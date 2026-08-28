"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import EmptyState from "@/components/ui/EmptyState";
import { coverFor } from "@/lib/cover";
import type { Vinyl } from "@/lib/types";

/**
 * The shelf on a phone: the same room, entered from the other side.
 *
 * The desktop shelf is a rack you walk along — sleeves stood on edge, moving
 * horizontally, one turned to face you. A phone is the wrong shape for that
 * and the wrong grip: there is no room across, and the thumb travels up and
 * down. So the same object is rotated ninety degrees and becomes a stack you
 * leaf through from above, the way records actually sit when you take them out
 * of the rack and put them on the floor.
 *
 * Which is why it is an accordion rather than a carousel of squares. Every
 * sleeve except the one you are looking at is folded away in perspective,
 * showing only its top edge with the title printed on it — exactly what you
 * see looking down at a pile. Nothing is hidden: forty records are all on
 * screen at once, and the one under your thumb is the one that opens up.
 *
 * **How it is built, and why not the obvious way.** Laying the sleeves out as
 * document flow and animating their heights would relayout the page on every
 * scroll frame; on a mid-range Android that is a slideshow. Instead the
 * scroller holds nothing but empty snap targets — one per record, so the
 * platform gives us real momentum and real snapping for free — and the sleeves
 * live in a sticky layer above it, positioned entirely by transform from a
 * single number: how far the scroll is between one record and the next.
 * Transform and opacity only, no layout, no paint. And only the dozen sleeves
 * near the fold are mounted, so a collection of four hundred costs the same as
 * a collection of twelve.
 */

/** Scroll distance from one record to the next. Also the snap interval. */
const STEP = 96;
/** How many sleeves either side of the fold exist in the DOM at all. */
const WINDOW = 7;

type Placed = {
  /** distance from the focus, in records; 0 is the open one */
  d: number;
};

/**
 * Where a sleeve sits, given its distance from the fold.
 *
 * The shape of this function IS the feel of the thing. Three parts:
 *
 * - **The first record away folds most.** The easing is front-loaded (t²-ish)
 *   so the open sleeve is unmistakably open and its neighbours are already
 *   edge-on. A linear fold makes a fan, and a fan reads as a bug.
 * - **Past the first, sleeves only stack.** Beyond one step away the angle
 *   stops changing and they pile at a constant pitch, like paper. Continuing
 *   to rotate would send them face-down and turn the far end into mush.
 * - **Everything is signed by side.** Above the fold the sleeves lean away
 *   from you and stack upward; below, the mirror. That is what makes the fold
 *   read as a fold and not as a list that happens to be tilted.
 */
function place({ d }: Placed) {
  const side = Math.sign(d) || 1;
  const a = Math.abs(d);
  const near = Math.min(a, 1);
  // front-loaded: most of the fold happens in the first record of travel
  const fold = near * near * (3 - 2 * near);
  const far = Math.max(0, a - 1);

  const rotate = side * (7 + 55 * fold);
  const y = side * (150 * fold + far * 30);
  const z = -110 * fold - far * 26;
  const scale = 1 - 0.13 * fold - Math.min(0.12, far * 0.02);
  // it is darker further into the pile because it is further from the light,
  // and because a receding stack that stays bright has no depth in it
  const dim = Math.min(0.62, 0.3 * fold + far * 0.055);

  return { rotate, y, z, scale, dim };
}

