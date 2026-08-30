"use client";

import Link from "next/link";

import { useEffect, useMemo, useRef, useState } from "react";
import ListHoverCard from "@/components/community/ListHoverCard";
import SharedMark from "@/components/ui/SharedMark";
import Select from "@/components/ui/Select";
import { useRepository } from "@/hooks/useRepository";
import type { Collaborator } from "@/lib/data/types";
import CollaboratorsSheet from "@/components/community/CollaboratorsSheet";
import { type Collection, type SortMode, SORT_LABELS, sortedVinylIds } from "@/lib/collections";
import { coverFor } from "@/lib/cover";
import Avatar from "@/components/ui/Avatar";
import type { ListVisibility, ListWithRecord } from "@/lib/data/types";

/** Predefined lists are told apart by what they are, not by their id. */
const kindOf = (cols: Collection[], id: string) =>
  cols.find((c) => c.id === id)?.kind ?? "custom";
const isPrimaryIn = (cols: Collection[], id: string) => kindOf(cols, id) !== "custom";
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
  /** up to a few cover URLs per kept list, so its row looks like your own */
  followedCovers: Record<string, string[]>;
  onUnfollowList: (listId: string) => void;
  /** open a kept list on this shelf instead of navigating away from it */
  onOpenFollowed: (list: ListWithRecord) => void;
  visibilityOf: (collectionId: string) => ListVisibility;
  /** who you are, so an invitation knows who is sending it */
  myId: string;
  /** the preview shows what lists are, without letting you dismantle them */
  preview?: boolean;
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
  followedCovers,
  onUnfollowList,
  onOpenFollowed,
  visibilityOf,
  myId,
  allVinilos,
  preview = false,
}: Props) {
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  /**
   * The hover card waits half a second before it exists.
   *
   * Without the delay it fires on the way past — you cross three rows reaching
   * for a fourth and three panels flash at you. Half a second is long enough to
   * separate "passing over" from "looking at", and short enough that nobody
   * experiences it as waiting.
   */
  const [hovered, setHovered] = useState<{ list: ListWithRecord; el: HTMLElement } | null>(null);
  /** the list whose collaborators are open, if any */
  const [sharingId, setSharingId] = useState<string | null>(null);

  /**
   * Who else can write in the list on screen.
   *
   * Asked for per list rather than for all of them: a shelf with twenty lists
   * would otherwise open twenty requests to answer a question about one.
   */
  const repo = useRepository();
  const [sharedWith, setSharedWith] = useState<Collaborator[]>([]);
  useEffect(() => {
    if (!open || !activeId) return setSharedWith([]);
    let alive = true;
    repo
      .collaboratorsOf(activeId)
      .then((all) => alive && setSharedWith(all.filter((c) => c.role !== "owner")))
      .catch(() => alive && setSharedWith([]));
    return () => {
      alive = false;
    };
  }, [repo, open, activeId, sharingId]);
  const openTimer = useRef<ReturnType<typeof setTimeout>>();
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();

  /** dwell on a row and the card appears; move on and it is gone */
  const arm = (list: ListWithRecord, el: HTMLElement) => {
    clearTimeout(closeTimer.current);
    clearTimeout(openTimer.current);
    openTimer.current = setTimeout(() => setHovered({ list, el }), 500);
  };

  /**
   * Leaving closes it, with just enough of a bridge to cross the gap.
   *
   * Closing on the exact frame the pointer leaves the row would make the card
   * unreachable — there are ten pixels between them, and crossing those pixels
   * means having left. 120ms is below the threshold anyone perceives as a
   * delay, and entering the card cancels it outright.
   */
  const disarm = () => {
    clearTimeout(openTimer.current);
    closeTimer.current = setTimeout(() => setHovered(null), 120);
  };

  const keepOpen = () => clearTimeout(closeTimer.current);
  const closeNow = () => {
    clearTimeout(openTimer.current);
    clearTimeout(closeTimer.current);
    setHovered(null);
  };

  useEffect(
    () => () => {
      clearTimeout(openTimer.current);
      clearTimeout(closeTimer.current);
    },
    [],
  );
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
  const matching = listFilter.trim()
    ? collections.filter((c) => norm(c.name).includes(norm(listFilter.trim())))
    : collections;

  /**
   * The two you always have, then everything you made.
   *
   * Mi Colección and Lista de deseos are not lists in the same sense as the
   * rest: you never created them, you cannot delete them, and one of them is
   * everything you own. Sorted in among "Rock 🤘" they read as peers, and the
   * eye has to check the name of each row to find the one it wanted. Above a
   * rule, they are furniture — always in the same place, found without reading.
   *
   * Order inside the pair is fixed too: what you have before what you want.
   */
  const primary = matching
    .filter((c) => isPrimaryIn(collections, c.id))
    .sort((a, b) => (kindOf(collections, a.id) === "collection" ? -1 : 1));
  const custom = matching.filter((c) => !isPrimaryIn(collections, c.id));
  const visibleCollections = [...primary, ...custom];
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
              {editing ? "Editar el rack" : "Racks"}
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
              isPrimary={isPrimaryIn(collections, editing.id)}
              isLibrary={kindOf(collections, editing.id) === "collection"}
              visibility={visibilityOf(editing.id)}
              preview={preview}
              onShare={() => setSharingId(editing.id)}
              sharedCount={sharedWith.length}
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
                      {isPrimaryIn(collections, active.id) && (
                        <span className="text-paper/30 mt-1" title="Rack predefinido">
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
                      {/* Who else is in it, in the same table as everything
                          else true about this list — and as faces, because
                          "2 colaboradores" is a number you then have to go and
                          look up. */}
                      {sharedWith.length > 0 && (
                        <div className="flex items-baseline justify-between gap-4 border-b border-paper/[0.06] py-2">
                          <dt className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                            Compartida con
                          </dt>
                          <dd className="flex flex-wrap items-center justify-end gap-1.5">
                            {sharedWith.map((c) => (
                              <span
                                key={c.profile.id}
                                className={`flex items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[11px] ${
                                  c.pending
                                    ? "bg-paper/[0.04] text-paper/40"
                                    : "bg-paper/[0.08] text-paper/80"
                                }`}
                                title={c.pending ? "Invitación pendiente" : undefined}
                              >
                                <Avatar
                                  name={c.profile.displayName}
                                  handle={c.profile.username}
                                  src={c.profile.avatarUrl}
                                  size="xs"
                                />
                                {c.profile.displayName}
                                {c.pending && " ·"}
                              </span>
                            ))}
                          </dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {/* Who is in it, when there is more than one of you. */}
                  {active.sharedBy && (
                    <p className="mt-4 flex items-center gap-2 text-[12px] text-paper/45">
                      <SharedMark title={`Compartida por ${active.sharedBy.displayName}`} />
                      Compartida por {active.sharedBy.displayName}
                    </p>
                  )}

                  {/* action row */}
                  <div className="mt-5 flex items-center gap-2 rounded-md border border-paper/[0.06] p-2">
                    <button
                      onClick={() => setEditId(active.id)}
                      className="flex-1 rounded-control bg-paper/5 px-3 py-1.5 text-[12px] text-paper transition hover:bg-paper/10"
                    >
                      Editar lista →
                    </button>
                    {!isPrimaryIn(collections, active.id) && (
                      <button
                        onClick={() => setRenaming(true)}
                        className="rounded-control px-3 py-1.5 text-[12px] text-paper/70 transition hover:bg-paper/5 hover:text-paper"
                      >
                        Renombrar
                      </button>
                    )}
                    {!preview && collections.length > 1 && !isPrimaryIn(collections, active.id) && (
                      <button
                        onClick={() => {
                          if (confirm(`Eliminar "${active.name}"?`)) onDelete(active.id);
                        }}
                        className="rounded-control px-3 py-1.5 text-[12px] text-paper/35 transition hover:bg-red-500/10 hover:text-red-400"
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

              {/* gap, not space-y: Tailwind's space-y is a three-selector rule
                  and it silently outranks any margin an item sets on itself —
                  which is how the divider ended up 4px from the row above and
                  12px from the one below. With gap, what a child asks for
                  composes instead of being overruled. */}
              <ul className="flex flex-col gap-1 px-3 py-3">
                {visibleCollections.map((c, i) => {
                  // the rule goes between the pair and the rest, and only when
                  // there is something on both sides of it
                  const startsCustom =
                    i === primary.length && primary.length > 0 && custom.length > 0;
                  const s = statsFor(c, allVinilos);
                  const isActive = c.id === activeId;
                  // one cover reads better than a mosaic at 36px
                  const cover = vinylsOf(c, allVinilos).filter((v) => v.cover).pop();
                  return (
                    <li
                      key={c.id}
                      // 4px of gap + 8px of margin above, 12px of padding
                      // below: the rule sits centred in its own space
                      className={`group relative ${startsCustom ? "mt-2 border-t border-paper/10 pt-3" : ""}`}
                    >
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
                          onDoubleClick={() => !isPrimaryIn(collections, c.id) && setRenameId(c.id)}
                          title={isPrimaryIn(collections, c.id) ? undefined : "Doble clic para renombrar"}
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
                              {isPrimaryIn(collections, c.id) && (
                                <span className="text-paper/25" title="Rack predefinido">
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
                        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 reveal-on-hover transition">
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
                          {!preview && !isPrimaryIn(collections, c.id) && (
                            <RowAction
                              label="Borrar el rack"
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
                  <ul className="flex flex-col gap-1 px-3 py-3">
                    {followed.map((l) => {
                      const covers = followedCovers[l.id] ?? [];
                      return (
                        <li key={l.id}>
                          {/* Exactly the row an owned list gets — same square,
                              same type, same weight — because in your
                              collection that is what it is: a shelf you can
                              open. What makes it not yours is one small face on
                              the corner of the cover, and everything else moves
                              into the card that appears when you dwell on it. */}
                          <button
                            onClick={() => {
                              onOpenFollowed(l);
                              onClose();
                            }}
                            onMouseEnter={(e) => arm(l, e.currentTarget)}
                            onMouseLeave={disarm}
                            className="flex w-full items-center gap-3 rounded-md bg-paper/[0.03] px-3 py-2.5 text-left transition hover:bg-paper/[0.07]"
                          >
                            <span className="relative shrink-0">
                              <span className="flex h-9 w-9 overflow-hidden rounded-sm bg-paper/[0.06]">
                                {covers[0] && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={covers[0]} alt="" className="h-full w-full object-cover" />
                                )}
                              </span>
                              {/* A shadow, not a ring.
                                  A ring has to match the surface behind it, and
                                  this one sits on a translucent row that
                                  changes tint on hover — so it never matched
                                  and read as a patch. A shadow needs to match
                                  nothing and separates the badge from the
                                  artwork under it on any background. */}
                              <span
                                title={`Rack de ${l.owner.displayName}`}
                                className="absolute -bottom-1 -right-1 rounded-full shadow-[0_0_0_2px_rgba(10,10,10,0.85)]"
                              >
                                <Avatar
                                  name={l.owner.displayName}
                                  handle={l.owner.username}
                                  src={l.owner.avatarUrl}
                                  size="xxs"
                                />
                              </span>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] text-paper">{l.title}</span>
                              <span className="mt-0.5 block truncate text-[11px] text-paper/40">
                                {l.itemCount} {l.itemCount === 1 ? "disco" : "discos"} · de{" "}
                                {l.owner.displayName}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
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
                    placeholder="Rack nuevo"
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

      {/* Everything a kept list is that yours is not: whose it is, whether you
          follow them, and how to stop keeping it. Out of the row, so the row
          can be a row. */}
      {/* Sharing lives in the same panel now, one press from the list it is
          about — not on a different screen behind a different button. */}
      <CollaboratorsSheet
        open={Boolean(sharingId)}
        onClose={() => setSharingId(null)}
        listId={sharingId ?? ""}
        listTitle={collections.find((c) => c.id === sharingId)?.name ?? ""}
        isOwner
        myId={myId}
      />

      {hovered && (
        <ListHoverCard
          list={hovered.list}
          anchor={hovered.el}
          count={hovered.list.itemCount}
          onUnfollow={() => onUnfollowList(hovered.list.id)}
          onEnter={keepOpen}
          onClose={closeNow}
        />
      )}
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
  onShare,
  sharedCount,
  onSetVisibility,
  onRename,
  onToggleVinyl,
  onDeleteVinyl,
  onSetSort,
  onReorder,
  preview = false,
}: {
  editing: Collection;
  allVinilos: Vinyl[];
  isPrimary: boolean;
  /** Mi Colección is the library itself: taking a record out means deleting it */
  isLibrary: boolean;
  visibility: ListVisibility;
  /** open the collaborators sheet for this list */
  onShare: () => void;
  /** how many people are already in it, pending included */
  sharedCount: number;
  onSetVisibility: (collectionId: string, visibility: ListVisibility) => void;
  onRename: (id: string, name: string) => void;
  onToggleVinyl: (collectionId: string, vinylId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  onSetSort: (collectionId: string, sortBy: SortMode) => void;
  onReorder: (collectionId: string, fromIdx: number, toIdx: number) => void;
  preview?: boolean;
}) {
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const sortBy = editing.sortBy ?? "custom";

  const [addQuery, setAddQuery] = useState("");
  const [addGenre, setAddGenre] = useState("");

  const orderedIds = sortedVinylIds(editing, allVinilos);
  const orderedVinilos = orderedIds
    .map((id) => allVinilos.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
  const outside = allVinilos.filter((v) => !editing.vinylIds.includes(v.id));

  /**
   * Finding a record among everything you own, from inside the list.
   *
   * "Añadir discos" listed the entire library — thirty-one rows here, and
   * three hundred for anybody with a real collection — so adding the record
   * you had in mind meant scrolling past everything you did not. A field and a
   * genre are the two cuts that work on a music library: you either know what
   * it is called, or you know what kind of night you are building.
   *
   * The genres are the ones actually present in what is left to add, with
   * their counts. A dropdown offering a genre that yields nothing is a menu
   * that lies.
   */
  const genres = useMemo(() => {
    const count = new Map<string, number>();
    for (const v of outside) if (v.genre) count.set(v.genre, (count.get(v.genre) ?? 0) + 1);
    return [...count.entries()].sort((a, b) => b[1] - a[1]);
  }, [outside]);

  const notInCol = useMemo(() => {
    const norm = (t: string) =>
      t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const q = norm(addQuery.trim());
    return outside.filter(
      (v) =>
        (!addGenre || v.genre === addGenre) &&
        (!q || norm(`${v.title} ${v.artist}`).includes(q)),
    );
  }, [outside, addQuery, addGenre]);

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
        <div className={`flex items-center justify-between gap-4 border-b border-paper/[0.07] py-3 ${preview ? "hidden" : ""}`}>
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

        {/* Sharing sits with sort and visibility because it is the same kind
            of fact: something true about the list rather than about a record
            in it. It was on a different screen behind a different button,
            which is why nobody found it. */}
        {!isPrimary && (
          <div className="flex items-center justify-between gap-4 border-b border-paper/[0.06] py-3">
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Compartida con
            </span>
            <button
              onClick={onShare}
              className="text-[13px] text-paper/70 transition hover:text-paper"
            >
              {sharedCount > 0 ? `${sharedCount} · Gestionar →` : "Invitar →"}
            </button>
          </div>
        )}

        <div className="flex items-center justify-between gap-4 py-3">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Orden</span>
          <Select
            label="Orden del rack"
            value={sortBy}
            onChange={(m) => onSetSort(editing.id, m)}
            options={(Object.keys(SORT_LABELS) as SortMode[]).map((m) => ({
              value: m,
              label: SORT_LABELS[m],
            }))}
          />
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
                className={`group flex items-center gap-2 px-3 py-2 rounded-control transition ${
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
                {/* A record is a picture with a name on it. Editing a list by
                    reading two columns of type is proofreading; with the
                    sleeve there you recognise what you are about to remove
                    before you have finished reading its title. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverFor(v)}
                  alt=""
                  loading="lazy"
                  className="h-8 w-8 shrink-0 rounded-[2px] object-cover"
                />
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  <span className="text-paper">{v.title}</span>
                  <span className="ml-2 text-paper/40">{v.artist}</span>
                  {v.year ? <span className="ml-2 text-paper/25">{v.year}</span> : null}
                </span>
                <button
                  hidden={preview && isLibrary}
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
                  className="reveal-on-hover text-[11px] uppercase tracking-[0.16em] text-paper/30 hover:text-red-400 transition px-2"
                  aria-label={isLibrary ? "Eliminar permanentemente" : "Quitar"}
                >
                  {isLibrary ? "Eliminar" : "Quitar"}
                </button>
              </li>
            );
          })}
          {orderedVinilos.length === 0 && (
            <li className="px-3 py-3 text-[12px] text-paper/35">Rack vacío</li>
          )}
        </ul>

        {/* add more */}
        {outside.length > 0 && !isLibrary && (
          <>
            {/* same rhythm as the section above: label left, count right */}
            <div className="mt-6 flex items-baseline justify-between border-t border-paper/[0.07] px-6 pb-2 pt-5">
              <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                Añadir discos
              </span>
              <span className="mono text-[10px] tracking-[0.16em] text-paper/30">
                {notInCol.length}
                {notInCol.length !== outside.length && (
                  <span className="text-paper/20"> / {outside.length}</span>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 px-6 pb-3">
              <input
                value={addQuery}
                onChange={(e) => setAddQuery(e.target.value)}
                placeholder="Buscar en tu colección"
                aria-label="Buscar un disco para añadir"
                className="h-8 min-w-0 flex-1 border-b border-paper/[0.12] bg-transparent text-[12px] text-paper outline-none transition-colors placeholder:text-paper/30 focus:border-paper/40"
              />
              <div className="shrink-0">
                <Select
                  label="Filtrar por género"
                  value={addGenre}
                  onChange={setAddGenre}
                  options={[
                    { value: "", label: "Todos los géneros" },
                    ...genres.map(([g, n]) => ({ value: g, label: g, hint: String(n) })),
                  ]}
                />
              </div>
            </div>
            {notInCol.length === 0 && (
              <p className="px-6 pb-2 text-[12px] text-paper/35">
                Nada que coincida. {addGenre && "Prueba con otro género."}
              </p>
            )}
            <ul className="px-3">
              {notInCol.map((v) => (
                <li key={v.id}>
                  <button
                    onClick={() => onToggleVinyl(editing.id, v.id)}
                    className="group/add flex w-full items-center gap-2 rounded-control px-3 py-2 text-left text-[12px] text-paper/55 transition hover:bg-paper/[0.04]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverFor(v)}
                      alt=""
                      loading="lazy"
                      className="h-8 w-8 shrink-0 rounded-[2px] object-cover opacity-60 transition group-hover/add:opacity-100"
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="text-paper">{v.title}</span>
                      <span className="ml-2 text-paper/40">{v.artist}</span>
                    </span>
                    <span
                      aria-hidden
                      className="shrink-0 text-[13px] text-paper/25 transition group-hover/add:text-paper"
                    >
                      +
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
