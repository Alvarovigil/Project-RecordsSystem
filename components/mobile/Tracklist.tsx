"use client";

import { useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/Card";
import type { Track, Vinyl } from "@/lib/types";

/**
 * The tracklist, as the object rather than as a table.
 *
 * A record is not a list of twelve songs. It is one or two or four discs, each
 * with two sides, and you play a side and then get up and turn it over. The
 * old list knew about sides and printed them all at once, which is the right
 * fact told in the wrong shape: a double LP came out as four headings in a
 * column, and nothing said there were two objects in the sleeve.
 *
 * So a disc at a time, with its two sides under it, and arrows to step between
 * them. The heading says which one you are holding — "Vinilo 1 de 2" — and
 * where there is only one disc it says nothing clever and goes back to
 * "Canciones".
 *
 * **And the titles play.** A record here has exactly one preview, found at
 * import, which is enough to answer "what does this sound like" and nothing at
 * all for a list of songs; a list of titles you cannot press was the most
 * database-like thing left on this screen. See /api/preview/album: one lookup
 * per record, cached forever, matched by title.
 */

type Parsed = { disc: number; side: string; track: Track; index: number };

/**
 * Where a track sits, from the only clue there is.
 *
 * Discogs writes positions three ways and this app has to read all of them.
 * "1A1" says disc and side outright. "A1" and "C1" say only the side — and on
 * a double LP the sides run A B C D across two discs, so the letter is the
 * disc: A and B are the first record, C and D the second. Anything else — a
 * bare number, an empty string on a heading row — belongs to whatever came
 * before it.
 */
function parse(tracks: Track[]): Parsed[] {
  let disc = 1;
  let side = "";
  return tracks.map((track, index) => {
    const p = (track.position ?? "").trim();
    const numbered = p.match(/^(\d+)\s*[-–.]?\s*([A-Za-z])/);
    const lettered = p.match(/^([A-Za-z])\s*\d/);
    if (numbered) {
      disc = Number(numbered[1]);
      side = numbered[2].toUpperCase();
    } else if (lettered) {
      side = lettered[1].toUpperCase();
      const nth = side.charCodeAt(0) - 64; // A = 1
      disc = Math.max(1, Math.ceil(nth / 2));
    }
    return { disc, side, track, index };
  });
}

/** the number a listener reads: "A1" → 1, "1B3" → 3, otherwise its order */
function trackNumber(position: string, fallback: number) {
  const m = position.match(/(\d+)\s*$/);
  return m ? m[1] : String(fallback);
}

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^a-z0-9]/g, "");

export default function Tracklist({
  vinyl,
  nowPlayingId,
  playing,
  onPlayTrack,
}: {
  vinyl: Vinyl;
  nowPlayingId?: string;
  playing: boolean;
  /** a synthetic record for one track, so the player needs to know nothing new */
  onPlayTrack: (v: Vinyl) => void;
}) {
  const parsed = useMemo(() => parse(vinyl.tracklist ?? []), [vinyl.tracklist]);
  const discs = useMemo(
    () => Array.from(new Set(parsed.map((p) => p.disc))).sort((a, b) => a - b),
    [parsed],
  );
  const [at, setAt] = useState(0);
  useEffect(() => setAt(0), [vinyl.id]);

  const [previews, setPreviews] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!vinyl.artist || !vinyl.title) return;
    let alive = true;
    setPreviews({});
    const q = new URLSearchParams({ artist: vinyl.artist, album: vinyl.title });
    if (vinyl.discogsId) q.set("id", String(vinyl.discogsId));
    fetch(`/api/preview/album?${q}`)
      .then((r) => r.json())
      .then((d) => alive && setPreviews(d.tracks ?? {}))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [vinyl.id, vinyl.artist, vinyl.title, vinyl.discogsId]);

  if (parsed.length === 0) return null;

  const disc = discs[Math.min(at, discs.length - 1)];
  const many = discs.length > 1;
  const onThisDisc = parsed.filter((p) => p.disc === disc);
  const sides = Array.from(new Set(onThisDisc.map((p) => p.side).filter(Boolean)));

  return (
    <Card padded={false}>
      <header className="flex items-center justify-between gap-3 px-5 pb-1">
        <h3 className="text-body font-medium text-paper">
          {many ? `Vinilo ${at + 1} de ${discs.length}` : "Canciones"}
        </h3>
        {many && (
          <div className="flex items-center gap-1">
            <Step dir="prev" disabled={at === 0} onClick={() => setAt((n) => n - 1)} />
            <Step
              dir="next"
              disabled={at >= discs.length - 1}
              onClick={() => setAt((n) => n + 1)}
            />
          </div>
        )}
      </header>

      <div className="mt-3">
        {(sides.length ? sides : [""]).map((side, si) => {
          const rows = onThisDisc.filter((p) => (side ? p.side === side : true));
          return (
            <div key={side || si} className={si > 0 ? "mt-5" : ""}>
              {side && (
                <h4 className="flex items-baseline gap-2 px-5 pb-1.5 text-caption uppercase tracking-label text-content-faint">
                  Cara {side}
                  <span>{rows.length}</span>
                </h4>
              )}
              <ol>
                {rows.map(({ track, index }) => {
                  const preview = previews[norm(track.title)];
                  const id = `${vinyl.id}#${index}`;
                  const current = nowPlayingId === id;
                  return (
                    <li key={index}>
                      <button
                        disabled={!preview}
                        onClick={() =>
                          preview &&
                          onPlayTrack({
                            ...vinyl,
                            id,
                            title: track.title,
                            previewUrl: preview,
                          })
                        }
                        className={`flex w-full items-center gap-3 px-5 py-2.5 text-left text-sub transition-colors ${
                          preview ? "pressable hover:bg-fill-subtle" : "cursor-default"
                        }`}
                      >
                        {/* The number becomes the meter while it sounds: one
                            column, two states, and no control appearing to
                            push the title sideways. */}
                        <span className="mono flex w-5 shrink-0 justify-center text-caption text-content-faint">
                          {current ? (
                            <span aria-label="Sonando" className="flex h-3 items-end gap-[2px]">
                              {[0, 1, 2].map((b) => (
                                <span
                                  key={b}
                                  className={`w-[2px] bg-accent ${playing ? "sound-bar" : ""}`}
                                  style={{
                                    animationDelay: `${b * 140}ms`,
                                    height: playing ? undefined : "45%",
                                  }}
                                />
                              ))}
                            </span>
                          ) : (
                            trackNumber(track.position ?? "", index + 1)
                          )}
                        </span>
                        <span
                          className={`min-w-0 flex-1 truncate ${
                            current ? "text-accent" : preview ? "text-paper" : "text-content-secondary"
                          }`}
                        >
                          {track.title}
                        </span>
                        {track.duration && (
                          <span className="mono shrink-0 text-caption text-content-faint">
                            {track.duration}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/** one step between discs: a 36px target for a 10px glyph */
function Step({
  dir,
  disabled,
  onClick,
}: {
  dir: "prev" | "next";
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={dir === "prev" ? "Vinilo anterior" : "Vinilo siguiente"}
      className="pressable flex h-9 w-9 items-center justify-center rounded-full text-content-secondary transition-colors hover:bg-fill hover:text-paper disabled:pointer-events-none disabled:opacity-25"
    >
      <svg width="9" height="14" viewBox="0 0 10 16" fill="none" aria-hidden>
        <path
          d={dir === "prev" ? "M6.8 1.5 L2 8 L6.8 14.5" : "M3.2 1.5 L8 8 L3.2 14.5"}
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
