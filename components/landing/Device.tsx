"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/**
 * The app, running, inside a phone — on the page that is selling it.
 *
 * The landing below the hero was five screens of type: a headline, a lead, a
 * list of label/value rows and an aside, three times over. Every word of it
 * was true and none of it showed the product, which on a landing page is the
 * one job the copy cannot do for itself. Nobody has ever been persuaded to
 * install a thing they have not seen.
 *
 * **Built at real size and then scaled.** Everything inside is laid out at
 * 390×844 in the app's own classes and numbers — the 54px tab bar with its
 * four labelled destinations, the 48px glass pucks, the grid's real
 * `gap-x-4 gap-y-7`, the scanner's viewfinder and tray card. One transform
 * shrinks it to fit the column. Inventing smaller values that "look about
 * right" is how a landing ends up showing an app nobody wrote: the
 * proportions drift, the type goes relatively huge, and the promise breaks on
 * first use.
 *
 * Each screen animates only while it is on screen, and holds still under
 * `prefers-reduced-motion`.
 */

const W = 390;
const H = 844;
const BEZEL = 7;

export const COVERS = {
  lux: "rosalia-lux-35578378",
  currents: "tame-impala-currents-7252111",
  demon: "gorillaz-demon-days-36145336",
  zeppelin: "led-zeppelin-led-zeppelin-iv-1015465",
  rumours: "fleetwood-mac-rumours-526351",
  pulp: "various-pulp-fiction-music-from-the-motion-picture-376354",
  vandalist: "noga-erez-the-vandalist-31803860",
  etta: "etta-james-at-last-5466884",
  sunday: "cypress-hill-black-sunday-12387973",
  billie: "billie-eilish-hit-me-hard-and-soft-34773263",
  dune: "hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571",
  estopa: "estopa-estopa-9267144",
  motomami: "rosalia-motomami-23206178",
  arms: "dire-straits-brothers-in-arms-2462721",
};
export const src = (slug: string) => `/covers/${slug}.jpg`;

/** the shell: bezel is padding, so the frame measures screen + bezel on both axes */
export default function Device({
  scale = 0.62,
  children,
}: {
  scale?: number;
  children: React.ReactNode;
}) {
  const w = W * scale;
  const h = H * scale;
  return (
    <div
      aria-hidden
      className="relative select-none"
      style={{ width: w + BEZEL * 2 }}
    >
      <span className="absolute inset-x-8 bottom-2 h-20 rounded-full bg-black/70 blur-3xl" />
      <div
        className="relative rounded-[46px] border border-paper/[0.16] bg-ink shadow-[0_40px_100px_rgba(0,0,0,0.75)]"
        style={{ width: w + BEZEL * 2, height: h + BEZEL * 2, padding: BEZEL }}
      >
        <div
          className="relative overflow-hidden rounded-[40px] bg-surface"
          style={{ width: w, height: h }}
        >
          <div
            style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            {children}
          </div>
          {/* the island, over everything, the way the hardware is */}
          <span
            className="absolute left-1/2 z-40 -translate-x-1/2 rounded-full bg-ink"
            style={{ top: 11 * scale, height: 34 * scale, width: 122 * scale }}
          />
        </div>
      </div>
    </div>
  );
}

/** runs its children's animation only while the device is actually being looked at */
export function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }, []);
  return { ref, live: inView && !reduced };
}

/* ─────────────────────────────────────────────────────────── shared furniture */

export function Puck({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl">
      {children}
    </span>
  );
}

export function ShelfHeader({ name, count }: { name: string; count: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2 px-3 pt-[58px]">
      <Puck>
        <svg width="14" height="14" viewBox="0 0 83 83" fill="none">
          <rect width="22.33" height="83" fill="currentColor" />
          <rect x="30.33" width="22.33" height="83" fill="currentColor" />
          <rect x="60.67" width="22.33" height="83" fill="currentColor" />
        </svg>
      </Puck>
      <div className="flex min-w-0 flex-1 justify-center">
        <span className="flex h-12 max-w-[230px] items-center gap-1.5 rounded-full bg-ink/72 px-4 text-paper/90 backdrop-blur-xl">
          <span className="truncate text-[13px] font-medium">{name}</span>
          <span className="text-[13px] text-paper/40">{count}</span>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="shrink-0 text-paper/50">
            <path d="M2.5 4.5 L6 8 L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
      <Puck>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.4" />
          <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </Puck>
    </div>
  );
}

export function TabBar({ active = 0 }: { active?: number }) {
  const tabs = [
    { label: "Colección", icon: <Disc filled={active === 0} /> },
    { label: "Actividad", icon: <Waves /> },
    { label: "Explorar", icon: <Glass /> },
    { label: "Perfil", icon: <Person /> },
  ];
  return (
    <div className="shrink-0 border-t border-paper/10 bg-ink/92 pb-6 backdrop-blur-xl">
      <div className="flex items-stretch">
        {tabs.map((t, i) => (
          <div key={t.label} className="flex-1">
            <div className="relative flex h-[54px] flex-col items-center justify-center gap-[3px]">
              <span className={i === active ? "text-paper" : "text-paper/40"}>{t.icon}</span>
              <span
                className={`text-[10px] leading-none ${
                  i === active ? "font-semibold text-paper" : "font-medium text-paper/40"
                }`}
              >
                {t.label}
              </span>
              {i === 1 && (
                <span className="absolute right-[calc(50%-18px)] top-[9px] h-[7px] w-[7px] rounded-full bg-[#f83a23]" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Disc({ filled = false }: { filled?: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth={filled ? 1.8 : 1.3} />
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth={filled ? 1.4 : 1.1} opacity={0.6} />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}
function Waves() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path d="M3 10h2.2M14.8 10H17" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
      <path d="M6.6 6.4v7.2M10 4.2v11.6M13.4 6.4v7.2" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}
function Glass() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="9" cy="9" r="5.6" stroke="currentColor" strokeWidth="1.35" />
      <path d="M13.2 13.2 17 17" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}
function Person() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <circle cx="10" cy="6.6" r="3" stroke="currentColor" strokeWidth="1.35" />
      <path d="M4.2 16.6C4.8 13.5 7.1 11.8 10 11.8s5.2 1.7 5.8 4.8" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

export const EASE = [0.16, 1, 0.3, 1] as const;
export { motion };
