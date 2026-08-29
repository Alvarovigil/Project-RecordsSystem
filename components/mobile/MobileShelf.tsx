"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import MarqueeText from "@/components/MarqueeText";
import Button from "@/components/ui/Button";
import ListEditSheet from "./ListEditSheet";
import EmptyState from "@/components/ui/EmptyState";
import dynamic from "next/dynamic";

/**
 * The 3D engine, downloaded only when a phone actually opens the shelf.
 *
 * It used to be desktop-only on purpose — a phone never paid for three.js at
 * all. Now it does, and that is a real cost paid for a real reason: the shelf
 * IS the product, and a flat imitation of it in CSS was a different, worse
 * thing wearing its name.
 */
const VinylShelf3D = dynamic(() => import("@/components/VinylShelf3D"), { ssr: false });
import Avatar from "@/components/ui/Avatar";
import { coverFor } from "@/lib/cover";
import { useImagesReady } from "@/hooks/useImagesReady";
import { listTitleFor } from "@/lib/list-title";
import SharedMark from "@/components/ui/SharedMark";
import LightLab, { DEFAULT_RIG, useLightLab } from "./LightLab";
import { useRepository } from "@/hooks/useRepository";
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
  allVinilos,
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
  onUnsaveList,
  onOpenSaved,
  onRemoveRecordFromList,
  readOnly = false,
}: {
  vinilos: Vinyl[];
  /** every record you own, so a list can show what is in it */
  allVinilos: Vinyl[];
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
  /** stop keeping somebody else's list */
  onUnsaveList: (listId: string) => void;
  /** open a kept list on this shelf, the way one of yours opens */
  onOpenSaved: (list: SavedList) => void;
  /** take a record out of a list from the list's own editor */
  onRemoveRecordFromList: (listId: string, vinylId: string) => void;
  /** the shelf is showing somebody else's list, so it cannot be edited */
  readOnly?: boolean;
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
  /**
   * The kept list whose ⋯ is open.
   *
   * On the desktop these three actions live in a card that appears when the
   * pointer rests on the row. A finger cannot rest on anything, so the same
   * three get a button of their own — the alternative is a set of actions that
   * exist on one device and simply do not on the other.
   */
  const [listMenu, setListMenu] = useState<SavedList | null>(null);

  // the lighting bench, and only when it has been asked for by hand
  const lab = useLightLab();
  const [rig, setRig] = useState(DEFAULT_RIG);

  // the covers down the list sheet: one fade for the menu, not one per row
  const listCovers = ordered.map(
    (c) =>
      c.vinylIds
        .map((id) => allVinilos.find((v) => v.id === id))
        .filter((v): v is Vinyl => Boolean(v?.cover))
        .pop()?.cover ?? null,
  );
  const listsReady = useImagesReady(listCovers);

  /**
   * A cover for each kept list.
   *
   * Your own lists can pull one out of the library in memory; somebody else's
   * records were never downloaded, so the crate would be an empty square. One
   * request for all of them, and only when there are any.
   */
  const [savedCovers, setSavedCovers] = useState<Record<string, string[]>>({});
  const repo = useRepository();
  useEffect(() => {
    if (savedLists.length === 0) return;
    let alive = true;
    repo
      .coversOfLists(savedLists.map((l) => l.id))
      .then((c) => alive && setSavedCovers(c))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repo, savedLists]);
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
          {/* The two views of the same records. Only the one you are in is
              drawn: a two-segment pill spends a whole slot showing you the
              thing you already chose, and up here every pixel is cover art
              you are covering up. Tap and it flips. */}
          <RoundButton
            label={view === "shelf" ? "Ver en cuadrícula" : "Ver el estante"}
            onClick={() => setView(view === "shelf" ? "grid" : "shelf")}
          >
            {view === "shelf" ? <ShelfIcon /> : <GridIcon />}
          </RoundButton>

          {/* Which list you are in — the centre of the header, because it is
              the one thing up here that changes and the one you tap most. The
              chevron is what says the name is a door and not a label. */}
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              onClick={() => setSwitching(true)}
              aria-label={`Lista actual: ${activeName}. Cambiar de lista`}
              className="pressable flex h-11 max-w-full items-center gap-1.5 rounded-full bg-ink/55 px-4 text-paper/85 backdrop-blur-md"
            >
              <MarqueeText className="min-w-0 text-sub font-medium">
                {activeName}
              </MarqueeText>
              <span className="shrink-0 text-sub text-paper/40">{vinilos.length}</span>
              <svg
                width="11"
                height="11"
                viewBox="0 0 12 12"
                fill="none"
                aria-hidden
                className="shrink-0 text-paper/50"
              >
                <path d="M2.5 4.5 L6 8 L9.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <RoundButton label="Buscar" onClick={onSearch}>
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.6 10.6 L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </RoundButton>
        </div>
      </header>

      {view === "shelf" ? (
        <div className="fixed inset-0">
          <VinylShelf3D vertical rig={lab ? rig : undefined} vinilos={vinilos} onOpen={onOpen} />
          {/* The records go into the dark rather than off an edge. It also
              gives the controls up there something to sit on: white type over
              a bright sleeve is unreadable exactly when a bright sleeve
              happens to pass behind it. */}
          <div
            aria-hidden
            className="scrim-top pointer-events-none absolute inset-x-0 top-0 h-[36dvh]"
          />
        </div>
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
        {/* The same row as the desktop panel, and deliberately so: a cover, the
            name, a lock on the two you cannot delete, and what is in it. A
            phone is a single column, which is the shape that panel already
            had — so there is nothing to redesign, only a hover to remove.
            Where the desktop reveals the row's actions when the pointer
            arrives, here the ⋯ is simply always there. A finger has no hover,
            and hiding a control behind a long press is hiding it. */}
        <ul
          className={`flex flex-col gap-1 px-3 py-3 transition-opacity duration-base ease-out ${
            listsReady ? "opacity-100" : "opacity-0"
          }`}
        >
          {ordered.map((c, i) => {
            const startsCustom =
              i === primary.length && primary.length > 0 && custom.length > 0;
            const isActive = c.id === activeListId;
            const isPrimary = (c.kind ?? "custom") !== "custom";
            // one cover reads better than a mosaic at this size; the last one
            // in is the one you are most likely to recognise
            const cover = c.vinylIds
              .map((id) => allVinilos.find((v) => v.id === id))
              .filter((v): v is Vinyl => Boolean(v?.cover))
              .pop();
            return (
              <li
                key={c.id}
                className={`relative ${startsCustom ? "mt-2 border-t border-line pt-3" : ""}`}
              >
                <button
                  onClick={() => {
                    onActivate(c.id);
                    setSwitching(false);
                  }}
                  className={`pressable flex w-full items-center gap-3 rounded-md py-2.5 pl-3 pr-12 text-left transition ${
                    isActive ? "bg-fill-strong" : "bg-fill-subtle"
                  }`}
                >
                  <span className="flex h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-fill">
                    {cover?.cover && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover.cover} alt="" className="h-full w-full object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-body text-paper">{c.name}</span>
                      {c.sharedBy && (
                        <span className="text-content-faint">
                          <SharedMark title={`Compartida por ${c.sharedBy.displayName}`} />
                        </span>
                      )}
                      {isPrimary && (
                        <span aria-label="Lista predefinida" className="shrink-0 text-content-faint">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" stroke="currentColor" />
                            <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
                          </svg>
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-content-muted">
                      {/* whose it is before how many: the number is
                          bookkeeping, the name is why this list is here */}
                      {c.sharedBy ? `de ${c.sharedBy.displayName} y tú · ` : ""}
                      {c.vinylIds.length} {c.vinylIds.length === 1 ? "disco" : "discos"}
                      {isActive ? " · viendo ahora" : ""}
                    </span>
                  </span>
                </button>

                <button
                  onClick={() => setEditing(c)}
                  aria-label={`Opciones de ${c.name}`}
                  className="pressable absolute right-0 top-1/2 flex h-tap w-tap -translate-y-1/2 items-center justify-center text-content-muted"
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                    <circle cx="8" cy="3.2" r="1.35" fill="currentColor" />
                    <circle cx="8" cy="8" r="1.35" fill="currentColor" />
                    <circle cx="8" cy="12.8" r="1.35" fill="currentColor" />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="pb-1">

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
            {/* The same card as your own lists, and it opens the same way:
                onto this shelf, not out to a web page. A kept list IS a shelf
                you can browse — sending someone to a profile instead is the
                moment they stop feeling like it is theirs to look at. Whose it
                is stays said, in the line under the name, where it belongs. */}
            <ul className="flex flex-col gap-1 px-3 pb-2 pt-3">
              {savedLists.map((l) => (
                <li key={l.id} className="relative">
                  <button
                    onClick={() => {
                      onOpenSaved(l);
                      setSwitching(false);
                    }}
                    className="pressable flex w-full items-center gap-3 rounded-md bg-fill-subtle py-2.5 pl-3 pr-12 text-left"
                  >
                    <span className="flex h-11 w-11 shrink-0 overflow-hidden rounded-sm bg-fill">
                      {(savedCovers[l.id] ?? [])[0] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(savedCovers[l.id] ?? [])[0]}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Avatar
                          name={l.owner.displayName}
                          handle={l.owner.username}
                          src={l.owner.avatarUrl}
                          size="md"
                        />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body text-paper">
                        {listTitleFor(l, false)}
                      </span>
                      <span className="mt-0.5 block truncate text-caption text-content-muted">
                        de {l.owner.displayName} · {l.itemCount}{" "}
                        {l.itemCount === 1 ? "disco" : "discos"}
                      </span>
                    </span>
                  </button>
                  <button
                    onClick={() => setListMenu(l)}
                    aria-label={`Opciones de ${listTitleFor(l, false)}`}
                    className="pressable absolute right-0 top-1/2 flex h-tap w-tap -translate-y-1/2 items-center justify-center text-content-muted"
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                      <circle cx="8" cy="3.2" r="1.35" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.35" fill="currentColor" />
                      <circle cx="8" cy="12.8" r="1.35" fill="currentColor" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </Sheet>

      {/* the same three doors as the desktop hover card, in the same order and
          with the same words: a menu that disagrees with itself across devices
          teaches people not to trust either copy */}
      <Sheet
        open={Boolean(listMenu)}
        onClose={() => setListMenu(null)}
        title={listMenu ? listTitleFor(listMenu, false) : undefined}
        subtitle={listMenu ? `Lista de ${listMenu.owner.displayName}` : undefined}
        size="auto"
        width={380}
      >
        {listMenu && (
          <div className="py-1">
            <SheetRow
              label="Quitar de mi colección"
              onClick={() => {
                onUnsaveList(listMenu.id);
                setListMenu(null);
              }}
            />
            <SheetRow
              label="Compartir enlace"
              onClick={() => {
                void shareList(listMenu);
                setListMenu(null);
              }}
            />
            <SheetRow
              label={`Ver el perfil de ${listMenu.owner.displayName}`}
              href={`/u/${listMenu.owner.username}`}
            />
          </div>
        )}
      </Sheet>

      {lab && <LightLab rig={rig} onChange={setRig} />}

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
        // resolved here rather than in the sheet: this screen already holds the
        // library, and the sheet should not have to know where records live
        records={
          editing
            ? editing.vinylIds
                .map((id) => allVinilos.find((v) => v.id === id))
                .filter((v): v is Vinyl => Boolean(v))
            : []
        }
        onRemoveRecord={onRemoveRecordFromList}
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
  // Only the first screenful is waited for. Gating four hundred covers on each
  // other would mean waiting for the ones nobody has scrolled to yet; the rest
  // arrive as you reach them, each into a square that is already the right
  // shape and colour.
  const ready = useImagesReady(vinilos.slice(0, 8).map(coverFor));

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
      <ul
        className={`grid grid-cols-2 gap-x-4 gap-y-7 transition-opacity duration-base ease-out ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
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

/**
 * Share a list: the platform sheet where there is one, the clipboard where
 * there is not — and it says which, because a button that silently did
 * nothing is indistinguishable from a broken one.
 */
async function shareList(l: SavedList) {
  const url = `${window.location.origin}/u/${l.owner.username}/${l.slug}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: l.title, url });
    } catch {
      // cancelled: not an error, and not something to report
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
  } catch {
    // nothing sensible to do; the link is still one tap away in the address bar
  }
}

/**
 * The two views, as the two shapes.
 *
 * The same pair the desktop bar uses, deliberately: a record for the shelf and
 * a block of four for the grid. Two words in a pill are two things to read
 * every time you look at the screen, and these two are the rare case where the
 * picture is not a decoration of the idea — it IS the idea. The words are
 * still there for anyone listening to the page.
 */
function ShelfIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="7" cy="7" r="1.5" fill="currentColor" />
    </svg>
  );
}

function GridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M1.6 1.6h4.2v4.2H1.6zM8.2 1.6h4.2v4.2H8.2zM1.6 8.2h4.2v4.2H1.6zM8.2 8.2h4.2v4.2H8.2z"
        fill="currentColor"
      />
    </svg>
  );
}
