"use client";

import type { Vinyl } from "@/lib/types";
import type { List } from "./types";

/**
 * The last thing this device knew, kept so a screen never opens empty.
 *
 * The library was read from the network on every mount: three round trips —
 * releases, lists, and the items of every list — before the shelf could draw
 * anything at all. On a laptop that is a flicker. On a phone, on mobile data,
 * it is the app going blank every time you come back to your collection, and
 * it is the single biggest reason this felt like a website rather than an
 * application.
 *
 * So reads are stale-while-revalidate. The snapshot paints immediately, the
 * network answer replaces it a moment later, and the difference between the
 * two is usually nothing — which is exactly why showing the stale one first is
 * safe. Nothing here is a source of truth: every write still goes to the
 * backend and every action still re-reads it.
 *
 * Two layers, on purpose:
 *
 * - **Memory**, so moving between screens in a session costs nothing at all.
 * - **localStorage**, so the *first* paint after opening the app from the home
 *   screen is instant too. That one is the whole point on a phone: a cold
 *   launch is the moment an installed app either feels native or does not.
 */

export type Snapshot = {
  releases: Vinyl[];
  lists: List[];
  items: Record<string, string[]>;
  /** when it was taken, so a caller can decide it is too old to trust */
  at: number;
};

const KEY = "rackr.snapshot.v1";

/**
 * Persisting is capped, and silence is the correct failure.
 *
 * A large collection with full tracklists can run past a megabyte of JSON, and
 * localStorage is a shared five-megabyte budget that also holds the session
 * and the local backend's own data. Blowing it would throw on write and, worse,
 * could evict something that is not a cache. Over the cap the memory layer
 * still does its job for the whole session — only the cold start goes back to
 * waiting for the network.
 */
const MAX_BYTES = 1_600_000;

const mem = new Map<string, Snapshot>();

export function readSnapshot(key: string): Snapshot | null {
  const hit = mem.get(key);
  if (hit) return hit;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${KEY}.${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    if (!parsed || !Array.isArray(parsed.releases) || !Array.isArray(parsed.lists)) return null;
    mem.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

let pending: ReturnType<typeof setTimeout> | null = null;

export function writeSnapshot(key: string, snap: Snapshot) {
  mem.set(key, snap);
  if (typeof window === "undefined") return;
  // Writing is debounced and deferred: serialising a whole library is real
  // work, and doing it inside the same tick as a render is how a save turns
  // into a dropped frame.
  if (pending) clearTimeout(pending);
  pending = setTimeout(() => {
    pending = null;
    try {
      const raw = JSON.stringify(snap);
      if (raw.length > MAX_BYTES) return;
      localStorage.setItem(`${KEY}.${key}`, raw);
    } catch {
      /* full, private mode, or disabled: the memory layer still stands */
    }
  }, 400);
}

/** signing out must not leave the next person looking at somebody else's shelf */
export function clearSnapshots() {
  mem.clear();
  if (typeof window === "undefined") return;
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(KEY))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    /* nothing to do */
  }
}
