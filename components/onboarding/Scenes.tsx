"use client";

import { motion } from "framer-motion";

/**
 * The five ideas, shown in the app's own interface.
 *
 * Not illustrations *about* the app — the app. Every scene here is built from
 * the same classes the real screens use, at the real sizes: the collection
 * grid with its `gap-x-4 gap-y-7` and the titles under the sleeves, the rack
 * card at radius 14 on `bg-fill-subtle`, the scanner's viewfinder corners and
 * its tray card, the glass tick that sits on a wished cover. Somebody who
 * swipes through this and then arrives at the shelf should recognise it, not
 * discover it.
 *
 * Each is a **fragment**, cropped and faded at the bottom rather than fitted
 * into a frame. A whole phone drawn inside a phone is a diagram of a device
 * you are already holding; a piece of the interface reads as a window onto
 * where you are going.
 */

const EASE = [0.16, 1, 0.3, 1] as const;
const src = (slug: string) => `/covers/${slug}.jpg`;

/** every scene sits in the same box and fades out at the foot */
function Stage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div className="absolute inset-x-0 top-0">{children}</div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface to-transparent" />
    </div>
  );
}

const rise = (i: number) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.55, delay: 0.06 * i, ease: EASE },
});

/* --------------------------------------------------------------- 1. shelf */
/** the collection grid, exactly as the phone draws it */
export function SceneCollection() {
  const covers = [
    ["rosalia-lux-35578378", "LUX", "Rosalía"],
    ["tame-impala-currents-7252111", "Currents", "Tame Impala"],
    ["gorillaz-demon-days-36145336", "Demon Days", "Gorillaz"],
    ["led-zeppelin-led-zeppelin-iv-1015465", "Led Zeppelin IV", "Led Zeppelin"],
  ];
  return (
    <Stage>
      <div className="grid grid-cols-2 gap-x-4 gap-y-7 px-2">
        {covers.map(([c, t, a], i) => (
          <motion.div key={c} {...rise(i)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(c)} alt="" className="aspect-square w-full rounded-[3px] object-cover" />
            <span className="mt-2 block truncate text-sub font-medium text-paper">{t}</span>
            <span className="block truncate text-caption text-content-muted">{a}</span>
          </motion.div>
        ))}
      </div>
    </Stage>
  );
}

/* ----------------------------------------------------------- 2. community */
/** the bridge line that hangs under a record, and where it leads */
export function SceneCommunity() {
  return (
    <Stage>
      <div className="px-2">
        <motion.p {...rise(0)} className="text-center text-sub text-paper/60">
          <span className="text-paper/85">Lo tienen 2 amigos</span>
          <span className="text-paper/25"> · </span>
          está en 3 racks
        </motion.p>

        <div className="mt-6 space-y-3">
          <motion.div {...rise(1)}>
            <Person name="Bruno Sáez" detail="Lo tiene en Rarezas de mercadillo" initials="BS" />
          </motion.div>
          <motion.div {...rise(2)}>
            <RackCard
              title="Sonido de sótano"
              detail="Luci Arroyo · 13 discos"
              covers={[
                "cypress-hill-black-sunday-12387973",
                "gorillaz-demon-days-36145336",
                "estopa-estopa-9267144",
                "various-pulp-fiction-music-from-the-motion-picture-376354",
              ]}
            />
          </motion.div>
        </div>
      </div>
    </Stage>
  );
}

