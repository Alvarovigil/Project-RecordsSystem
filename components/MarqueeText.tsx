"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

type Props = {
  children: string;
  className?: string;
  /** ms per pixel of scroll travel */
  speed?: number;
};

/**
 * Spotify-style marquee: scrolls horizontally only when the text overflows
 * its container. Soft gradient fade on both edges via mask-image so the
 * scrolling text dissolves cleanly into the background.
 */
export default function MarqueeText({ children, className, speed = 60 }: Props) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [duration, setDuration] = useState(0);
  /**
   * With «reduce motion» on, text never moves on its own: a long name is cut
   * with an ellipsis and stays put. For someone with vertigo a title sliding
   * past is the thing that makes the screen hard to look at.
   */
  const reduce = useReducedMotion();

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
    if (reduce) {
      setOverflows(false);
      return;
    }
    /**
     * Ask the container, not the text.
     *
     * This measured the inner span, and the inner span is exactly the thing
     * that gets replaced the moment the answer is yes: overflowing swaps one
     * span for a flex row holding two copies. The observer went on watching
     * the old node, which by then was detached from the document and reported
     * a width of zero — so the marquee turned itself off in the same breath it
     * turned on, and a long title just sat there truncated.
     *
     * The container survives both branches, and its own scrollWidth answers
     * the same question: is there more text here than there is room for.
     */
    const measure = () => {
      /* Ya en marcha, el contenedor lleva dos copias y su scrollWidth siempre
         se pasa: así nunca volvía a pararse aunque el texto ya cupiera (la
         cabecera de la colección le da más sitio después de medirse). Se mide
         una copia, sin su respiro (pr-10). */
      const inner = innerRef.current;
      const running = Boolean(inner?.classList.contains("pr-10"));
      // el respiro está en rem: al 130 % ya no son 40px
      const breath = running && inner ? parseFloat(getComputedStyle(inner).paddingRight) || 0 : 0;
      const textW = running && inner ? inner.scrollWidth - breath : outer.scrollWidth;
      const overflow = textW > outer.clientWidth + 1;
      setOverflows(overflow);
      if (overflow) {
        // travel is one copy plus the gap; in marquee mode the container holds
        // two, so halving it is the same number from the other side
        const single = innerRef.current?.scrollWidth || outer.scrollWidth / 2;
        setDuration(((single + 40) / 1000) * speed);
      }
    };
    measure();

    /**
     * Measure again once the real typeface has arrived.
     *
     * The first measurement happens in the fallback font, which is narrower —
     * a title that overflows by ten pixels in Inter does not overflow in
     * Helvetica, so the marquee never started. And the ResizeObserver cannot
     * catch the swap: the span is block-level, so its border box stays exactly
     * as wide as the container while only the text inside it grows.
     *
     * Two more looks: after the next frame, for a layout that has not settled,
     * and when the font loader says it is done.
     */
    const raf = requestAnimationFrame(measure);
    let alive = true;
    void document.fonts?.ready.then(() => alive && measure());

    const ro = new ResizeObserver(measure);
    ro.observe(outer);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [children, speed, reduce]);

  return (
    <div
      ref={outerRef}
      className={`relative overflow-hidden ${className ?? ""}`}
      style={
        overflows
          ? {
              maskImage:
                "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
              WebkitMaskImage:
                "linear-gradient(to right, transparent 0, #000 14px, #000 calc(100% - 14px), transparent 100%)",
            }
          : undefined
      }
    >
      {overflows ? (
        <div className="flex whitespace-nowrap will-change-transform" style={{ animation: `marquee ${duration}s linear infinite` }}>
          <span ref={innerRef} className="pr-10">{children}</span>
          <span className="pr-10" aria-hidden>{children}</span>
        </div>
      ) : (
        <span ref={innerRef} className={`block whitespace-nowrap${reduce ? " truncate" : ""}`}>{children}</span>
      )}
    </div>
  );
}
