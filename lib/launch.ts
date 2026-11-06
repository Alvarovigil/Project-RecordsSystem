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
/** the app has already moved off the screen it was opened on */
let moved = false;

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

/**
 * The shell reports every screen it shows. Once it has shown one that is not
 * the entry, the launch is over: coming back to the entry screen later is
 * moving inside the app too.
 */
export function noteScreen(pathname: string) {
  noteEntry();
  if (entry !== null && pathname !== entry) moved = true;
}

/**
 * True only while the document is still on the screen it was opened on, asked
 * for a given screen rather than for wherever the address happens to be: a
 * route's loading state renders before the address changes, so the address
 * would still name the screen being left.
 *
 * On the server there is no launch to speak of, and what the server paints is
 * by definition a document being opened: true, so the server's HTML and the
 * hydration of a cold start agree.
 */
export function isColdStartOn(pathname: string): boolean {
  if (typeof window === "undefined") return true;
  noteEntry();
  return !moved && entry === pathname;
}
