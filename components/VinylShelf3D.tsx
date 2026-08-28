"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import { forwardRef, memo, Suspense, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";

// ---------------- shared texture cache + edge-colour sampler ----------------
// Loads the cover image once, returns the three.js Texture AND samples the
// average colour of the outer border so the sleeve's edges can be tinted to
// blend with the printed cover.
type LoadedCover = { texture: THREE.Texture; edgeColor: string };
const TEXTURE_CACHE = new Map<string, Promise<LoadedCover>>();

function sampleEdgeColor(img: HTMLImageElement): string {
  try {
    const SIZE = 48;
    const c = document.createElement("canvas");
    c.width = SIZE;
    c.height = SIZE;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "#888";
    ctx.drawImage(img, 0, 0, SIZE, SIZE);
    const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
    let r = 0,
      g = 0,
      b = 0,
      n = 0;
    // sample the outermost 2-pixel ring on each side
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const onEdge = x < 2 || x >= SIZE - 2 || y < 2 || y >= SIZE - 2;
        if (!onEdge) continue;
        const i = (y * SIZE + x) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
        n++;
      }
    }
    r = Math.round(r / n);
    g = Math.round(g / n);
    b = Math.round(b / n);
    const hex = (v: number) => v.toString(16).padStart(2, "0");
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  } catch {
    return "#888";
  }
}

function loadTextureCached(url: string): Promise<LoadedCover> {
  const hit = TEXTURE_CACHE.get(url);
  if (hit) return hit;
  const p = new Promise<LoadedCover>((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const texture = new THREE.Texture(img);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 8;
      texture.needsUpdate = true;
      const edgeColor = sampleEdgeColor(img);
      resolve({ texture, edgeColor });
    };
    img.onerror = (e) => reject(e);
    img.src = url;
  });
  TEXTURE_CACHE.set(url, p);
  return p;
}

// ---------------- easing helpers ----------------
const EASINGS = {
  linear: (x: number) => x,
  easeInCubic: (x: number) => x * x * x,
  easeOutCubic: (x: number) => 1 - Math.pow(1 - x, 3),
  easeInOutCubic: (x: number) =>
    x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2,
  easeOutQuart: (x: number) => 1 - Math.pow(1 - x, 4),
  easeOutQuint: (x: number) => 1 - Math.pow(1 - x, 5),
  easeInOutQuart: (x: number) =>
    x < 0.5 ? 8 * x * x * x * x : 1 - Math.pow(-2 * x + 2, 4) / 2,
  easeOutBack: (x: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
  },
} as const;
type EasingName = keyof typeof EASINGS;

type Props = {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  onActiveChange?: (v: Vinyl) => void;
  /** reports how wide the centred cover actually is, so the page can keep its
   *  side panels clear of it at any viewport */
  onCoverHalfWidth?: (px: number) => void;
  /**
   * Wallpaper mode: the shelf drifts on its own and answers to nothing.
   *
   * No wheel, no drag, no keys, no hover, no clicks — the landing puts this
   * behind its own content, and a background that steals the scroll or lifts a
   * sleeve under the cursor stops being a background.
   */
  ambient?: boolean;
  /**
   * The same rack, stood on its end.
   *
   * A phone is the wrong shape for a row you walk along and the wrong grip:
   * the thumb travels up and down. So the wheel turns vertically, the camera
   * climbs above the strip and looks down at it, and every sleeve lies face-up
   * in a pile with its printed edge toward you — the way records sit when you
   * take them out of the rack. Nothing else changes: same boxes, same spines,
   * same cardboard, same single number driving the whole thing.
   */
  vertical?: boolean;
  /** records per second of drift in ambient mode */
  drift?: number;
  /**
   * The handle, offered as a prop as well as through the ref.
   *
   * This component is loaded with next/dynamic so a phone never downloads the
   * 3D engine — and next/dynamic does not forward refs. The ref silently
   * stayed null, so goTo/open/close did nothing and clicking a sleeve stopped
   * opening it: no error, no warning, just a shelf that had quietly become
   * scenery. A plain prop crosses that boundary.
   */
  handleRef?: { current: VinylShelfHandle | null };
};

export type VinylShelfHandle = {
  goTo: (idx: number) => void;
  next: () => void;
  prev: () => void;
  open: (idx: number) => void;
  close: () => void;
};



const SLEEVE_W = 3;
const SLEEVE_H = 3;
const BACKGROUND = "#0a0a0a";
// reveal: each sleeve fades + rises into place once its cover has decoded,
// staggered outwards from the centre of the shelf.
const REVEAL_MS = 560;
const REVEAL_STAGGER_MS = 38;
const REVEAL_STAGGER_MAX = 300;


/**
 * The spine, printed.
 *
 * In a real crate you do not read covers — you read spines, because that is all
 * a shelved record shows you. Ours were a flat sliver of colour sampled from
 * the artwork, which looked right and said nothing, so the row of sleeves
 * behind the centred one carried no information at all.
 *
 * Drawn on a canvas rather than with 3D text: a spine is ink on cardboard, not
 * a geometry, and one 2048×128 texture costs a fraction of what a glyph mesh
 * per record would. The canvas is tall and narrow to match the face it lands
 * on — the box's px/nx faces are height × thickness — and the type is rotated
 * so it reads bottom-to-top, which is the convention on European pressings and
 * the way a head tilts at a shelf.
 *
 * The ink colour is derived from the sampled edge rather than fixed: a cream
 * sleeve needs dark type and a black one needs light, and guessing wrong makes
 * the text vanish exactly where it mattered.
 */
const spineTextureCache = new Map<string, THREE.CanvasTexture>();

/**
 * The app's own sans, not a guess at its name.
 *
 * next/font gives Inter a generated family (`__Inter_xxxx`) and exposes it as
 * a CSS variable. Asking a canvas for "Inter" therefore misses — unless the
 * machine happens to have Inter installed — and it silently falls back to
 * whatever the system offers, which is why the spines came out in a face
 * nobody chose. Reading the variable gets the real name.
 */
function appSans(): string {
  if (typeof window === "undefined") return "system-ui, sans-serif";
  const v = getComputedStyle(document.documentElement)
    .getPropertyValue("--font-geist-sans")
    .trim();
  return v ? `${v}, system-ui, sans-serif` : "system-ui, sans-serif";
}

/**
 * A canvas draws with whatever is loaded at that instant, and web fonts arrive
 * after first paint — so a texture built too early is baked in the fallback
 * and never corrects itself. This flips once, and the sleeves rebuild.
 */
function useFontReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (typeof document === "undefined" || !document.fonts) return setReady(true);
    let alive = true;
    document.fonts.ready.then(() => alive && setReady(true));
    return () => {
      alive = false;
    };
  }, []);
  return ready;
}

/**
 * Where the printing sits along the spine.
 *
 * Not centred: on a real sleeve the type sits above the middle, clear of the
 * shelf lip and closer to eye level. A fraction of the run, so it holds at any
 * sleeve size — flip the sign if it ends up below.
 */
const SPINE_SHIFT = 0.06;

function spineTexture(
  artist: string,
  title: string,
  edge: string,
  aspect: number,
  family: string,
): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;
  const key = `${artist}|${title}|${edge}|${aspect.toFixed(2)}|${family}`;
  const hit = spineTextureCache.get(key);
  if (hit) return hit;

  // The canvas has to match the face it lands on or the glyphs are squeezed:
  // a 16:1 texture stretched across a 100:1 spine flattens the type to a sixth
  // of its width. Derived from the geometry rather than hardcoded, so it stays
  // right if the sleeve ever changes thickness.
  const LONG = 4096;
  const SHORT = Math.max(24, Math.round(LONG / aspect));
  const canvas = document.createElement("canvas");
  canvas.width = SHORT;
  canvas.height = LONG;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const { bg, ink, halo } = spineInk(edge);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SHORT, LONG);

  ctx.translate(SHORT / 2, LONG / 2);
  ctx.rotate(-Math.PI / 2); // reads bottom-to-top, as European pressings do
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ink;

  /**
   * One size for every spine on the shelf.
   *
   * Shrinking the type until a long title fitted meant every sleeve was set
   * differently — "Rumours" at full size beside "Dune: Part Two (Original
   * Motion Picture Soundtrack)" at half — and the same weight reads heavier
   * at a larger size, so the row looked like a mix of bold and light. A real
   * crate is printed at one size and the long names are the ones that get
   * abbreviated. Same here: fixed cap height, and what does not fit is cut.
   */
  const size = Math.round(SHORT * 0.52);
  ctx.font = `600 ${size}px ${family}`;
  ctx.letterSpacing = `${Math.max(1, Math.round(size * 0.06))}px`;

  const room = LONG - 220;
  const full = `${artist.toUpperCase()}   ·   ${title}`;
  let text = full;
  if (ctx.measureText(text).width > room) {
    // the artist survives whole; the title is what gives way
    let t = title;
    while (t.length > 4 && ctx.measureText(`${artist.toUpperCase()}   ·   ${t}…`).width > room) {
      t = t.slice(0, -1);
    }
    text = `${artist.toUpperCase()}   ·   ${t.trimEnd()}…`;
    // an artist so long there is no room for a title at all: keep the artist
    if (ctx.measureText(text).width > room) {
      let a = artist.toUpperCase();
      while (a.length > 4 && ctx.measureText(`${a}…`).width > room) a = a.slice(0, -1);
      text = `${a.trimEnd()}…`;
    }
  }

  // after the rotation, the run of the spine is this axis
  const x = LONG * SPINE_SHIFT;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(2, size * 0.14);
  ctx.strokeStyle = halo;
  ctx.strokeText(text, x, 0);
  ctx.fillText(text, x, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  spineTextureCache.set(key, tex);
  return tex;
}

/**
 * Ink that can actually be read on this particular cardboard.
 *
 * Choosing black or white from a luminance threshold fails in the middle: a
 * mid-grey sleeve is far from both, and whichever you pick is roughly as
 * unreadable as the other. So the two candidates are compared by actual
 * contrast ratio, and when even the better one is too low, the spine itself is
 * pushed away from the ink until it isn't — the sampled colour is a starting
 * point, not a constraint. Legibility wins over fidelity to the sleeve.
 */
function spineInk(edge: string): { bg: string; ink: string; halo: string } {
  const hex = edge.replace("#", "");
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  let rgb = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) || 0);

  // sRGB has to be linearised before luminance means anything
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  const scale = (c: number[], k: number) =>
    c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));

  /**
   * Keep the ground out of the extremes before anything else.
   *
   * The spine is a lit surface in a 3D scene, and MeshStandardMaterial
   * multiplies the texture by the light hitting it. A pale sampled edge —
   * Dune's cream, say — arrives at the eye blown to near-white, and the
   * contrast so carefully computed here is destroyed after the fact by a lamp.
   * Holding the ground in a mid band leaves the lighting somewhere to go in
   * both directions, and keeps the sleeve's hue while doing it.
   */
  const L0 = lum(rgb);
  if (L0 > 0.34) rgb = scale(rgb, Math.sqrt(0.34 / L0));
  // Only near-black is lifted, and barely: a dark navy spine has all the
  // contrast it needs against light ink, and brightening it would just make
  // the shelf look like it had been washed.
  else if (L0 < 0.015) rgb = scale(rgb, 1.5);

  const dark = 0.02, light = 0.9;
  const useDark = ratio(lum(rgb), dark) >= ratio(lum(rgb), light);

  let guard = 0;
  while (ratio(lum(rgb), useDark ? dark : light) < 4.5 && guard++ < 24) {
    rgb = rgb.map((v) => (useDark ? Math.min(255, v + 8) : Math.max(0, v - 8)));
  }

  const toHex = (c: number[]) =>
    "#" + c.map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");

  return {
    bg: toHex(rgb),
    ink: useDark ? "rgba(10,10,10,0.95)" : "rgba(250,248,244,0.95)",
    // A thin outline in the ground's own tone, pushed further from the ink.
    // Lighting can lift or crush the whole surface and the glyph still has an
    // edge, because the edge travels with it.
    halo: useDark
      ? "rgba(255,255,255,0.55)"
      : "rgba(0,0,0,0.6)",
  };
}

