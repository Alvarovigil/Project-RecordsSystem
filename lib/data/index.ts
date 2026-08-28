"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLocalRepository } from "./local";
import { createSupabaseRepository } from "./supabase";
import type { LibraryRepository } from "./types";

let cached: LibraryRepository | null = null;
const listeners = new Set<() => void>();

/**
 * Whether there is a session, answered before anyone asks the network.
 *
 * This used to start as false and wait for the session layer to say otherwise.
 * But `useSession` learns the answer from an async call, and every community
 * screen mounts and fetches before it lands — so a signed-in visitor's first
 * request for a profile went to the localStorage backend, which knows nothing
 * about real accounts and answered "no lists, no such person". The page then
 * settled on that answer, because by the time the truth arrived the screen had
 * already drawn.
 *
 * Supabase persists the session in localStorage, so the answer is available
 * synchronously on the very first read. The async path still corrects this
 * later — it just no longer has to arrive first.
 */
function hasStoredSession(): boolean {
  if (typeof window === "undefined") return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) return false;
  try {
    const ref = new URL(url).hostname.split(".")[0];
    const name = `sb-${ref}-auth-token`;
    // @supabase/ssr keeps the session in cookies — that is the point of the
    // package, so the server can read it too — and splits it across
    // `…auth-token.0`, `.1` when the token outgrows one cookie. Presence of
    // any chunk is the signal; validating it is the client's job, not ours.
    if (document.cookie.split("; ").some((c) => c.startsWith(name))) return true;
    // older clients, and anything configured with the localStorage adapter
    return Boolean(localStorage.getItem(name));
  } catch {
    return false;
  }
}

let authenticated = hasStoredSession();

/** The session layer tells the data layer whether a real account is behind it. */
export function setAuthenticated(value: boolean) {
  if (value === authenticated) return;
  authenticated = value;
  cached = null;
  listeners.forEach((fn) => fn());
}

/** Consumers re-read their data when the backend underneath them changes. */
export function subscribeRepository(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Identity of the current backend, for hooks that need a dependency. */
export function repositoryKey() {
  return authenticated ? "supabase" : "local";
}

/**
 * The app's single data source. Supabase when configured AND signed in;
 * localStorage otherwise, so the app is always usable — including offline and
 * before anyone has an account.
 */
export function getRepository(): LibraryRepository {
  if (cached) return cached;
  const sb = authenticated ? getSupabaseBrowserClient() : null;
  cached = sb ? createSupabaseRepository(sb) : createLocalRepository();
  return cached;
}

/** Forget the memoised backend (after sign-in or sign-out). */
export function resetRepository() {
  cached = null;
  listeners.forEach((fn) => fn());
}

export * from "./types";
