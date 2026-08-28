"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Page, PageHeader, Section } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import Segmented from "@/components/ui/Segmented";
import EmptyState, { CoverGridSkeleton } from "@/components/ui/EmptyState";
import PersonRow from "@/components/community/PersonRow";
import ListCard from "@/components/community/ListCard";
import { useRepository } from "@/hooks/useRepository";
import { useLibrary } from "@/hooks/useLibrary";
import { useCatalogueSearch } from "@/hooks/useCatalogueSearch";
import { useToast } from "@/components/ui/Toast";
import { coverFor } from "@/lib/cover";
import type { ListWithRecord, Profile } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";

/**
 * Where you go when you don't know what you're looking for — and where you go
 * when you know exactly.
 *
 * Those are two different jobs and most apps build two screens for them. One
 * screen is better, and Spotify's Search is the proof: an empty field shows you
 * things to browse, and typing turns the same surface into results. You never
 * navigate to "search" — search is what this place does when you use it.
 *
 * The decisions inside it:
 *
 * - **Scopes, not separate searches.** Todo / Discos / Listas / Gente filter one
 *   query. Making someone pick the category *before* typing means guessing where
 *   the thing they want lives, and they are usually wrong.
 * - **Old results stay while new ones load.** Clearing to a spinner on every
 *   keystroke makes a fast connection feel broken and a slow one feel hostile.
 * - **Recent searches are the real feature.** Most searching is re-searching.
 *   Stored locally, removable one by one — a history you cannot edit is a
 *   liability, not a convenience.
 * - **One place to search for a record.** "Discos" used to mean only what you
 *   already own, while finding something to *add* lived in a different box on
 *   a different screen. Nobody holds that distinction in their head: you look
 *   for a record, and the app's job is to tell you whether you have it or can
 *   get it. Both answers now arrive here, in that order.
 */

type Scope = "all" | "records" | "lists" | "people";

const RECENTS_KEY = "vinilos.recent-searches.v1";
const MAX_RECENTS = 8;

