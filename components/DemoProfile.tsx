"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "./app/TopNav";
import { useRepository } from "@/hooks/useRepository";
import type { ListWithRecord, Profile } from "@/lib/data/types";

/**
 * A profile from the placeholder community.
 *
 * It exists so every link in the demo leads somewhere: a tour that dead-ends
 * on a 404 teaches you the product is unfinished, which is the opposite of
 * what a demo is for. Clearly labelled, and it disappears with the real data.
 */
export default function DemoProfile({ profileId }: { profileId: string }) {
  const repo = useRepository();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [lists, setLists] = useState<ListWithRecord[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.getProfile(profileId), repo.listsOfProfile(profileId)]).then(
      ([p, l]) => {
        if (!alive) return;
        setProfile(p);
        setLists(l);
      },
    );
    return () => {
      alive = false;
    };
  }, [repo, profileId]);

  const discos = lists.reduce((n, l) => n + l.itemCount, 0);

  return (
    <main className="min-h-screen bg-ink pb-28 text-paper">
      <TopNav />
      <div className="mx-auto w-full max-w-[880px] px-6 py-10">
        <span className="mono border border-paper/15 px-2 py-1 text-[9px] uppercase tracking-[0.2em] text-paper/35">
          Perfil de demostración
        </span>

        <header className="mt-6 flex items-start gap-5 border-b border-paper/[0.08] pb-8">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-paper/10 text-[16px] text-paper/70">
            {(profile?.displayName ?? "?").slice(0, 2).toUpperCase()}
          </span>
          <div>
            <h1 className="text-[26px] leading-tight">{profile?.displayName ?? "—"}</h1>
            <p className="mono mt-1 text-[12px] text-paper/40">@{profile?.username}</p>
            {profile?.bio && (
              <p className="mt-3 max-w-[46ch] text-[14px] text-paper/60">{profile.bio}</p>
            )}
            <p className="mono mt-4 text-[10px] uppercase tracking-[0.18em] text-paper/30">
              {lists.length} listas · {discos} discos
            </p>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Listas</h2>
          <ul className="mt-4 divide-y divide-paper/[0.07] border-y border-paper/[0.07]">
            {lists.map((l) => (
              <li key={l.id}>
                <Link
                  href={`/u/${l.owner.username}/${l.slug}`}
                  className="flex items-center gap-4 py-4 transition hover:bg-paper/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{l.title}</span>
                    <span className="mt-0.5 block truncate text-[12px] text-paper/45">
                      {l.description}
                    </span>
                  </span>
                  <span className="mono text-[10px] uppercase tracking-[0.16em] text-paper/30">
                    {l.itemCount} discos
                  </span>
                  <span className="text-paper/25">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
