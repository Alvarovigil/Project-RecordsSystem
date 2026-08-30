"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * The app, running, inside a phone — not a drawing of it.
 *
 * **Built at real size and then scaled.** The screen inside is laid out at
 * 390×844 with the app's own numbers: a 54px tab bar, 10px labels, 48px glass
 * controls, the grid's real `gap-x-4 gap-y-7`. A single `transform: scale()`
 * shrinks the whole thing to fit the page. The alternative — inventing small
 * values that "look about right" — is how a preview ends up being a picture of
 * an app nobody wrote: the proportions drift, the type goes relatively huge,
 * and the thing on the install page stops matching the thing you install.
 *
 * **And it plays the errand, not a pose.** A still of a grid says "there are
 * records in here", which nobody doubted. The loop shows the reason the icon
 * is worth having: a sleeve in your hand, the camera, and the record on your
 * shelf four seconds later. That is the same argument the copy underneath
 * makes, made once in pictures.
 *
 * Presentational only, `aria-hidden`, and still on `prefers-reduced-motion`:
 * a screen reader that read out four scenes of fake interface would be reading
 * the wallpaper aloud, and a loop that cannot be stopped is a bad neighbour on
 * a page somebody is trying to read instructions from.
 */

const W = 390;
const H = 844;
const SCALE = 0.6;

const COVERS = [
  "rosalia-lux-35578378",
  "tame-impala-currents-7252111",
  "gorillaz-demon-days-36145336",
  "led-zeppelin-led-zeppelin-iv-1015465",
  "fleetwood-mac-rumours-526351",
  "various-pulp-fiction-music-from-the-motion-picture-376354",
];

const SCANNED = {
  cover: "noga-erez-the-vandalist-31803860",
  title: "The Vandalist",
  artist: "Noga Erez",
  edition: "2024 · IL · LP · +4 ediciones",
};

const src = (slug: string) => `/covers/${slug}.jpg`;

/** how long each beat of the loop holds, in ms */
const BEATS = [2600, 2200, 2600, 3000] as const;

export default function PhonePreview() {
  const [scene, setScene] = useState(0);
  const [still, setStill] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) return setStill(true);
    const t = setTimeout(() => setScene((s) => (s + 1) % BEATS.length), BEATS[scene]);
    return () => clearTimeout(t);
  }, [scene]);

  const shown = still ? 0 : scene;

  return (
    <div aria-hidden className="relative mx-auto select-none" style={{ width: W * SCALE }}>
      <span className="absolute inset-x-6 bottom-1 h-16 rounded-full bg-black/70 blur-2xl" />

      <div
        className="relative overflow-hidden rounded-[46px] border border-paper/[0.16] bg-ink p-[7px] shadow-[0_30px_80px_rgba(0,0,0,0.7)]"
        style={{ width: W * SCALE, height: H * SCALE + 14 }}
      >
        <div
          className="relative overflow-hidden rounded-[40px] bg-surface"
          style={{ width: W * SCALE, height: H * SCALE }}
        >
          <div
            style={{
              width: W,
              height: H,
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
            }}
          >
            <AnimatePresence initial={false} mode="popLayout">
              {(shown === 0 || shown === 3) && (
                <motion.div
                  key="shelf"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0"
                >
                  <Collection justAdded={shown === 3} />
                </motion.div>
              )}
              {(shown === 1 || shown === 2) && (
                <motion.div
                  key="scanner"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.35 }}
                  className="absolute inset-0"
                >
                  <Scanner caught={shown === 2} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* the island, drawn over everything the way the hardware is */}
          <span
            className="absolute left-1/2 z-20 -translate-x-1/2 rounded-full bg-ink"
            style={{ top: 11 * SCALE + 6, height: 34 * SCALE, width: 122 * SCALE }}
          />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ scenes */
/* Everything below is written at 390px, in the app's own classes and sizes.  */

