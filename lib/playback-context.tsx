"use client";

import { createContext, useContext, type ReactNode } from "react";
import { usePlayback, type Playback } from "@/hooks/usePlayback";

/**
 * Sound lives above the pages.
 *
 * Held in the shell so a preview keeps playing while you walk from a profile
 * to a list to your own shelf. Music that stops every time you click a link is
 * what makes a set of pages feel like a set of pages.
 */
const PlaybackContext = createContext<Playback | null>(null);

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const playback = usePlayback();
  return <PlaybackContext.Provider value={playback}>{children}</PlaybackContext.Provider>;
}

export function usePlaybackContext(): Playback {
  const value = useContext(PlaybackContext);
  if (!value) throw new Error("usePlaybackContext fuera de PlaybackProvider");
  return value;
}
