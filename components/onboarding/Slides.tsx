"use client";

import { useState } from "react";
import { motion, type PanInfo } from "framer-motion";
import {
  SceneCollection,
  SceneCommunity,
  SceneRacks,
  SceneScanner,
  SceneWishlist,
} from "./Scenes";

/**
 * The first minute, as five screens.
 *
 * Onboarding used to be two forms — a name and an import — which told a new
 * arrival nothing about what they had just installed. That is fine for
 * somebody who already used the web version and is only signing in; it is
 * empty for the person who tapped an icon because a friend said to. So the
 * deck comes first and the forms come after, in that order on purpose: **give
 * before you ask.**
 *
 * Rules it follows:
 *
 * - **Every idea is shown in the app's own interface.** Not an abstract mark
 *   standing for "scanning" — the viewfinder, the sweep and the tray card, in
 *   the classes the scanner really uses. Somebody arriving at the shelf after
 *   this should recognise it rather than discover it, and copy that promises
 *   something the interface does not look like is a debt paid on first use.
 * - **Swipeable, and also pressable.** A deck you can only tap through is a
 *   slideshow; one you can only swipe is a puzzle for whoever has never done
 *   it. Both, always, plus dots that say how long this will take.
 * - **A way out on every screen.** "Saltar" never moves and never hides. The
 *   fastest onboarding is the one somebody chooses not to skip.
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
    title: "Tu colección, más allá de tu estantería",
    body: "Ten tus discos siempre contigo y haz que tu colección forme parte de algo más grande.",
    scene: <SceneCollection />,
  },
  {
    key: "community",
    title: "Descubre qué coleccionan los demás",
    body: "Recorre otras colecciones, encuentra gente con tus mismos gustos y descubre nuevos discos para la tuya.",
    scene: <SceneCommunity />,
  },
  {
    key: "racks",
    title: "Racks, a tu manera",
    body: "Agrupa tus discos por sello, por género, por un viaje a Lisboa o por lo que te dé la gana. Cada rack tiene su propio enlace para compartirlo.",
    scene: <SceneRacks />,
  },
  {
    key: "scan",
    title: "Apunta y ya está",
    body: "Escanea el código de barras y encuentra el disco con su edición, año y prensa. Añádelo a tu colección en un toque.",
    scene: <SceneScanner />,
  },
  {
    key: "wishlist",
    title: "Y lo que aún no tienes",
    body: "Guarda los discos que buscas y llévalos contigo cuando salgas de caza. Cuando caiga uno, pasa directo a tu colección.",
    scene: <SceneWishlist />,
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
        className="flex shrink-0 justify-end px-5"
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
            <div key={s.key} aria-hidden={idx !== i} className="flex h-full w-full shrink-0 flex-col">
              {/**
               * The picture takes the room that is left, the words take what
               * they need. A fixed-height stage would crop the interface on a
               * small phone and strand it in the middle of a large one — and
               * these scenes are fragments, so the crop has to be the screen's
               * decision rather than a number written here.
               */}
              <div className="min-h-0 flex-1 px-6 pt-2">
                {/* only the scene being looked at animates: five loops running
                    behind screens nobody sees is work paid for nothing */}
                {idx === i ? s.scene : null}
              </div>
              <div className="shrink-0 px-7 pb-2 pt-6 text-center">
                <h2 className="text-title font-medium leading-tight text-paper">{s.title}</h2>
                <p className="mx-auto mt-3 max-w-[34ch] text-body leading-relaxed text-content-secondary">
                  {s.body}
                </p>
              </div>
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
          className="pressable flex h-12 w-full max-w-[420px] items-center justify-center gap-2 rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
        >
          {last ? (
            <>
              Entra al club
              <span aria-hidden>→</span>
            </>
          ) : (
            "Siguiente"
          )}
        </button>
      </div>
    </div>
  );
}
