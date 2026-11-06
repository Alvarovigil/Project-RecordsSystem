"use client";

import { useEffect, useState } from "react";

/**
 * How much of the bottom of the screen the on-screen keyboard is covering.
 *
 * Chrome on Android, by default, opens the keyboard over the page without
 * resizing it (`resizes-visual`): the layout viewport keeps its height, so
 * anything pinned to the bottom — a sheet's button — ends up under the keys.
 * What does shrink is the *visual* viewport, and the difference between the
 * two is exactly the keyboard. iOS reports it the same way, plus an
 * `offsetTop` when it pans the page to keep the field in view.
 *
 * 0 when there is no keyboard, no `visualViewport`, or on the server. Small
 * differences (browser chrome collapsing, a pinch-zoom) are ignored: only a
 * keyboard takes more than a sixth of the screen.
 */
export function useKeyboardInset(active = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    let frame = 0;
    const read = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // zoomed in, the visual viewport is small for another reason
        if (vv.scale > 1.01) return setInset(0);
        const covered = Math.max(0, Math.round(window.innerHeight - vv.height - vv.offsetTop));
        setInset(covered > window.innerHeight / 6 ? covered : 0);
      });
    };
    read();
    vv.addEventListener("resize", read);
    vv.addEventListener("scroll", read);
    return () => {
      cancelAnimationFrame(frame);
      vv.removeEventListener("resize", read);
      vv.removeEventListener("scroll", read);
      setInset(0);
    };
  }, [active]);

  return inset;
}
