/**
 * The colours actually printed on a sleeve.
 *
 * `Vinyl.palette` exists but cannot do this job: anything that arrives from
 * Discogs is stamped with the same five greys (`app/api/discogs/release`),
 * so a light built from it would be the same grey light for every record in
 * the collection. Only the seeded demo catalogue carries real colours.
 *
 * Reading the artwork is possible here for one reason: covers are served
 * through `/api/cover`, so they are same-origin and drawing one into a canvas
 * does not taint it. A cross-origin Discogs URL would throw on getImageData
 * and this would silently return nothing — which is why the caller must treat
 * an empty array as "no light", not as an error.
 */

export type Tone = "light" | "dark";

export type CoverLook = {
  /** the two or three colours the sleeve is *about* */
  colors: string[];
  /** how bright it is where a corner control sits, and where a centred one does */
  corner: Tone;
  centre: Tone;
};

/** one promise per image, forever: sampling the same sleeve twice is waste */
const cache = new Map<string, Promise<CoverLook>>();

const NEUTRAL: CoverLook = { colors: [], corner: "dark", centre: "dark" };

/** how many pixels across we sample. 24² = 576 pixels is plenty to find the
 *  two or three colours a sleeve is *about*, and costs nothing to decode. */
const GRID = 24;

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0")).join("")}`;

/**
 * Buckets, not clusters.
 *
 * Proper k-means on 576 pixels would be more correct and completely
 * unjustifiable for a background glow: quantising each channel to 4 bits puts
 * every pixel into one of 4096 boxes, and the fullest boxes are the colours
 * you would name if asked what the cover looks like.
 */
function dominant(data: Uint8ClampedArray): string[] {
  const bins = new Map<number, { n: number; r: number; g: number; b: number; sat: number }>();

  for (let i = 0; i < data.length; i += 4) {
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    if (a < 200) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    // Ink and paper are not the record's colour. A sleeve is mostly black
    // borders and white type, and letting those win would light the room the
    // same neutral grey for every album — which is the thing worth avoiding.
    if (max < 34 || min > 232) continue;
    const sat = max === 0 ? 0 : (max - min) / max;

    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) ?? { n: 0, r: 0, g: 0, b: 0, sat: 0 };
    bin.n += 1;
    bin.r += r;
    bin.g += g;
    bin.b += b;
    bin.sat += sat;
    bins.set(key, bin);
  }

  return (
    Array.from(bins.values())
      /**
       * Weight by colourfulness, not by area alone.
       *
       * By raw count the winner of almost every sleeve is a muddy mid-grey —
       * the average of a photograph. Multiplying the count by saturation lets
       * a smaller, vivid area win, which is what a person means when they say
       * "the orange one".
       */
      .map((b) => ({ ...b, score: b.n * (0.25 + (b.sat / b.n) * 1.6) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((b) => hex(b.r / b.n, b.g / b.n, b.b / b.n))
  );
}

/**
 * How bright one region of the sleeve is, in the eye's terms.
 *
 * Rec. 709 weights rather than a plain average: the same amount of green
 * looks far brighter than the same amount of blue, and a control judged by
 * the arithmetic mean disappears on exactly the covers people notice.
 *
 * The threshold sits at 0.58 rather than 0.5 — white glass gives up long
 * before the background is literally mid-grey.
 */
function toneOf(data: Uint8ClampedArray, x0: number, y0: number, x1: number, y1: number): Tone {
  let sum = 0;
  let n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * GRID + x) * 4;
      sum += (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      n++;
    }
  }
  return n > 0 && sum / n > 0.58 ? "light" : "dark";
}

export function analyseCover(src: string): Promise<CoverLook> {
  const hit = cache.get(src);
  if (hit) return hit;

  const job = new Promise<CoverLook>((resolve) => {
    if (typeof document === "undefined") return resolve(NEUTRAL);
    const img = new Image();
    // harmless same-origin, and the one thing that would let a future
    // CORS-enabled host work instead of throwing
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = GRID;
        canvas.height = GRID;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(NEUTRAL);
        ctx.drawImage(img, 0, 0, GRID, GRID);
        const { data } = ctx.getImageData(0, 0, GRID, GRID);
        resolve({
          colors: dominant(data),
          // the corner a control actually lands in, not the sleeve's average:
          // a black record with a white sticker top right is a light corner
          corner: toneOf(data, Math.round(GRID * 0.62), 0, GRID, Math.round(GRID * 0.3)),
          centre: toneOf(data, Math.round(GRID * 0.28), Math.round(GRID * 0.34), Math.round(GRID * 0.72), Math.round(GRID * 0.66)),
        });
      } catch {
        // tainted canvas: the cover came from somewhere that is not ours
        resolve(NEUTRAL);
      }
    };
    img.onerror = () => resolve(NEUTRAL);
    img.src = src;
  });

  cache.set(src, job);
  return job;
}
