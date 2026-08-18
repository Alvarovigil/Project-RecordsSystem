"use client";

import type { Vinyl } from "@/lib/types";
import { loadCollections, DEFAULT_ID, WISHLIST_ID } from "@/lib/collections";
import { createLocalRepository } from "@/lib/data/local";
import type { LibraryRepository } from "@/lib/data/types";

const DONE_KEY = "vinilos.migrated.v1";

export type MigrationSummary = { releases: number; lists: number; items: number };

/**
 * Moves what you built while signed out into your account.
 *
 * Runs once per browser and is idempotent anyway: releases dedupe on the
 * catalogue's unique slug, list items on their primary key. The local copy is
 * left untouched — if anything goes wrong you haven't lost your collection.
 */
export async function migrateLocalLibrary(
  target: LibraryRepository,
): Promise<MigrationSummary | null> {
  if (typeof window === "undefined") return null;
  if (localStorage.getItem(DONE_KEY)) return null;

  const local = createLocalRepository();
  const releases = await local.listReleases();
  const localLists = loadCollections(releases.map((v) => v.id));
  if (releases.length === 0) return null;

  const summary: MigrationSummary = { releases: 0, lists: 0, items: 0 };

  // 1. the catalogue first: lists can only point at records that exist
  for (const release of releases) {
    await target.upsertRelease(release);
    summary.releases++;
  }

  // 2. the two predefined lists already exist in the account, so map onto them
  const targetLists = await target.listLists();
  const byKind = {
    collection: targetLists.find((l) => l.kind === "collection"),
    wishlist: targetLists.find((l) => l.kind === "wishlist"),
  };

  for (const local of localLists) {
    const isPrimary = local.id === DEFAULT_ID || local.id === WISHLIST_ID;
    const destination = isPrimary
      ? local.id === WISHLIST_ID
        ? byKind.wishlist
        : byKind.collection
      : await target.createList({ title: local.name });
    if (!destination) continue;
    if (!isPrimary) summary.lists++;

    // Mi Colección is derived from the library, so it needs no items copied:
    // everything already landed there with the catalogue import above.
    if (destination.kind === "collection") continue;

    for (const releaseId of local.vinylIds) {
      await target.addToList(destination.id, releaseId);
      summary.items++;
    }
  }

  localStorage.setItem(DONE_KEY, new Date().toISOString());
  return summary;
}

/** Has this browser's local library already been claimed by an account? */
export function localLibraryMigrated() {
  return typeof window !== "undefined" && Boolean(localStorage.getItem(DONE_KEY));
}

/** Records waiting to be claimed, for the onboarding copy. */
export function localLibrarySize(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem("vinilos.releases.v1");
    return raw ? (JSON.parse(raw) as Vinyl[]).length : 0;
  } catch {
    return 0;
  }
}
