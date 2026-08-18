"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "./TopNav";
import { useRepository } from "@/hooks/useRepository";
import { useLibrary } from "@/hooks/useLibrary";
import { useSession } from "@/hooks/useSession";
import { coverFor } from "@/lib/cover";
import type { FeedEntry, ListWithRecord, Profile } from "@/lib/data/types";

/**
 * The social home.
 *
 * Order matters: what your people did, then your own shelf, then the wider
 * community. A home that opens with recommendations from strangers tells you
 * the network is empty; one that opens with your contacts tells you it isn't.
 */
export default function HomeView() {
  const repo = useRepository();
  const { profile } = useSession();
  const lib = useLibrary();
  const [feed, setFeed] = useState<FeedEntry[] | null>(null);
  const [lists, setLists] = useState<ListWithRecord[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);

  useEffect(() => {
    let alive = true;
    Promise.all([repo.feed(), repo.popularLists(), repo.suggestedProfiles()]).then(
      ([f, l, p]) => {
        if (!alive) return;
        setFeed(f);
        setLists(l.slice(0, 6));
        setPeople(p.slice(0, 6));
      },
    );
    return () => {
      alive = false;
    };
  }, [repo]);

  const groups = groupFeed(feed ?? []).slice(0, 6);
  const yourLists = lib.lists.filter((l) => l.itemCount > 0).slice(0, 6);

  return (
    <main className="min-h-screen bg-ink pb-24 text-paper">
      <TopNav />
      <div className="mx-auto w-full max-w-[1180px] px-6 py-10">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-[30px] leading-tight">
              {profile ? `Hola, ${profile.displayName.split(" ")[0]}` : "Tu comunidad"}
            </h1>
            <p className="mt-1.5 text-[14px] text-paper/45">
              Lo que se mueve entre quienes sigues.
            </p>
          </div>
          <Link
            href="/coleccion"
            className="mono border border-paper/20 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-paper/70 transition hover:border-paper/60 hover:text-paper"
          >
            Ir a mi colección →
          </Link>
        </header>

        {/* --- what your people did ------------------------------------- */}
        <Section title="Movimientos" href={groups.length ? "/feed" : undefined} linkLabel="Ver todo">
          {feed === null ? (
            <Placeholder text="Cargando…" />
          ) : groups.length === 0 ? (
            <div className="border border-paper/10 px-6 py-7">
              <p className="text-[15px] text-paper/80">Todavía no sigues a nadie.</p>
              <p className="mt-2 max-w-[52ch] text-[13px] text-paper/45">
                Sigue a alguien o a una lista y aquí verás lo que van añadiendo. Cada disco
                de tu colección lleva a las listas donde vive.
              </p>
              <Link
                href="/explorar"
                className="mono mt-5 inline-block text-[10px] uppercase tracking-[0.18em] text-paper/60 underline-offset-4 transition hover:text-paper hover:underline"
              >
                Explorar la comunidad →
              </Link>
            </div>
          ) : (
            <ul className="space-y-7">
              {groups.map((g) => (
                <li key={`${g.actor.id}-${g.listId}`} className="flex gap-4">
                  <Link
                    href={`/u/${g.actor.username}`}
                    className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60"
                  >
                    {g.actor.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={g.actor.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      g.actor.displayName.slice(0, 2).toUpperCase()
                    )}
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] text-paper/70">
                      <Link href={`/u/${g.actor.username}`} className="text-paper hover:underline">
                        {g.actor.displayName}
                      </Link>{" "}
                      añadió {g.releases.length} {g.releases.length === 1 ? "disco" : "discos"} a{" "}
                      <Link
                        href={`/u/${g.actor.username}/${g.listSlug}`}
                        className="text-paper hover:underline"
                      >
                        {g.listTitle}
                      </Link>
                    </p>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {g.releases.slice(0, 6).map((r) => (
                        <li key={r.slug} className="w-[74px]">
                          <span className="block aspect-square w-full overflow-hidden bg-paper/[0.05]">
                            {r.cover && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.cover} alt="" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="mt-1 block truncate text-[10px] text-paper/45">
                            {r.title}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* --- your own shelf, one click away ---------------------------- */}
        {yourLists.length > 0 && (
          <Section title="Tus listas" href="/coleccion" linkLabel="Abrir estantería">
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              {yourLists.map((l) => {
                const cover = lib.releases.find((v) => lib.idsOf(l.id).includes(v.id));
                return (
                  <li key={l.id}>
                    <Link href="/coleccion" className="group block">
                      <span className="block aspect-square w-full overflow-hidden bg-paper/[0.05]">
                        {cover && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={coverFor(cover)}
                            alt=""
                            className="h-full w-full object-cover opacity-85 transition group-hover:opacity-100"
                          />
                        )}
                      </span>
                      <span className="mt-2 block truncate text-[13px]">{l.title}</span>
                      <span className="mono block text-[10px] uppercase tracking-[0.16em] text-paper/35">
                        {l.itemCount} discos
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Section>
        )}

        {/* --- the wider community --------------------------------------- */}
        <Section title="Listas de la comunidad" href="/explorar" linkLabel="Explorar">
          <ul className="grid gap-px bg-paper/[0.07] sm:grid-cols-2 lg:grid-cols-3">
            {lists.map((l) => (
              <li key={l.id} className="bg-ink">
                <Link
                  href={`/u/${l.owner.username}/${l.slug}`}
                  className="flex h-full flex-col justify-between px-5 py-4 transition hover:bg-paper/[0.04]"
                >
                  <span className="text-[15px]">{l.title}</span>
                  <span className="mono mt-3 text-[10px] uppercase tracking-[0.16em] text-paper/30">
                    {l.owner.displayName} · {l.itemCount} discos
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Gente que colecciona" href="/explorar" linkLabel="Ver más">
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </main>
  );
}

function Section({
  title,
  href,
  linkLabel,
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <div className="flex items-baseline justify-between border-b border-paper/[0.07] pb-2">
        <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">{title}</h2>
        {href && (
          <Link
            href={href}
            className="mono text-[10px] uppercase tracking-[0.16em] text-paper/35 transition hover:text-paper"
          >
            {linkLabel} →
          </Link>
        )}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Placeholder({ text }: { text: string }) {
  return <p className="text-[13px] text-paper/30">{text}</p>;
}

type Group = {
  actor: FeedEntry["actor"];
  listId: string;
  listTitle: string;
  listSlug: string;
  at: string;
  releases: FeedEntry["release"][];
};

function groupFeed(entries: FeedEntry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.actor.id}:${e.listId}`;
    const found = groups.get(key);
    if (found) {
      found.releases.push(e.release);
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
