"use client";

import { useState } from "react";
import { motion, type PanInfo } from "framer-motion";

/**
 * The first minute, as four screens.
 *
 * Onboarding used to be two forms — a name and an import — which told a new
 * arrival nothing about what they had just installed. That is fine for
 * somebody who already used the web version and is only signing in; it is
 * empty for the person who tapped an icon because a friend said to.
 *
 * So the deck comes first and the forms come after, in that order on purpose:
 * **give before you ask.** Four ideas, one per screen, each one a thing the
 * app does rather than a value it holds. Nobody has ever been won over by
 * "descubre, organiza y comparte".
 *
 * Rules it follows:
 *
 * - **Swipeable, and also pressable.** A deck you can only tap through is a
 *   slideshow; one you can only swipe is a puzzle for whoever has never done
 *   it. Both, always, plus dots that say how long this will take — four is a
 *   promise people accept, and the dots are what make it visible.
 * - **A way out on every screen.** "Saltar" never moves and never hides. The
 *   fastest onboarding is the one somebody chooses not to skip.
 * - **Drawn, not photographed.** Every scene is vector and animates itself, so
 *   there are no screenshots to go stale the next time a screen changes — and
 *   nothing to download before the first frame.
 */

type Slide = {
  key: string;
  title: string;
  body: string;
  scene: React.ReactNode;
};

const SLIDES: Slide[] = [
  {
    key: "shelf",
    title: "Tu estantería, entera",
    body: "Todos tus discos en un sitio que se parece a donde los guardas. Se recorre con el pulgar, funda a funda.",
    scene: <ShelfScene />,
  },
  {
    key: "scan",
    title: "Apunta y ya está",
    body: "El código de barras de la contraportada trae el disco con su ficha, su año y su prensa. Uno, o la estantería entera de una sentada.",
    scene: <ScanScene />,
  },
  {
    key: "racks",
    title: "Racks, no carpetas",
    body: "Agrupa por sello, por lo que suena un martes o por lo que te dio la gana. Cada rack tiene su enlace y se comparte con quien quieras.",
    scene: <RackScene />,
  },
  {
    key: "wishlist",
    title: "Y lo que aún no tienes",
    body: "Apunta lo que persigues y llévalo encima cuando entres en una tienda. El día que cae, un toque y pasa a tu colección.",
    scene: <WishScene />,
  },
];

