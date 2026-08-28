"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import Segmented from "@/components/ui/Segmented";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import ListEditSheet from "./ListEditSheet";
import ListCard from "@/components/community/ListCard";
import Crate from "@/components/ui/Crate";
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
  const [view, setView] = useState<"albums" | "lists">("albums");
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
                { value: "albums", label: "Álbumes" },
                { value: "lists", label: "Listas" },
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

      {view === "albums" ? (
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
        <ListsView
          collections={collections}
          savedLists={savedLists}
          vinilos={vinilos}
          onActivate={(id) => {
            onActivate(id);
            setView("albums");
          }}
        />
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

/** Your lists and the ones you kept, in one grid but never confusable. */
function ListsView({
  collections,
  savedLists,
  vinilos,
  onActivate,
}: {
  collections: Collection[];
  savedLists: SavedList[];
  vinilos: Vinyl[];
  onActivate: (id: string) => void;
}) {
  // newest first: vinylIds is insertion order, so the tail is what went in last
  const coversOf = useCallback(
    (ids: string[]) =>
      [...ids]
        .reverse()
        .map((id) => vinilos.find((v) => v.id === id))
        .filter((v): v is Vinyl => Boolean(v))
        .slice(0, 3)
        .map(coverFor),
    [vinilos],
  );

  const mine = useMemo(() => collections.filter((c) => c.vinylIds.length > 0), [collections]);

  return (
    <div
      className="scroll-y h-screen-d px-5"
      style={{
        paddingTop: "calc(var(--safe-top) + 118px)",
        paddingBottom: "calc(var(--tabbar-h) + var(--player-h) + 24px)",
      }}
    >
      <ul className="grid grid-cols-2 gap-x-6 gap-y-11">
        {mine.map((c) => (
          <li key={c.id}>
            <button onClick={() => onActivate(c.id)} className="pressable block w-full text-left">
              <Crate covers={coversOf(c.vinylIds)} />
              <span className="mt-2.5 block truncate text-body font-medium text-paper">{c.name}</span>
              <span className="mt-0.5 block text-sub text-content-muted">
                {c.vinylIds.length} discos
              </span>
            </button>
          </li>
        ))}
      </ul>

      {savedLists.length > 0 && (
        <section className="mt-9">
          <h2 className="border-b border-line pb-2 text-caption uppercase tracking-label text-content-muted">
            Guardadas de otra gente
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-11">
            {savedLists.map((l) => (
              <li key={l.id}>
                <ListCard list={l} covers={[]} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * One sleeve, and the gesture that pulls it out of the crate.
 *
 * Dragging the centred sleeve sideways takes it out of the list you are
 * looking at — the physical gesture the metaphor has been promising since the
 * first screen. It is the one iOS convention this app was missing, and here it
 * is not decoration: pulling a record out of a crate is literally the action.
 *
 * Three things keep it from firing by accident, which is the usual failure of
 * swipe-to-delete:
 *
 *  - **Only the active sleeve drags.** The others are edge-on and 55% opaque;
 *    a gesture on something you can barely see is a gesture you did not mean.
 *  - **`dragDirectionLock`**, so a diagonal thumb travelling down the stack
 *    scrolls instead of deleting.
 *  - **Distance AND intent.** 45% of the width, or a genuine flick. Below that
 *    it springs back, and the label fading in on the way tells you what is
 *    about to happen while there is still time to stop.
 *
 * Nothing is lost either way: removal goes through the same undo as every
 * other removal in the app.
 */

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
