"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import Segmented from "@/components/ui/Segmented";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import EmptyState from "@/components/ui/EmptyState";
import { useToast } from "@/components/ui/Toast";
import { useCatalogueSearch, type DiscogsResult } from "@/hooks/useCatalogueSearch";
import BarcodeScanner, { useCanScan } from "@/components/BarcodeScanner";
import type { Collection } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";
import CatalogueNotice from "@/components/ui/CatalogueNotice";

/**
 * Adding a record, on a phone.
 *
 * The desktop version of this is a command palette: floating at 12vh, driven by
 * ↑↓ and ↵, with a picker that pops out of a hover-revealed button. Every one of
 * those affordances is missing on a phone, so the same overlay there is a small
 * box with a keyboard covering two thirds of it and controls too small to hit.
 *
 * This is the phone's own screen instead:
 *
 * - **Full height, field under the thumb-free top**, so the keyboard opening
 *   doesn't shove the results out of the screen.
 * - **One tap saves.** There is a destination bar showing where things are
 *   going and a tap to change it — but the common case, "add this to the list
 *   I'm already in", is one press, and it is confirmed with an undo instead of
 *   a dialogue.
 * - **Scanning gets a full-width row, not a 16px icon.** Arriving with a sleeve
 *   in your hand is the most physical thing this app does, and on a phone it is
 *   also the fastest way in. On a desktop it is a curiosity.
 * - **Cancelar, in words.** A phone sheet with only a gesture to leave it is a
 *   trap for anyone who hasn't learnt the gesture yet.
 */
