"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import type { Vinyl } from "@/lib/types";

// The 3D engine is the heaviest thing this product ships. On the landing it is
// decoration, so it loads after the page is readable and never blocks it.
const VinylShelf3D = dynamic(() => import("@/components/VinylShelf3D"), {
  ssr: false,
  loading: () => null,
});

/**
 * The shelf, used as wallpaper.
 *
 * The real carousel from the real product, drifting on its own behind the
 * landing. Inert by construction (see `ambient` in VinylShelf3D) and skipped
 * entirely for anyone who asked for less motion.
 */
export default function ShelfBackdrop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // let the mark and the copy paint first; the shelf arrives a beat later
    const t = setTimeout(() => setShow(true), 120);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 animate-[rise-in_900ms_ease-out_both]"
    >
      <VinylShelf3D ambient drift={0.11} vinilos={SHELF} onOpen={() => {}} />
    </div>
  );
}

/**
 * Sleeves for the wallpaper, written out rather than imported from the
 * catalogue: the landing has no business shipping the whole data file to draw
 * a background. Only the cover art is ever read.
 */
const SHELF: Vinyl[] = [
  ["tame-impala-currents-7252111", "Currents", "Tame Impala"],
  ["etta-james-at-last-5466884", "At Last!", "Etta James"],
  ["rosalia-lux-35578378", "Lux", "Rosalía"],
  ["fleetwood-mac-rumours-526351", "Rumours", "Fleetwood Mac"],
  ["gorillaz-demon-days-36145336", "Demon Days", "Gorillaz"],
  ["eagles-hotel-california-1571555", "Hotel California", "Eagles"],
  ["noga-erez-the-vandalist-31803860", "The Vandalist", "Noga Erez"],
  ["led-zeppelin-led-zeppelin-iv-1015465", "Led Zeppelin IV", "Led Zeppelin"],
  ["rosalia-motomami-23206178", "Motomami", "Rosalía"],
  ["dire-straits-brothers-in-arms-2462721", "Brothers In Arms", "Dire Straits"],
  ["various-pulp-fiction-music-from-the-motion-picture-376354", "Pulp Fiction", "Various"],
  ["billie-eilish-hit-me-hard-and-soft-34773263", "Hit Me Hard And Soft", "Billie Eilish"],
  ["cypress-hill-black-sunday-12387973", "Black Sunday", "Cypress Hill"],
  ["bad-bunny-debi-tirar-mas-fotos-35474179", "Debí Tirar Más Fotos", "Bad Bunny"],
  ["hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571", "Dune: Part Two", "Hans Zimmer"],
  ["estopa-estopa-9267144", "Estopa", "Estopa"],
  ["elton-john-diamonds-13731060", "Diamonds", "Elton John"],
  ["rosalia-el-mal-querer-12746598", "El Mal Querer", "Rosalía"],
].map(([id, title, artist]) => ({
  id,
  title,
  artist,
  cover: `/covers/${id}.jpg`,
  palette: ["#888", "#666", "#444", "#222", "#000"],
  year: 0,
  genre: "",
  label: "",
  country: "",
  discogsId: null,
  previewUrl: null,
  tracklist: [],
}));
