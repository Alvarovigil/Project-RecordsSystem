"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { coverFor } from "@/lib/cover";
import { usePlaybackContext } from "@/lib/playback-context";

/**
 * The player that follows you around.
 *
 * Hidden on the shelf, where the transport is part of the scene — two sets of
 * controls for the same sound is worse than one.
 */
export default function MiniPlayer() {
  const { nowPlaying, playing, loading, toggleCurrent } = usePlaybackContext();
  const pathname = usePathname();

  if (!nowPlaying || pathname.startsWith("/estanteria")) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-paper/[0.08] bg-ink/92 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-[1180px] items-center gap-4 px-6 py-3">
        <span className="h-11 w-11 shrink-0 overflow-hidden bg-paper/[0.06]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverFor(nowPlaying)} alt="" className="h-full w-full object-cover" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-paper">{nowPlaying.title}</span>
          <span className="mono block truncate text-[10px] uppercase tracking-[0.16em] text-paper/40">
            {loading ? "Cargando" : nowPlaying.artist}
          </span>
        </span>

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

        <Link
          href="/estanteria"
          className="mono shrink-0 text-[10px] uppercase tracking-[0.16em] text-paper/35 transition hover:text-paper"
        >
          Ver en la estantería
        </Link>
      </div>
    </div>
  );
}
