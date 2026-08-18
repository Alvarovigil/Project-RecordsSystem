"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { previewSrc } from "@/lib/audio";

/**
 * Everything about sound, in one place.
 *
 * The rule it encodes: what SOUNDS is independent from what you are looking
 * at. Browsing never touches playback; only Play and the transport do.
 */

/**
 * Fully lets go of an audio element: pausing alone leaves the download
 * running, and abandoned streams eat the browser's per-host connection budget
 * until the next preview can't get through.
 */
function releaseAudio(a: HTMLAudioElement | null) {
  if (!a) return;
  a.pause();
  a.removeAttribute("src");
  a.load();
}

export type Playback = {
  nowPlaying: Vinyl | null;
  playing: boolean;
  loading: boolean;
  /** paused by the user, as opposed to stalled or finished */
  pausedByUser: boolean;
  play: (v: Vinyl) => void;
  toggle: (v: Vinyl | null) => void;
  toggleCurrent: () => void;
  stop: () => void;
};

export function usePlayback(): Playback {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [nowPlaying, setNowPlaying] = useState<Vinyl | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pausedByUser, setPausedByUser] = useState(false);

  useEffect(() => () => releaseAudio(audioRef.current), []);

  const play = useCallback((v: Vinyl) => {
    if (!v.previewUrl) return;
    releaseAudio(audioRef.current);

    const audio = new Audio(previewSrc(v.previewUrl));
    audio.preload = "auto";
    audio.addEventListener("playing", () => setLoading(false));
    audio.addEventListener("ended", () => {
      setPlaying(false);
      setLoading(false);
    });
    audio.addEventListener("error", () => {
      setPlaying(false);
      setLoading(false);
    });
    audioRef.current = audio;
    setNowPlaying(v);
    setLoading(true);
    setPausedByUser(false);

    const start = () =>
      audio
        .play()
        .then(() => {
          if (audioRef.current === audio) setPlaying(true);
        })
        .catch(() => false);

    // play() can reject while the stream is still opening; wait for the
    // element to say it's ready and try once more
    start().then((ok) => {
      if (ok !== false || audioRef.current !== audio) return;
      audio.addEventListener(
        "canplay",
        () => {
          if (audioRef.current === audio) start();
        },
        { once: true },
      );
    });
  }, []);

  const stop = useCallback(() => {
    releaseAudio(audioRef.current);
    audioRef.current = null;
    setPlaying(false);
    setLoading(false);
    setPausedByUser(false);
    setNowPlaying(null);
  }, []);

  /** pause / resume whatever is loaded, without restarting it */
  const toggleCurrent = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !nowPlaying) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      setPausedByUser(true);
      return;
    }
    setPausedByUser(false);
    audio
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [nowPlaying, playing]);

  /** the transport button: same record → pause/resume, other record → takes over */
  const toggle = useCallback(
    (v: Vinyl | null) => {
      if (v && nowPlaying?.id === v.id && audioRef.current) {
        toggleCurrent();
        return;
      }
      if (v?.previewUrl) play(v);
    },
    [nowPlaying, play, toggleCurrent],
  );

  return { nowPlaying, playing, loading, pausedByUser, play, toggle, toggleCurrent, stop };
}
