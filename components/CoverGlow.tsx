"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { analyseCover } from "@/lib/palette";
import { coverFor } from "@/lib/cover";
import type { Vinyl } from "@/lib/types";

/**
 * The room lights up in the colour of the record you took out.
 *
 * Two things make this read as light rather than as a coloured rectangle:
 *
 * **It blends, it does not paint.** The shelf is a WebGL canvas that clears
 * to near-black every frame, so anything behind it is invisible — the glow
 * has to sit on top. `mix-blend-screen` is what keeps that honest: screen can
 * only ever brighten, so over the black background it reads as a lamp, and
 * where it crosses the sleeve it warms the artwork instead of veiling it.
 * Painting the same shape with opacity would fog everything it touched.
 *
 * **It has no edge.** Two wide ellipses, offset from each other, each fading
 * to nothing well before the shape ends. A glow you can find the boundary of
 * is a gradient; a glow you cannot is light.
 *
 * It arrives slowly and leaves a little quicker, the way a room you walk into
 * settles and a lamp you switch off does not.
 */
export default function CoverGlow({ vinyl }: { vinyl: Vinyl | null }) {
  /**
   * One layer per record, and the layer owns its colours.
   *
   * This used to be a single div whose opacity was toggled and whose
   * `background` was cleared in the same render — so closing a record removed
   * the gradient outright and there was nothing left to fade: the light
   * vanished on the frame you clicked, and the 350ms transition animated an
   * element that was already invisible.
   *
   * Keyed by record and handed to AnimatePresence, the old light is still
   * mounted and still coloured while it dims. It also buys the other case for
   * free: stepping from one sleeve straight to the next cross-fades, because
   * the outgoing layer is a real element with its own colours rather than a
   * style that got overwritten.
   */
  const [layer, setLayer] = useState<{ id: string; colors: string[] } | null>(null);

  useEffect(() => {
    if (!vinyl) {
      setLayer(null);
      return;
    }
    let alive = true;
    void analyseCover(coverFor(vinyl)).then(({ colors }) => {
      if (!alive) return;
      // whatever the sleeve gave us, falling back to the record's own stored
      // palette minus the greys that Discogs stamps on everything
      const use = colors.length
        ? colors
        : vinyl.palette.filter((p) => !/^#(8{2}|6{2}|4{2}|2{2}|0{2})\1\1$/i.test(p));
      setLayer(use.length ? { id: vinyl.id, colors: use } : null);
    });
    return () => {
      alive = false;
    };
  }, [vinyl]);

  return (
    <AnimatePresence>
      {layer && (
        <motion.div
          key={layer.id}
          aria-hidden
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 0.9,
            ease: [0.16, 1, 0.3, 1],
            // a lamp goes out faster than a room settles, but not abruptly
            exit: { duration: 0.6, ease: "easeOut" },
          }}
          className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-[58vh] mix-blend-screen"
          style={{ background: gradient(layer.colors) }}
        />
      )}
    </AnimatePresence>
  );
}

function gradient([a, b = a, c = b]: string[]) {
  return [
    `radial-gradient(75% 100% at 30% -18%, ${a}59 0%, ${a}1f 42%, transparent 72%)`,
    `radial-gradient(65% 95% at 72% -14%, ${b}4d 0%, ${b}1a 45%, transparent 74%)`,
    `radial-gradient(120% 80% at 50% -30%, ${c}33 0%, transparent 65%)`,
  ].join(", ");
}