export default function MobileSearch({
  open,
  onClose,
  autoScan = false,
  collections,
  activeCollectionId,
  allVinilos,
  localVinilos,
  onSaveToList,
  onCreateList,
  onRemoveFromList,
  onDeleteVinyl,
  onJumpTo,
}: {
  open: boolean;
  onClose: () => void;
  autoScan?: boolean;
  collections: Collection[];
  activeCollectionId: string;
  allVinilos: Vinyl[];
  localVinilos: Vinyl[];
  onSaveToList: (v: Vinyl, listId: string) => void;
  onCreateList: (name: string) => Promise<string>;
  onRemoveFromList: (vinylId: string, listId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  onJumpTo: (v: Vinyl) => void;
}) {
  const toast = useToast();
  const canScan = useCanScan();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<"vinyls" | "people">("vinyls");
  const [targetId, setTargetId] = useState(activeCollectionId);
  const [picking, setPicking] = useState(false);
  const [scanning, setScanning] = useState(false);

  const search = useCatalogueSearch({ query: q, mode, localVinilos, allVinilos });

  useEffect(() => setTargetId(activeCollectionId), [activeCollectionId]);

  useEffect(() => {
    if (!open) {
      setQ("");
      setMode("vinyls");
      setScanning(false);
      return;
    }
    if (autoScan) {
      setScanning(true);
      return;
    }
    // the delay lets the sheet finish rising; focusing mid-animation on iOS
    // raises the keyboard against a moving target and the layout jumps
    const t = setTimeout(() => inputRef.current?.focus(), 320);
    return () => clearTimeout(t);
  }, [open, autoScan]);

  if (!open) return null;

  const target = collections.find((c) => c.id === targetId);
  const nothing =
    q.trim() &&
    !search.loading &&
    (mode === "vinyls"
      ? search.localResults.length === 0 && search.addable.length === 0
      : search.people.length === 0 && search.communityLists.length === 0);

  const saveCatalogue = async (r: DiscogsResult) => {
    const v = await search.addFromCatalogue(r, targetId, onSaveToList);
    if (!v) return toast.show("No se pudo añadir ese disco.", { tone: "error" });
    const saved = search.savedIn[`d${r.id}`];
    toast.undo(
      `${v.title} → ${target?.name ?? "tu colección"}`,
      () => {
        // brand new to the library → undo takes it out entirely
        if (saved?.wasNew) onDeleteVinyl(v.id);
        else onRemoveFromList(v.id, targetId);
        search.forgetSave(`d${r.id}`);
      },
      { media: { src: r.thumb } },
    );
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] flex flex-col bg-surface">
        {/* ------------------------------------------------------- the field */}
        <div
          className="shrink-0 border-b border-line px-4 pb-3"
          style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
        >
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <span className="pointer-events-none absolute left-0 top-1/2 -translate-y-1/2 text-content-faint">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.3" />
                  <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </span>
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                aria-label={mode === "vinyls" ? "Buscar un disco" : "Buscar personas o racks"}
                placeholder={mode === "vinyls" ? "Un disco, tuyo o por añadir" : "Personas o racks"}
                className="h-11 w-full bg-transparent pl-7 pr-2 text-body text-paper outline-none placeholder:text-content-faint"
              />
            </div>
            <button onClick={onClose} className="pressable shrink-0 py-2 text-body text-content-secondary">
              Cancelar
            </button>
          </div>

          <div className="mt-2.5">
            <Segmented
              size="sm"
              value={mode}
              onChange={setMode}
              segments={[
                { value: "vinyls", label: "Discos" },
                { value: "people", label: "Gente y racks" },
              ]}
            />
          </div>
        </div>

        {/* where saves are going — always visible, never a guess */}
        {mode === "vinyls" && (
          <button
            onClick={() => setPicking(true)}
            className="pressable flex shrink-0 items-center gap-2 border-b border-line px-4 py-2.5 text-left"
          >
            <span className="text-sub text-content-muted">Guardar en</span>
            <span className="min-w-0 flex-1 truncate text-sub font-medium text-paper">
              {target?.name ?? "Mi Colección"}
            </span>
            <span aria-hidden className="text-content-faint">
              Cambiar
            </span>
          </button>
        )}

        {/* ----------------------------------------------------- the results */}
        <div className="scroll-y flex-1 px-4" style={{ paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
          {mode === "vinyls" && !q.trim() && canScan && (
            <button
              onClick={() => setScanning(true)}
              className="pressable mt-4 flex w-full items-center gap-3.5 rounded-control border border-dashed border-line-strong px-4 py-4 text-left"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-sm border border-line-strong text-paper">
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path d="M4.6 4v10M7 4v10M9.6 4v10M13.4 4v10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </span>
              <span className="min-w-0">
                <span className="block text-body font-medium text-paper">Escanear el código</span>
                <span className="mt-0.5 block text-sub text-content-muted">
                  Uno detrás de otro, sin salir de la cámara
                </span>
              </span>
            </button>
          )}

          {!q.trim() && !canScan && (
            <p className="mt-6 text-sub text-content-muted">
              Escribe el título o el artista. Si no lo tienes, aparecerá abajo para añadirlo.
            </p>
          )}

          {nothing && (
            <div className="mt-5">
              <EmptyState
                compact
                title={`Nada para «${q}»`}
                body={
                  mode === "vinyls"
                    ? "Prueba con menos palabras, o solo con el artista. El código de barras acierta más que el título."
                    : "Ningún nombre ni ningún rack con eso."
                }
                action={
                  canScan && mode === "vinyls"
                    ? { label: "Escanear el código", onClick: () => setScanning(true) }
                    : { label: "Borrar búsqueda", onClick: () => setQ("") }
                }
              />
            </div>
          )}

          {mode === "vinyls" && (
            <div className="px-4 pb-1 pt-3">
              <CatalogueNotice degraded={search.degraded} compact />
            </div>
          )}

          {mode === "vinyls" && search.localResults.length > 0 && (
            <>
              <Label>En tu colección</Label>
              <ul className="divide-y divide-line">
                {search.localResults.map((v) => (
                  <li key={v.id}>
                    <button
                      onClick={() => {
                        onJumpTo(v);
                        onClose();
                      }}
                      className="pressable flex w-full items-center gap-3 py-3 text-left"
                    >
                      <Thumb src={v.cover} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-paper">{v.title}</span>
                        <span className="block truncate text-sub text-content-muted">
                          {[v.artist, v.year].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span aria-hidden className="shrink-0 text-content-faint">
                        →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          {mode === "vinyls" && search.addable.length > 0 && (
            <>
              <Label>Añadir a tu colección</Label>
              <ul className="divide-y divide-line">
                {search.addable.map((r) => {
                  const done = Boolean(search.savedIn[`d${r.id}`]);
                  return (
                    <li key={r.id} className="flex items-center gap-3 py-3">
                      <Thumb src={r.thumb} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-paper">{r.title}</span>
                        <span className="block truncate text-sub text-content-muted">
                          {[r.year, r.country, r.format?.join(", ")].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <button
                        onClick={() => void saveCatalogue(r)}
                        disabled={search.adding === r.id || done}
                        aria-label={`Añadir ${r.title} a ${target?.name ?? "mi colección"}`}
                        className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-40"
                      >
                        {done ? (
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                            <path d="M2.5 7.5 L5.5 10.5 L11.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        ) : search.adding === r.id ? (
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
            </>
          )}

          {mode === "people" && search.people.length > 0 && (
            <>
              <Label>Personas</Label>
              <ul className="divide-y divide-line">
                {search.people.map((u) => (
                  <li key={u.id}>
                    <Link
                      href={`/u/${u.username}`}
                      onClick={onClose}
                      className="pressable flex items-center gap-3 py-3"
                    >
                      <Avatar name={u.displayName} handle={u.username} src={u.avatarUrl} size="md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-paper">{u.displayName}</span>
                        <span className="block truncate text-sub text-content-muted">@{u.username}</span>
                      </span>
                      <span aria-hidden className="text-content-faint">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}

          {mode === "people" && search.communityLists.length > 0 && (
            <>
              <Label>Racks</Label>
              <ul className="divide-y divide-line">
                {search.communityLists.map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/u/${l.owner.username}/${l.slug}`}
                      onClick={onClose}
                      className="pressable flex items-center gap-3 py-3"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body text-paper">{l.title}</span>
                        <span className="block truncate text-sub text-content-muted">
                          {l.owner.displayName} · {l.itemCount} discos
                        </span>
                      </span>
                      <span aria-hidden className="text-content-faint">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {/* changing the destination: a sheet over the search, which stays put */}
      <Sheet open={picking} onClose={() => setPicking(false)} title="Guardar en" size="auto" width={380}>
        <div className="py-1">
          {collections.map((c) => (
            <SheetRow
              key={c.id}
              label={c.name}
              detail={c.id === targetId ? "✓" : `${c.vinylIds.length}`}
              onClick={() => {
                setTargetId(c.id);
                setPicking(false);
              }}
            />
          ))}
          <SheetRow
            label="Rack nuevo…"
            onClick={async () => {
              const name = window.prompt("Nombre del rack");
              if (!name?.trim()) return;
              const id = await onCreateList(name.trim());
              setTargetId(id);
              setPicking(false);
            }}
          />
        </div>
      </Sheet>

      <BarcodeScanner
        open={scanning}
        onClose={() => {
          setScanning(false);
          // arriving straight into the camera and closing it means you are done,
          // not that you wanted a text field you never asked for
          if (autoScan) onClose();
        }}
        collections={collections}
        targetId={targetId}
        onTargetChange={setTargetId}
        onCreateList={onCreateList}
        allVinilos={allVinilos}
        onSaveToList={onSaveToList}
        onRemoveFromList={onRemoveFromList}
        onDeleteVinyl={onDeleteVinyl}
        onSearchManually={(query) => {
          setScanning(false);
          setMode("vinyls");
          setQ(query);
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
      />
    </>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <p className="pb-1.5 pt-6 text-caption uppercase tracking-label text-content-muted">{children}</p>
  );
}

function Thumb({ src }: { src?: string | null }) {
  return (
    <span className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-fill-subtle">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
