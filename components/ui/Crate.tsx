"use client";

/**
 * A list, as a crate with records in it.
 *
 * The four-cover mosaic said "four images" and nothing more. This says the one
 * thing a preview should: here is a stack of records, and these three went in
 * last. It is also the object the whole product is a picture of.
 *
 * The artwork is a crate with no back. Sleeves are drawn first, the crate lands
 * on top, and because its lattice is 57% transparent they carry on showing
 * through it — genuinely behind, not faked with a cut-out.
 *
 * Every number below is derived from two measurements rather than nudged into
 * place, so a re-export of the asset at another size changes nothing.
 */

/**
 * Measured from public/crate.png: 500 × 401, with the crate filling it to
 * within two pixels a side.
 *
 * The distinction between the file and the crate inside it still matters — an
 * earlier export carried a 5% transparent margin, and applying the sleeve ratio
 * to the file width instead of the crate made every record wider than the box
 * it was meant to be sitting in. Both are measured here so a future re-export
 * cannot quietly reintroduce that.
 */
const IMAGE = { w: 500, h: 401 };
const BODY = { w: 496, left: 2 };

/** A sleeve is 443 wide when the crate is 500 — the scale of a real 12". */
const SLEEVE = 443 / IMAGE.w;

/** The crate is a hair off-centre in its own file; sleeves follow it, not the file. */
const CENTRE = (BODY.left + BODY.w / 2) / IMAGE.w;

const CRATE_ASPECT = IMAGE.w / IMAGE.h;

/**
 * The crate's solid lower panel, as fractions of its own height. Between these
 * two lines nothing behind the crate can be seen, which is where every sleeve's
 * foot has to end: a sleeve showing below the crate stops being inside it and
 * becomes a picture stuck behind another picture.
 */
const PANEL_TOP = 0.728;
const PANEL_BOTTOM = 0.978;

/**
 * Square, and it fits — once the sleeve is measured against the crate rather
 * than against the file. At the true 12" scale a record needs 78.6% of the
 * card's width, and three of them stack inside a square with room to lean.
 */
const CARD = 1;

const CRATE_H = 1 / CRATE_ASPECT;
const CRATE_TOP = CARD - CRATE_H;
/**
 * The band where the crate's solid panel hides whatever is behind it: 0.723 to
 * 0.901 of the card. Every foot below sits inside it, and that is the whole
 * illusion — a sleeve whose bottom edge showed under the crate would stop being
 * inside it and become a picture stuck behind another picture.
 */
export const HIDDEN_FROM = CRATE_TOP + PANEL_TOP * CRATE_H;
export const HIDDEN_TO = CRATE_TOP + PANEL_BOTTOM * CRATE_H;

/**
 * Three sleeves, back to front.
 *
 * `foot` is where each one's bottom edge lands, and all three sit inside the
 * hidden band. The ones behind end higher, because records in a crate lean
 * back — which is also what lets all three read at once instead of the front
 * one swallowing the rest.
 */
/**
 * `lift` is how far each sleeve rises when the card is pointed at.
 *
 * The ones behind travel furthest, so the stack fans open like a hand of cards
 * rather than sliding as a block. Resting positions sit a little lower than
 * they otherwise would, purely to leave that headroom: the card clips at its
 * top edge, and a sleeve that rose past it would be sliced rather than lifted.
 */
const SLEEVES = [
  { foot: 0.915, lift: 0.026, dim: 0.4 },  // back
  { foot: 0.942, lift: 0.015, dim: 0.19 },
  { foot: 0.97, lift: 0.005, dim: 0 },     // front — the newest
];

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

export default function Crate({
  covers,
  className = "",
}: {
  /** newest first; up to three are used */
  covers: string[];
  className?: string;
}) {
  // drawn back to front, so the newest ends up nearest the viewer
  const shown = covers.slice(0, 3).reverse();
  const offset = SLEEVES.length - shown.length;

  return (
    <span
      className={`relative block w-full overflow-hidden ${className}`}
      style={{ paddingTop: pct(CARD) }}
    >
      {shown.map((src, i) => {
        const s = SLEEVES[offset + i];
        return (
          <span
            key={`${src}-${i}`}
            className="crate-sleeve absolute"
            style={{
              // back to front, so it unfolds rather than jumping
              transitionDelay: `${(SLEEVES.length - 1 - (offset + i)) * 35}ms`,
              ["--lift" as string]: pct(s.lift / CARD),
              width: pct(SLEEVE),
              // dead centre on the crate. Records in a crate are flush; the
              // small horizontal scatter that was here read as sloppy, not
              // as casual.
              left: pct(CENTRE - SLEEVE / 2),
              // `top` resolves against the card's height, so the fractions —
              // which are all in units of its width — are converted here
              top: pct((s.foot - SLEEVE) / CARD),
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt=""
              loading="lazy"
              draggable={false}
              className="aspect-square w-full rounded-[2px] object-cover shadow-[0_8px_22px_rgba(0,0,0,0.6)]"
            />
            {/* the deeper a sleeve sits, the less light reaches it */}
            {s.dim > 0 && (
              <span
                aria-hidden
                className="absolute inset-0 rounded-[2px] bg-ink"
                style={{ opacity: s.dim }}
              />
            )}
          </span>
        );
      })}

      {/* the crate, at its own proportions and anchored to the bottom, so it is
          never stretched by whatever shape it is placed in */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/crate.png"
        alt=""
        draggable={false}
        className="pointer-events-none absolute inset-x-0 bottom-0 w-full"
        style={{ height: pct(CRATE_H / CARD) }}
      />
    </span>
  );
}
