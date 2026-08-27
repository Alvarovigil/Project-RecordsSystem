"use client";

/**
 * The social state the local backend has to remember.
 *
 * Following someone was already stored; everything the community flows added —
 * when you saved a list, who collaborates on what, who put which record where,
 * and what you haven't read yet — needs the same treatment, so that a flow
 * designed against the placeholder data behaves exactly as it will against the
 * real one. A prototype where "invite" does nothing teaches you nothing about
 * whether the invite flow works.
 *
 * Each key is versioned and every read is defensive: a shape that changed
 * between two visits must degrade to "empty", never to a crash on boot.
 */

import type { Collaborator, Notification, ProfilePatch } from "./types";

const KEYS = {
  saved: "vinilos.saved-lists.v1",
  collab: "vinilos.collaborators.v1",
  addedBy: "vinilos.added-by.v1",
  notifs: "vinilos.notifications.v1",
  profile: "vinilos.profile-overrides.v1",
  seenNotifs: "vinilos.notifications.seeded.v1",
} as const;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // a full quota is not a reason to take the app down
  }
}

/** A clock that is stable within a render pass, so lists don't reshuffle. */
const now = () => new Date().toISOString();

// ------------------------------------------------------------- saved lists
export type SavedRecord = { listId: string; at: string };

export const loadSaved = (): SavedRecord[] => read<SavedRecord[]>(KEYS.saved, []);

export function setSaved(listId: string, saved: boolean) {
  const all = loadSaved().filter((s) => s.listId !== listId);
  write(KEYS.saved, saved ? [{ listId, at: now() }, ...all] : all);
}

export const isSaved = (listId: string) => loadSaved().some((s) => s.listId === listId);

// ----------------------------------------------------------- collaborators
type CollabMap = Record<string, Collaborator[]>;

export const loadCollaborators = (): CollabMap => read<CollabMap>(KEYS.collab, {});

export const collaboratorsOf = (listId: string): Collaborator[] =>
  loadCollaborators()[listId] ?? [];

export function setCollaborators(listId: string, next: Collaborator[]) {
  const all = loadCollaborators();
  if (next.length === 0) delete all[listId];
  else all[listId] = next;
  write(KEYS.collab, all);
}

/** Lists someone else owns that you have been let into. */
export function listsIveJoined(myId: string): string[] {
  const all = loadCollaborators();
  return Object.entries(all)
    .filter(([, people]) =>
      people.some((c) => c.profile.id === myId && c.role === "editor" && !c.pending),
    )
    .map(([listId]) => listId);
}

// -------------------------------------------------------------- attribution
type AddedByMap = Record<string, { id: string; username: string; displayName: string }>;

const attrKey = (listId: string, releaseId: string) => `${listId}::${releaseId}`;

export const loadAddedBy = (): AddedByMap => read<AddedByMap>(KEYS.addedBy, {});

export function setAddedBy(
  listId: string,
  releaseId: string,
  who: { id: string; username: string; displayName: string },
) {
  const all = loadAddedBy();
  all[attrKey(listId, releaseId)] = who;
  write(KEYS.addedBy, all);
}

export const getAddedBy = (listId: string, releaseId: string) =>
  loadAddedBy()[attrKey(listId, releaseId)] ?? null;

// ------------------------------------------------------------ notifications
export const loadNotifications = (): Notification[] =>
  read<Notification[]>(KEYS.notifs, []);

export function saveNotifications(next: Notification[]) {
  // a hundred is more than anyone scrolls, and it keeps the key small
  write(KEYS.notifs, next.slice(0, 100));
}

export function pushNotification(n: Notification) {
  saveNotifications([n, ...loadNotifications().filter((x) => x.id !== n.id)]);
}

export function markAllRead() {
  saveNotifications(loadNotifications().map((n) => ({ ...n, read: true })));
}

export const hasSeededNotifications = () => read<boolean>(KEYS.seenNotifs, false);
export const markSeeded = () => write(KEYS.seenNotifs, true);

// ------------------------------------------------------------------ profile
export const loadProfileOverrides = (): ProfilePatch =>
  read<ProfilePatch>(KEYS.profile, {});

export function saveProfileOverrides(patch: ProfilePatch) {
  write(KEYS.profile, { ...loadProfileOverrides(), ...patch });
}

/** A local id that doesn't need a server and doesn't collide in practice. */
export function newId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36)}`;
}
