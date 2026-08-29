"use client";

import { useEffect, useRef } from "react";

/**
 * A train of sleeves crossing the screen and bouncing off the edges.
 *
 * The reference for this is the old screensaver everybody has watched waiting
 * for a corner hit, and it is the right joke for a 404: something that has
 * nowhere to be, moving anyway. Ours is made of records rather than a logo,
 * because a dead end in this product should still be made of the product.
 *
 * **How it moves.** One point travels in a straight line and reflects off the
 * viewport rectangle — position and velocity, no physics engine, no library.
 * Every sleeve after the first is that same path, sampled further back in
 * time: the head's positions are pushed onto a short ring buffer, and sleeve N
 * reads the entry N steps behind it. That is what makes it a train rather than
 * a cluster — they follow the leader exactly, including through the bounces,
 * which is the part that looks alive.
 *
 * **Why a ring buffer and not springs.** Chasing with easing gives you a comet
 * that cuts the corners: the followers shortcut across the bounce instead of
 * going where the leader went. Replaying the actual path costs one array and
 * gets the corners right.
 *
 * **Cost.** One rAF, one transform per sleeve, nothing else touched — no
 * layout, no paint, no React state. The covers are the ones already on disk
 * for the demo shelf, so the page adds no requests it did not already have.
 */

/**
 * The gap between sleeves, as a fraction of a sleeve.
 *
 * Measured in distance travelled, not in frames — which is the second version
 * of this. Counting frames ties the spacing to the speed and to the refresh
 * rate: the same number that looked right on a desktop packed the train into a
 * single thick sleeve on a phone, where the viewport is a third as wide and
 * everything moves a third as far per frame. Arc length does not care about
 * either.
 *
 * 0.26 leaves each record showing barely a quarter of itself: the train reads
 * as one thick stack sliding across the screen, not as a line of records.
 */
const GAP = 0.26;
/** Viewport widths per second: a drift, not a projectile. */
const SPEED = 0.13;

export default function NotFoundTrain({ covers }: { covers: string[] }) {
  const items = useRef<(HTMLDivElement | null)[]>([]);
  const frame = useRef(0);

  useEffect(() => {
    const nodes = items.current.filter(Boolean) as HTMLDivElement[];
    if (!nodes.length) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const size = () => nodes[0].offsetWidth;

    // start low and off-centre, heading up-right at an angle that is not 45° —
    // a diagonal that divides the screen evenly reads as a wipe rather than as
    // something wandering
    let x = window.innerWidth * 0.22;
    let y = window.innerHeight * 0.68;
    let vx = 1;
    let vy = -0.62;

    /** the leader's path, with how far it had travelled at each point */
    const path: { x: number; y: number; d: number }[] = [];
    let travelled = 0;

    /**
     * The point on the path a given distance behind the head.
     *
     * Walked rather than indexed, and interpolated between the two samples it
     * falls between — otherwise the followers snap from sample to sample at
     * low frame rates, which is visible exactly when the device is already
     * struggling.
     */
    const behind = (gap: number) => {
      const target = travelled - gap;
      if (target <= 0) return path[path.length - 1] ?? path[0];
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i];
        const b = path[i + 1];
        if (b.d <= target) {
          const span = a.d - b.d || 1;
          const t = (a.d - target) / span;
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
        }
      }
      return path[path.length - 1];
    };

    const place = (node: HTMLDivElement, p: { x: number; y: number }) => {
      node.style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
    };

    if (reduced) {
      // a still frame of the same idea: the train, parked diagonally
      const still = nodes[0].offsetWidth * GAP;
      nodes.forEach((n, i) => place(n, { x: x - i * still * 0.86, y: y - i * still * 0.53 }));
      return;
    }

    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      const s = size();
      const maxX = window.innerWidth - s;
      const maxY = window.innerHeight - s;
      const travel = window.innerWidth * SPEED * dt;

      x += vx * travel;
      y += vy * travel;

      // reflect, and clamp on the same frame: without the clamp a resize can
      // leave the head outside the box and it never comes back
      if (x <= 0 || x >= maxX) {
        vx = -vx;
        x = Math.max(0, Math.min(maxX, x));
      }
      if (y <= 0 || y >= maxY) {
        vy = -vy;
        y = Math.max(0, Math.min(maxY, y));
      }

      travelled += travel;
      path.unshift({ x, y, d: travelled });

      const span = s * GAP * (nodes.length - 1);
      // keep only the path the tail still needs, plus a little slack
      while (path.length > 2 && travelled - path[path.length - 1].d > span + s) {
        path.pop();
      }

      nodes.forEach((node, i) => {
        const p = i === 0 ? { x, y } : behind(i * s * GAP);
        if (p) place(node, p);
      });

      frame.current = requestAnimationFrame(step);
    };

    frame.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame.current);
  }, [covers.length]);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden">
      {covers.map((src, i) => (
        <div
          key={`${src}-${i}`}
          ref={(el) => {
            items.current[i] = el;
          }}
          className="absolute left-0 top-0 h-[26vw] w-[26vw] max-h-[210px] max-w-[210px] will-change-transform"
          style={{
            // every sleeve at full strength: the overlap and the z-order give
            // the train its direction, so fading the tail only bought dirty
            // covers
            zIndex: covers.length - i,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            className="h-full w-full rounded-[3px] object-cover shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
          />
        </div>
      ))}
    </div>
  );
}
