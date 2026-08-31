"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Device, { COVERS, EASE, ShelfHeader, TabBar, src, useOnScreen } from "./Device";

/**
 * Three moments of the app, each one the argument of the section it sits in.
 *
 * Not screenshots and not illustrations: the real interface, in the real
 * classes, at the real sizes — see `Device`. A landing that draws its own
 * approximation of a product is writing a cheque the first launch has to
 * cash.
 *
 * Every one of them loops a single errand rather than posing. A still of a
 * grid says "there are records in here", which nobody doubted; the point of
 * each of these is the *verb* in the heading above it.
 */

/* ══════════════════════════════════════════════ 01 · the shop-floor question */
export function ScreenScan({ scale }: { scale?: number }) {
  const { ref, live } = useOnScreen<HTMLDivElement>();
  const [caught, setCaught] = useState(false);

  useEffect(() => {
    if (!live) return setCaught(false);
    const t = setInterval(() => setCaught((c) => !c), 2600);
    return () => clearInterval(t);
  }, [live]);

  return (
    <div ref={ref}>
      <Device scale={scale}>
        <div className="relative flex h-full flex-col bg-black">
          {/* what the camera is looking at: a sleeve, close, out of focus */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src(COVERS.vandalist)}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-40 blur-[2px]"
          />
          <div className="absolute inset-0 bg-black/45" />

          {/* the shutter: the only feedback a camera can give that needs no word */}
          <AnimatePresence>
            {caught && (
              <motion.div
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.26 }}
                className="pointer-events-none absolute inset-0 z-40 bg-paper"
              />
            )}
          </AnimatePresence>

          <div className="relative z-10 flex shrink-0 items-center gap-2 px-3 pb-10 pt-[58px]">
            <Round>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </Round>
            {/* the destination, stated before anything is read */}
            <span className="flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 text-paper backdrop-blur-md">
              <span className="truncate text-[13px] font-medium">Mi Colección</span>
              <svg width="9" height="9" viewBox="0 0 8 8" fill="none" className="text-paper/60">
                <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </span>
            <Round>
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M8 1 L3.5 9 H7.5 L6.5 15 L12.5 6.5 H8.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </Round>
          </div>

          <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
            <motion.div
              animate={{ backgroundColor: caught ? "rgba(245,243,238,0.14)" : "rgba(245,243,238,0)" }}
              transition={{ duration: 0.2 }}
              className="relative aspect-[9/5] w-full max-w-[300px] overflow-hidden"
            >
              {(
                [
                  "-top-px -left-px border-t border-l",
                  "-top-px -right-px border-t border-r",
                  "-bottom-px -left-px border-b border-l",
                  "-bottom-px -right-px border-b border-r",
                ] as const
              ).map((pos) => (
                <span key={pos} className={`absolute h-6 w-6 ${pos} ${caught ? "border-paper" : "border-paper/80"}`} />
              ))}
              <span className="absolute inset-x-4 top-1/2 h-px bg-paper/50" />
              {!caught && (
                <motion.span
                  className="absolute inset-x-0 h-[2px] bg-[#f83a23]"
                  style={{ boxShadow: "0 0 14px 2px rgba(248,58,35,0.55)" }}
                  initial={{ top: "8%" }}
                  animate={{ top: ["8%", "92%", "8%"] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
            <p className="mt-5 text-center text-[13px] text-paper/70">
              Apunta al código de barras de la contraportada
            </p>
          </div>

          {/* the tray: a scan is a proposal, not a save */}
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
                  <img src={src(COVERS.vandalist)} alt="" className="h-11 w-11 rounded-md object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-paper">The Vandalist</span>
                    <span className="mt-0.5 block truncate text-[11px] text-paper/55">
                      2024 · IL · LP · +4 ediciones
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
              <span className="flex h-12 flex-[1.6] items-center justify-center truncate rounded-control bg-paper px-3 text-[13px] font-semibold text-ink">
                {caught ? "Añadir 1 a Mi Colección" : "Listo"}
              </span>
            </div>
          </div>
        </div>
      </Device>
    </div>
  );
}

/* ═══════════════════════════════════════════════════ 02 · the wishlist's exit */
export function ScreenWishlist({ scale }: { scale?: number }) {
  const { ref, live } = useOnScreen<HTMLDivElement>();
  const [got, setGot] = useState(false);

  useEffect(() => {
    if (!live) return setGot(false);
    const t = setInterval(() => setGot((g) => !g), 2800);
    return () => clearInterval(t);
  }, [live]);

  const wished = [COVERS.dune, COVERS.billie, COVERS.motomami, COVERS.arms];

  return (
    <div ref={ref}>
      <Device scale={scale}>
        <div className="flex h-full flex-col bg-surface">
          <ShelfHeader name="Lista de deseos" count={got ? 11 : 12} />

          <div className="min-h-0 flex-1 overflow-hidden px-4 pt-6">
            <div className="grid grid-cols-2 gap-x-4 gap-y-7">
              {wished.map((c, i) => (
                <motion.div key={c} layout className="relative" transition={{ duration: 0.5, ease: EASE }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src(c)}
                    alt=""
                    className="aspect-square w-full rounded-[3px] object-cover"
                    style={i === 0 && got ? { opacity: 0.25 } : undefined}
                  />
                  {i === 0 && (
                    <span className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl">
                      <motion.svg
                        width="14" height="14" viewBox="0 0 14 14" fill="none"
                        animate={{ scale: got ? [1, 1.35, 1] : 1 }}
                        transition={{ duration: 0.45, ease: EASE }}
                      >
                        <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                      </motion.svg>
                    </span>
                  )}
                  <span className="mt-2 block truncate text-[13px] font-medium text-paper">
                    {i === 0 ? "Dune: Part Two" : i === 1 ? "Hit Me Hard And Soft" : i === 2 ? "Motomami" : "Brothers In Arms"}
                  </span>
                  <span className="block truncate text-[11px] text-content-muted">
                    {i === 0 ? "Hans Zimmer" : i === 1 ? "Billie Eilish" : i === 2 ? "Rosalía" : "Dire Straits"}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>

          <TabBar />

          {/* the acknowledgement, with the undo the app really offers */}
          <AnimatePresence>
            {got && (
              <motion.div
                initial={{ opacity: 0, y: -14 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35 }}
                className="absolute inset-x-0 top-[58px] flex justify-center px-4"
              >
                <span className="flex items-center gap-2.5 rounded-full bg-[#1b1b1b] py-1.5 pl-1.5 pr-3 shadow-[0_10px_30px_rgba(0,0,0,0.6)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src(COVERS.dune)} alt="" className="h-8 w-8 rounded-full object-cover" />
                  <span className="text-[13px] text-paper">Dune → Mi Colección</span>
                  <span className="ml-1 text-[12px] text-paper/45">Deshacer</span>
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Device>
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ 03 · who else has it */
export function ScreenClub({ scale }: { scale?: number }) {
  const { ref, live } = useOnScreen<HTMLDivElement>();
  return (
    <div ref={ref}>
      <Device scale={scale}>
        <div className="flex h-full flex-col bg-surface">
          <div className="shrink-0 px-5 pt-[70px]">
            <p className="text-[11px] uppercase tracking-[0.2em] text-content-muted">Comunidad</p>
            <h3 className="mt-3 text-[19px] leading-tight text-paper">
              Quién más tiene <span className="text-paper/45">Rumours</span>
            </h3>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden px-5 pt-7">
            <Label>Amigos <span className="text-paper/30">2</span></Label>
            <div className="mt-4 space-y-3">
              <Row live={live} i={0}>
                <Face initials="BS" />
                <Text title="Bruno Sáez" detail="Lo tiene en Rarezas de mercadillo" />
              </Row>
            </div>

            <div className="mt-8">
              <Label>Racks <span className="text-paper/30">5</span></Label>
            </div>
            <div className="mt-4 space-y-3">
              <Row live={live} i={1}>
                <Strip ids={[COVERS.rumours, COVERS.etta, COVERS.zeppelin, COVERS.arms]} />
                <Text title="Cara B" detail="Luci Arroyo · 17 discos" />
              </Row>
              <Row live={live} i={2}>
                <Strip ids={[COVERS.pulp, COVERS.sunday, COVERS.demon, COVERS.estopa]} />
                <Text title="Sonido de sótano" detail="Inés Camarena · 13 discos" />
              </Row>
            </div>
          </div>

          <TabBar active={2} />
        </div>
      </Device>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────── pieces */

function Round({ children }: { children: React.ReactNode }) {
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur-md">
      {children}
    </span>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="flex items-baseline gap-2 text-[15px] font-medium text-paper">{children}</h4>
  );
}

function Row({ children, live, i }: { children: React.ReactNode; live: boolean; i: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={live ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
      transition={{ duration: 0.55, delay: 0.1 * i, ease: EASE }}
      className="flex items-center gap-3.5 rounded-[14px] bg-fill-subtle p-3"
    >
      {children}
    </motion.div>
  );
}

function Face({ initials }: { initials: string }) {
  return (
    <span className="mono flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-paper/10 text-[11px] text-paper/70">
      {initials}
    </span>
  );
}

function Strip({ ids }: { ids: string[] }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-[3px]">
      {ids.map((c) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={c} src={src(c)} alt="" className="h-11 w-11 object-cover" />
      ))}
    </span>
  );
}

function Text({ title, detail }: { title: string; detail: string }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate text-[13px] font-medium text-paper">{title}</span>
      <span className="mt-0.5 block truncate text-[11px] text-content-muted">{detail}</span>
    </span>
  );
}