function Collection({ justAdded }: { justAdded: boolean }) {
  const covers = justAdded ? [SCANNED.cover, ...COVERS] : COVERS;

  return (
    <div className="flex h-full flex-col bg-surface">
      {/* the shelf's header: three glass controls, the rack in the middle */}
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
            <span className="text-[13px] font-medium">Mi Colección</span>
            <span className="text-[13px] text-paper/40">{justAdded ? 129 : 128}</span>
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className="text-paper/50">
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

      <div className="min-h-0 flex-1 overflow-hidden px-4 pt-6">
        <div className="grid grid-cols-2 gap-x-4 gap-y-7">
          {covers.slice(0, 6).map((c, i) => (
            <motion.div
              key={c}
              layout
              initial={justAdded && i === 0 ? { opacity: 0, scale: 0.94 } : false}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(c)} alt="" className="aspect-square w-full rounded-[3px] object-cover" />
              <span className="mt-2 block truncate text-[13px] font-medium text-paper">
                {i === 0 && justAdded ? SCANNED.title : TITLES[c]?.[0]}
              </span>
              <span className="block truncate text-[11px] text-content-muted">
                {i === 0 && justAdded ? SCANNED.artist : TITLES[c]?.[1]}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      <TabBar />

      {/* the acknowledgement, in the corner the real one drops into */}
      <AnimatePresence>
        {justAdded && (
          <motion.div
            initial={{ opacity: 0, y: -14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35, delay: 0.15 }}
            className="absolute inset-x-0 top-[58px] flex justify-center px-4"
          >
            <span className="flex items-center gap-2.5 rounded-full bg-[#1b1b1b] py-1.5 pl-1.5 pr-4 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(SCANNED.cover)} alt="" className="h-8 w-8 rounded-full object-cover" />
              <span className="text-[13px] text-paper">{SCANNED.title} → Mi Colección</span>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Scanner({ caught }: { caught: boolean }) {
  return (
    <div className="relative flex h-full flex-col bg-black">
      {/* what the camera is looking at: a sleeve, close, out of focus */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src(SCANNED.cover)}
        alt=""
        className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-[2px]"
      />
      <div className="absolute inset-0 bg-black/45" />

      <div className="relative z-10 flex shrink-0 items-center gap-2 px-3 pb-10 pt-[58px]">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur-md">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 text-paper backdrop-blur-md">
          <span className="truncate text-[13px] font-medium">Mi Colección</span>
          <svg width="9" height="9" viewBox="0 0 8 8" fill="none" className="text-paper/60">
            <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
        </span>
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur-md">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M8 1 L3.5 9 H7.5 L6.5 15 L12.5 6.5 H8.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
          </svg>
        </span>
      </div>

      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <motion.div
          animate={caught ? { backgroundColor: "rgba(245,243,238,0.14)" } : { backgroundColor: "rgba(245,243,238,0)" }}
          transition={{ duration: 0.2 }}
          className="relative aspect-[9/5] w-full max-w-[300px]"
        >
          {(
            [
              "-top-px -left-px border-t border-l",
              "-top-px -right-px border-t border-r",
              "-bottom-px -left-px border-b border-l",
              "-bottom-px -right-px border-b border-r",
            ] as const
          ).map((pos) => (
            <span key={pos} className={`absolute h-6 w-6 border-paper/80 ${pos}`} />
          ))}
          <span className="absolute inset-x-4 top-1/2 h-px bg-paper/50" />
        </motion.div>
        <p className="mt-5 text-center text-[13px] text-paper/70">
          Apunta al código de barras de la contraportada
        </p>
      </div>

      {/* the tray: nothing is saved until the run is committed */}
      <div className="relative z-20 shrink-0 px-3">
        <AnimatePresence>
          {caught && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", damping: 30, stiffness: 420 }}
              className="flex items-center gap-3 rounded-lg bg-white/[0.16] px-3 py-2.5 backdrop-blur-2xl"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(SCANNED.cover)} alt="" className="h-11 w-11 rounded-md object-cover" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-paper">
                  {SCANNED.title}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-paper/55">
                  {SCANNED.edition}
                </span>
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="relative z-10 shrink-0 px-3 pb-9 pt-8">
        <div className="flex items-center gap-2">
          <span className="flex h-12 flex-1 items-center justify-center rounded-control bg-white/10 text-[13px] font-medium text-paper backdrop-blur-md">
            Escribir el código
          </span>
          <motion.span
            layout
            className="flex h-12 flex-[1.6] items-center justify-center truncate rounded-control bg-paper px-3 text-[13px] font-semibold text-ink"
          >
            {caught ? "Añadir 1 a Mi Colección" : "Listo"}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- parts */

function Puck({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl">
      {children}
    </span>
  );
}

/** the real bar: four destinations, labelled, 54px tall */
function TabBar() {
  const tabs = [
    { label: "Colección", icon: <Disc filled />, on: true },
    { label: "Actividad", icon: <Waves />, on: false },
    { label: "Explorar", icon: <Glass />, on: false },
    { label: "Perfil", icon: <Person />, on: false },
  ];
  return (
    <div className="shrink-0 border-t border-paper/10 bg-ink/92 pb-6 backdrop-blur-xl">
      <div className="flex items-stretch">
        {tabs.map((t) => (
          <div key={t.label} className="flex-1">
            <div className="relative flex h-[54px] flex-col items-center justify-center gap-[3px]">
              <span className={t.on ? "text-paper" : "text-paper/40"}>{t.icon}</span>
              <span
                className={`text-[10px] leading-none ${
                  t.on ? "font-semibold text-paper" : "font-medium text-paper/40"
                }`}
              >
                {t.label}
              </span>
              {t.label === "Actividad" && (
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

const TITLES: Record<string, [string, string]> = {
  "rosalia-lux-35578378": ["LUX", "Rosalía"],
  "tame-impala-currents-7252111": ["Currents", "Tame Impala"],
  "gorillaz-demon-days-36145336": ["Demon Days", "Gorillaz"],
  "led-zeppelin-led-zeppelin-iv-1015465": ["Led Zeppelin IV", "Led Zeppelin"],
  "fleetwood-mac-rumours-526351": ["Rumours", "Fleetwood Mac"],
  "various-pulp-fiction-music-from-the-motion-picture-376354": ["Pulp Fiction", "Varios"],
};
