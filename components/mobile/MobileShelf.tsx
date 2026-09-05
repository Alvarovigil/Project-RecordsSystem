"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ShareSheet from "@/components/ShareSheet";
import { SITE_URL } from "@/lib/site";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import MarqueeText from "@/components/MarqueeText";
import Button from "@/components/ui/Button";
import ListEditSheet from "./ListEditSheet";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Cover } from "@/components/ui/Avatar";
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
import { findWishlist } from "@/lib/collections";
import SharedMark from "@/components/ui/SharedMark";
import LightLab, { DEFAULT_RIG, useLightLab } from "./LightLab";
import { useRepository } from "@/hooks/useRepository";
import type { Collection } from "@/lib/collections";
import type { ListVisibility, SavedList } from "@/lib/data/types";
import type { SortMode } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";
import type { VinylShelfHandle } from "@/components/VinylShelf3D";

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
  onAcquire,
  loading = false,
  shelfHandle,
  openIndex = null,
  onViewChange,
  recordOpen = false,
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
  /** "ya lo tengo", from the wishlist grid — absent means don't offer it */
  onAcquire?: (v: Vinyl) => void;
  /** the library has not answered yet: draw the shape of it, not a void */
  loading?: boolean;
  /**
   * The 3D shelf's own controls, handed up so the record screen can be a
   * continuation of this one rather than a picture laid over it.
   */
  shelfHandle?: { current: VinylShelfHandle | null };
  /** which record is open on the shelf, or null — see VinylShelf3D */
  openIndex?: number | null;
  /** the shelf owns which of its two views is showing; the app needs to know
   *  because it decides whether an opened record has the 3D behind it */
  onViewChange?: (v: "shelf" | "grid") => void;
  /** a record is open: the shelf is the subject, so its chrome gets out */
  recordOpen?: boolean;
  /** the shelf is showing somebody else's list, so it cannot be edited */
  readOnly?: boolean;
}) {
  /** the wishlist is the only list where "ya lo tengo" means anything */
  const isWishlist = findWishlist(collections)?.id === activeListId;

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
  // the app above needs this to know what is behind an opened record
  useEffect(() => {
    onViewChange?.(view);
  }, [view, onViewChange]);
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
  /** the rack whose 9:16 card is open */
  const [sharingList, setSharingList] = useState<SavedList | null>(null);
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
      {/* The chrome steps aside while a record is open: from that moment the
          shelf is not a place you are browsing, it is the object you are
          looking at, and the rack switcher and the search button belong to
          the browsing. */}
      <header
        className={`fixed inset-x-0 top-0 z-40 px-3 transition-opacity duration-300 ${
          recordOpen ? "pointer-events-none opacity-0" : "opacity-100"
        }`}
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
              aria-label={`Rack actual: ${activeName}. Cambiar de rack`}
              /**
               * A ceiling, or the marquee never runs.
               *
               * The pill grew to fit whatever it held, so a long name simply
               * made a wider button and the text never overflowed its own box
               * — which is the only condition MarqueeText scrolls on. Capped
               * at 62% of the screen it has to give, and a name too long to
               * read at a glance starts moving instead of being cut.
               */
              className="pressable flex h-12 max-w-[62vw] items-center gap-1.5 rounded-full bg-ink/72 px-4 text-paper/90 backdrop-blur-xl"
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
          <VinylShelf3D
            vertical
            handleRef={shelfHandle}
            openIndex={openIndex}
            rig={lab ? rig : undefined}
            vinilos={vinilos}
            onOpen={onOpen}
          />
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
        <CoverGrid
          vinilos={vinilos}
          onOpen={onOpen}
          nowPlayingId={nowPlayingId}
          onAcquire={!readOnly && isWishlist ? onAcquire : undefined}
          loading={loading}
        />
      )}

      {/* ---------------------------------------------------- list switcher */}
      <Sheet
        open={switching}
        onClose={() => setSwitching(false)}
        title="Tus racks"
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
                        <span aria-label="Rack predefinido" className="shrink-0 text-content-faint">
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
            <SheetRow label="Rack nuevo" onClick={() => setCreating(true)} />
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
        subtitle={listMenu ? `Rack de ${listMenu.owner.displayName}` : undefined}
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
              label="Compartir"
              detail="Imagen para historias"
              onClick={() => {
                setSharingList(listMenu);
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

      {sharingList && (
        <ShareSheet
          open
          onClose={() => setSharingList(null)}
          image={`/api/share/list?user=${encodeURIComponent(sharingList.owner.username)}&list=${encodeURIComponent(sharingList.slug)}`}
          link={`${SITE_URL}/u/${sharingList.owner.username}/${sharingList.slug}`}
          title={`${sharingList.title} · un rack de ${sharingList.owner.displayName}`}
          filename={`${sharingList.slug}.png`}
        />
      )}

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
  onAcquire,
  loading = false,
}: {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  nowPlayingId?: string;
  /** only ever passed for the wishlist: a tick that means "compré este" */
  onAcquire?: (v: Vinyl) => void;
  /** the library has not answered yet — draw the shape of it, not a void */
  loading?: boolean;
}) {
  const pad = {
    paddingTop: "calc(var(--safe-top) + 118px)",
    paddingBottom: "calc(var(--tabbar-h) + var(--player-h) + 24px)",
  };

  /**
   * A skeleton, not an empty state.
   *
   * "Este rack está vacío" was shown for every millisecond before the first
   * answer arrived, which meant a cold start told you your collection was
   * empty and then filled with it. Saying something false quickly is worse
   * than saying nothing slowly.
   */
  if (loading && vinilos.length === 0) {
    return (
      <div data-scrollable className="scroll-y h-screen-d px-4" style={pad}>
        <SkeletonGrid n={8} />
      </div>
    );
  }

  if (vinilos.length === 0) {
    return (
      <div className="px-5 pb-chrome" style={{ paddingTop: "calc(var(--safe-top) + 130px)" }}>
        <EmptyState
          title="Este rack está vacío"
          body="Busca un disco por título, artista o código de barras y aparecerá aquí."
          action={{ label: "Buscar discos", href: "/explorar?buscar=1" }}
        />
      </div>
    );
  }

  return (
    <div data-scrollable className="scroll-y h-screen-d px-4" style={pad}>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-7">
        {vinilos.map((v, i) => (
          <li key={v.id}>
            <button onClick={() => onOpen(v)} className="pressable block w-full text-left">
              <span className="relative block">
                <Cover
                  src={coverFor(v)}
                  eager={i < 6}
                  className="aspect-square w-full rounded-[3px]"
                />
                {/**
                 * Going down the wishlist is the one pass where the same
                 * decision repeats — you got these three, you did not get
                 * those. Opening each record to say so is four taps for a
                 * one-bit answer, so the answer lives on the cover.
                 */}
                {onAcquire && (
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Ya tengo ${v.title}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onAcquire(v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.stopPropagation();
                      e.preventDefault();
                      onAcquire(v);
                    }}
                    className="pressable absolute bottom-1.5 right-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl"
                  >
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                )}
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
      /**
       * Darker glass, and taller.
       *
       * At 55% over a bright sleeve these read as light grey pucks: the tint
       * was doing the blurring's job and neither was doing enough. 72% with a
       * heavier blur puts the icon on something solid enough to be read
       * against any cover that passes behind it — and 48px is the size a
       * thumb aims at without looking, where 44 is the floor you are allowed
       * to hit.
       */
      className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-ink/72 text-paper/90 backdrop-blur-xl"
    >
      {children}
    </button>
  );
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
    /**
     * Three slabs in perspective: the shelf seen from the front, with the
     * records behind receding. The old one was a record — a circle with a hole
     * — which named the contents rather than the view, and sat next to a grid
     * of squares that named a layout. Both marks describe an arrangement now,
     * which is what the switch is choosing between.
     */
    <svg width="15" height="15" viewBox="0 0 83 83" fill="none" aria-hidden>
      <rect x="10" width="63" height="10" fill="currentColor" />
      <rect x="5" y="18" width="73" height="10" fill="currentColor" />
      <rect y="36" width="83" height="47" fill="currentColor" />
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
