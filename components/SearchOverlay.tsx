"use client";

import Link from "next/link";

import { useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";
import { DestinationBar, RowSave } from "./SaveToList";
import { getRepository, type ListWithRecord, type Profile } from "@/lib/data";

type SearchResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  genre?: string;
  cover_image?: string;
  thumb?: string;
  format?: string[];
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** put a record (new or already in the library) into a list */
  onSaveToList: (v: Vinyl, listId: string) => void;
  onCreateList: (name: string) => Promise<string>;
  onRemoveFromList: (vinylId: string, listId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  collections: Collection[];
  activeCollectionId: string;
  allVinilos: Vinyl[];
  localVinilos: Vinyl[];
  onJumpTo: (v: Vinyl) => void;
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mono px-2 pb-2 pt-4 text-[10px] uppercase tracking-[0.2em] text-paper/35">
      {children}
    </div>
  );
}

export default function SearchOverlay({
  open,
  onClose,
  onSaveToList,
  onCreateList,
  onRemoveFromList,
  onDeleteVinyl,
  collections,
  activeCollectionId,
  allVinilos,
  localVinilos,
  onJumpTo,
}: Props) {
  // the chosen destination sticks between saves, like a pinboard would
  const [targetId, setTargetId] = useState(activeCollectionId);
  useEffect(() => setTargetId(activeCollectionId), [activeCollectionId]);
  // what a save actually did, so Deshacer can undo exactly that: a record that
  // was new to the library must leave it again, not just leave the list
  const [savedIn, setSavedIn] = useState<
    Record<string, { listId: string; vinylId: string; wasNew: boolean }>
  >({});
  const [mode, setMode] = useState<"local" | "discogs" | "people">("local");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      setQ("");
      setResults([]);
      setMode("local");
    }
  }, [open]);

  // discogs search only when in "discogs" mode
  useEffect(() => {
    if (mode !== "discogs" || !q.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(q)}`);
        const data = await r.json();
        if (cancelled) return;
        setResults(data.results ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, mode]);

  // local filter — instant, no network
  const norm = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const localResults =
    mode === "local" && q.trim()
      ? localVinilos.filter((v) => {
          const t = norm(`${v.title} ${v.artist}`);
          return t.includes(norm(q.trim()));
        })
      : [];

  // Saving keeps the search open on purpose: adding several records in a row
  // is the common case, and a closing overlay would punish it.
  const add = async (r: SearchResult, listId: string) => {
    setAdding(r.id);
    try {
      const res = await fetch(`/api/discogs/release`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: r.id }),
      });
      const data = await res.json();
      if (data.vinyl) {
        const wasNew = !allVinilos.some((v) => v.id === data.vinyl.id);
        onSaveToList(data.vinyl, listId);
        setSavedIn((m) => ({
          ...m,
          [`d${r.id}`]: { listId, vinylId: data.vinyl.id, wasNew },
        }));
      }
    } finally {
      setAdding(null);
    }
  };

  // people and lists, searched together: you rarely know which one you want
  const [people, setPeople] = useState<Profile[]>([]);
  const [communityLists, setCommunityLists] = useState<ListWithRecord[]>([]);
  useEffect(() => {
    if (mode !== "people" || !q.trim()) {
      setPeople([]);
      setCommunityLists([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      const repo = getRepository();
      const [p, l] = await Promise.all([repo.searchProfiles(q), repo.searchLists(q)]);
      if (cancelled) return;
      setPeople(p);
      setCommunityLists(l);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [q, mode]);

  // one cursor over the visible list: ↑↓ to move, ↵ to act on it
  const [cursor, setCursor] = useState(0);
  useEffect(() => setCursor(0), [q, mode]);
  const rowCount = mode === "local" ? localResults.length : results.length;
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (rowCount === 0) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((i) => {
          const next = e.key === "ArrowDown" ? i + 1 : i - 1;
          return Math.max(0, Math.min(rowCount - 1, next));
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (mode === "local") {
          const v = localResults[cursor];
          if (v) {
            onJumpTo(v);
            onClose();
          }
        } else {
          const r = results[cursor];
          if (r) add(r, targetId);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // keep the cursor row in view
  useEffect(() => {
    document
      .querySelector(`[data-row="${cursor}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  const listsHolding = (vinylId: string) =>
    collections.filter((c) => c.vinylIds.includes(vinylId)).map((c) => c.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 backdrop-blur-sm pt-[12vh]">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-label="close search"
      />
      <div className="relative w-full max-w-[640px] mx-6">
        {/* mode tabs */}
        <div className="flex items-center gap-5 mb-1">
          {(["local", "discogs", "people"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] uppercase tracking-[0.22em] py-2 transition relative ${
                mode === m ? "text-paper" : "text-paper/35 hover:text-paper/70"
              }`}
            >
              {m === "local" ? "Mi biblioteca" : m === "discogs" ? "Añadir vinilos" : "Gente y listas"}
              {mode === m && (
                <span className="absolute left-0 right-0 -bottom-px h-px bg-paper" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 border-b border-paper/20">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={
              mode === "local"
                ? "Buscar en tu colección…"
                : mode === "discogs"
                  ? "Buscar vinilos para añadir…"
                  : "Buscar personas o listas…"
            }
            className="flex-1 bg-transparent py-4 text-[18px] text-paper outline-none placeholder:text-paper/30"
          />
          <kbd className="mono inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-[3px] border border-paper/20 text-[10px] text-paper/45">
            Esc
          </kbd>
        </div>
        {/* one destination for everything you save here, plus the keyboard
            hint — adding a run of records shouldn't need the mouse */}
        <div className={`mt-3 flex items-center justify-between gap-4 ${mode === "people" ? "hidden" : ""}`}>
          <DestinationBar
            collections={collections}
            targetId={targetId}
            onTargetChange={setTargetId}
            onCreateList={onCreateList}
          />
          <span className="mono hidden text-[10px] uppercase tracking-[0.18em] text-paper/25 sm:block">
            ↑↓ moverse · ↵ {mode === "local" ? "ir al disco" : "guardar"}
          </span>
        </div>

        <div data-scrollable className="mt-3 max-h-[60vh] overflow-y-auto">
          {mode === "discogs" && loading && (
            <div className="text-paper/50 text-sm py-3">Buscando…</div>
          )}
          {mode === "discogs" && !loading && results.length === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">Sin resultados</div>
          )}
          {mode === "local" && localResults.length === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">
              Sin coincidencias en tu colección
            </div>
          )}

          {/* people and lists */}
          {mode === "people" && (
            <>
              {people.length > 0 && (
                <>
                  <SectionLabel>Personas</SectionLabel>
                  <ul className="divide-y divide-paper/[0.07]">
                    {people.map((u) => (
                      <li key={u.id}>
                        <Link
                          href={`/u/${u.username}`}
                          className="flex items-center gap-3 px-2 py-3 transition hover:bg-paper/5"
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60">
                            {u.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              u.displayName.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-paper/90">
                              {u.displayName}
                            </span>
                            <span className="mono block truncate text-[11px] text-paper/40">
                              @{u.username}
                            </span>
                          </span>
                          <span className="text-paper/25">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {communityLists.length > 0 && (
                <>
                  <SectionLabel>Listas</SectionLabel>
                  <ul className="divide-y divide-paper/[0.07]">
                    {communityLists.map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/u/${l.owner.username}/${l.slug}`}
                          className="flex items-center gap-3 px-2 py-3 transition hover:bg-paper/5"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-paper/90">
                              {l.title}
                            </span>
                            <span className="mono block truncate text-[11px] uppercase tracking-[0.14em] text-paper/40">
                              {l.owner.displayName} · {l.itemCount} discos
                            </span>
                          </span>
                          <span className="text-paper/25">→</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {!loading && q.trim() && people.length === 0 && communityLists.length === 0 && (
                <div className="py-3 text-sm text-paper/50">
                  Nadie con ese nombre, ninguna lista con ese título.
                </div>
              )}
            </>
          )}

          {/* local mode list */}
          {mode === "local" && (
            <ul className="divide-y divide-paper/10">
              {localResults.map((v, i) => (
                <li
                  key={v.id}
                  data-row={i}
                  onMouseEnter={() => setCursor(i)}
                  className={`group flex items-center gap-2 pr-2 transition ${
                    cursor === i ? "bg-paper/[0.06]" : ""
                  }`}
                >
                  <button
                    onClick={() => {
                      onJumpTo(v);
                      onClose();
                    }}
                    className="flex min-w-0 flex-1 items-center gap-3 py-3 text-left hover:bg-paper/5 transition px-2"
                  >
                    {v.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.cover} alt="" className="w-12 h-12 object-cover rounded-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-paper/10 rounded-sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-paper/90">{v.title}</div>
                      <div className="mt-0.5 text-[11px] text-paper/50 truncate">
                        {[v.artist, v.year, v.genre].filter(Boolean).join(" · ")}
                      </div>
                    </div>
                  </button>
                  <RowSave
                    collections={collections}
                    targetId={targetId}
                    onTargetChange={setTargetId}
                    onCreateList={onCreateList}
                    containedIn={listsHolding(v.id)}
                    savedIn={savedIn[v.id]?.listId ?? null}
                    onSave={(listId: string) => {
                      onSaveToList(v, listId);
                      setSavedIn((m) => ({
                        ...m,
                        [v.id]: { listId, vinylId: v.id, wasNew: false },
                      }));
                    }}
                    onUndo={(listId: string) => {
                      onRemoveFromList(v.id, listId);
                      setSavedIn((m) => {
                        const next = { ...m };
                        delete next[v.id];
                        return next;
                      });
                    }}
                  />
                </li>
              ))}
            </ul>
          )}

          {/* discogs add list */}
          <ul className={mode === "discogs" ? "divide-y divide-paper/10" : "hidden"}>
            {results.map((r, i) => {
              // a record already in the library keeps its identity, so the
              // control can tell you which lists already hold it
              const known = allVinilos.find((v) => v.discogsId === r.id);
              return (
                <li
                  key={r.id}
                  data-row={i}
                  onMouseEnter={() => setCursor(i)}
                  className={`group flex items-center gap-2 pr-2 transition ${
                    cursor === i ? "bg-paper/[0.06]" : ""
                  }`}
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3 py-3 px-2">
                    {r.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.thumb} alt="" className="w-12 h-12 object-cover rounded-sm" />
                    ) : (
                      <div className="w-12 h-12 bg-paper/10 rounded-sm" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[14px] text-paper/90">{r.title}</div>
                      <div className="mt-0.5 text-[11px] text-paper/50 truncate">
                        {[r.year, r.country, r.label, r.format?.join(", ")]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                  </div>
                  <RowSave
                    collections={collections}
                    targetId={targetId}
                    onTargetChange={setTargetId}
                    onCreateList={onCreateList}
                    containedIn={known ? listsHolding(known.id) : []}
                    savedIn={savedIn[`d${r.id}`]?.listId ?? null}
                    busy={adding === r.id}
                    onSave={(listId: string) => add(r, listId)}
                    onUndo={(listId: string) => {
                      const saved = savedIn[`d${r.id}`];
                      if (saved) {
                        // brand new to the library → undo removes it entirely
                        if (saved.wasNew) onDeleteVinyl(saved.vinylId);
                        else onRemoveFromList(saved.vinylId, listId);
                      }
                      setSavedIn((m) => {
                        const next = { ...m };
                        delete next[`d${r.id}`];
                        return next;
                      });
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
