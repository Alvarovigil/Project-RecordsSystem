"use client";

/**
 * Which screen this launch began on.
 *
 * The opening screen is for a cold start — the app coming up from nothing —
 * and only for that. Arriving at the collection from Explorar is moving
 * inside an app that is already running, and a curtain there reads as a page
 * load. The difference is simply whether the document was opened on this
 * screen, so it is written down once, when the shell's code first runs, which
 * is before any soft navigation can have happened.
 */

let entry: string | null = null;

/** Called at module scope by the shell, the first code that runs on the client. */
export function noteEntry() {
  if (entry === null && typeof window !== "undefined") entry = window.location.pathname;
}

/** True when the document was opened on the screen that is asking. */
export function isColdEntry(): boolean {
  if (typeof window === "undefined") return false;
  noteEntry();
  return entry === window.location.pathname;
}
