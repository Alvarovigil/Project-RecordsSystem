"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "./app/TopNav";
import { useRepository } from "@/hooks/useRepository";
import { coverFor } from "@/lib/cover";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";

/** A list from the placeholder community, so the demo never dead-ends. */
export default function DemoList({ profileId, slug }: { profileId: string; slug: string }) {
  const repo = useRepository();
  const [list, setList] = useState<ListWithRecord | null>(null);
  const [items, setItems] = useState<Vinyl[]>([]);

  useEffect(() => {
    let alive = true;
    repo.listsOfProfile(profileId).then(async (lists) => {
      const found = lists.find((l) => l.slug === slug) ?? null;
      if (!alive) return;
      setList(found);
      if (found) setItems(await repo.releasesOfList(found.id));
    });
    return () => {
      alive = false;
    };
  }, [repo, profileId, slug]);

  return (
    <main className="min-h-screen bg-ink pb-28 text-paper">
      <TopNav />
      <div className="mx-auto w-full max-w-[1000px] px-6 py-10">
        <span className="mono border border-paper/15 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-paper/35">
          Lista de demostración
        </span>

        <header className="mt-6 border-b border-paper/[0.08] pb-8">
          <h1 className="text-[30px] leading-tight">{list?.title ?? "—"}</h1>
          {list?.description && (
            <p className="mt-2 max-w-[56ch] text-[14px] text-paper/55">{list.description}</p>
          )}
          {list && (
            <Link
              href={`/u/${list.owner.username}`}
              className="mono mt-4 inline-block text-[10px] uppercase tracking-[0.18em] text-paper/40 transition hover:text-paper"
            >
              {list.owner.displayName} · {list.itemCount} discos
            </Link>
          )}
        </header>

        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-5">
          {items.map((v) => (
            <li key={v.id}>
              <span className="block aspect-square w-full overflow-hidden bg-paper/[0.04]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverFor(v)} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="mt-2 block truncate text-[13px]">{v.title}</span>
              <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-paper/45">
                {v.artist}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