const VinylShelf3D = forwardRef<VinylShelfHandle, Props>(function VinylShelf3D(
  {
    vinilos,
    onOpen,
    onActiveChange,
    onCoverHalfWidth,
    ambient = false,
    vertical = false,
    drift = 0.09,
    handleRef,
  },
  ref,
) {
  // animation tuning (fixed)
  const tuning = {
    openDuration: 1600,
    moveSplit: 0.45,
    flipOverlap: 0.4, // start the flip much earlier — overlaps most of the lift
    hoverSpring: 0.04,
    hoverLift: 0.08,
  };
  const moveEasing: EasingName = "easeInOutQuart";
  const flipEasing: EasingName = "easeInOutCubic";

  // fixed visual params
  const zoom = 8;
  const camX = 0;
  const camY = 0.3;
  /**
   * Light comes from where the viewer is.
   *
   * The rack is lit from in front because that is where you stand. Leaning
   * over a pile, the same two lamps sit below the horizon and the near end of
   * the stack — the part closest to you — goes black. So in vertical they
   * climb with the camera and look down with it.
   */
  const lights = vertical
    ? {
        /**
         * Lit like a room, not like a photo shoot.
         *
         * The rack's lamps are strong because a sleeve stood on edge shows you
         * almost nothing and needs the help. Lying open toward the camera it
         * shows you everything, and the same intensities blew the white covers
         * out to paper — the printing disappeared and the cardboard read as
         * plastic. Most of the light is ambient now, with one soft key from
         * above to keep the edges of the stack readable, and the second lamp
         * only fills the shadow it casts.
         */
        ambient: 1.15,
        light1X: 2.5,
        light1Y: 9,
        light1Z: 8,
        light1Intensity: 1.5,
        light2X: -4,
        light2Y: 5,
        light2Z: 10,
        light2Intensity: 0.9,
      }
    : {
    ambient: 1.6,
    light1X: 2,
    light1Y: 0,
    light1Z: 14,
    light1Intensity: 4,
    light2X: -2,
    light2Y: 0,
    light2Z: 14,
    light2Intensity: 4,
      };
  /**
   * Looking down at a pile needs a wider lens than looking along a rack.
   *
   * A phone in portrait is 0.46 as wide as it is tall, and a 28° vertical
   * field of view leaves barely 13° across — at which point a 3-unit sleeve
   * has to be seventeen units away to fit, and the perspective flattens into
   * an elevation drawing. Widening the lens keeps the camera close enough for
   * the pile to have depth in it.
   */
  const fov = vertical ? 40 : 28;
  /**
   * The wheel.
   *
   * Every sleeve is glued by its bottom edge to the rim of a wheel whose axle
   * runs left to right behind the screen, and sticks out from it like the
   * paddle of a water wheel. The one at the top of the wheel stands up facing
   * you — that is the record you are on. Turning the wheel tips it over toward
   * you while the next one rises behind it.
   *
   * This is why it is not the pile it was a moment ago: on a wheel a sleeve's
   * angle and its position are not two things to keep in step, they are one
   * number. There is nothing to get out of sync because there is nothing to
   * sync.
   *
   * The radius is large on purpose. A small wheel is a carousel: the sleeves
   * splay out like a fan and you are looking at the mechanism. A large one is
   * nearly a straight line with a curve in it, which is what a stack of
   * records leaning against each other actually looks like.
   */
  const WHEEL_R = 9;
  /** distance along the rim from one sleeve to the next, in world units */
  const WHEEL_STEP = 1.5;
  /** every sleeve leans this much further forward than the rim does */
  const WHEEL_LEAN = 0.16;
  /** how far above the axle the camera sits, in radians */
  const CENITAL = 0.18;
  // horizontally the strip sits below the eye line so the covers read against
  // the empty top half; looking down at a pile there is no "below" to use
  const stripY = vertical ? 0 : -1.1;
  const spacing = 0.45;
  const visibleX = 6;
  const fanStrength = 0.08;
  const maxOpen = 1.3;
  /**
   * Fog measured from where the camera actually is.
   *
   * Fixed distances were fine while the camera never moved; leaning over the
   * pile puts it eleven units out, which is past the old far plane — the whole
   * stack came out black. The haze still has to be there (it is what makes the
   * far end of the pile recede) so it travels with the camera instead.
   */
  const fogNear = vertical ? 9 : 6;
  const fogFar = vertical ? 20 : 11;
  // glossier than the cardboard sides so light catches highlights on the cover
  // Flat to the camera, the clearcoat highlight lands square in the middle of
  // the artwork; angled away on the rack it never does. So the pile gets a
  // duller finish — matte sleeve rather than gallery glass.
  const coverRoughness = vertical ? 0.62 : 0.35;
  const coverMetalness = vertical ? 0 : 0.05;
  const cardboardRoughness = 0.9;
  // A real LP sleeve is about 5mm across a 315mm face — roughly 1 in 63. This
  // was 1 in 100, thinner than any record ever pressed, which left the spine
  // too narrow to print anything legible on.
  /**
   * The pile is thicker than the rack, and it is not a lie about the object.
   *
   * A sleeve in a rack is seen along its spine, where 5mm on a 315mm face is
   * exactly right and any more reads as a box set. Lying in a pile you see the
   * edge almost flat on, foreshortened to a couple of pixels, and at the real
   * ratio the cardboard disappears — the stack turns back into stacked
   * photographs. The extra is buying back what the viewing angle takes away.
   */
  const thickness = vertical ? 0.085 : 0.05;

  // scroll target in INDEX space (floating-point). At t=0, item 0 is at x=0.
  const target = useRef(0);
  const current = useRef(0);
  const [active, setActive] = useState(0);
  // open state — 0 = closed (carousel), 1 = fully opened (cover face-on)
  const openTarget = useRef(0);
  const openProgress = useRef(0);
  const [openIdx, setOpenIdx] = useState<number | null>(null);



  const LOOP_THRESHOLD = 8;
  const goToIdx = (idx: number) => {
    const N = lengthRef.current;
    if (N <= LOOP_THRESHOLD) {
      target.current = Math.max(0, Math.min(N - 1, idx));
      return;
    }
    const cur = target.current;
    const curMod = ((cur % N) + N) % N;
    const delta = ((idx - curMod + N + N / 2) % N) - N / 2;
    target.current = cur + delta;
  };

  const stepTarget = (dir: 1 | -1) => {
    const N = lengthRef.current;
    const next = Math.round(target.current) + dir;
    target.current = N <= LOOP_THRESHOLD ? Math.max(0, Math.min(N - 1, next)) : next;
  };

  // handleRef wins when it is there: through next/dynamic it is the only one
  // that actually arrives
  useImperativeHandle(
    handleRef ?? ref,
    () => ({
      goTo: goToIdx,
      next: () => stepTarget(1),
      prev: () => stepTarget(-1),
      open: (idx: number) => {
        goToIdx(idx);
        openTarget.current = 1;
        setOpenIdx(idx);
      },
      close: () => {
        openTarget.current = 0;
        setOpenIdx(null);
      },
    }),
    [vinilos.length],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  // keep the latest list length in a ref so the input handlers (mounted once
  // on first effect) always read the up-to-date value after a collection
  // switch or vinyls add/remove.
  const lengthRef = useRef(vinilos.length);
  useEffect(() => {
    lengthRef.current = vinilos.length;
    // also clamp any in-flight scroll position into the new range so a
    // collection change can't leave the carousel pointing at empty space
    if (vinilos.length > 0 && vinilos.length <= 8) {
      target.current = Math.max(0, Math.min(vinilos.length - 1, target.current));
      current.current = Math.max(0, Math.min(vinilos.length - 1, current.current));
    }
  }, [vinilos.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || ambient) return;

    const clampToList = (v: number) => {
      const N = lengthRef.current;
      if (N > LOOP_THRESHOLD) return v;
      return Math.max(0, Math.min(N - 1, v));
    };

    // The shelf must never come to rest between two records: after the last
    // wheel event it magnetises to the nearest one, like a detented dial.
    let snapTimer: ReturnType<typeof setTimeout> | null = null;
    const snapToNearest = () => {
      snapTimer = null;
      if (openTarget.current > 0) return;
      target.current = clampToList(Math.round(target.current));
    };
    const scheduleSnap = () => {
      if (snapTimer) clearTimeout(snapTimer);
      snapTimer = setTimeout(snapToNearest, 90);
    };

    const onWheel = (e: WheelEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // let scrolling pass through inside any overlay that opts in
      if (t.closest("[data-scrollable]")) return;
      if (openTarget.current > 0) return;
      e.preventDefault();
      const delta = vertical
        ? e.deltaY
        : Math.abs(e.deltaX) > Math.abs(e.deltaY)
          ? e.deltaX
          : e.deltaY;
      target.current = clampToList(target.current + delta * 0.005);
      scheduleSnap();
    };
    // attach to window so overlays / backdrops don't block scrolling
    window.addEventListener("wheel", onWheel, { passive: false });

    // drag: listen pointerdown on el (so we only start drag inside the shelf),
    // but pointermove/up on window so we don't capture/intercept the pointer
    // and r3f can still receive its synthesized click events on the canvas.
    let startX = 0;
    let startT = 0;
    let dragging = false;
    let moved = false;
    // the axis the strip runs along is the axis the finger works on
    const axisOf = (e: PointerEvent) => (vertical ? e.clientY : e.clientX);
    const onDown = (e: PointerEvent) => {
      if (openTarget.current > 0) return; // no drag while opened
      dragging = true;
      moved = false;
      startX = axisOf(e);
      startT = target.current;
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = axisOf(e) - startX;
      if (Math.abs(dx) > 4) moved = true;
      // The records go where the finger goes. Dragging down on a rack pulls
      // the row rightwards past you, which is why the horizontal sign is
      // negative; dragging down on a pile pushes the pile down, and inverting
      // that is the difference between holding an object and operating a
      // control.
      target.current = clampToList(startT + (vertical ? dx : -dx) * 0.01);
    };
    const onUp = () => {
      if (!dragging) return;
      dragging = false;
      target.current = clampToList(Math.round(target.current));
      if (moved) {
        // swallow the synthetic click that follows a drag
        const stop = (ev: Event) => {
          ev.stopPropagation();
          ev.preventDefault();
          window.removeEventListener("click", stop, true);
        };
        window.addEventListener("click", stop, true);
      }
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    const onKey = (e: KeyboardEvent) => {
      if (openTarget.current > 0) return;
      const fwd = vertical ? "ArrowDown" : "ArrowRight";
      const back = vertical ? "ArrowUp" : "ArrowLeft";
      if (e.key === fwd) target.current = clampToList(Math.round(target.current) + 1);
      else if (e.key === back) target.current = clampToList(Math.round(target.current) - 1);
    };
    window.addEventListener("keydown", onKey);

    return () => {
      if (snapTimer) clearTimeout(snapTimer);
      window.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
    };
  }, [ambient, vertical]);

  useEffect(() => {
    onActiveChange?.(vinilos[active]);
  }, [active, vinilos, onActiveChange]);

  return (
    <div
      ref={containerRef}
      className={`relative select-none touch-none ${
        ambient ? "h-full w-full" : "h-screen w-screen"
      }`}
      style={{ cursor: ambient ? "default" : "grab", pointerEvents: ambient ? "none" : undefined }}
    >
      <Canvas
        // wallpaper doesn't earn retina pixels, and this runs every frame
        // behind someone's landing page
        dpr={ambient ? 1 : [1, 1.5]}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: vertical ? 0.98 : 1.2,
          powerPreference: "high-performance",
          antialias: true,
        }}
      >
        {/* Standing in front of a rack, or leaning over a pile. 46° is the
            angle at which a stack still reads as a stack: flatter and the
            covers are hidden behind each other, steeper and the printed edges
            — the only thing you can read while they are stacked — disappear. */}
        {/* Standing in front of a rack, or leaning over a pile. The distance
            is not a taste decision: it is whatever puts a sleeve across most
            of the screen at this lens and this aspect, so the shelf fills a
            phone the same way it fills a desktop. */}
        <PerspectiveCamera makeDefault position={[camX, camY, zoom]} fov={fov} />
        <color attach="background" args={["#0a0a0a"]} />
        <FogRig openProgressRef={openProgress} near={fogNear} far={fogFar} />
        <ambientLight intensity={lights.ambient} />
        <AnimatedLight
          openProgressRef={openProgress}
          fromPos={[lights.light1X, lights.light1Y, lights.light1Z]}
          fromIntensity={lights.light1Intensity}
          toPos={[2, 0, 14]}
          toIntensity={0}
        />
        <AnimatedLight
          openProgressRef={openProgress}
          fromPos={[lights.light2X, lights.light2Y, lights.light2Z]}
          fromIntensity={lights.light2Intensity}
          toPos={[-7.5, 0.5, 14]}
          toIntensity={2}
        />
        <CameraRig
          openProgressRef={openProgress}
          baseZ={zoom}
          fov={fov}
          vertical={vertical}
          cenital={CENITAL}
          onCoverHalfWidth={onCoverHalfWidth}
        />

        <Suspense fallback={null}>
          <Strip
            ambient={ambient}
            vertical={vertical}
            wheelR={WHEEL_R}
            wheelStep={WHEEL_STEP}
            wheelLean={WHEEL_LEAN}
            drift={drift}
            vinilos={vinilos}
            targetRef={target}
            currentRef={current}
            openTargetRef={openTarget}
            openProgressRef={openProgress}
            onSettle={setActive}
            onClick={onOpen}
            stripY={stripY}
            spacing={spacing}
            visibleX={visibleX}
            fanStrength={fanStrength}
            maxOpen={maxOpen}
            thickness={thickness}
            coverRoughness={coverRoughness}
            coverMetalness={coverMetalness}
            cardboardRoughness={cardboardRoughness}
            openDuration={tuning.openDuration}
            moveSplit={tuning.moveSplit}
            flipOverlap={tuning.flipOverlap}
            moveEasing={moveEasing}
            flipEasing={flipEasing}
            hoverSpring={tuning.hoverSpring}
            hoverLift={tuning.hoverLift}
          />
        </Suspense>
      </Canvas>
    </div>
  );
});

