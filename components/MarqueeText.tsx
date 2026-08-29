"use client";

import { useEffect, useRef, useState } from "react";

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

  useEffect(() => {
    const outer = outerRef.current;
    if (!outer) return;
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
      const overflow = outer.scrollWidth > outer.clientWidth + 1;
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
  }, [children, speed]);

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
        <span ref={innerRef} className="block whitespace-nowrap">{children}</span>
      )}
    </div>
  );
}
