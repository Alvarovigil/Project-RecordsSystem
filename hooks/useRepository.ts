"use client";

import { useSyncExternalStore } from "react";
import { getRepository, repositoryKey, subscribeRepository } from "@/lib/data";
import type { LibraryRepository } from "@/lib/data/types";

/**
 * The current backend, and a re-render when it changes.
 *
 * Signing in swaps localStorage for Supabase underneath the whole app; without
 * this, screens would keep reading the backend they happened to mount with.
 */
export function useRepository(): LibraryRepository {
  useSyncExternalStore(
    subscribeRepository,
    () => repositoryKey(),
    () => "local",
  );
  return getRepository();
}
