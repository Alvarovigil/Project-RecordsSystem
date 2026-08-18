"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { createLocalRepository } from "./local";
import { createSupabaseRepository } from "./supabase";
import type { LibraryRepository } from "./types";

let cached: LibraryRepository | null = null;
let authenticated = false;

/** The session layer tells the data layer whether a real account is behind it. */
export function setAuthenticated(value: boolean) {
  if (value !== authenticated) {
    authenticated = value;
    cached = null;
  }
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
}

export * from "./types";
