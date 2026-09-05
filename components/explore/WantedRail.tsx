"use client";

import { useEffect, useState } from "react";
import { Cover } from "@/components/ui/Avatar";
import Skeleton, { SkeletonText } from "@/components/ui/Skeleton";
import CatalogueSheet, { type CatalogueItem } from "@/components/CatalogueSheet";
import type { Vinyl } from "@/lib/types";

/**
 * A chart of records people are still looking for.
 *
 * Every release on Discogs carries how many collectors have it and how many
 * want it, filled in by millions of people over twenty years. Sorted by want,
 * that is the closest thing this world has to an honest chart: not plays, not
 * a label's campaign — how many people have written a record down as something
 * they are still hunting. Which is the same question this whole app is about.
 *
 * The number is shown, and that is most of why the rail works. "1.732 lo
 * quieren" is a fact somebody can weigh; a row of covers under the word
 * "tendencia" is an assertion they have to take on trust.
 *
 * Reading is one tap and keeping is another, as everywhere else: the cover
 * opens the record's sheet, and the sheet has the button.
 */
export type WantedRow = CatalogueItem & { want: number; have: number };

export default function WantedRail({
  title,
  subtitle,
  genre,
  ownedIds,
  targetName,
  onSave,
  onSaved,
  savingId,
  savedIds,
}: {
  title: string;
  subtitle: string;
  /** absent for the year's chart; a genre makes it personal */
  genre?: string | null;
  ownedIds: Set<number>;
  targetName: string;
  onSave: (row: WantedRow) => unknown;
  /** el disco ya es tuyo: quien tenga la pantalla del disco se lo queda */
  onSaved?: (vinyl: Vinyl) => void;
  savingId: number | null;
  savedIds: Set<number>;
}) {
  const [rows, setRows] = useState<WantedRow[] | null>(null);
  const [looking, setLooking] = useState<WantedRow | null>(null);

  useEffect(() => {
    let alive = true;
    setRows(null);
    const q = genre ? `?genre=${encodeURIComponent(genre)}` : "";
    fetch(`/api/discogs/trending${q}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        // what you already own is not a recommendation
        setRows((d.results ?? []).filter((r: WantedRow) => !ownedIds.has(r.id)).slice(0, 12));
      })
      .catch(() => alive && setRows([]));
    return () => {
      alive = false;
    };
    // ownedIds changes identity on every render; the ids themselves rarely do
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre]);

  // nothing to say is better than a heading over an empty strip
  if (rows !== null && rows.length === 0) return null;

  return (
    <section className="mt-9">
      {/* El mismo encabezado que las demás secciones de Explorar: un título que
          se lee y una línea que dice por qué mirar. */}
      <h2 className="text-heading font-medium leading-tight text-paper">{title}</h2>
      <p className="mt-1.5 text-sub text-content-muted">{subtitle}</p>

      {/* The same rail as the racks above it: this is something to skim past,
          and it bleeds off the right edge so the row says there is more. */}
      <ul className="rail rail-page mt-4 flex gap-4 pb-2">
        {rows === null
          ? Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="w-[38vw] shrink-0 sm:w-[168px]">
                <Skeleton className="aspect-square w-full" />
                <SkeletonText className="mt-2.5" w={i % 2 ? "62%" : "82%"} />
                <SkeletonText className="mt-1.5" w="46%" />
              </li>
            ))
          : rows.map((r) => (
              <li key={r.id} className="w-[38vw] shrink-0 snap-start sm:w-[168px]">
                <button
                  onClick={() => setLooking(r)}
                  className="pressable block w-full text-left"
                >
                  <span className="relative block">
                    <Cover
                      src={r.cover_image ?? r.thumb ?? null}
                      className="w-full rounded-[3px]"
                    />
                    {savedIds.has(r.id) && (
                      <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/75 text-paper backdrop-blur-xl">
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                          <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </span>
                    )}
                  </span>
                  <span className="mt-2.5 block truncate text-sub font-medium text-paper">
                    {r.title}
                  </span>
                  {/* the number, because it is the argument */}
                  <span className="mt-1 block truncate text-caption text-content-muted">
                    {r.want.toLocaleString("es-ES")} lo quieren
                  </span>
                </button>
              </li>
            ))}
      </ul>

      <CatalogueSheet
        item={looking}
        onClose={() => setLooking(null)}
        targetName={targetName}
        saved={Boolean(looking && savedIds.has(looking.id))}
        busy={savingId === looking?.id}
        onSave={() => (looking ? onSave(looking) : null)}
        onSaved={onSaved}
      />
    </section>
  );
}