export default function AccordionShelf({
  vinilos,
  onOpen,
  onPlay,
  onRemove,
  listName,
  nowPlayingId,
  isPlaying,
}: {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  onPlay: (v: Vinyl) => void;
  onRemove: (v: Vinyl) => void;
  listName: string;
  nowPlayingId?: string;
  isPlaying: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const sleeveRefs = useRef(new Map<number, HTMLLIElement>());
  const progressRef = useRef(0);
  const frame = useRef(0);
  // Only the integer part drives React. The fractional part — the part that
  // changes sixty times a second — never crosses into the render path.
  const [focus, setFocus] = useState(0);

  const paint = useCallback(() => {
    const p = progressRef.current;
    for (const [i, el] of sleeveRefs.current) {
      const { rotate, y, z, scale, dim } = place({ d: i - p });
      el.style.transform = `translate3d(0, ${y.toFixed(2)}px, ${z.toFixed(2)}px) rotateX(${rotate.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.zIndex = String(1000 - Math.round(Math.abs(i - p) * 10));
      const shade = el.querySelector<HTMLElement>("[data-shade]");
      if (shade) shade.style.opacity = dim.toFixed(3);
    }
  }, []);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    progressRef.current = el.scrollTop / STEP;
    const next = Math.round(progressRef.current);
    if (next !== focus) setFocus(Math.max(0, Math.min(vinilos.length - 1, next)));
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      paint();
    });
  }, [focus, paint, vinilos.length]);

  // first paint before the browser shows anything: a stack that arrives flat
  // and then folds on the first scroll looks like a bug being fixed live
  useLayoutEffect(() => {
    paint();
  });

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const scrollTo = (i: number) => {
    scrollerRef.current?.scrollTo({ top: i * STEP, behavior: "smooth" });
  };

  if (vinilos.length === 0) {
    return (
      <div className="px-5 pb-chrome" style={{ paddingTop: "calc(var(--safe-top) + 130px)" }}>
        <EmptyState
          title="Esta lista está vacía"
          body="Busca un disco por título, artista o código de barras y aparecerá aquí."
          action={{ label: "Buscar discos", href: "/explorar?buscar=1" }}
        />
      </div>
    );
  }

  const current = vinilos[Math.max(0, Math.min(vinilos.length - 1, focus))];
  const sounding = current?.id === nowPlayingId;

  return (
    <div className="relative h-screen-d overflow-hidden">
      {/* ------------------------------------------------------- the stack */}
      {/* The stage does not scroll. It sits still and the transforms move,
          which is what lets a sleeve be positioned by its distance from the
          fold rather than by where the document happens to have put it. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{
          top: "calc(var(--safe-top) + 92px)",
          perspective: "1000px",
          perspectiveOrigin: "50% 42%",
        }}
      >
        <ul className="relative w-[min(86vw,420px)]" style={{ transformStyle: "preserve-3d" }}>
          {vinilos.map((v, i) => {
            if (Math.abs(i - focus) > WINDOW) return null;
            return (
              <li
                key={v.id}
                ref={(el) => {
                  if (el) sleeveRefs.current.set(i, el);
                  else sleeveRefs.current.delete(i);
                }}
                className="absolute inset-x-0 top-0 origin-top will-change-transform"
                style={{ transformStyle: "preserve-3d" }}
              >
                <Sleeve
                  vinyl={v}
                  eager={Math.abs(i - focus) <= 2}
                  open={i === focus}
                  listName={listName}
                  onOpen={() => (i === focus ? onOpen(v) : scrollTo(i))}
                  onRemove={() => onRemove(v)}
                />
              </li>
            );
          })}
        </ul>
      </div>

      {/* ------------------------------------------------- the scroll track */}
      {/* Nothing but empty snap targets. The platform's own momentum and
          snapping are worth more than any hand-written inertia, and this is
          the cheapest possible way to keep them. */}
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        data-scrollable
        className="scroll-y absolute inset-0 snap-y snap-mandatory"
        style={{ paddingBottom: "calc(var(--tabbar-h) + var(--player-h))" }}
      >
        {vinilos.map((v) => (
          <div key={v.id} className="snap-center" style={{ height: STEP }} />
        ))}
        {/* room to bring the last record to the fold */}
        <div style={{ height: `calc(100dvh - ${STEP}px - var(--safe-top) - 300px)` }} />
      </div>

      {/* ---------------------------------------------------- what is open */}
      {/* Pinned to the bottom instead of riding under the open sleeve: the
          caption is the one thing that must not move while you scroll, or you
          end up reading a title that belongs to the record you just left. */}
      {current && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 px-6"
          style={{ bottom: "calc(var(--tabbar-h) + var(--player-h) + 18px)" }}
        >
          <div className="pointer-events-auto flex items-center justify-between gap-3">
            <button
              onClick={() => onOpen(current)}
              className="pressable min-w-0 flex-1 text-left"
            >
              <p className="truncate text-heading font-medium text-paper">{current.title}</p>
              <p className="truncate text-sub text-content-muted">
                {current.artist}
                {current.year ? ` · ${current.year}` : ""}
              </p>
            </button>
            <button
              onClick={() => onPlay(current)}
              disabled={!current.previewUrl}
              aria-label={sounding && isPlaying ? "Pausar" : `Escuchar ${current.title}`}
              className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong bg-ink/50 text-paper backdrop-blur-sm disabled:opacity-30"
            >
              {sounding && isPlaying ? (
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                  <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                  <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * One sleeve: a cover, a printed top edge, and a millimetre of cardboard.
 *
 * The edge is not decoration. Folded away, the edge is the only part of a
 * record you can see, and a stack of squares with no edge reads as a stack of
 * pictures rather than a stack of objects. It is also where the title lives,
 * for the same reason it lives on a real spine: it is the surface that faces
 * you when the record is put away.
 */
function Sleeve({
  vinyl,
  eager,
  open,
  listName,
  onOpen,
  onRemove,
}: {
  vinyl: Vinyl;
  eager: boolean;
  open: boolean;
  listName: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const x = useMotionValue(0);
  const hint = useTransform(x, [-150, -60, 0, 60, 150], [1, 0, 0, 0, 1]);
  const fade = useTransform(x, [-260, 0, 260], [0.25, 1, 0.25]);
  const [dragging, setDragging] = useState(false);

  // Throwing a record off the shelf is only offered on the open one. On a
  // folded sleeve the same gesture would be a lottery: you cannot see which
  // one you are holding.
  const end = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const far = Math.abs(info.offset.x) > window.innerWidth * 0.45;
    const flick = Math.abs(info.velocity.x) > 700 && Math.abs(info.offset.x) > 60;
    if (far || flick) onRemove();
  };

  return (
    <div className="pointer-events-auto relative">
      {/* what the gesture is going to do, revealed by the gesture itself */}
      <motion.span
        style={{ opacity: hint }}
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption font-semibold uppercase tracking-label text-[#ff6b57]"
      >
        Quitar de {listName}
      </motion.span>

      <motion.button
        onClick={() => !dragging && onOpen()}
        drag={open ? "x" : false}
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.55}
        onDragStart={() => setDragging(true)}
        onDragEnd={end}
        style={{ x, opacity: open ? fade : 1 }}
        className="block w-full touch-pan-y text-left"
        aria-label={`${vinyl.title}, ${vinyl.artist}`}
      >
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverFor(vinyl)}
            alt=""
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            className="aspect-square w-full rounded-[3px] object-cover"
            style={{ boxShadow: "0 24px 50px rgba(0,0,0,0.55)" }}
          />

          {/* the printed edge: the title reads while the sleeve is still folded */}
          <span className="absolute inset-x-0 top-0 flex items-baseline gap-1.5 rounded-t-[3px] bg-ink/78 px-3 py-[7px] backdrop-blur-sm">
            <span className="truncate text-caption font-semibold text-paper">{vinyl.title}</span>
            <span className="truncate text-caption text-paper/55">{vinyl.artist}</span>
          </span>

          {/* the cardboard: a hairline of thickness under the cover, which is
              what stops the stack from looking like stacked photographs */}
          <span
            aria-hidden
            className="absolute inset-x-[1px] top-full h-[3px] rounded-b-[2px] bg-paper/25"
          />

          {/* depth: painted, not lit — one element per sleeve instead of a
              light model, because this runs on a phone */}
          <span
            data-shade
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[3px] bg-ink"
            style={{ opacity: 0 }}
          />
        </span>
      </motion.button>
    </div>
  );
}