export default function Slides({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const last = i === SLIDES.length - 1;

  const go = (next: number) => setI(Math.max(0, Math.min(SLIDES.length - 1, next)));

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // distance or a flick: a fast throw is a decision even when it is short
    const far = Math.abs(info.offset.x) > 70 || Math.abs(info.velocity.x) > 450;
    if (!far) return;
    go(i + (info.offset.x < 0 ? 1 : -1));
  };

  return (
    <div className="flex h-full flex-col">
      {/* Always there, never moving. A skip that appears on the last screen is
          a skip that only helps the people who did not need it. */}
      <div
        className="flex justify-end px-5"
        style={{ paddingTop: "calc(var(--safe-top) + 14px)" }}
      >
        <button
          onClick={onDone}
          className="pressable px-2 py-1 text-sub text-content-muted transition hover:text-paper"
        >
          Saltar
        </button>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <motion.div
          className="flex h-full"
          animate={{ x: `-${i * 100}%` }}
          transition={{ type: "spring", damping: 34, stiffness: 320 }}
          drag="x"
          dragDirectionLock
          dragElastic={0.12}
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={onDragEnd}
        >
          {SLIDES.map((s, idx) => (
            <div
              key={s.key}
              aria-hidden={idx !== i}
              className="flex h-full w-full shrink-0 flex-col items-center justify-center px-8 text-center"
            >
              {/* the scene only animates while it is the one being looked at,
                  so four loops are not running behind a screen nobody sees */}
              <div className="flex h-[190px] w-full items-center justify-center">
                {idx === i ? s.scene : null}
              </div>
              <h2 className="mt-10 text-title font-medium leading-tight text-paper">
                {s.title}
              </h2>
              <p className="mt-3 max-w-[32ch] text-body leading-relaxed text-content-secondary">
                {s.body}
              </p>
            </div>
          ))}
        </motion.div>
      </div>

      <div
        className="flex shrink-0 flex-col items-center gap-6 px-7 pt-6"
        style={{ paddingBottom: "calc(var(--safe-bottom) + 22px)" }}
      >
        <div className="flex items-center gap-2">
          {SLIDES.map((s, idx) => (
            <button
              key={s.key}
              onClick={() => go(idx)}
              aria-label={`Ir a la pantalla ${idx + 1}`}
              aria-current={idx === i}
              className="p-1.5"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  idx === i ? "w-5 bg-paper" : "w-1.5 bg-paper/25"
                }`}
              />
            </button>
          ))}
        </div>

        <button
          onClick={() => (last ? onDone() : go(i + 1))}
          className="pressable flex h-12 w-full max-w-[420px] items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
        >
          {last ? "Empezar" : "Siguiente"}
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------- the scenes
// Vector, self-animating, and deliberately abstract: these say "sleeves", "a
// barcode", "groups" — not "here is a screenshot of the shelf", which would be
// a promise the next redesign breaks.

const EASE = [0.16, 1, 0.3, 1] as const;

/** sleeves stood on edge, one pulled half out of the rack */
function ShelfScene() {
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
      {[0, 1, 2, 3, 4, 5].map((n) => (
        <motion.rect
          key={n}
          x={18 + n * 32}
          width="22"
          height="110"
          rx="2"
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: n === 3 ? 12 : 24, opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.06 * n, ease: EASE }}
          className={n === 3 ? "fill-paper" : "fill-paper/20"}
        />
      ))}
      <rect x="8" y="132" width="204" height="2" rx="1" className="fill-paper/25" />
    </svg>
  );
}

/** a barcode with the reader's line travelling over it */
function ScanScene() {
  const bars = [3, 1.5, 1.5, 4, 1.5, 3, 1.5, 1.5, 4, 2, 1.5, 3, 1.5, 4, 1.5, 2];
  let x = 0;
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
      <rect x="24" y="26" width="172" height="98" rx="6" className="fill-paper/[0.06]" />
      <g>
        {bars.map((w, n) => {
          const el = (
            <rect key={n} x={44 + x} y="50" width={w} height="50" rx="0.6" className="fill-paper/70" />
          );
          x += w + 4;
          return el;
        })}
      </g>
      <motion.rect
        y="48"
        width="150"
        height="2"
        rx="1"
        className="fill-accent"
        initial={{ x: 40 }}
        animate={{ x: 40, y: [48, 100, 48] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      {[
        "M32 34v-6a4 4 0 0 1 4-4h6",
        "M188 34v-6a4 4 0 0 0-4-4h-6",
        "M32 116v6a4 4 0 0 0 4 4h6",
        "M188 116v6a4 4 0 0 1-4 4h-6",
      ].map((d) => (
        <path key={d} d={d} stroke="currentColor" strokeWidth="1.6" className="text-paper/80" />
      ))}
    </svg>
  );
}

/** three groups, each a little stack of its own */
function RackScene() {
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
      {[0, 1, 2].map((g) => (
        <motion.g
          key={g}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.12 * g, ease: EASE }}
        >
          <rect
            x={14 + g * 68}
            y="28"
            width="60"
            height="60"
            rx="8"
            className={g === 0 ? "fill-paper/25" : "fill-paper/[0.09]"}
          />
          <rect x={24 + g * 68} y="38" width="18" height="18" rx="2" className="fill-paper/60" />
          <rect x={46 + g * 68} y="38" width="18" height="18" rx="2" className="fill-paper/35" />
          <rect x={24 + g * 68} y="60" width="18" height="18" rx="2" className="fill-paper/35" />
          <rect x={46 + g * 68} y="60" width="18" height="18" rx="2" className="fill-paper/60" />
          <rect x={14 + g * 68} y="100" width={g === 1 ? 46 : 36} height="5" rx="2.5" className="fill-paper/30" />
          <rect x={14 + g * 68} y="112" width="24" height="5" rx="2.5" className="fill-paper/15" />
        </motion.g>
      ))}
    </svg>
  );
}

/** a wanted sleeve becoming an owned one */
function WishScene() {
  return (
    <svg width="220" height="150" viewBox="0 0 220 150" fill="none" aria-hidden>
      <rect x="62" y="24" width="96" height="96" rx="8" className="fill-paper/[0.09]" />
      <motion.rect
        x="62"
        y="24"
        width="96"
        height="96"
        rx="8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray="6 6"
        className="text-paper/30"
        animate={{ opacity: [1, 0.15, 1] }}
        transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.g
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.35, ease: EASE }}
        style={{ transformOrigin: "110px 72px" }}
      >
        <circle cx="110" cy="72" r="26" className="fill-paper" />
        <path
          d="M99 72.5 L107 80.5 L122 64"
          stroke="#0a0a0a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </motion.g>
    </svg>
  );
}
