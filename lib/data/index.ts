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
    //
    // Exactly the token or one of its chunks, never a prefix match: the PKCE
    // flow leaves `…auth-token-code-verifier` behind when somebody starts a
    // Google sign-in and backs out, and `startsWith(name)` read that as a
    // session. The app then built the signed-in backend for a visitor, and
    // every rack and profile threw «Sin sesión» from listReleases until the
    // session layer corrected it.
    const chunk = new RegExp(`^${name}(\\.\\d+)?=`);
    if (document.cookie.split("; ").some((c) => chunk.test(c))) return true;
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
export function repositoryKey(): "supabase" | "visitor" | "local" {
  if (authenticated) return "supabase";
  return getSupabaseBrowserClient() ? "visitor" : "local";
}

/**
 * Whether an id belongs to a real account or list.
 *
 * Real rows are uuids; everything the local backend invents is not ("local",
 * "u-…", "cl-…", "default", "wishlist", "col-…"). That difference is what lets
 * one screen show a real profile and the preview shelf side by side.
 */
export function isRealId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Somebody without an account, on a site that has real ones.
 *
 * Their own shelf is the preview in localStorage — that is all they have. But
 * everything they can look at that belongs to somebody else is real, and has
 * to be read from the real place. This used to fall through to the local
 * backend, which answers any question about a real profile with its invented
 * community: a shared link to @rackrclub showed a thousand followers it does
 * not have and racks that 404, and a real rack showed "0 discos".
 *
 * So the reads route by whose the thing is: a uuid is real and goes to
 * Supabase with the anonymous key (RLS decides what is public), anything else
 * is the preview and stays local. Writes never leave localStorage.
 */
function createVisitorRepository(sb: NonNullable<ReturnType<typeof getSupabaseBrowserClient>>): LibraryRepository {
  const local = createLocalRepository();
  const remote = createSupabaseRepository(sb);
  const pick = (id: string) => (isRealId(id) ? remote : local);

  return {
    ...local,
    async getProfile(handleOrId) {
      if (isRealId(handleOrId)) return remote.getProfile(handleOrId);
      return (await remote.getProfile(handleOrId)) ?? local.getProfile(handleOrId);
    },
    profileStats: (id) => pick(id).profileStats(id),
    listsOfProfile: (id) => pick(id).listsOfProfile(id),
    followersOf: (id) => pick(id).followersOf(id),
    followingOf: (id) => pick(id).followingOf(id),
    picksOf: (id) => pick(id).picksOf(id),
    relationship: async (id) =>
      isRealId(id) ? { following: false, followsYou: false, isYou: false } : local.relationship(id),
    releasesOfList: (id) => pick(id).releasesOfList(id),
    collaboratorsOf: (id) => pick(id).collaboratorsOf(id),
    addedBy: (listId, releaseId) => pick(listId).addedBy(listId, releaseId),
    async coversOfLists(ids) {
      const real = ids.filter(isRealId);
      const preview = ids.filter((id) => !isRealId(id));
      const [a, b] = await Promise.all([
        real.length ? remote.coversOfLists(real) : {},
        preview.length ? local.coversOfLists(preview) : {},
      ]);
      return { ...b, ...a };
    },
    listsWithRelease: (slug) => remote.listsWithRelease(slug),
    friendsWithRelease: (slug) => remote.friendsWithRelease(slug),
    searchProfiles: (q) => remote.searchProfiles(q),
    searchLists: (q) => remote.searchLists(q),
    popularLists: () => remote.popularLists(),
    suggestedProfiles: () => remote.suggestedProfiles(),
    activity: () => remote.activity(),
  };
}

/**
 * The app's single data source. Supabase when configured AND signed in; the
 * visitor mix when configured but signed out; localStorage when there is no
 * Supabase at all, so the app is always usable — including offline and before
 * anyone has an account.
 */
export function getRepository(): LibraryRepository {
  if (cached) return cached;
  const sb = getSupabaseBrowserClient();
  cached = !sb
    ? createLocalRepository()
    : authenticated
      ? createSupabaseRepository(sb)
      : createVisitorRepository(sb);
  return cached;
}

/** Forget the memoised backend (after sign-in or sign-out). */
export function resetRepository() {
  cached = null;
  listeners.forEach((fn) => fn());
}

export * from "./types";
