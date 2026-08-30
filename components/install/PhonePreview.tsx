"use client";

/**
 * The thing you are about to get, drawn at the size it will be.
 *
 * An install page with no picture asks somebody to take two steps on faith.
 * This is the app's grid view inside a phone, with real sleeves from the
 * catalogue — not a mock-up of a screen that does not exist and not a
 * screenshot that goes stale the next time the grid changes, because it is
 * built out of the same covers the app serves.
 *
 * Presentational only: no state, no interaction, `aria-hidden`. It is a
 * photograph of the product, and a screen reader that announced sixteen album
 * covers here would be reading out the wallpaper.
 */

const COVERS = [
  "rosalia-lux-35578378",
  "tame-impala-currents-7252111",
  "gorillaz-demon-days-36145336",
  "led-zeppelin-led-zeppelin-iv-1015465",
  "billie-eilish-hit-me-hard-and-soft-34773263",
  "fleetwood-mac-rumours-526351",
  "various-pulp-fiction-music-from-the-motion-picture-376354",
  "noga-erez-the-vandalist-31803860",
  "hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571",
  "etta-james-at-last-5466884",
  "cypress-hill-black-sunday-12387973",
  "estopa-estopa-9267144",
];

export default function PhonePreview() {
  return (
    <div aria-hidden className="relative mx-auto w-[228px] select-none">
      {/* the light the device throws, so it sits on the page instead of being
          pasted onto it */}
      <span className="absolute inset-x-6 bottom-2 h-16 rounded-full bg-black/60 blur-2xl" />

      <div className="relative overflow-hidden rounded-[30px] border border-paper/[0.14] bg-ink p-[5px] shadow-[0_26px_70px_rgba(0,0,0,0.65)]">
        <div className="relative h-[400px] overflow-hidden rounded-[25px] bg-surface">
          {/* the island, because a phone without one no longer reads as a phone */}
          <span className="absolute left-1/2 top-2.5 z-10 h-[18px] w-[62px] -translate-x-1/2 rounded-full bg-ink" />

          <div className="px-3 pt-11">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-medium text-paper">Mi Colección</span>
              <span className="text-[10px] text-content-faint">128</span>
            </div>

            <div className="mt-2.5 grid grid-cols-3 gap-1.5">
              {COVERS.map((c) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={c}
                  src={`/covers/${c}.jpg`}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full rounded-[2px] object-cover"
                />
              ))}
            </div>
          </div>

          {/* the covers run out under the bar rather than stopping short: a
              screenshot that ends in empty space reads as an empty app */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-surface via-surface/85 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-around px-4 pb-4 pt-2">
            {[0, 1, 2, 3].map((n) => (
              <span
                key={n}
                className={`h-1.5 w-1.5 rounded-full ${n === 0 ? "bg-paper" : "bg-paper/25"}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
