"use client";

import { useState } from "react";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";

type Props = {
  vinilos: Vinyl[];
  activeId?: string | null;
  playingId?: string | null;
  isPlaying?: boolean;
  onSelect: (v: Vinyl) => void;
  onPlay: (v: Vinyl) => void;
};

/** Cover that fades in on decode — no flash of empty tile. */
function Cover({ vinyl, dim }: { vinyl: Vinyl; dim: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={coverFor(vinyl)}
      alt=""
      loading="lazy"
      decoding="async"
      onLoad={() => setLoaded(true)}
      className={`h-full w-full object-cover transition-[opacity,transform] duration-500 ease-out group-hover:opacity-100 ${
        loaded ? (dim ? "opacity-45" : "opacity-90") : "opacity-0 scale-[1.02]"
      } scale-100`}
    />
  );
}

/** Three bars that only move while audio is actually running. */
function SoundBars({ animated }: { animated: boolean }) {
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={`w-[2px] bg-current ${animated ? "sound-bar" : ""}`}
          style={{
            height: animated ? undefined : "40%",
            animationDelay: `${i * 0.16}s`,
          }}
        />
      ))}
    </span>
  );
}

/**
 * Flat 5-column contact-sheet view of the collection: cover + title/artist
 * underneath. The record that sounds is marked and everything else dims, so
 * the grid answers "what am I listening to?" at a glance.
 */
export default function VinylGrid({
  vinilos,
  activeId,
  playingId,
  isPlaying = false,
  onSelect,
  onPlay,
}: Props) {
  return (
    <div className="absolute inset-0 z-0 overflow-y-auto">
      <div className="grid grid-cols-5 gap-x-6 gap-y-10 px-8 pb-40 pt-32">
        {vinilos.map((v) => {
          const sounding = playingId === v.id;
          return (
            <div key={v.id} id={`grid-${v.id}`} className="group relative">
              <button
                onClick={() => onSelect(v)}
                className="block w-full text-left"
                aria-label={`${v.artist} — ${v.title}`}
              >
                <div
                  className={`relative aspect-square w-full overflow-hidden bg-paper/[0.03] outline-offset-2 transition ${
                    sounding
                      ? "outline outline-1 outline-paper/70"
                      : activeId === v.id
                        ? "outline outline-1 outline-paper/25"
                        : ""
                  }`}
                >
                  <Cover vinyl={v} dim={!!playingId && !sounding} />
                  {sounding && (
                    <span className="absolute bottom-2 left-2 flex items-center gap-1.5 bg-ink/70 px-2 py-1 text-paper backdrop-blur-sm">
                      <SoundBars animated={isPlaying} />
                    </span>
                  )}
                </div>
              </button>

              {/* play this one without leaving the grid */}
              {v.previewUrl && (
                <button
                  onClick={() => onPlay(v)}
                  aria-label={
                    sounding && isPlaying
                      ? `Pausar ${v.title}`
                      : `Reproducir ${v.title}`
                  }
                  className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-paper/25 bg-ink/70 text-paper backdrop-blur-sm transition focus:opacity-100 ${
                    sounding ? "opacity-100" : "reveal-on-hover"
                  }`}
                >
                  {sounding && isPlaying ? (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                      <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                      <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                    </svg>
                  )}
                </button>
              )}

              <button
                onClick={() => onSelect(v)}
                className="block w-full text-left"
                tabIndex={-1}
              >
                <div
                  className={`mt-3 truncate text-[13px] leading-tight transition ${
                    sounding ? "text-paper" : "text-paper/90"
                  }`}
                >
                  {v.title}
                </div>
                <div className="mt-1 truncate text-[11px] uppercase tracking-[0.14em] text-paper/45">
                  {v.artist}
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
