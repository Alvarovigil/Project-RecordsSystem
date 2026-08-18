import type { ReactNode } from "react";
import { PlaybackProvider } from "@/lib/playback-context";
import MiniPlayer from "@/components/app/MiniPlayer";

/**
 * The shell every signed-in surface shares.
 *
 * Because this layout stays mounted across navigations, the audio element
 * inside it does too: a preview keeps playing while you move from a profile to
 * a list to your own shelf. That continuity is what turns a set of pages into
 * one place.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <PlaybackProvider>
      {children}
      <MiniPlayer />
    </PlaybackProvider>
  );
}
