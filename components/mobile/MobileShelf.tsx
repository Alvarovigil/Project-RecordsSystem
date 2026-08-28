"use client";

import { useState } from "react";
import Link from "next/link";
import Segmented from "@/components/ui/Segmented";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import ListEditSheet from "./ListEditSheet";
import EmptyState from "@/components/ui/EmptyState";
import AccordionShelf from "./AccordionShelf";
import Avatar from "@/components/ui/Avatar";
import { coverFor } from "@/lib/cover";
import type { Collection } from "@/lib/collections";
import type { ListVisibility, SavedList } from "@/lib/data/types";
import type { SortMode } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";

/**
 * The crate, on a phone.
 *
 * The 3D shelf is this product's signature and it is also a WebGL canvas that
 * a mid-range phone renders at a cost you can feel in the battery. So the phone
 * does not get a smaller version of it — it gets the same *idea* built out of
 * things a phone is good at: sleeves stacked front-to-back, tilted in
 * perspective, that you flick through with a thumb. CSS transforms and scroll
 * snapping, no canvas, no frame budget.
 *
 * The reference this is drawn from (MD Vinyl) gets two things right that are
 * worth stealing outright:
 *
 * - **The chrome floats over the artwork instead of framing it.** A phone
 *   screen is mostly cover art; a header bar with a background steals a fifth
 *   of it to say something you already know.
 * - **Álbumes / Listas is a segmented control, not navigation.** Both are your
 *   collection seen two ways. A tab bar would say "somewhere else", which is
 *   wrong, and it would compete with the real tab bar at the bottom.
 *
 * What we do differently: the title of the current list is a button, because
 * on a phone there is no room for a lists panel *and* a shelf, and the thing
 * you switch most often should be the thing you tap most easily.
 */