/* --------------------------------------------------------------- 3. racks */
export function SceneRacks() {
  return (
    <Stage>
      <div className="space-y-3 px-2">
        <motion.div {...rise(0)}>
          <RackCard
            title="Traído de Lisboa"
            detail="13 discos"
            covers={[
              "rosalia-motomami-23206178",
              "noga-erez-the-vandalist-31803860",
              "tre-funk-iii-planeetta-funk-9219041",
              "etta-james-at-last-5466884",
            ]}
          />
        </motion.div>
        <motion.div {...rise(1)}>
          <RackCard
            title="Lo que pongo cuando cocino"
            detail="17 discos"
            covers={[
              "fleetwood-mac-rumours-526351",
              "elton-john-diamonds-13731060",
              "estopa-estopa-9267144",
              "tame-impala-currents-7252111",
            ]}
          />
        </motion.div>

        {/* the thing that makes a rack a rack: it has an address */}
        <motion.div
          {...rise(2)}
          className="flex items-center gap-2 rounded-full bg-fill-subtle px-4 py-3"
        >
          <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden className="shrink-0 text-content-faint">
            <path d="M5.6 8.4a2.6 2.6 0 0 0 3.9.3l1.7-1.7a2.6 2.6 0 0 0-3.7-3.7l-1 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            <path d="M8.4 5.6a2.6 2.6 0 0 0-3.9-.3L2.8 7a2.6 2.6 0 0 0 3.7 3.7l1-1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <span className="mono truncate text-caption text-content-muted">
            rackr.club/u/alvaro/traido-de-lisboa
          </span>
        </motion.div>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------- 4. scanner */
export function SceneScanner() {
  return (
    <Stage>
      <div className="px-2">
        <div className="relative overflow-hidden rounded-[14px] bg-black px-5 pb-5 pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src("noga-erez-the-vandalist-31803860")}
            alt=""
            className="absolute inset-0 h-full w-full scale-125 object-cover opacity-35 blur-[2px]"
          />
          <div className="absolute inset-0 bg-black/45" />

          <div className="relative mx-auto aspect-[9/5] w-full max-w-[240px] overflow-hidden">
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
            <motion.span
              className="absolute inset-x-0 h-[2px] bg-accent/80"
              style={{ boxShadow: "0 0 14px 2px rgba(248,58,35,0.55)" }}
              initial={{ top: "8%" }}
              animate={{ top: ["8%", "92%", "8%"] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
            />
          </div>

          {/* the tray card, in the scanner's own glass */}
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, type: "spring", damping: 30, stiffness: 400 }}
            className="relative mt-6 flex items-center gap-3 rounded-lg bg-white/[0.16] px-3 py-2.5 backdrop-blur-2xl"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src("noga-erez-the-vandalist-31803860")}
              alt=""
              className="h-11 w-11 shrink-0 rounded-md object-cover"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sub font-medium text-paper">The Vandalist</span>
              <span className="mt-0.5 block truncate text-caption text-paper/55">
                2024 · IL · LP · +4 ediciones
              </span>
            </span>
          </motion.div>
        </div>
      </div>
    </Stage>
  );
}

/* ------------------------------------------------------------ 5. wishlist */
export function SceneWishlist() {
  const wished = [
    "hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571",
    "billie-eilish-hit-me-hard-and-soft-34773263",
  ];
  return (
    <Stage>
      <div className="px-2">
        <div className="grid grid-cols-2 gap-x-4">
          {wished.map((c, i) => (
            <motion.div key={c} {...rise(i)} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src(c)} alt="" className="aspect-square w-full rounded-[3px] object-cover" />
              {/* the tick that ends a want: the real one, in the real glass */}
              {i === 0 && (
                <motion.span
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.75, duration: 0.45, ease: EASE }}
                  className="absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.span>
              )}
            </motion.div>
          ))}
        </div>

        {/* and the acknowledgement it produces, in the shape the app uses */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.4 }}
          className="mt-5 flex justify-center"
        >
          <span className="flex items-center gap-2.5 rounded-full bg-[#1b1b1b] py-1.5 pl-1.5 pr-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src(wished[0])} alt="" className="h-8 w-8 rounded-full object-cover" />
            <span className="text-sub text-paper">Dune → Mi Colección</span>
          </span>
        </motion.div>
      </div>
    </Stage>
  );
}

/* ----------------------------------------------------------------- pieces */

/** the community bridge's person card */
function Person({
  name,
  detail,
  initials,
}: {
  name: string;
  detail: string;
  initials: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-fill-subtle p-3">
      <span className="mono flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/10 text-caption text-paper/70">
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sub font-medium text-paper">{name}</span>
        <span className="mt-0.5 block truncate text-caption text-content-muted">{detail}</span>
      </span>
    </div>
  );
}

/** the rack card, the same one the community panel and the racks list use */
function RackCard({
  title,
  detail,
  covers,
}: {
  title: string;
  detail: string;
  covers: string[];
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-[14px] bg-fill-subtle p-3">
      <span className="flex shrink-0 overflow-hidden rounded-[3px]">
        {covers.map((c) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c} src={src(c)} alt="" className="h-11 w-11 object-cover" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sub font-medium text-paper">{title}</span>
        <span className="mt-0.5 block truncate text-caption text-content-muted">{detail}</span>
      </span>
    </div>
  );
}
