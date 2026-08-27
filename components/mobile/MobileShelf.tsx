"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import Link from "next/link";
import Segmented from "@/components/ui/Segmented";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Button from "@/components/ui/Button";
import ListEditSheet from "./ListEditSheet";
import EmptyState from "@/components/ui/EmptyState";
import ListCard from "@/components/community/ListCard";
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
        <CrateStack
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
          {collections.map((c) => (
            // The row is two targets, not one: the name switches to the list,
            // the ⋯ edits it. Long-press would hide the second one behind a
            // gesture nobody discovers.
            <div key={c.id} className="flex items-center">
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
                className="h-11 flex-1 rounded-sm border border-line-strong bg-transparent px-3 text-body text-paper outline-none placeholder:text-content-faint focus:border-line-focus"
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
 * Sleeves front-to-back, the way they sit in a crate.
 *
 * Scroll-snapping so a flick always lands on a record rather than between two,
 * and the snapped one lifts and straightens — the feedback that tells you which
 * one you have got hold of. Everything is a CSS transform, so the whole thing
 * runs on the compositor and survives a cheap phone.
 */
function CrateStack({
  vinilos,
  onOpen,
  onPlay,
  onRemove,
  listName,
  nowPlayingId,
  isPlaying,
}: {
  vinilos: Vinyl[];
  onOpen: (v: Vinyl) => void;
  onPlay: (v: Vinyl) => void;
  onRemove: (v: Vinyl) => void;
  listName: string;
  nowPlayingId?: string;
  isPlaying: boolean;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  // Which sleeve is centred, read from an observer rather than from scroll
  // maths: it stays correct through momentum, snapping and orientation change.
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root, rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    Array.from(root.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [vinilos.length]);

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
    <ul
      ref={ref}
      data-scrollable
      className="scroll-y h-screen-d snap-y snap-mandatory"
      style={{
        perspective: "1100px",
        paddingTop: "calc(var(--safe-top) + 118px)",
        paddingBottom: "calc(var(--tabbar-h) + var(--player-h) + 90px)",
      }}
    >
      {vinilos.map((v, i) => {
        const isActive = i === active;
        const sounding = v.id === nowPlayingId;
        return (
          <li
            key={v.id}
            data-i={i}
            className="snap-center px-5"
            style={{ marginBottom: isActive ? 22 : -14, transformStyle: "preserve-3d" }}
          >
            <Sleeve
              vinyl={v}
              eager={i < 4}
              isActive={isActive}
              tilt={i < active ? 34 : -34}
              listName={listName}
              onOpen={() => onOpen(v)}
              onRemove={() => onRemove(v)}
            />

            {/* the transport belongs to the centred record only: a play button
                on every sleeve is 30 targets nobody aimed at */}
            {isActive && (
              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-body font-medium text-paper">{v.title}</p>
                  <p className="truncate text-sub text-content-muted">
                    {v.artist}
                    {v.year ? ` · ${v.year}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => onPlay(v)}
                  disabled={!v.previewUrl}
                  aria-label={sounding && isPlaying ? "Pausar" : `Escuchar ${v.title}`}
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-30"
                >
                  {sounding && isPlaying ? (
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                      <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                    </svg>
                  )}
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
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
  const coversOf = useCallback(
    (ids: string[]) =>
      ids
        .map((id) => vinilos.find((v) => v.id === id))
        .filter((v): v is Vinyl => Boolean(v))
        .slice(0, 4)
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
      <ul className="grid grid-cols-2 gap-4">
        {mine.map((c) => (
          <li key={c.id}>
            <button onClick={() => onActivate(c.id)} className="pressable block w-full text-left">
              <span className="relative block aspect-square w-full overflow-hidden bg-fill-subtle">
                <span className="grid h-full w-full grid-cols-2 grid-rows-2">
                  {coversOf(c.vinylIds).map((src, i) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={i} src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ))}
                </span>
              </span>
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
          <ul className="mt-4 grid grid-cols-2 gap-4">
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
function Sleeve({
  vinyl,
  eager,
  isActive,
  tilt,
  listName,
  onOpen,
  onRemove,
}: {
  vinyl: Vinyl;
  eager: boolean;
  isActive: boolean;
  tilt: number;
  listName: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const x = useMotionValue(0);
  const hint = useTransform(x, [-150, -60, 0, 60, 150], [1, 0, 0, 0, 1]);
  const fade = useTransform(x, [-260, 0, 260], [0.2, 1, 0.2]);
  const [dragging, setDragging] = useState(false);

  const end = (_: unknown, info: PanInfo) => {
    setDragging(false);
    const far = Math.abs(info.offset.x) > window.innerWidth * 0.45;
    const flick = Math.abs(info.velocity.x) > 700 && Math.abs(info.offset.x) > 60;
    if (far || flick) onRemove();
  };

  return (
    <div className="relative">
      {/* what the gesture is going to do, revealed by the gesture itself */}
      <motion.span
        style={{ opacity: hint }}
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center justify-center text-caption font-semibold uppercase tracking-label text-[#ff6b57]"
      >
        Quitar de {listName}
      </motion.span>

      <motion.button
        onClick={() => !dragging && onOpen()}
        drag={isActive ? "x" : false}
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.55}
        onDragStart={() => setDragging(true)}
        onDragEnd={end}
        style={{
          x,
          opacity: isActive ? fade : 0.55,
          transform: isActive ? undefined : `rotateX(${tilt}deg) scale(0.9)`,
          transition: dragging
            ? undefined
            : "transform 380ms var(--ease-out), opacity 380ms var(--ease-out)",
        }}
        className="block w-full touch-pan-y text-left"
      >
        <span className="relative block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverFor(vinyl)}
            alt=""
            draggable={false}
            loading={eager ? "eager" : "lazy"}
            className="aspect-square w-full rounded-sm object-cover"
            style={{
              boxShadow: isActive
                ? "0 26px 60px rgba(0,0,0,0.6)"
                : "0 10px 26px rgba(0,0,0,0.45)",
            }}
          />
          {/* the spine label, like the reference: the title reads while the
              sleeve is still edge-on */}
          <span className="absolute inset-x-0 top-0 flex items-center gap-1.5 rounded-t-sm bg-ink/72 px-2.5 py-1.5 backdrop-blur-sm">
            <span className="truncate text-caption font-semibold text-paper">{vinyl.title}</span>
            <span className="truncate text-caption text-paper/55">{vinyl.artist}</span>
          </span>
        </span>
      </motion.button>
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