// Memoised: the page re-renders on every playback tick, and without this the
// whole scene tree would be reconciled each time — the transport animation
// stuttered against it.
export default memo(VinylShelf3D);

function Strip({
  ambient,
  vertical,
  wheelR,
  wheelStep,
  wheelLean,
  drift,
  vinilos,
  targetRef,
  currentRef,
  openTargetRef,
  openProgressRef,
  onSettle,
  onClick,
  stripY,
  spacing,
  visibleX,
  fanStrength,
  maxOpen,
  thickness,
  coverRoughness,
  coverMetalness,
  cardboardRoughness,
  openDuration,
  moveSplit,
  flipOverlap,
  moveEasing,
  flipEasing,
  hoverSpring,
  hoverLift,
}: {
  ambient: boolean;
  vertical: boolean;
  wheelR: number;
  wheelStep: number;
  wheelLean: number;
  drift: number;
  vinilos: Vinyl[];
  targetRef: React.MutableRefObject<number>;
  currentRef: React.MutableRefObject<number>;
  openTargetRef: React.MutableRefObject<number>;
  openProgressRef: React.MutableRefObject<number>;
  onSettle: (idx: number) => void;
  onClick: (v: Vinyl) => void;
  stripY: number;
  spacing: number;
  visibleX: number;
  fanStrength: number;
  maxOpen: number;
  thickness: number;
  coverRoughness: number;
  coverMetalness: number;
  cardboardRoughness: number;
  openDuration: number;
  moveSplit: number;
  flipOverlap: number;
  moveEasing: EasingName;
  flipEasing: EasingName;
  hoverSpring: number;
  hoverLift: number;
}) {
  const lastIdx = useRef(-1);
  const N = vinilos.length;

  // No more blocking pre-load of all textures — each Sleeve loads its own
  // imperatively, with a palette-colour fallback while pending.

  // loop only if the collection is big enough — otherwise users would see
  // the same 5 vinyls repeated again right next to themselves
  const LOOP_THRESHOLD = 8;
  const enableLoop = N > LOOP_THRESHOLD;
  const copies = enableLoop ? Math.max(1, Math.ceil((2 * visibleX) / (N * spacing))) : 1;
  const modulus = enableLoop ? N * copies : Number.POSITIVE_INFINITY;

  const stripGroupRef = useRef<THREE.Group>(null);
  // Only ONE sleeve can be under the cursor. r3f's pointerOut doesn't always
  // arrive (the sleeve slides away, the pointer leaves over a DOM overlay…),
  // which used to leave sleeves stuck in hover and visibly raised several
  // positions away from the centre. A single shared id makes that impossible.
  const hoveredRef = useRef<number | null>(null);

  // track the cursor so we can re-fire pointermove on the canvas every time
  // the carousel moves — otherwise r3f wouldn't update hover state for the
  // sleeve passing under a stationary cursor.
  const { gl } = useThree();
  const pointerXY = useRef({ x: -10000, y: -10000, inside: false });
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointerXY.current.x = e.clientX;
      pointerXY.current.y = e.clientY;
      pointerXY.current.inside = true;
    };
    const onLeave = () => {
      pointerXY.current.inside = false;
      hoveredRef.current = null;
    };
    if (ambient) return;
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, [ambient]);
  const lastCurrent = useRef(0);

  const tweenRef = useRef({
    from: 0,
    to: 0,
    startTime: 0,
    lastTarget: 0,
  });

  useFrame((_, delta) => {
    // Wallpaper: one continuous slide, never settling on a record. Driving
    // `current` straight off the clock keeps the speed even — the spring the
    // interactive shelf uses would ease towards a target that never arrives.
    if (ambient) {
      targetRef.current += drift * Math.min(delta, 0.1);
      currentRef.current = targetRef.current;
      return;
    }
    // while opened, snap directly to the new vinyl (no inter-vinyl animation)
    if (openTargetRef.current > 0) {
      currentRef.current = targetRef.current;
    } else {
      currentRef.current += (targetRef.current - currentRef.current) * 0.12;
    }

    const t = tweenRef.current;
    if (openTargetRef.current !== t.lastTarget) {
      t.from = openProgressRef.current;
      t.to = openTargetRef.current;
      t.startTime = performance.now();
      t.lastTarget = openTargetRef.current;
    }
    const elapsed = performance.now() - t.startTime;
    const p = Math.min(1, elapsed / openDuration);
    openProgressRef.current = t.from + (t.to - t.from) * p;

    // strip drop: ease the position itself within the SAME phase as the move
    // phase, so the carousel decelerates smoothly into its dropped position
    if (stripGroupRef.current) {
      const open = openProgressRef.current;
      const movePhaseRaw = Math.min(1, open / moveSplit);
      const movePhaseEased = EASINGS[moveEasing](movePhaseRaw);
      stripGroupRef.current.position.y = stripY - movePhaseEased * 3;
    }

    const idx = ((Math.round(currentRef.current) % N) + N) % N;
    if (idx !== lastIdx.current) {
      lastIdx.current = idx;
      onSettle(idx);
    }

    // if the carousel is moving and the cursor is on-screen, fire a synthetic
    // pointermove so r3f re-raycasts and updates hover state for whichever
    // sleeve has just slid under the cursor.
    const movedEnough = Math.abs(currentRef.current - lastCurrent.current) > 0.0005;
    lastCurrent.current = currentRef.current;
    // Only re-raycast when the cursor is actually over the canvas. Without this
    // check the synthetic move ignores the DOM chrome on top, so resting the
    // pointer on the transport buttons hover-lifted whichever sleeve happened
    // to sit behind them.
    const overCanvas =
      pointerXY.current.inside &&
      document.elementFromPoint(pointerXY.current.x, pointerXY.current.y) ===
        gl.domElement;
    if (!overCanvas && hoveredRef.current !== null) {
      hoveredRef.current = null;
      document.body.style.cursor = "";
    }
    if (movedEnough && overCanvas) {
      gl.domElement.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          pointerId: 1,
          pointerType: "mouse",
          clientX: pointerXY.current.x,
          clientY: pointerXY.current.y,
        }),
      );
    }
  });

  return (
    <group ref={stripGroupRef} position={[0, stripY, 0]}>
      {vinilos.flatMap((v, i) =>
        Array.from({ length: copies }, (_, c) => (
          <Sleeve
            key={`${v.id}-${c}`}
            vinyl={v}
            vertical={vertical}
            wheelR={wheelR}
            wheelStep={wheelStep}
            wheelLean={wheelLean}
            baseIndex={i + c * N}
            modulus={modulus}
            currentRef={currentRef}
            openProgressRef={openProgressRef}
            spacing={spacing}
            visibleX={visibleX}
            fanStrength={fanStrength}
            maxOpen={maxOpen}
            thickness={thickness}
            coverRoughness={coverRoughness}
            coverMetalness={coverMetalness}
            cardboardRoughness={cardboardRoughness}
            moveSplit={moveSplit}
            flipOverlap={flipOverlap}
            moveEasing={moveEasing}
            flipEasing={flipEasing}
            hoverSpring={hoverSpring}
            hoverLift={hoverLift}
            hoveredRef={hoveredRef}
            onClick={() => onClick(v)}
          />
        )),
      )}
    </group>
  );
}