export default function ExploreView() {
  const repo = useRepository();
  const lib = useLibrary();
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("all");
  const [lists, setLists] = useState<ListWithRecord[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [library, setLibrary] = useState<Vinyl[]>([]);
  const [loading, setLoading] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);

  const searching = query.trim().length > 0;

  useEffect(() => {
    setRecents(readRecents());
    repo.listReleases().then(setLibrary).catch(() => {});
  }, [repo]);

  // The same searching the shelf does, so "¿lo tengo?" and "¿puedo tenerlo?"
  // are one question with one answer, wherever you happen to ask it.
  const catalogue = useCatalogueSearch({
    query,
    mode: "vinyls",
    localVinilos: library,
    allVinilos: library,
  });
  const records = catalogue.localResults;
  const addable = catalogue.addable;

  // arriving from the bar's search puts the cursor where you expect it
  useEffect(() => {
    if (params.get("buscar")) inputRef.current?.focus();
  }, [params]);

  useEffect(() => {
    let alive = true;
    const q = query.trim();

    if (!q) {
      setLoading(true);
      Promise.all([repo.popularLists(), repo.suggestedProfiles()]).then(([l, p]) => {
        if (!alive) return;
        setLists(l);
        setPeople(p);
        setLoading(false);
      });
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    // 220ms is roughly the gap between words when someone types a title; below
    // it you fire a request per letter, above it the results feel detached
    const t = setTimeout(() => {
      Promise.all([repo.searchLists(q), repo.searchProfiles(q)]).then(([l, p]) => {
        if (!alive) return;
        setLists(l);
        setPeople(p);
        setLoading(false);
      });
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [repo, query, library]);

  const remember = useCallback((q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    const next = [clean, ...readRecents().filter((r) => r !== clean)].slice(0, MAX_RECENTS);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    setRecents(next);
  }, []);

  const forget = (q: string) => {
    const next = readRecents().filter((r) => r !== q);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    setRecents(next);
  };

  /**
   * Covers come from the backend, not from your own shelf.
   *
   * This used to cross-reference each list's record ids against `library` —
   * which is *your* collection, and which on Supabase never carries those ids
   * for somebody else's list anyway. Every crate on this page came out empty.
   */
  const [covers, setCovers] = useState<Record<string, string[]>>({});
  const coversOf = useCallback((l: ListWithRecord) => covers[l.id] ?? [], [covers]);

  useEffect(() => {
    if (lists.length === 0) return;
    let alive = true;
    // one request for every crate on the page, not one per crate
    repo
      .coversOfLists(lists.map((l) => l.id))
      .then((c) => alive && setCovers((prev) => ({ ...prev, ...c })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repo, lists]);

  const counts = useMemo(
    () => ({
      records: records.length + addable.length,
      lists: lists.length,
      people: people.length,
    }),
    [records, addable, lists, people],
  );
  const total = counts.records + counts.lists + counts.people;
  const loadingAnything = loading || catalogue.loading;
  const show = (s: Scope) => scope === "all" || scope === s;

  return (
    <Page width="full">
      <PageHeader title="Explorar" subtitle="Discos, listas y gente que colecciona." />

      {/* the field is the screen; everything under it answers to it */}
      <div className="sticky top-0 z-20 -mx-5 bg-surface/95 px-5 pb-3 pt-1 backdrop-blur-sm sm:-mx-8 sm:px-8">
        {/* The page runs edge to edge; the field does not.
            Stretched across a full-width page it became a 1900px box for a
            twenty-character query, and its clear button ended up a screen away
            from the text it clears. A search field wants the measure of what
            gets typed into it, not the measure of the page. */}
        <div className="relative max-w-[680px]">
          <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-content-faint">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          </span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onBlur={() => remember(query)}
            enterKeyHint="search"
            type="search"
            autoCapitalize="none"
            autoCorrect="off"
            aria-label="Buscar discos, listas o personas"
            placeholder="Busca discos, listas o personas"
            className="h-12 w-full border-b border-line-strong bg-transparent pl-7 pr-10 text-body text-paper outline-none transition-colors placeholder:text-content-faint focus:border-line-focus"
          />
          {searching && (
            <button
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Borrar búsqueda"
              className="pressable absolute right-0 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center text-content-muted hover:text-paper"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>

        {searching && (
          <div className="mt-3 max-w-[680px] overflow-x-auto">
            <Segmented
              size="sm"
              value={scope}
              onChange={setScope}
              segments={[
                { value: "all", label: "Todo" },
                { value: "records", label: "Discos", count: counts.records },
                { value: "lists", label: "Listas", count: counts.lists },
                { value: "people", label: "Gente", count: counts.people },
              ]}
            />
          </div>
        )}
      </div>

      {/* ------------------------------------------------ nothing typed yet */}
      {!searching && (
        <>
          {recents.length > 0 && (
            <Section title="Búsquedas recientes">
              <ul className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <li key={r} className="flex items-center rounded-full bg-fill">
                    <button
                      onClick={() => setQuery(r)}
                      className="pressable py-2 pl-3.5 pr-1.5 text-sub text-content-secondary hover:text-paper"
                    >
                      {r}
                    </button>
                    <button
                      onClick={() => forget(r)}
                      aria-label={`Quitar ${r} del historial`}
                      className="pressable flex h-8 w-7 items-center justify-center text-content-faint hover:text-paper"
                    >
                      <svg width="9" height="9" viewBox="0 0 14 14" fill="none">
                        <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          <Section title="Listas de la comunidad">
            {loading && lists.length === 0 ? (
              <CoverGridSkeleton count={8} />
            ) : (
              <ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                {lists.slice(0, 8).map((l) => (
                  <li key={l.id}>
                    <ListCard list={l} covers={coversOf(l)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title="Gente que colecciona">
            {/* people in columns for the same reason */}
            <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line">
              {people.slice(0, 8).map((p) => (
                <li key={p.id}>
                  <PersonRow profile={p} subtitle={p.bio || `@${p.username}`} />
                </li>
              ))}
            </ul>
          </Section>
        </>
      )}

      {/* ---------------------------------------------------------- results */}
      {searching && (
        <div className="mt-6">
          {total === 0 && !loadingAnything ? (
            <EmptyState
              title={`Nada para «${query}»`}
              body="Prueba con menos palabras, o solo con el nombre del artista. Para un disco que todavía no tienes, el código de barras acierta más que el título."
              action={{ label: "Escanear un código", href: "/coleccion" }}
              secondary={{ label: "Borrar búsqueda", onClick: () => setQuery("") }}
            />
          ) : (
            <div className="space-y-9">
              {show("records") && records.length > 0 && (
                <ResultBlock title="En tu colección" onAll={() => setScope("records")} showAll={scope === "all"}>
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                    {(scope === "all" ? records.slice(0, 6) : records).map((v) => (
                      <li key={v.id}>
                        <Link
                          href="/coleccion"
                          onClick={() => remember(query)}
                          className="pressable block"
                        >
                          <Cover vinyl={v} alt={v.title} />
                          <span className="mt-2 block truncate text-sub text-paper">{v.title}</span>
                          <span className="block truncate text-caption text-content-muted">
                            {v.artist}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </ResultBlock>
              )}

              {/* What you don't have yet, offered underneath — never mixed in.
                  "Lo tengo" and "puedo tenerlo" are different answers and a
                  single blended grid makes you check each one. */}
              {show("records") && addable.length > 0 && (
                <ResultBlock
                  title="Añadir a tu colección"
                  onAll={() => setScope("records")}
                  showAll={scope === "all"}
                >
                  {/* rows in columns once there is room: a single file of them
                      across a full-width page is mostly empty space */}
                  <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line">
                    {(scope === "all" ? addable.slice(0, 6) : addable.slice(0, 24)).map((r) => {
                      const done = Boolean(catalogue.savedIn[`d${r.id}`]);
                      return (
                        <li key={r.id} className="flex items-center gap-3 py-3">
                          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-fill-subtle">
                            {r.thumb && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={r.thumb} alt="" loading="lazy" className="h-full w-full object-cover" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body text-paper">{r.title}</span>
                            <span className="block truncate text-sub text-content-muted">
                              {[r.year, r.country, r.format?.join(", ")].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <button
                            onClick={async () => {
                              remember(query);
                              const v = await catalogue.addFromCatalogue(
                                r,
                                lib.activeListId,
                                (vinyl, listId) => void lib.saveToList(vinyl, listId),
                              );
                              if (!v) return toast.show("No se pudo añadir.", { tone: "error" });
                              toast.show(`${v.title} · guardado`, {
                                media: { src: r.thumb ?? coverFor(v) },
                                action: { label: "Ver", onClick: () => router.push("/coleccion") },
                              });
                              repo.listReleases().then(setLibrary).catch(() => {});
                            }}
                            disabled={catalogue.adding === r.id || done}
                            aria-label={`Añadir ${r.title} a tu colección`}
                            className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-40"
                          >
                            {done ? (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                                <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            ) : catalogue.adding === r.id ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.6px] border-current border-t-transparent" />
                            ) : (
                              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                                <path d="M7 2 V12 M2 7 H12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                              </svg>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </ResultBlock>
              )}

              {show("lists") && lists.length > 0 && (
                <ResultBlock title="Listas" onAll={() => setScope("lists")} showAll={scope === "all"}>
                  <ul className="grid grid-cols-2 gap-x-6 gap-y-9 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                    {(scope === "all" ? lists.slice(0, 4) : lists).map((l) => (
                      <li key={l.id}>
                        <ListCard list={l} covers={coversOf(l)} />
                      </li>
                    ))}
                  </ul>
                </ResultBlock>
              )}

              {show("people") && people.length > 0 && (
                <ResultBlock title="Gente" onAll={() => setScope("people")} showAll={scope === "all"}>
                  <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line">
                    {(scope === "all" ? people.slice(0, 4) : people).map((p) => (
                      <li key={p.id}>
                        <PersonRow profile={p} subtitle={p.bio || `@${p.username}`} />
                      </li>
                    ))}
                  </ul>
                </ResultBlock>
              )}

              {/* a scope with nothing in it still has to say something */}
              {scope !== "all" &&
                ((scope === "records" && records.length === 0) ||
                  (scope === "lists" && lists.length === 0) ||
                  (scope === "people" && people.length === 0)) && (
                  <EmptyState
                    compact
                    title="Aquí no hay resultados"
                    body="Puede que lo que buscas esté en otra pestaña."
                    action={{ label: "Buscar en todo", onClick: () => setScope("all") }}
                  />
                )}
            </div>
          )}
        </div>
      )}
    </Page>
  );
}

function ResultBlock({
  title,
  children,
  onAll,
  showAll,
}: {
  title: string;
  children: React.ReactNode;
  onAll: () => void;
  showAll: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="text-caption uppercase tracking-label text-content-muted">{title}</h2>
        {showAll && (
          <button
            onClick={onAll}
            className="text-caption uppercase tracking-label text-content-faint transition-colors hover:text-paper"
          >
            Ver todo
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}