export default function MobileShelf({
  vinilos,
  collections,
  activeListId,
  activeName,
  savedLists,
  nowPlayingId,
  isPlaying,
  onOpen,
  onActivate,
  onSearch,
  onPlay,
  onCreateList,
  onRenameList,
  onDeleteList,
  onSetSort,
  onSetVisibility,
  visibilityOf,
  myId,
  onRemoveFromList,
}: {
  vinilos: Vinyl[];
  collections: Collection[];
  activeListId: string;
  activeName: string;
  savedLists: SavedList[];
  nowPlayingId?: string;
  isPlaying: boolean;
  onOpen: (v: Vinyl) => void;
  onActivate: (listId: string) => void;
  onSearch: () => void;
  onPlay: (v: Vinyl) => void;
  onCreateList: (name: string) => Promise<string>;
  onRenameList: (id: string, name: string) => void;
  onDeleteList: (id: string) => void;
  onSetSort: (id: string, sortBy: SortMode) => void;
  onSetVisibility: (id: string, v: ListVisibility) => void;
  visibilityOf: (id: string) => ListVisibility;
  myId: string;
  onRemoveFromList: (v: Vinyl) => void;
}) {
  /**
   * The two ways of looking at the same records — the phone's version of the
   * desktop switch, and the same pair: the shelf, or all of it at once.
   *
   * It used to switch between albums and lists, which put a navigation control
   * where a view control belongs: your lists are a place you go, and they are
   * already one tap away under the button that names the list you are in.
   * Two different jobs wearing the same clothes is how people end up pressing
   * the wrong one.
   */
  const [view, setView] = useState<"shelf" | "grid">("shelf");
  const [switching, setSwitching] = useState(false);
  /**
   * Same order as the desktop panel: the two you always have, a rule, then the
   * ones you made. Furniture first, so it is found without reading.
   */
  const primary = collections.filter((c) => (c.kind ?? "custom") !== "custom");
  const custom = collections.filter((c) => (c.kind ?? "custom") === "custom");
  const ordered = [
    ...primary.sort((a) => (a.kind === "collection" ? -1 : 1)),
    ...custom,
  ];

  const [editing, setEditing] = useState<Collection | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="relative min-h-screen-d bg-surface">
      {/* ------------------------------------------------------- the chrome */}
      <header
        className="fixed inset-x-0 top-0 z-40 px-3"
        style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
      >
        <div className="flex items-center gap-2">
          <RoundButton label="Cambiar de lista" onClick={() => setSwitching(true)}>
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M2 3.5 H12 M2 7 H12 M2 10.5 H8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </RoundButton>

          <div className="flex flex-1 justify-center">
            <Segmented
              size="sm"
              value={view}
              onChange={setView}
              segments={[
                { value: "shelf", label: "Estante" },
                { value: "grid", label: "Cuadrícula" },
              ]}
              className="shadow-[0_8px_30px_rgba(0,0,0,0.45)]"
            />
          </div>

          <RoundButton label="Buscar" onClick={onSearch}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </RoundButton>
        </div>

        {/* which list you are in — under the controls, quiet, always there */}
        <button
          onClick={() => setSwitching(true)}
          className="pressable mx-auto mt-2.5 flex max-w-full items-center gap-1.5 rounded-full bg-ink/55 px-3 py-1 backdrop-blur-md"
        >
          <span className="truncate text-caption font-medium text-paper/85">{activeName}</span>
          <span className="shrink-0 text-caption text-paper/40">{vinilos.length}</span>
        </button>
      </header>

      {view === "shelf" ? (
        <AccordionShelf
          vinilos={vinilos}
          onOpen={onOpen}
          onPlay={onPlay}
          onRemove={onRemoveFromList}
          listName={activeName}
          nowPlayingId={nowPlayingId}
          isPlaying={isPlaying}
        />
      ) : (
        <CoverGrid vinilos={vinilos} onOpen={onOpen} nowPlayingId={nowPlayingId} />
      )}

      {/* ---------------------------------------------------- list switcher */}
      <Sheet
        open={switching}
        onClose={() => setSwitching(false)}
        title="Tus listas"
        size="tall"
        width={400}
      >
        <div className="py-1">
          {ordered.map((c, i) => (
            // The row is two targets, not one: the name switches to the list,
            // the ⋯ edits it. Long-press would hide the second one behind a
            // gesture nobody discovers.
            <div
              key={c.id}
              className={`flex items-center ${
                i === primary.length && primary.length > 0 && custom.length > 0
                  ? "mt-2 border-t border-line pt-3"
                  : ""
              }`}
            >
              <button
                onClick={() => {
                  onActivate(c.id);
                  setSwitching(false);
                }}
                className="pressable flex min-w-0 flex-1 items-center gap-3 py-3.5 pl-5 pr-2 text-left"
              >
                <span className="min-w-0 flex-1 truncate text-body text-paper">{c.name}</span>
                <span className="shrink-0 text-sub text-content-muted">
                  {c.id === activeListId ? "Viendo" : c.vinylIds.length}
                </span>
              </button>
              <button
                onClick={() => setEditing(c)}
                aria-label={`Opciones de ${c.name}`}
                className="pressable flex h-tap w-tap shrink-0 items-center justify-center text-content-muted"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                  <circle cx="8" cy="3.2" r="1.35" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.35" fill="currentColor" />
                  <circle cx="8" cy="12.8" r="1.35" fill="currentColor" />
                </svg>
              </button>
            </div>
          ))}

          {creating ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const clean = newName.trim();
                if (!clean) return;
                const id = await onCreateList(clean);
                setNewName("");
                setCreating(false);
                onActivate(id);
                setSwitching(false);
              }}
              className="flex gap-2 px-5 py-3"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="El turno de noche"
                enterKeyHint="done"
                className="h-11 flex-1 rounded-control border border-line-strong bg-transparent px-3 text-body text-paper outline-none placeholder:text-content-faint focus:border-line-focus"
              />
              <Button type="submit" variant="primary" disabled={!newName.trim()}>
                Crear
              </Button>
            </form>
          ) : (
            <SheetRow label="Nueva lista" onClick={() => setCreating(true)} />
          )}
        </div>
        {savedLists.length > 0 && (
          <>
            {/* Other people's lists sit apart and keep their author's name.
                Mixed into your own with a badge, you lose track of which
                shelves you actually built. */}
            <p className="border-t border-line px-5 pb-2 pt-4 text-caption uppercase tracking-label text-content-muted">
              Guardadas de otra gente
            </p>
            <div className="pb-1">
              {savedLists.map((l) => (
                <Link
                  key={l.id}
                  href={`/u/${l.owner.username}/${l.slug}`}
                  className="pressable flex items-center gap-3 px-5 py-3"
                >
                  <Avatar
                    name={l.owner.displayName}
                    handle={l.owner.username}
                    src={l.owner.avatarUrl}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-body text-paper">{l.title}</span>
                    <span className="block truncate text-caption text-content-muted">
                      de {l.owner.displayName}
                    </span>
                  </span>
                  <span aria-hidden className="text-content-faint">
                    →
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}
      </Sheet>

      <ListEditSheet
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        list={editing}
        visibility={editing ? visibilityOf(editing.id) : "public"}
        isPrimary={(editing?.kind ?? "custom") !== "custom"}
        myId={myId}
        onRename={onRenameList}
        onDelete={onDeleteList}
        onSetSort={onSetSort}
        onSetVisibility={onSetVisibility}
      />
    </div>
  );
}

/**
 * Everything at once, two across.
 *
 * The shelf is for browsing — you go through it record by record and the
 * pleasure is in the going. This is for finding: you already know what you are
 * looking for and you want your eye to land on it. Two columns rather than
 * three because a cover is a picture with words printed on it, and at a third
 * of a phone's width nobody can read them.
 */
function CoverGrid({
  vinilos,
  onOpen,
  nowPlayingId,
}: {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  nowPlayingId?: string;
}) {
  if (vinilos.length === 0) {
    return (
      <div className="px-5 pb-chrome" style={{ paddingTop: "calc(var(--safe-top) + 130px)" }}>
        <EmptyState
          title="Esta lista está vacía"
          body="Busca un disco por título, artista o código de barras y aparecerá aquí."
          action={{ label: "Buscar discos", href: "/explorar?buscar=1" }}
        />
      </div>
    );
  }

  return (
    <div
      data-scrollable
      className="scroll-y h-screen-d px-4"
      style={{
        paddingTop: "calc(var(--safe-top) + 118px)",
        paddingBottom: "calc(var(--tabbar-h) + var(--player-h) + 24px)",
      }}
    >
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7">
        {vinilos.map((v, i) => (
          <li key={v.id}>
            <button onClick={() => onOpen(v)} className="pressable block w-full text-left">
              <span className="relative block">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={coverFor(v)}
                  alt=""
                  loading={i < 8 ? "eager" : "lazy"}
                  className="aspect-square w-full rounded-[3px] object-cover"
                />
                {v.id === nowPlayingId && (
                  <span
                    aria-label="Sonando"
                    className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-accent"
                  />
                )}
              </span>
              <span className="mt-2 block truncate text-sub font-medium text-paper">{v.title}</span>
              <span className="block truncate text-caption text-content-muted">{v.artist}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ink/55 text-paper/85 backdrop-blur-md"
    >
      {children}
    </button>
  );
}
