"use client";

/**
 * Where you have just been, inside this app.
 *
 * `document.referrer` is the obvious answer and it is wrong here: a Next.js
 * navigation never leaves the document, so the referrer is frozen at whatever
 * loaded the tab — usually nothing. A back link built on it names the right
 * place exactly once, on a cold load, and lies for the rest of the session.
 * That is why "← Bruno Sáez" kept greeting people who had arrived from
 * Explorar.
 *
 * So the trail is kept by hand: every route this app renders pushes itself
 * onto a small stack in sessionStorage. Per tab, because two tabs are two
 * journeys; capped, because nobody needs a fifth step back; and written on
 * arrival rather than on departure, since a click cannot know it is the last
 * thing that happens on a page.
 */

const KEY = "rackr.nav.v1";
const MAX = 6;

function read(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

/** Called by the shell on every route change. */
export function recordVisit(path: string) {
  if (typeof window === "undefined") return;
  const trail = read();
  // Reloading or replacing the same screen is not travel. Without this, going
  // back from a list you refreshed would land on the same list.
  if (trail[trail.length - 1] === path) return;
  try {
    sessionStorage.setItem(KEY, JSON.stringify([...trail, path].slice(-MAX)));
  } catch {
    /* private mode: the back link falls back to its default, which is fine */
  }
}

/** The last screen that was not this one. */
export function previousPath(current: string): string | null {
  const trail = read();
  for (let i = trail.length - 1; i >= 0; i--) {
    if (trail[i] !== current) return trail[i];
  }
  return null;
}
