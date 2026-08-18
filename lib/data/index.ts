"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLocalRepository } from "./local";
import { createSupabaseRepository } from "./supabase";
import type { LibraryRepository } from "./types";

let cached: LibraryRepository | null = null;
let authenticated = false;
const listeners = new Set<() => void>();

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
