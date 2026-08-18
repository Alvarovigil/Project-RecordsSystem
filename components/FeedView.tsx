"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRepository } from "@/hooks/useRepository";
import type { FeedEntry } from "@/lib/data/types";

/**
 * What the people and lists you follow have been adding.
 *
 * Grouped by person and list rather than one row per record: "Marta añadió 4
 * discos a Sonido de sótano" is a thing that happened; four separate lines are
 * just noise wearing a timestamp.
 */
export default function FeedView() {
  const repo = useRepository();
  const [entries, setEntries] = useState<FeedEntry[] | null>(null);

  useEffect(() => {
    let alive = true;
    repo
      .feed()
      .then((f) => alive && setEntries(f))
      .catch(() => alive && setEntries([]));
    return () => {
      alive = false;
    };
  }, [repo]);

  const groups = groupByActorAndList(entries ?? []);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-[760px] px-6 py-16">
        <Link
          href="/estanteria"
          className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40 transition hover:text-paper"
        >
          ← Mi estantería
        </Link>
        <h1 className="mt-8 text-[30px] leading-tight">Novedades</h1>

        {entries === null ? (
          <p className="mt-10 text-[13px] text-paper/35">Cargando…</p>
        ) : groups.length === 0 ? (
          <div className="mt-10 border border-paper/10 px-6 py-8">
            <p className="text-[15px] text-paper/80">Aquí no hay nada todavía.</p>
            <p className="mt-2 max-w-[46ch] text-[13px] text-paper/45">
              Sigue a alguien, o sigue una lista, y verás lo que van añadiendo.
            </p>
            <Link
              href="/explorar"
              className="mono mt-5 inline-block text-[10px] uppercase tracking-[0.18em] text-paper/60 underline-offset-4 transition hover:text-paper hover:underline"
            >
              Explorar →
            </Link>
          </div>
        ) : (
          <ul className="mt-10 space-y-10">
            {groups.map((g) => (
              <li key={`${g.actor.id}-${g.listId}-${g.at}`}>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/u/${g.actor.username}`}
                    className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60"
                  >
                    {g.actor.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      g.actor.displayName.slice(0, 2).toUpperCase()
                    )}
                  </Link>
                  <p className="text-[14px] text-paper/70">
                    <Link href={`/u/${g.actor.username}`} className="text-paper hover:underline">
                      {g.actor.displayName}
                    </Link>{" "}
                    añadió {g.releases.length}{" "}
                    {g.releases.length === 1 ? "disco" : "discos"} a{" "}
                    <Link
                      href={`/u/${g.actor.username}/${g.listSlug}`}
                      className="text-paper hover:underline"
                    >
                      {g.listTitle}
                    </Link>
                  </p>
                </div>

                <ul className="mt-3 flex flex-wrap gap-2 pl-12">
                  {g.releases.map((r) => (
                    <li key={r.slug} className="w-[92px]">
                      <span className="block aspect-square w-full overflow-hidden bg-paper/[0.05]">
                        {r.cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={r.cover} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="mt-1.5 block truncate text-[11px] text-paper/70">
                        {r.title}
                      </span>
                      <span className="block truncate text-[10px] text-paper/35">{r.artist}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

type Group = {
  actor: FeedEntry["actor"];
  listId: string;
  listTitle: string;
  listSlug: string;
  at: string;
  releases: FeedEntry["release"][];
};

function groupByActorAndList(entries: FeedEntry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.actor.id}:${e.listId}`;
    const existing = groups.get(key);
    if (existing) {
      existing.releases.push(e.release);
      continue;
    }
    groups.set(key, {
      actor: e.actor,
      listId: e.listId,
      listTitle: e.listTitle,
      listSlug: e.listSlug,
      at: e.at,
      releases: [e.release],
    });
  }
  return [...groups.values()].sort((a, b) => b.at.localeCompare(a.at));
}