function Sleeve({
  vinyl,
  vertical,
  wheelR,
  wheelStep,
  wheelLean,
  baseIndex,
  modulus,
  currentRef,
  openProgressRef,
  spacing,
  visibleX,
  fanStrength,
  maxOpen,
  thickness,
  coverRoughness,
  coverMetalness,
  cardboardRoughness,
  moveSplit,
  flipOverlap,
  moveEasing,
  flipEasing,
  hoverSpring,
  hoverLift,
  hoveredRef,
  onClick,
}: {
  vinyl: Vinyl;
  vertical: boolean;
  wheelR: number;
  wheelStep: number;
  wheelLean: number;
  baseIndex: number;
  modulus: number;
  currentRef: React.MutableRefObject<number>;
  openProgressRef: React.MutableRefObject<number>;
  spacing: number;
  visibleX: number;
  fanStrength: number;
  maxOpen: number;
  thickness: number;
  coverRoughness: number;
  coverMetalness: number;
  cardboardRoughness: number;
  moveSplit: number;
  flipOverlap: number;
  moveEasing: EasingName;
  flipEasing: EasingName;
  hoverSpring: number;
  hoverLift: number;
  hoveredRef: React.MutableRefObject<number | null>;
  onClick: () => void;
}) {
  const url = useMemo(() => coverFor(vinyl), [vinyl]);
  // lazy texture loading + edge-colour sampling — palette fallback while pending
  const [texture, setTexture] = useState<THREE.Texture | null>(null);
  const [sampledEdge, setSampledEdge] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    loadTextureCached(url)
      .then(({ texture: t, edgeColor }) => {
        if (cancelled) return;
        setTexture(t);
        setSampledEdge(edgeColor);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [url]);

  // Edge slivers: instead of cloning the texture 4× per vinyl (heavy on
  // memory + draw calls), use a solid colour pulled from the cover's palette.
  // Visually it's still cardboard-like and indistinguishable at carousel
  // viewing distance, but ~5× fewer texture units per vinyl.
  // edge colour: prefer the colour sampled from the cover's border pixels
  // (best blend with the printed art), fall back to palette while loading
  // While the cover is still decoding the sleeve is fully transparent, so the
  // placeholder colour must read as "background", never as a light grey box.
  const edgeColor = sampledEdge ?? BACKGROUND;
  const edgeMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: edgeColor,
        roughness: cardboardRoughness,
      }),
    [edgeColor, cardboardRoughness],
  );
  // The two spines carry the printed name; top and bottom stay bare cardboard,
  // because that is what they are. Built only once the edge colour has been
  // sampled — printing on the placeholder would mean redrawing every sleeve
  // the moment its cover decoded.
  const fontReady = useFontReady();
  const spineMaterial = useMemo(() => {
    const map =
      sampledEdge && fontReady
        ? spineTexture(
            vinyl.artist,
            vinyl.title,
            sampledEdge,
            SLEEVE_H / thickness,
            appSans(),
          )
        : null;
    return new THREE.MeshStandardMaterial({
      map,
      color: map ? "#ffffff" : edgeColor,
      roughness: cardboardRoughness,
    });
  }, [sampledEdge, fontReady, vinyl.artist, vinyl.title, edgeColor, cardboardRoughness, thickness]);

  const matRight = spineMaterial;
  const matLeft = spineMaterial;
  const matTop = edgeMaterial;
  const matBottom = edgeMaterial;
  // PhysicalMaterial w/ a touch of clearcoat → simulates the gloss laminate
  // of a real album sleeve so light catches highlights without washing out
  const portada = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        map: texture ?? null,
        color: texture ? "#ffffff" : edgeColor,
        roughness: coverRoughness,
        metalness: coverMetalness,
        clearcoat: 0.4,
        clearcoatRoughness: 0.25,
      }),
    [texture, edgeColor, coverRoughness, coverMetalness],
  );
  const contra = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        map: texture ?? null,
        color: texture ? "#666" : edgeColor,
        roughness: 0.7,
        metalness: 0,
      }),
    [texture, edgeColor],
  );
  const materials = useMemo(
    () => [matRight, matLeft, matTop, matBottom, portada, contra],
    [matRight, matLeft, matTop, matBottom, portada, contra],
  );

  const meshGroupRef = useRef<THREE.Group>(null);
  /** where this sleeve is on the wheel, kept for the visibility test below */
  const phiRef = useRef(0);
  const hoverRef = useRef(0); // 0..1 smooth hover progress
  // reveal 0..1 — driven once the cover texture is ready, so a sleeve is never
  // shown as an empty box waiting for its image
  const revealRef = useRef(0);
  const revealStartRef = useRef<number | null>(null);
  const transparentRef = useRef(false);

  useFrame(() => {
    if (!meshGroupRef.current) return;
    // wrap the position to [-modulus/2, modulus/2) so the vinyl quietly loops
    let delta = (baseIndex - currentRef.current) % modulus;
    if (delta > modulus / 2) delta -= modulus;
    if (delta < -modulus / 2) delta += modulus;
    const x = delta * spacing;

    // ---- reveal (fade + rise), staggered outwards from the centre ----
    if (texture && revealStartRef.current === null) {
      revealStartRef.current =
        performance.now() +
        Math.min(REVEAL_STAGGER_MAX, Math.abs(x) * REVEAL_STAGGER_MS);
    }
    if (revealStartRef.current !== null && revealRef.current < 1) {
      const p = Math.max(
        0,
        Math.min(1, (performance.now() - revealStartRef.current) / REVEAL_MS),
      );
      revealRef.current = EASINGS.easeOutCubic(p);
    }
    const reveal = revealRef.current;
    if (reveal < 1) {
      // Fading in, but STILL writing depth: three.js draws transparent meshes
      // back-to-front without it, so the fanned sleeves showed through each
      // other and read as overlapping — worst on the crowded right-hand side.
      transparentRef.current = true;
      for (const m of materials) {
        m.transparent = true;
        m.depthWrite = true;
        m.opacity = reveal;
      }
    } else if (transparentRef.current) {
      // settled: back to opaque so the strip renders/sorts as usual
      transparentRef.current = false;
      for (const m of materials) {
        m.transparent = false;
        m.opacity = 1;
        m.depthWrite = true;
      }
    }
    if (reveal <= 0.001) {
      if (meshGroupRef.current.visible) meshGroupRef.current.visible = false;
      return;
    }

    // fast skip: sleeves comfortably off-screen don't need per-frame math.
    // We only check 1 unit beyond visibleX to allow margin for the lift.
    if (Math.abs(x) > visibleX + 1) {
      if (meshGroupRef.current.visible) meshGroupRef.current.visible = false;
      return;
    }
    if (!meshGroupRef.current.visible) meshGroupRef.current.visible = true;

    const open = openProgressRef.current;
    // staged animation, each phase eased separately. flipOverlap brings the
    // start of the flip BEFORE the lift finishes, so the rotation is already
    // underway as the sleeve settles into the centre.
    const flipStart = Math.max(0, moveSplit - flipOverlap);
    const movePhaseRaw = Math.min(1, open / moveSplit);
    const flipPhaseRaw = Math.max(0, (open - flipStart) / (1 - flipStart));
    const movePhase = EASINGS[moveEasing](movePhaseRaw);
    const flipPhase = EASINGS[flipEasing](flipPhaseRaw);

    const tilt = Math.sign(x) * Math.min(maxOpen, Math.abs(x) * fanStrength);
    /**
     * The closed pose, which is the whole difference between the two shelves.
     *
     * Standing in a rack, a sleeve is turned a quarter turn about its vertical
     * axis: spine out, cover to the side. Lying in a pile it is turned the
     * same quarter turn about its horizontal one: cover up, printed edge
     * toward you. Same rotation, different axis — and opening it is the same
     * move undone in both cases, which is why one number still drives it all.
     */
    const baseRot = (vertical ? -Math.PI / 2 : Math.PI / 2) + tilt;

    const centerWeight = Math.max(0, 1 - Math.abs(x) / (spacing * 0.6));

    // Two sources of lift, smoothed differently on purpose:
    //   spotlight — a pure function of the distance to the centre, so the lift
    //   travels with the shelf. Springing it left the previous sleeve still
    //   raised several positions behind while you kept pressing Next.
    //   cursor — springs, because it switches on and off abruptly.
    const spotlight = Math.max(0, Math.min(1, (centerWeight - 0.35) / 0.5));
    const cursorOver = hoveredRef.current === baseIndex;
    hoverRef.current += ((cursorOver ? 1 : 0) - hoverRef.current) * hoverSpring;

    // Sharp flip: only sleeves VERY close to center (|x| < spacing * 0.15)
    // are flipped — sleeves moving in or out of the centre stay spine-forward
    // (slim profile) so they never sweep through neighbours.  Achieved with a
    // steep power curve on centerWeight: low centerWeight → ~0, only spikes
    // close to 1.
    const flipReadyness = Math.pow(centerWeight, 5);
    const flipFactor = flipPhase * flipReadyness;
    if (vertical) meshGroupRef.current.rotation.x = baseRot * (1 - flipFactor);
    else meshGroupRef.current.rotation.y = baseRot * (1 - flipFactor);

    // hover lift fades out as we open
    // easeInOutQuint — strong S-curve, very soft entry AND exit
    const h = Math.max(spotlight, hoverRef.current);
    const hoverEased =
      h < 0.5 ? 16 * h * h * h * h * h : 1 - Math.pow(-2 * h + 2, 5) / 2;
    const hoverLiftValue = hoverEased * hoverLift * (1 - open);
    // lift uses a softer curve so neighbours still rise nicely as they slide
    // toward centre — only the FLIP is sharply gated, not the lift itself
    const liftReadyness = Math.pow(centerWeight, 1.4);
    // the reveal also lifts the sleeve the last few millimetres into the strip
    const lift = movePhase * liftReadyness * 4.4 + hoverLiftValue - (1 - reveal) * 0.3;
    if (vertical) {
      /**
       * One number: where this sleeve sits on the rim.
       *
       * φ = 0 is the top of the wheel, where the sleeve stands upright facing
       * the camera. Positive φ has already tipped toward you; negative is
       * still rising behind. Position and rotation both come from it, which is
       * what makes the motion read as one object turning rather than as a list
       * of things being animated in parallel.
       */
      const phi = (x / spacing) * (wheelStep / wheelR);
      const sin = Math.sin(phi);
      const cos = Math.cos(phi);
      /**
       * Glued flat to the rim, not sticking out of it.
       *
       * The first version had them radiating outward like the paddles of a
       * water wheel, and a large wheel then throws them straight at the lens:
       * near the top the rim runs almost parallel to the line of sight, so the
       * sleeves travelled toward the camera instead of across the screen.
       *
       * Lying flat on the rim — the bottom edge touching it, the sleeve
       * following the curve upward like a roof tile — the one at the front
       * faces you square on, and its neighbours lean progressively away as the
       * surface curves out from under them. That is the shape a stack of
       * records leaning against each other has, and it is what the wheel is
       * for.
       */
      const r = wheelR + lift * 0.12;
      meshGroupRef.current.position.set(
        0,
        r * sin + (SLEEVE_H / 2) * cos - SLEEVE_H / 2,
        r * cos - (SLEEVE_H / 2) * sin - wheelR,
      );
      /**
       * A constant lean on top of the wheel's own angle.
       *
       * Sitting exactly tangent, the record at the front is dead vertical and
       * the pile reads as a wall of squares. Tipping every sleeve a little
       * further forward — the top toward you — is what a row of records
       * leaning on each other in a crate actually does, and it puts a sliver
       * of the cardboard edge back in view under each one.
       */
      meshGroupRef.current.rotation.set(-phi + wheelLean, 0, 0);
      phiRef.current = phi;
    } else {
      meshGroupRef.current.position.x = x;
      meshGroupRef.current.position.y = lift;
      meshGroupRef.current.position.z = 0;
    }
    const s = 0.97 + reveal * 0.03;
    meshGroupRef.current.scale.set(s, s, 1);

    // non-active sleeves fade away while opened
    const opacityFactor = open > 0.05
      ? (centerWeight > 0.5 ? 1 : 1 - open * 0.95)
      : 1;
    // On the wheel the cull is angular: past a right angle a sleeve is edge-on
    // to the camera and then behind the axle, and there is nothing to draw.
    const visible = vertical
      ? Math.abs(phiRef.current) < 0.95 && opacityFactor > 0.02
      : Math.abs(x) < visibleX && opacityFactor > 0.02;
    if (meshGroupRef.current.visible !== visible) {
      meshGroupRef.current.visible = visible;
    }
  });

  return (
    // Starts hidden: positions are assigned in useFrame, so the very first
    // painted frame would otherwise show every sleeve piled at the origin
    // before they snap into the strip.
    <group ref={meshGroupRef} visible={false}>
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          hoveredRef.current = baseIndex;
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (hoveredRef.current === baseIndex) hoveredRef.current = null;
          document.body.style.cursor = "";
        }}
        material={materials}
      >
        <boxGeometry args={[SLEEVE_W, SLEEVE_H, thickness]} />
      </mesh>
    </group>
  );
}

