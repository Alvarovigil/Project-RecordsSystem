"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Page, Section } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import EmptyState, { CoverGridSkeleton } from "@/components/ui/EmptyState";
import CatalogueNotice from "@/components/ui/CatalogueNotice";
import PersonRow from "@/components/community/PersonRow";
import ListCard from "@/components/community/ListCard";
import { useRepository } from "@/hooks/useRepository";
import RecordSheet from "@/components/mobile/RecordSheet";
import { usePlaybackContext } from "@/lib/playback-context";
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
  const audio = usePlaybackContext();
  const { nowPlaying, playing } = audio;
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
  /** the record whose sheet is open, opened from a result */
  const [openRecord, setOpenRecord] = useState<Vinyl | null>(null);

  const searching = query.trim().length > 0;

  useEffect(() => {
    setRecents(readRecents());
    repo
      .listReleases()
      .then(setLibrary)
      .catch(() => {});
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
      Promise.all([repo.popularLists(), repo.suggestedProfiles()])
        .then(([l, p]) => {
          if (!alive) return;
          setLists(l);
          setPeople(p);
          setLoading(false);
        })
        // without this a failed read leaves the skeleton pulsing for ever,
        // which is the one state that never resolves itself
        .catch(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }

    setLoading(true);
    // 220ms is roughly the gap between words when someone types a title; below
    // it you fire a request per letter, above it the results feel detached
    const t = setTimeout(() => {
      Promise.all([repo.searchLists(q), repo.searchProfiles(q)])
        .then(([l, p]) => {
          if (!alive) return;
          setLists(l);
          setPeople(p);
          setLoading(false);
        })
        .catch(() => alive && setLoading(false));
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [repo, query, library]);

  const remember = useCallback((q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    const next = [clean, ...readRecents().filter((r) => r !== clean)].slice(
      0,
      MAX_RECENTS,
    );
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
  const coversOf = useCallback(
    (l: ListWithRecord) => covers[l.id] ?? [],
    [covers],
  );

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
      {/**
       * The field is the top of the page, because it is the page.
       *
       * There was a title above it saying "Explorar" over a subtitle saying
       * what could be searched — under a navigation bar with the word
       * Explorar in it, marked as the place you are. A heading that repeats
       * the tab you just pressed is a line of type that costs the screen its
       * first eighty pixels and tells you something you already knew. The
       * placeholder says what can be typed; the bar says where you are.
       *
       * It is a field now rather than an underline. A rule under some grey
       * placeholder text is a typographic idea of a search box; people look
       * for something with edges, and on a page this wide a lone line does not
       * read as a place to type at all.
       */}
      <div className="sticky top-0 z-20 -mx-5 bg-surface/95 px-5 pb-3 pt-1 backdrop-blur-sm sm:static sm:mx-0 sm:bg-transparent sm:px-0 sm:pb-7 sm:pt-0 sm:backdrop-blur-none">
        <div className="mx-auto w-full max-w-[560px]">
          <div className="relative w-full border-b border-line transition-colors focus-within:border-line-strong">
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
              /**
               * The query, set as type rather than typed into a widget.
               *
               * A rounded box with a magnifying glass in it is the search
               * field every site has, and it looked borrowed here — the rest
               * of this product is words, hairlines and mono micro-type, with
               * no chrome anywhere. So the field is the sentence: large,
               * centred under the title, on a rule that lights up when the
               * cursor is in it. The magnifier goes for the same reason it
               * went from the bar — the placeholder already says what to do,
               * and the icon was saying it a second time in another language.
               */
              className="w-full bg-transparent pb-3 pt-1 text-center text-title text-paper outline-none placeholder:text-content-faint"
            />
            {searching && (
              <button
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Borrar búsqueda"
                className="pressable absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-content-faint transition-colors hover:text-paper"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2 L12 12 M12 2 L2 12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>

          {/**
           * The scopes as a line of words, not as a switch.
           *
           * A segmented pill is a control you press; these are the four shapes
           * one answer can take, and they read better as a caption under the
           * question — the same mono micro-type that names every region on
           * every other screen. It also stops the two most prominent objects
           * on the page from both being rounded rectangles fighting for the
           * middle of the screen.
           *
           * The counts do the work the pill was doing: they say where the
           * answers are before you choose, so choosing is informed rather than
           * exploratory.
           */}
          {searching && (
            <div className="mt-4 flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2">
              {(
                [
                  ["all", "Todo", null],
                  ["records", "Discos", counts.records],
                  ["lists", "Listas", counts.lists],
                  ["people", "Gente", counts.people],
                ] as const
              ).map(([value, label, n]) => {
                const active = scope === value;
                return (
                  <button
                    key={value}
                    onClick={() => setScope(value)}
                    aria-pressed={active}
                    className={`pressable text-caption uppercase tracking-label transition-colors ${
                      active ? "text-paper" : "text-content-faint hover:text-content-secondary"
                    }`}
                  >
                    {label}
                    {n !== null && (
                      <span className={`ml-1.5 ${active ? "text-content-muted" : "text-content-faint/70"}`}>
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ nothing typed yet */}
      {!searching && (
        <>
          {recents.length > 0 && (
            <Section title="Búsquedas recientes">
              <ul className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <li
                    key={r}
                    className="flex items-center rounded-full bg-fill"
                  >
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
                        <path
                          d="M2 2 L12 12 M12 2 L2 12"
                          stroke="currentColor"
                          strokeWidth="1.6"
                          strokeLinecap="round"
                        />
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
            ) : lists.length === 0 ? (
              /* A heading with nothing under it is the worst of both: it does
                 not say "there is nothing here" and it does not say "something
                 went wrong" — it just looks like the page stopped loading. */
              <EmptyState
                compact
                title="Todavía no hay listas que enseñarte"
                body="O nadie ha publicado una lista pública, o no hemos podido leerlas. Prueba a recargar; si sigue vacío, busca algo concreto."
                action={{
                  label: "Recargar",
                  onClick: () => window.location.reload(),
                }}
              />
            ) : (
              /* one line, sliding sideways: the community is something you
                 skim past, not a wall you have to get through before the rest
                 of the page starts. It bleeds to both edges so the last card
                 is cut off — the only honest way to say "there is more". */
              // Padding on both ends — and scroll-padding to match it.
              //
              // The margin was there and the rail ignored it: snapping aligns
              // an item to the container's snapport, which starts at its edge
              // unless scroll-padding says otherwise. So the browser scrolled
              // twenty pixels on load to put the first crate flush against the
              // screen, and the row looked mis-indented against the heading
              // above it. scroll-pl teaches the snap where the content
              // actually begins.
              <ul className="rail -mx-5 flex snap-x snap-mandatory scroll-pl-5 gap-9 px-5 pb-2 pr-10 sm:-mx-8 sm:scroll-pl-8 sm:px-8 sm:pr-14">
                {lists.slice(0, 12).map((l) => (
                  <li
                    key={l.id}
                    className="w-[44vw] shrink-0 snap-start sm:w-[200px]"
                  >
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
          {/* said before the results, not after: someone who reads "nada para
              «x»" and then scrolls past a note explaining why has already
              drawn their conclusion */}
          {catalogue.degraded && (
            <div className="mb-6">
              <CatalogueNotice degraded={catalogue.degraded} />
            </div>
          )}
          {total === 0 && !loadingAnything ? (
            <EmptyState
              title={`Nada para «${query}»`}
              body="Prueba con menos palabras, o solo con el nombre del artista. Para un disco que todavía no tienes, el código de barras acierta más que el título."
              action={{ label: "Escanear un código", href: "/coleccion" }}
              secondary={{
                label: "Borrar búsqueda",
                onClick: () => setQuery(""),
              }}
            />
          ) : (
            <div className="space-y-9">
              {show("records") && records.length > 0 && (
                <ResultBlock
                  title="En tu colección"
                  onAll={() => setScope("records")}
                  showAll={scope === "all"}
                >
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                    {(scope === "all" ? records.slice(0, 6) : records).map(
                      (v) => (
                        <li key={v.id}>
                          {/**
                           * Opens here, not on the shelf.
                           *
                           * It used to be a link to /coleccion, which threw
                           * away the search you had just typed and dropped you
                           * on your whole collection to find the record again
                           * yourself. A result is the record: pressing it
                           * opens the record, and your search is still behind
                           * it when you close the sheet.
                           */}
                          <button
                            onClick={() => {
                              remember(query);
                              setOpenRecord(v);
                            }}
                            className="pressable block w-full text-left"
                          >
                            <Cover vinyl={v} alt={v.title} />
                            <span className="mt-2 block truncate text-sub text-paper">
                              {v.title}
                            </span>
                            <span className="block truncate text-caption text-content-muted">
                              {v.artist}
                            </span>
                          </button>
                        </li>
                      ),
                    )}
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
                    {(scope === "all"
                      ? addable.slice(0, 6)
                      : addable.slice(0, 24)
                    ).map((r) => {
                      const done = Boolean(catalogue.savedIn[`d${r.id}`]);
                      return (
                        <li key={r.id} className="flex items-center gap-3 py-3">
                          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-fill-subtle">
                            {r.thumb && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={r.thumb}
                                alt=""
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-body text-paper">
                              {r.title}
                            </span>
                            <span className="block truncate text-sub text-content-muted">
                              {[r.year, r.country, r.format?.join(", ")]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </span>
                          <button
                            onClick={async () => {
                              remember(query);
                              const v = await catalogue.addFromCatalogue(
                                r,
                                lib.activeListId,
                                (vinyl, listId) =>
                                  void lib.saveToList(vinyl, listId),
                              );
                              if (!v)
                                return toast.show("No se pudo añadir.", {
                                  tone: "error",
                                });
                              toast.show(`${v.title} · guardado`, {
                                media: { src: r.thumb ?? coverFor(v) },
                                action: {
                                  label: "Ver",
                                  onClick: () => router.push("/coleccion"),
                                },
                              });
                              repo
                                .listReleases()
                                .then(setLibrary)
                                .catch(() => {});
                            }}
                            disabled={catalogue.adding === r.id || done}
                            aria-label={`Añadir ${r.title} a tu colección`}
                            className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-40"
                          >
                            {done ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M2.5 7.5 L5.5 10.5 L11.5 3.5"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            ) : catalogue.adding === r.id ? (
                              <span className="h-3.5 w-3.5 animate-spin rounded-full border-[1.6px] border-current border-t-transparent" />
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 14 14"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M7 2 V12 M2 7 H12"
                                  stroke="currentColor"
                                  strokeWidth="1.6"
                                  strokeLinecap="round"
                                />
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
                <ResultBlock
                  title="Listas"
                  onAll={() => setScope("lists")}
                  showAll={scope === "all"}
                >
                  <ul className="grid grid-cols-2 gap-x-9 gap-y-14 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                    {(scope === "all" ? lists.slice(0, 4) : lists).map((l) => (
                      <li key={l.id}>
                        <ListCard list={l} covers={coversOf(l)} />
                      </li>
                    ))}
                  </ul>
                </ResultBlock>
              )}

              {show("people") && people.length > 0 && (
                <ResultBlock
                  title="Gente"
                  onAll={() => setScope("people")}
                  showAll={scope === "all"}
                >
                  <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line">
                    {(scope === "all" ? people.slice(0, 4) : people).map(
                      (p) => (
                        <li key={p.id}>
                          <PersonRow
                            profile={p}
                            subtitle={p.bio || `@${p.username}`}
                          />
                        </li>
                      ),
                    )}
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
                    action={{
                      label: "Buscar en todo",
                      onClick: () => setScope("all"),
                    }}
                  />
                )}
            </div>
          )}
        </div>
      )}
      {/* The same sheet as everywhere else: listen, read, put it in a list.
          Editing rows are hidden — a search result is not a place you can
          take something out of. */}
      <RecordSheet
        vinyl={openRecord}
        onClose={() => setOpenRecord(null)}
        canEdit={false}
        collections={lib.lists.map((l) => ({
          id: l.id,
          name: l.title,
          vinylIds: lib.idsOf(l.id),
          kind: l.kind,
        }))}
        activeListId=""
        playing={playing && nowPlaying?.id === openRecord?.id}
        onTogglePlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : audio.play(v))}
        onAddTo={(listId, v) => void lib.saveToList(v, listId)}
        onRemoveFromActive={() => {}}
        onDelete={() => {}}
      />
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
        <h2 className="text-caption uppercase tracking-label text-content-muted">
          {title}
        </h2>
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
