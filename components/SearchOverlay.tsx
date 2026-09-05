"use client";

import Link from "next/link";
import RackRow, { Chevron } from "@/components/community/RackRow";
import PersonRow from "@/components/community/PersonRow";
import { useRackCovers } from "@/hooks/useRackCovers";
import { rackOfList } from "@/lib/rack";

import { useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";
import { DestinationBar, RowSave } from "./SaveToList";
import BarcodeScanner, { BarcodeIcon, useCanScan } from "./BarcodeScanner";
import CatalogueSheet from "./CatalogueSheet";
import CatalogueNotice from "./ui/CatalogueNotice";
import { useCatalogueSearch, type DiscogsResult as SearchResult } from "@/hooks/useCatalogueSearch";

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
  /** abre la pantalla del disco; `pick` despliega además la hoja de racks */
  onJumpTo: (v: Vinyl, pick?: boolean) => void;
  /** open straight into the camera — the shelf offers scanning as its own act */
  autoScan?: boolean;
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
  autoScan = false,
}: Props) {
  // the chosen destination sticks between saves, like a pinboard would
  const [targetId, setTargetId] = useState(activeCollectionId);
  useEffect(() => setTargetId(activeCollectionId), [activeCollectionId]);
  const [mode, setMode] = useState<"vinyls" | "people">("vinyls");
  const [q, setQ] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // The searching itself is shared with the phone screen: same two sources,
  // same undo bookkeeping. Only the body around it differs.
  const {
    localResults,
    artists,
    artistPhotos,
    addable,
    degraded,
    people,
    communityLists,
    loading,
    adding,
    savedIn,
    addFromCatalogue,
    noteSave,
    forgetSave,
  } = useCatalogueSearch({ query: q, mode, localVinilos, allVinilos });
  const [scanning, setScanning] = useState(false);
  const canScan = useCanScan();
  /** a catalogue row opened to be read, not to be taken */
  const [looking, setLooking] = useState<SearchResult | null>(null);

  const openScanner = () => {
    setMode("vinyls");
    setScanning(true);
  };

  useEffect(() => {
    if (open && autoScan) {
      setScanning(true);
    } else if (open) setTimeout(() => inputRef.current?.focus(), 50);
    else {
      // clearing the query is enough: the hook derives every result set from
      // it, so there is nothing else left holding yesterday's search
      setQ("");
      setMode("vinyls");
      setScanning(false);
    }
  }, [open, autoScan]);

  // Saving keeps the search open on purpose: adding several records in a row
  // is the common case, and a closing overlay would punish it.
  const add = (r: SearchResult, listId: string) =>
    addFromCatalogue(r, listId, onSaveToList);

  // one cursor over the visible list: ↑↓ to move, ↵ to act on it
  const rackCovers = useRackCovers(communityLists);
  const [cursor, setCursor] = useState(0);
  useEffect(() => setCursor(0), [q, mode]);
  // one cursor walks both sections in reading order
  const rows: Array<{ kind: "local"; v: Vinyl } | { kind: "add"; r: SearchResult }> = [
    ...localResults.map((v) => ({ kind: "local" as const, v })),
    ...addable.map((r) => ({ kind: "add" as const, r })),
  ];
  const rowCount = rows.length;
  useEffect(() => {
    if (!open || scanning) return;
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
        const row = rows[cursor];
        if (!row) return;
        if (row.kind === "local") {
          onJumpTo(row.v);
          onClose();
        } else {
          add(row.r, targetId);
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
      if (open && !scanning && e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, scanning]);

  if (!open) return null;

  return (
    /**
     * The room behind the search, put properly out of focus.
     *
     * 70% black with a 4px blur left the shelf legible enough to keep reading
     * — so the palette floated on top of a scene that was still competing with
     * it. This is a modal: the point is that everything else stops. Darker,
     * and blurred far enough that the covers become colour rather than
     * pictures, which is what tells you the shelf is still there without
     * asking you to look at it.
     */
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/85 pt-[12vh] backdrop-blur-2xl">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-label="close search"
      />
      <div className="relative w-full max-w-[640px] mx-6">
        {/* mode tabs */}
        <div className="flex items-center gap-5 mb-1">
          {(["vinyls", "people"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`text-[11px] uppercase tracking-[0.22em] py-2 transition relative ${
                mode === m ? "text-paper" : "text-paper/35 hover:text-paper/70"
              }`}
            >
              {m === "vinyls" ? "Vinilos" : "Usuarios y racks"}
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
              mode === "vinyls"
                ? "Buscar un disco, tuyo o por añadir…"
                : "Buscar personas o racks…"
            }
            className="flex-1 bg-transparent py-4 text-[18px] text-paper outline-none placeholder:text-paper/30"
          />
          {canScan && mode !== "people" && (
            <button
              onClick={openScanner}
              title="Escanear el código de barras"
              aria-label="Escanear el código de barras"
              className="flex h-9 w-9 items-center justify-center text-paper/45 transition hover:text-paper"
            >
              <BarcodeIcon />
            </button>
          )}
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
            ↑↓ moverse · ↵ {rows[cursor]?.kind === "local" ? "ir al disco" : "guardar"}
          </span>
        </div>

        <div data-scrollable className="mt-3 max-h-[60vh] overflow-y-auto">
          {mode === "vinyls" && !q.trim() && canScan && (
            <button
              onClick={openScanner}
              className="mt-1 flex w-full items-center gap-3 border border-dashed border-paper/15 px-3 py-3 text-left transition hover:border-paper/35 hover:bg-paper/[0.03]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center border border-paper/20 text-paper/70">
                <svg width="15" height="15" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M4.6 4v10M7 4v10M9.6 4v10M13.4 4v10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] text-paper/90">Escanear el código de barras</span>
                <span className="mono mt-0.5 block text-[10px] uppercase tracking-[0.16em] text-paper/40">
                  Uno detrás de otro, sin salir de la cámara
                </span>
              </span>
            </button>
          )}
          {mode === "vinyls" && (
            <div className="px-2 pb-1 pt-2">
              <CatalogueNotice degraded={degraded} compact />
            </div>
          )}
          {mode === "vinyls" && loading && rowCount === 0 && (
            <div className="text-paper/50 text-sm py-3">Buscando…</div>
          )}
          {mode === "vinyls" && !loading && rowCount === 0 && q.trim() && (
            <div className="text-paper/50 text-sm py-3">Sin resultados</div>
          )}

          {/* people and lists */}
          {mode === "people" && (
            <>
              {people.length > 0 && (
                <>
                  <SectionLabel>Personas</SectionLabel>
                  <ul className="divide-y divide-line">
                    {people.map((u) => (
                      <li key={u.id}>
                        <PersonRow profile={u} />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {communityLists.length > 0 && (
                <>
                  <SectionLabel>Racks</SectionLabel>
                  <ul className="divide-y divide-line">
                    {communityLists.map((l) => (
                      <li key={l.id}>
                        <RackRow rack={rackOfList(l, (rackCovers[l.id] ?? [])[0] ?? null)} density="compact" showOwner />
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

          {/* Artists first when somebody typed a name: the question behind a
              name is "what else", and that had no row to press until now. */}
          {mode === "vinyls" && artists.length > 0 && (
            <>
              <SectionLabel>Artistas</SectionLabel>
              <ul className="divide-y divide-paper/10">
                {artists.map((a) => (
                  <li key={a.slug}>
                    <Link
                      href={`/artista/${a.slug}`}
                      onClick={onClose}
                      className="flex items-center gap-3 px-2 py-3 transition hover:bg-paper/5"
                    >
                      {artistPhotos[a.slug] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={artistPhotos[a.slug]}
                          alt=""
                          className="h-12 w-12 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-paper/[0.06] text-paper/45">
                          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden>
                            <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth="1.3" />
                            <circle cx="10" cy="10" r="1.6" fill="currentColor" />
                          </svg>
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-paper">{a.name}</span>
                        <span className="block truncate text-caption text-content-muted">
                          {a.records.length > 0
                            ? `${a.records.length} ${a.records.length === 1 ? "disco tuyo" : "discos tuyos"}`
                            : "Ver sus discos"}
                        </span>
                      </span>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* What you already own comes first, and only says so when there is
              something to separate it from. */}
          {mode === "vinyls" && localResults.length > 0 && (
            <>
            <SectionLabel>En tu colección</SectionLabel>
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
                      noteSave(v.id, { listId, vinylId: v.id, wasNew: false });
                    }}
                    onUndo={(listId: string) => {
                      onRemoveFromList(v.id, listId);
                      forgetSave(v.id);
                    }}
                  />
                </li>
              ))}
            </ul>
            </>
          )}

          {/* everything else the world has, offered underneath */}
          {mode === "vinyls" && localResults.length > 0 && addable.length > 0 && (
            <SectionLabel>Añadir a tu colección</SectionLabel>
          )}
          {mode === "vinyls" && localResults.length > 0 && loading && addable.length === 0 && (
            <div className="px-2 py-3 text-sm text-paper/40">Buscando más…</div>
          )}
          <ul className={mode === "vinyls" ? "divide-y divide-paper/10" : "hidden"}>
            {addable.map((r, i) => {
              // a record already in the library keeps its identity, so the
              // control can tell you which lists already hold it
              const known = allVinilos.find((v) => v.discogsId === r.id);
              return (
                <li
                  key={r.id}
                  data-row={localResults.length + i}
                  onMouseEnter={() => setCursor(localResults.length + i)}
                  className={`group flex items-center gap-2 pr-2 transition ${
                    cursor === localResults.length + i ? "bg-paper/[0.06]" : ""
                  }`}
                >
                  {/* The row reads, the control on the right keeps. Saving
                      was the only thing this line could do, so the only way to
                      find out which pressing you had found was to own it. */}
                  <button
                    onClick={() => setLooking(r)}
                    className="flex min-w-0 flex-1 items-center gap-3 px-2 py-3 text-left transition hover:bg-paper/5"
                  >
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
                  </button>
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
                      forgetSave(`d${r.id}`);
                    }}
                  />
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <CatalogueSheet
        item={looking}
        onClose={() => setLooking(null)}
        targetName={collections.find((c) => c.id === targetId)?.name ?? "Mi Colección"}
        saved={Boolean(looking && savedIn[`d${looking.id}`])}
        busy={adding === looking?.id}
        onSave={() => (looking ? add(looking, targetId) : null)}
        onSaved={(v) => {
          onJumpTo(v, true);
          onClose();
        }}
      />

      <BarcodeScanner
        open={scanning}
        onClose={() => setScanning(false)}
        collections={collections}
        targetId={targetId}
        onTargetChange={setTargetId}
        onCreateList={onCreateList}
        allVinilos={allVinilos}
        onSaveToList={onSaveToList}
        onRemoveFromList={onRemoveFromList}
        onDeleteVinyl={onDeleteVinyl}
        onSearchManually={(query) => {
          setMode("vinyls");
          setQ(query);
          setTimeout(() => inputRef.current?.focus(), 50);
        }}
      />
    </div>
  );
}