/**
 * Pushes the fog plane back during the open animation so the active vinyl
 * doesn't sink into the background when the camera dollies out.
 */
/**
 * Directional light whose position and intensity interpolate between two
 * states based on openProgress, eased the same as the rest of the open
 * animation.
 */
function AnimatedLight({
  openProgressRef,
  fromPos,
  fromIntensity,
  toPos,
  toIntensity,
}: {
  openProgressRef: React.MutableRefObject<number>;
  fromPos: [number, number, number];
  fromIntensity: number;
  toPos: [number, number, number];
  toIntensity: number;
}) {
  const ref = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    if (!ref.current) return;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);
    ref.current.position.set(
      fromPos[0] + (toPos[0] - fromPos[0]) * t,
      fromPos[1] + (toPos[1] - fromPos[1]) * t,
      fromPos[2] + (toPos[2] - fromPos[2]) * t,
    );
    ref.current.intensity = fromIntensity + (toIntensity - fromIntensity) * t;
  });
  return <directionalLight ref={ref} position={fromPos} intensity={fromIntensity} />;
}

function FogRig({
  openProgressRef,
  near,
  far,
}: {
  openProgressRef: React.MutableRefObject<number>;
  near: number;
  far: number;
}) {
  const fogRef = useRef<THREE.Fog>(null);
  useFrame(() => {
    if (!fogRef.current) return;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);
    fogRef.current.near = near + t * 10;
    fogRef.current.far = far + t * 15;
  });
  return <fog ref={fogRef} attach="fog" args={["#0a0a0a", near, far]} />;
}

