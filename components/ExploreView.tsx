"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SiteNav from "./SiteNav";
import { useRepository } from "@/hooks/useRepository";
import type { ListWithRecord, Profile } from "@/lib/data/types";

/**
 * Where you go when you don't know what you're looking for.
 *
 * Lists first, people second: in a collection network the interesting object
 * is the shelf someone built, not the account that built it.
 */
export default function ExploreView() {
  const repo = useRepository();
  const [lists, setLists] = useState<ListWithRecord[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    const run = query.trim()
      ? Promise.all([repo.searchLists(query), repo.searchProfiles(query)])
      : Promise.all([repo.popularLists(), repo.suggestedProfiles()]);
    const t = setTimeout(() => {
      run.then(([l, p]) => {
        if (!alive) return;
        setLists(l);
        setPeople(p);
      });
    }, query.trim() ? 250 : 0);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [repo, query]);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <SiteNav />
      <div className="mx-auto w-full max-w-[900px] px-6 py-16">
        <h1 className="mt-2 text-[30px] leading-tight">Explorar</h1>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar personas o listas…"
          className="mt-6 w-full border-b border-paper/15 bg-transparent py-2 text-[16px] text-paper outline-none placeholder:text-paper/25 focus:border-paper/60"
        />

        <section className="mt-12">
          <h2 className="mono border-b border-paper/[0.07] pb-2 text-[10px] uppercase tracking-[0.2em] text-paper/40">
            {query.trim() ? "Listas" : "Listas destacadas"}
          </h2>
          <ul className="mt-4 grid gap-px bg-paper/[0.07] sm:grid-cols-2">
            {lists.map((l) => (
              <li key={l.id} className="bg-ink">
                <Link
                  href={`/u/${l.owner.username}/${l.slug}`}
                  className="flex h-full flex-col justify-between px-5 py-4 transition hover:bg-paper/[0.04]"
                >
                  <span className="text-[15px]">{l.title}</span>
                  {l.description && (
                    <span className="mt-1 line-clamp-2 text-[12px] text-paper/45">
                      {l.description}
                    </span>
                  )}
                  <span className="mono mt-3 text-[10px] uppercase tracking-[0.16em] text-paper/30">
                    {l.owner.displayName} · {l.itemCount} discos · {l.followers} siguen
                  </span>
                </Link>
              </li>
            ))}
            {lists.length === 0 && (
              <li className="bg-ink px-5 py-6 text-[13px] text-paper/30">
                Nada por aquí todavía.
              </li>
            )}
          </ul>
        </section>

        <section className="mt-14">
          <h2 className="mono border-b border-paper/[0.07] pb-2 text-[10px] uppercase tracking-[0.2em] text-paper/40">
            {query.trim() ? "Personas" : "Gente que colecciona"}
          </h2>
          <ul className="mt-4 grid gap-6 sm:grid-cols-2">
            {people.map((u) => (
              <li key={u.id}>
                <Link href={`/u/${u.username}`} className="group flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60">
                    {u.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      u.displayName.slice(0, 2).toUpperCase()
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] transition group-hover:text-paper">
                      {u.displayName}
                    </span>
                    <span className="mono block truncate text-[11px] text-paper/35">
                      @{u.username}
                    </span>
                    {u.bio && (
                      <span className="mt-1 block line-clamp-2 text-[12px] text-paper/45">
                        {u.bio}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
            {people.length === 0 && (
              <li className="text-[13px] text-paper/30">Nadie por aquí todavía.</li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}
