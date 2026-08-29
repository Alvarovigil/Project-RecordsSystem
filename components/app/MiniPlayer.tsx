"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useDevice } from "@/hooks/useDevice";
import { coverFor } from "@/lib/cover";
import { usePlaybackContext } from "@/lib/playback-context";
import RecordSheet from "@/components/mobile/RecordSheet";
import { useLibrary } from "@/hooks/useLibrary";
import type { Vinyl } from "@/lib/types";

/**
 * The player that follows you around.
 *
 * Hidden on the shelf, where the transport is part of the scene — two sets of
 * controls for the same sound is worse than one.
 *
 * On a phone it rides above the tab bar and publishes its own height as
 * `--player-h`, so every scrolling surface can end above it. Guessing that
 * offset is how the last row of a list ends up permanently unreachable — and
 * only for the people who happen to be playing something.
 */
export default function MiniPlayer() {
  const { nowPlaying, playing, loading, toggleCurrent } = usePlaybackContext();
  const pathname = usePathname();
  const { isPhone } = useDevice();
  /** the record whose sheet the strip opened */
  const [open, setOpen] = useState<Vinyl | null>(null);

  // The phone shelf has no transport of its own in the scene, so the player is
  // exactly what it needs; only the 3D desktop shelf hides it.
  const onShelf =
    !isPhone && (pathname.startsWith("/coleccion") || pathname.startsWith("/demo"));
  const visible = Boolean(nowPlaying) && !onShelf;

  useEffect(() => {
    const root = document.documentElement.style;
    root.setProperty("--player-h", visible && isPhone ? "58px" : "0px");
    return () => root.setProperty("--player-h", "0px");
  }, [visible, isPhone]);

  if (!nowPlaying || onShelf) return null;

  return (
    <div
      className="fixed inset-x-0 z-40 border-t border-line bg-ink/92 backdrop-blur-md"
      style={{ bottom: isPhone ? "var(--tabbar-h)" : 0 }}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
        <button
          onClick={() => setOpen(nowPlaying)}
          aria-label={`Abrir ${nowPlaying.title}`}
          className="pressable h-10 w-10 shrink-0 overflow-hidden bg-paper/[0.06] sm:h-11 sm:w-11"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverFor(nowPlaying)} alt="" className="h-full w-full object-cover" />
        </button>

        {/**
         * The strip is the record.
         *
         * It said what was playing and led nowhere: to see the sleeve you were
         * hearing you had to go and find it. Now the whole left side opens it —
         * the same sheet as everywhere else, so listening and looking are one
         * gesture apart. The play button stays its own target, because the one
         * thing you must be able to do without leaving the screen is stop it.
         */}
        <button
          onClick={() => setOpen(nowPlaying)}
          aria-label={`Abrir ${nowPlaying.title}`}
          className="pressable min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[13px] text-paper">{nowPlaying.title}</span>
          <span className="mono block truncate text-[10px] uppercase tracking-[0.16em] text-paper/40">
            {loading ? "Cargando" : nowPlaying.artist}
          </span>
        </button>

        <button
          onClick={toggleCurrent}
          aria-label={playing ? "Pausar" : "Reproducir"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-paper/25 text-paper transition hover:border-paper/60"
        >
          {playing ? (
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <rect x="3" y="2" width="3" height="10" fill="currentColor" />
              <rect x="8" y="2" width="3" height="10" fill="currentColor" />
            </svg>
          ) : (
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none">
              <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
            </svg>
          )}
        </button>

        {/* on a phone the whole strip is the link back to the record; a
            separate text link would be a 9px target next to a 44px one */}
        <Link
          href="/coleccion"
          className="mono hidden shrink-0 text-[10px] uppercase tracking-[0.16em] text-paper/35 transition hover:text-paper sm:block"
        >
          Ver en mi colección
        </Link>
      </div>

      {/**
       * Mounted only once something has been opened.
       *
       * The sheet needs your lists, to offer to save the record into one — and
       * asking for them on every screen that happens to be playing something
       * would be a request nobody asked for. Mounting the launcher on demand
       * means the fetch happens when the sheet does.
       */}
      {open && <PlayingSheet vinyl={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function PlayingSheet({ vinyl, onClose }: { vinyl: Vinyl; onClose: () => void }) {
  const lib = useLibrary();
  const audio = usePlaybackContext();
  const { nowPlaying, playing } = audio;
  return (
    <RecordSheet
      vinyl={vinyl}
      onClose={onClose}
      canEdit={false}
      collections={lib.lists.map((l) => ({
        id: l.id,
        name: l.title,
        vinylIds: lib.idsOf(l.id),
        kind: l.kind,
      }))}
      activeListId=""
      playing={playing && nowPlaying?.id === vinyl.id}
      onTogglePlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : audio.play(v))}
      onAddTo={(listId, v) => void lib.saveToList(v, listId)}
      onRemoveFromActive={() => {}}
      onDelete={() => {}}
    />
  );
}
