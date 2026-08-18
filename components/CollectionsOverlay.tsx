"use client";

import { useEffect, useMemo, useState } from "react";
import { type Collection, type SortMode, SORT_LABELS, sortedVinylIds, DEFAULT_ID, WISHLIST_ID } from "@/lib/collections";
import type { ListVisibility, ListWithRecord } from "@/lib/data/types";

const isPrimaryId = (id: string) => id === DEFAULT_ID || id === WISHLIST_ID;
import type { Vinyl } from "@/lib/types";

type Props = {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  activeId: string;
  onActivate: (id: string) => void;
  onCreate: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onToggleVinyl: (collectionId: string, vinylId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  onSetSort: (collectionId: string, sortBy: SortMode) => void;
  onReorder: (collectionId: string, fromIdx: number, toIdx: number) => void;
  onSetVisibility: (collectionId: string, visibility: ListVisibility) => void;
  /** lists made by other people that you follow */
  followed: ListWithRecord[];
  onUnfollowList: (listId: string) => void;
  visibilityOf: (collectionId: string) => ListVisibility;
  allVinilos: Vinyl[];
};

function vinylsOf(c: Collection, all: Vinyl[]) {
  return c.vinylIds
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
}

function statsFor(c: Collection, all: Vinyl[]) {
  const vs = vinylsOf(c, all);
  if (vs.length === 0) {
    return { count: 0, last: null as Vinyl | null, topGenre: null, decades: null, artists: 0 };
  }
  const last = vs[vs.length - 1];
  const genreCount = new Map<string, number>();
  vs.forEach((v) => {
    if (v.genre) genreCount.set(v.genre, (genreCount.get(v.genre) ?? 0) + 1);
  });
  const topGenre = [...genreCount.entries()].sort((a, b) => b[1] - a[1])[0];
  const years = vs.map((v) => v.year).filter((y) => y && y > 1900);
  const minY = years.length ? Math.min(...years) : null;
  const maxY = years.length ? Math.max(...years) : null;
  const decades =
    minY && maxY
      ? minY === maxY
        ? `${minY}`
        : `${Math.floor(minY / 10) * 10}s – ${Math.floor(maxY / 10) * 10}s`
      : null;
  const artists = new Set(vs.map((v) => v.artist)).size;
  return { count: vs.length, last, topGenre, decades, artists };
}

export default function CollectionsOverlay({
  open,
  onClose,
  collections,
  activeId,
  onActivate,
  onCreate,
  onRename,
  onDelete,
  onToggleVinyl,
  onDeleteVinyl,
  onSetSort,
  onReorder,
  onSetVisibility,
  followed,
  onUnfollowList,
  visibilityOf,
  allVinilos,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [listFilter, setListFilter] = useState("");

  useEffect(() => {
    if (!open) {
      setEditId(null);
      setNewName("");
      setRenaming(false);
      setRenameId(null);
      setListFilter("");
    }
  }, [open]);

  const editing = editId ? collections.find((c) => c.id === editId) : null;
  const active = collections.find((c) => c.id === activeId);
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const visibleCollections = listFilter.trim()
    ? collections.filter((c) => norm(c.name).includes(norm(listFilter.trim())))
    : collections;
  const activeStats = useMemo(
    () => (active ? statsFor(active, allVinilos) : null),
    [active, allVinilos],
  );

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-500 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      />

      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 w-full max-w-[380px] bg-[#0a0a0a] text-paper border-r border-paper/[0.04] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-full flex flex-col">
          <header className="flex items-center justify-between px-6 pt-6 pb-3">
            <span className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
              {editing ? "Editar lista" : "Listas"}
            </span>
            <button
              onClick={editing ? () => setEditId(null) : onClose}
              className="text-[11px] uppercase tracking-[0.2em] text-paper/40 hover:text-paper transition"
            >
              {editing ? "← Atrás" : "Cerrar"}
            </button>
          </header>

          {editing ? (
            <EditPanel
              editing={editing}
              allVinilos={allVinilos}
              isPrimary={isPrimaryId(editing.id)}
              isLibrary={editing.id === DEFAULT_ID}
              visibility={visibilityOf(editing.id)}
              onSetVisibility={onSetVisibility}
              onRename={onRename}
              onToggleVinyl={onToggleVinyl}
              onDeleteVinyl={onDeleteVinyl}
              onSetSort={onSetSort}
              onReorder={onReorder}
            />
          ) : (
            <div data-scrollable className="flex-1 overflow-y-auto">
              {active && (
                <section className="px-6">
                  {/* title */}
                  {renaming ? (
                    <input
                      autoFocus
                      defaultValue={active.name}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v && v !== active.name) onRename(active.id, v);
                        setRenaming(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                        if (e.key === "Escape") setRenaming(false);
                      }}
                      className="w-full bg-transparent border-b border-paper/20 py-1 text-[22px] font-medium text-paper outline-none focus:border-paper/60"
                    />
                  ) : (
                    <h2 className="text-[22px] font-medium leading-tight tracking-tight flex items-center gap-2">
                      {active.name}
                      {isPrimaryId(active.id) && (
                        <span className="text-paper/30 mt-1" title="Lista predefinida">
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" stroke="currentColor" />
                            <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
                          </svg>
                        </span>
                      )}
                    </h2>
                  )}

                  {activeStats && activeStats.count > 0 && (
                    <p className="mt-2 text-[12px] text-paper/45">
                      {activeStats.count} {activeStats.count === 1 ? "disco" : "discos"} · {activeStats.artists} artistas
                    </p>
                  )}

                  {/* metadata table (Are.na style) */}
                  {activeStats && activeStats.count > 0 && (
                    <dl className="mt-5 text-[13px]">
                      <Row label="Discos" value={String(activeStats.count)} />
                      {activeStats.last && (
                        <Row label="Última inc." value={activeStats.last.title} />
                      )}
                      {activeStats.topGenre && (
                        <Row
                          label="Top género"
                          value={`${activeStats.topGenre[0]} · ${activeStats.topGenre[1]}`}
                        />
                      )}
                      {activeStats.decades && (
                        <Row label="Décadas" value={activeStats.decades} />
                      )}
                    </dl>
                  )}

                  {/* action row */}
                  <div className="mt-5 flex items-center gap-2 rounded-md border border-paper/[0.06] p-2">
                    <button
                      onClick={() => setEditId(active.id)}
                      className="flex-1 text-[12px] py-1.5 px-3 rounded-sm bg-paper/5 hover:bg-paper/10 text-paper transition"
                    >
                      Editar discos →
                    </button>
                    {!isPrimaryId(active.id) && (
                      <button
                        onClick={() => setRenaming(true)}
                        className="text-[12px] py-1.5 px-3 rounded-sm hover:bg-paper/5 text-paper/70 hover:text-paper transition"
                      >
                        Renombrar
                      </button>
                    )}
                    {collections.length > 1 && !isPrimaryId(active.id) && (
                      <button
                        onClick={() => {
                          if (confirm(`Eliminar "${active.name}"?`)) onDelete(active.id);
                        }}
                        className="text-[12px] py-1.5 px-3 rounded-sm hover:bg-red-500/10 text-paper/35 hover:text-red-400 transition"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* every list in one place: the active one is marked, the rest
                  are one click away. No "current vs others" split to parse. */}
              <div className="mt-7 px-6 pb-3 border-b border-paper/[0.04] flex items-baseline justify-between">
                <span className="text-[11px] uppercase tracking-[0.2em] text-paper/40">
                  Todas las listas · {collections.length}
                </span>
                {collections.length > 6 && (
                  <input
                    value={listFilter}
                    onChange={(e) => setListFilter(e.target.value)}
                    placeholder="Filtrar…"
                    className="w-[110px] bg-transparent text-right text-[12px] text-paper outline-none placeholder:text-paper/25"
                  />
                )}
              </div>

              <ul className="px-3 py-3 space-y-1">
                {visibleCollections.map((c) => {
                  const s = statsFor(c, allVinilos);
                  const isActive = c.id === activeId;
                  // one cover reads better than a mosaic at 36px
                  const cover = vinylsOf(c, allVinilos).filter((v) => v.cover).pop();
                  return (
                    <li key={c.id} className="group relative">
                      {renameId === c.id ? (
                        <input
                          autoFocus
                          defaultValue={c.name}
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v && v !== c.name) onRename(c.id, v);
                            setRenameId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            if (e.key === "Escape") setRenameId(null);
                          }}
                          className="w-full rounded-md border border-paper/25 bg-transparent px-4 py-3 text-[14px] text-paper outline-none"
                        />
                      ) : (
                        <button
                          onClick={() => onActivate(c.id)}
                          onDoubleClick={() => !isPrimaryId(c.id) && setRenameId(c.id)}
                          title={isPrimaryId(c.id) ? undefined : "Doble clic para renombrar"}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition ${
                            isActive
                              ? "bg-paper/[0.10]"
                              : "bg-paper/[0.03] hover:bg-paper/[0.07]"
                          }`}
                        >
                          {/* a strip of covers says more than a count */}
                          <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-sm bg-paper/[0.06]">
                            {cover && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={cover.cover as string}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="truncate text-[14px] text-paper">{c.name}</span>
                              {isPrimaryId(c.id) && (
                                <span className="text-paper/25" title="Lista predefinida">
                                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                    <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" stroke="currentColor" />
                                    <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
                                  </svg>
                                </span>
                              )}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-paper/40">
                              {s.count} {s.count === 1 ? "disco" : "discos"}
                              {isActive ? " · viendo ahora" : ""}
                            </span>
                          </span>
                        </button>
                      )}

                      {/* per-row actions, revealed on hover */}
                      {renameId !== c.id && (
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                          <RowAction
                            label="Editar discos"
                            onClick={() => {
                              onActivate(c.id);
                              setEditId(c.id);
                            }}
                          >
                            <g
                              stroke="currentColor"
                              strokeWidth="1"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              fill="none"
                            >
                              <path d="M7.9 1.6 L10.4 4.1 L4.3 10.2 L1.4 10.6 L1.8 7.7 Z" />
                              <path d="M6.6 2.9 L9.1 5.4" opacity="0.55" />
                            </g>
                          </RowAction>
                          {!isPrimaryId(c.id) && (
                            <RowAction
                              label="Borrar lista"
                              danger
                              onClick={() => {
                                if (confirm(`Eliminar "${c.name}"? Los discos siguen en tu biblioteca.`))
                                  onDelete(c.id);
                              }}
                            >
                              <g
                                stroke="currentColor"
                                strokeWidth="1"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                              >
                                <path d="M2 3.4 H10" />
                                <path d="M4.7 3.4 V2.2 H7.3 V3.4" />
                                <path d="M3.1 3.4 L3.6 10 H8.4 L8.9 3.4" />
                                <path d="M5.1 5.4 V8.4 M6.9 5.4 V8.4" opacity="0.55" />
                              </g>
                            </RowAction>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
                {visibleCollections.length === 0 && (
                  <li className="px-4 py-3 text-[12px] text-paper/35">
                    Ninguna lista con ese nombre
                  </li>
                )}
              </ul>

              {/* Lists you follow. Kept apart on purpose: they are not yours
                  to edit, and mixing them into your own would blur whose
                  collection you are looking at. */}
              {followed.length > 0 && (
                <>
                  <div className="mt-8 flex items-baseline justify-between border-y border-paper/[0.07] px-6 py-3">
                    <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                      Listas que sigues
                    </span>
                    <span className="mono text-[10px] tracking-[0.16em] text-paper/25">
                      {followed.length}
                    </span>
                  </div>
                  <ul className="px-3 py-3 space-y-1">
                    {followed.map((l) => (
                      <li key={l.id} className="group relative">
                        <a
                          href={`/u/${l.owner.username}/${l.slug}`}
                          className="flex items-center gap-3 rounded-md border border-dashed border-paper/[0.12] px-3 py-2.5 transition hover:border-paper/25 hover:bg-paper/[0.04]"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/[0.06] mono text-[9px] text-paper/50">
                            {l.owner.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={l.owner.avatarUrl} alt="" className="h-full w-full object-cover" />
                            ) : (
                              l.owner.displayName.slice(0, 2).toUpperCase()
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] text-paper/90">{l.title}</span>
                            <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.16em] text-paper/35">
                              de {l.owner.displayName} · {l.itemCount} discos
                            </span>
                          </span>
                        </a>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            onUnfollowList(l.id);
                          }}
                          aria-label="Dejar de seguir"
                          title="Dejar de seguir"
                          className="absolute right-2 top-1/2 -translate-y-1/2 mono text-[9px] uppercase tracking-[0.16em] text-paper/25 opacity-0 transition hover:text-paper group-hover:opacity-100"
                        >
                          Dejar
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {/* create new — sticky footer-ish */}
              <div className="px-6 py-4 mt-2 border-t border-paper/[0.04]">
                <div className="flex items-center gap-3">
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && newName.trim()) {
                        onCreate(newName.trim());
                        setNewName("");
                      }
                    }}
                    placeholder="Nueva lista"
                    className="flex-1 bg-transparent border-b border-paper/[0.07] py-1.5 text-[13px] text-paper outline-none placeholder:text-paper/30 focus:border-paper/60 transition"
                  />
                  <button
                    onClick={() => {
                      if (newName.trim()) {
                        onCreate(newName.trim());
                        setNewName("");
                      }
                    }}
                    disabled={!newName.trim()}
                    className="text-[11px] uppercase tracking-[0.18em] text-paper/60 hover:text-paper transition disabled:opacity-25"
                  >
                    Crear
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function RowAction({
  label,
  onClick,
  children,
  danger = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      aria-label={label}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded-sm bg-ink/70 text-paper/45 backdrop-blur-sm transition hover:bg-ink ${
        danger ? "hover:text-red-400" : "hover:text-paper"
      }`}
    >
      <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
        {children}
      </svg>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-3 py-1.5 border-b border-paper/[0.04] last:border-b-0">
      <dt className="text-paper/40 w-[32%]">{label}</dt>
      <dd className="flex-1 text-right text-paper/85 truncate">{value}</dd>
    </div>
  );
}

function EditPanel({
  editing,
  allVinilos,
  isPrimary,
  isLibrary,
  visibility,
  onSetVisibility,
  onRename,
  onToggleVinyl,
  onDeleteVinyl,
  onSetSort,
  onReorder,
}: {
  editing: Collection;
  allVinilos: Vinyl[];
  isPrimary: boolean;
  /** Mi Colección is the library itself: taking a record out means deleting it */
  isLibrary: boolean;
  visibility: ListVisibility;
  onSetVisibility: (collectionId: string, visibility: ListVisibility) => void;
  onRename: (id: string, name: string) => void;
  onToggleVinyl: (collectionId: string, vinylId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  onSetSort: (collectionId: string, sortBy: SortMode) => void;
  onReorder: (collectionId: string, fromIdx: number, toIdx: number) => void;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const sortBy = editing.sortBy ?? "custom";

  const orderedIds = sortedVinylIds(editing, allVinilos);
  const orderedVinilos = orderedIds
    .map((id) => allVinilos.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
  const notInCol = allVinilos.filter((v) => !editing.vinylIds.includes(v.id));

  return (
    <>
      {/* title block */}
      <div className="px-6 pb-5">
        {isPrimary ? (
          <div className="text-[20px] leading-tight text-paper">{editing.name}</div>
        ) : (
          <input
            defaultValue={editing.name}
            onBlur={(e) => onRename(editing.id, e.target.value.trim() || editing.name)}
            className="w-full bg-transparent border-b border-paper/[0.07] py-1 text-[20px] leading-tight text-paper outline-none focus:border-paper/60 transition"
          />
        )}
      </div>

      {/* one field per rule, label left / value right — the count lives with
          the list below, so it isn't stated twice */}
      <div className="border-y border-paper/[0.07] px-6">
        {/* Who can see it. The wishlist stays private by nature: what you want
            to buy is nobody else's business unless you say so. */}
        <div className="flex items-center justify-between gap-4 border-b border-paper/[0.07] py-3">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
            Visible
          </span>
          <div className="flex items-center gap-1">
            {(
              [
                ["public", "Pública"],
                ["unlisted", "Con enlace"],
                ["private", "Privada"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => onSetVisibility(editing.id, value)}
                className={`px-2.5 py-1 text-[12px] transition ${
                  visibility === value
                    ? "bg-paper text-ink"
                    : "text-paper/45 hover:text-paper"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 py-3">
          <label
            htmlFor="sort-select"
            className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40"
          >
            Orden
          </label>
          <div className="relative flex items-center">
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => onSetSort(editing.id, e.target.value as SortMode)}
              className="cursor-pointer appearance-none bg-transparent pr-4 text-right text-[13px] text-paper outline-none"
            >
              {(Object.keys(SORT_LABELS) as SortMode[]).map((m) => (
                <option key={m} value={m} className="bg-[#0a0a0a]">
                  {SORT_LABELS[m]}
                </option>
              ))}
            </select>
            <svg
              className="pointer-events-none absolute right-0 text-paper/40"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              aria-hidden
            >
              <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.1" />
            </svg>
          </div>
        </div>
      </div>

      <div data-scrollable className="flex-1 overflow-y-auto pb-6">
        {/* section header — stays put while the list scrolls under it */}
        <div className="sticky top-0 z-10 flex items-baseline justify-between bg-[#0a0a0a] px-6 pb-2 pt-5">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
            En la lista
          </span>
          <span className="mono text-[10px] tracking-[0.16em] text-paper/30">
            {orderedVinilos.length}
          </span>
        </div>
        <ul className="px-3">
          {orderedVinilos.map((v, idx) => {
            const customIdx = editing.vinylIds.indexOf(v.id);
            const draggable = sortBy === "custom";
            const isDragging = dragIdx === customIdx;
            const isOver = overIdx === customIdx && dragIdx !== null && dragIdx !== customIdx;
            return (
              <li
                key={v.id}
                draggable={draggable}
                onDragStart={(e) => {
                  if (!draggable) return;
                  setDragIdx(customIdx);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => {
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                onDragOver={(e) => {
                  if (!draggable || dragIdx === null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (overIdx !== customIdx) setOverIdx(customIdx);
                }}
                onDrop={(e) => {
                  if (!draggable || dragIdx === null) return;
                  e.preventDefault();
                  if (dragIdx !== customIdx) onReorder(editing.id, dragIdx, customIdx);
                  setDragIdx(null);
                  setOverIdx(null);
                }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-sm transition ${
                  isDragging ? "opacity-30" : "hover:bg-paper/[0.04]"
                } ${isOver ? "bg-paper/[0.08] outline outline-1 outline-paper/20" : ""} ${
                  draggable ? "cursor-grab active:cursor-grabbing" : ""
                }`}
              >
                {sortBy === "custom" && (
                  <span
                    className="text-paper/25 group-hover:text-paper/60 transition leading-none text-[10px] select-none"
                    aria-hidden
                  >
                    ⋮⋮
                  </span>
                )}
                <span className="flex-1 min-w-0 text-[12px] truncate">
                  <span className="text-paper">{v.title}</span>
                  <span className="ml-2 text-paper/40">{v.artist}</span>
                  {v.year ? <span className="ml-2 text-paper/25">{v.year}</span> : null}
                </span>
                <button
                  onClick={() => {
                    if (isLibrary) {
                      // Mi Colección: removing means deleting the vinyl entirely
                      if (confirm(`Eliminar permanentemente "${v.title}"?`)) {
                        onDeleteVinyl(v.id);
                      }
                    } else {
                      // any other list: just take it out of this list
                      onToggleVinyl(editing.id, v.id);
                    }
                  }}
                  className="text-[11px] uppercase tracking-[0.16em] text-paper/30 hover:text-red-400 transition px-2 opacity-0 group-hover:opacity-100"
                  aria-label={isLibrary ? "Eliminar permanentemente" : "Quitar"}
                >
                  {isLibrary ? "Eliminar" : "Quitar"}
                </button>
              </li>
            );
          })}
          {orderedVinilos.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-paper/35">Lista vacía</li>
          )}
        </ul>

        {/* add more */}
        {notInCol.length > 0 && !isLibrary && (
          <>
            {/* same rhythm as the section above: label left, count right */}
            <div className="mt-6 flex items-baseline justify-between border-t border-paper/[0.07] px-6 pb-2 pt-5">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                Añadir discos
              </span>
              <span className="mono text-[10px] tracking-[0.16em] text-paper/30">
                {notInCol.length}
              </span>
            </div>
            <ul className="px-3">
              {notInCol.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => onToggleVinyl(editing.id, v.id)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left text-[12px] rounded-sm text-paper/55 hover:bg-paper/[0.04] transition"
                  >
                    <span className="h-1.5 w-1.5 rounded-full border border-paper/25" />
                    <span className="truncate flex-1">
                      <span className="text-paper">{v.title}</span>
                      <span className="ml-2 text-paper/40">{v.artist}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </>
  );
}