/**
 * Pulls the camera back during the open animation so the opened cover doesn't
 * blow up on squarer viewports.  Uses an adaptive target distance based on
 * the viewport aspect — wider screens need less zoom-out.
 */
function CameraRig({
  openProgressRef,
  baseZ,
  fov,
  vertical,
  cenital,
  onCoverHalfWidth,
}: {
  openProgressRef: React.MutableRefObject<number>;
  baseZ: number;
  fov: number;
  vertical: boolean;
  /** radians above the plane of the pile */
  cenital: number;
  /** half the on-screen width of a centred sleeve, in CSS pixels */
  onCoverHalfWidth?: (px: number) => void;
}) {
  const { camera, size } = useThree();
  const lastReported = useRef(-1);
  useFrame(() => {
    const aspect = size.width / size.height;
    const t = EASINGS.easeInOutCubic(openProgressRef.current);

    if (vertical) {
      /**
       * The distance is derived, not chosen.
       *
       * A phone's width is the constraint — the sleeve has to fit across it
       * with a margin — so the camera sits wherever the horizontal field of
       * view makes that true, and then climbs to the viewing angle keeping
       * that distance. Hard-coding a number instead means the shelf is framed
       * for exactly one handset and cropped on every other.
       */
      const halfV = (fov * Math.PI) / 360;
      const halfH = Math.atan(Math.tan(halfV) * aspect);
      // 1.24: the sleeve fills most of the width but not all of it. A cover
      // touching both edges reads as a background image rather than as an
      // object lying on something, and the ones nearer the camera down the
      // pile are larger still — without the margin they get cropped.
      const want = (SLEEVE_W * 1.24 * (1 + 0.3 * t)) / 2 / Math.tan(halfH);
      const d = want;
      camera.position.set(0, d * Math.sin(cenital), d * Math.cos(cenital));
      // opening a record stands it up to face you, so the camera comes level
      // with it rather than continuing to look down on it
      camera.rotation.set(-cenital * (1 - t), 0, 0);
    } else {
      const openZ = aspect > 1.5 ? baseZ + 1.5 : baseZ + 4;
      camera.position.z = baseZ * (1 - t) + openZ * t;
    }

    // Project the sleeve to screen space so the UI can lay itself out around
    // the real cover instead of guessing with percentages.
    if (!onCoverHalfWidth) return;
    const visibleHeight =
      2 * Math.tan((fov * Math.PI) / 360) * Math.abs(camera.position.z);
    const halfPx = (SLEEVE_H / visibleHeight) * size.height * 0.5;
    if (Math.abs(halfPx - lastReported.current) > 1.5) {
      lastReported.current = halfPx;
      onCoverHalfWidth(halfPx);
    }
  });
  return null;
}

