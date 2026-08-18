"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { type SortMode, DEFAULT_ID, WISHLIST_ID, loadActiveId, saveActiveId } from "@/lib/collections";
import { getRepository, type List, type NewListInput } from "@/lib/data";
import { useRepository } from "./useRepository";

/**
 * Your library: records, lists and everything you can do to them.
 *
 * Components never touch storage — they call these actions. Swapping the
 * backend (localStorage → Supabase) changes nothing here.
 */
export function useLibrary() {
  const repo = useRepository();
  const [releases, setReleases] = useState<Vinyl[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [activeListId, setActiveListId] = useState<string>(DEFAULT_ID);
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    const [r, l] = await Promise.all([repo.listReleases(), repo.listLists()]);
    setReleases(r);
    setLists(l);
  }, [repo]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [r, l] = await Promise.all([repo.listReleases(), repo.listLists()]);
      if (!alive) return;
      setReleases(r);
      setLists(l);
      const saved = loadActiveId();
      setActiveListId(l.some((x) => x.id === saved) ? saved : (l[0]?.id ?? DEFAULT_ID));
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;

  /** ids of the records in a list, honouring its sort */
  const [itemsByList, setItemsByList] = useState<Record<string, string[]>>({});
  useEffect(() => {
    let alive = true;
    (async () => {
      const entries = await Promise.all(
        lists.map(async (l) => [l.id, await repo.listItems(l.id)] as const),
      );
      if (alive) setItemsByList(Object.fromEntries(entries));
    })();
  }, [lists, repo]);

  const idsOf = useCallback((listId: string) => itemsByList[listId] ?? [], [itemsByList]);

  const activate = useCallback((listId: string) => {
    setActiveListId(listId);
    saveActiveId(listId);
  }, []);

  // ---- actions: every one refreshes from the source of truth --------------
  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn();
      await refresh();
      const entries = await Promise.all(
        (await getRepository().listLists()).map(
          async (l) => [l.id, await repo.listItems(l.id)] as const,
        ),
      );
      setItemsByList(Object.fromEntries(entries));
    },
    [refresh, repo],
  );

  return {
    ready,
    releases,
    lists,
    activeList,
    activeListId,
    idsOf,
    activate,
    refresh,

    saveToList: (release: Vinyl, listId: string) =>
      act(async () => {
        await repo.upsertRelease(release);
        await repo.addToList(listId, release.id);
      }),
    removeFromList: (listId: string, releaseId: string) =>
      act(() => repo.removeFromList(listId, releaseId)),
    deleteRelease: (releaseId: string) => act(() => repo.deleteRelease(releaseId)),
    createList: async (input: NewListInput | string) => {
      const list = await repo.createList(
        typeof input === "string" ? { title: input } : input,
      );
      await act(async () => {});
      return list.id;
    },
    renameList: (listId: string, title: string) => act(() => repo.renameList(listId, title)),
    deleteList: (listId: string) =>
      act(async () => {
        await repo.deleteList(listId);
        if (listId === activeListId) {
          // fall back to the collection, whatever its id is in this backend
          const home = lists.find((l) => l.kind === "collection") ?? lists[0];
          if (home) activate(home.id);
        }
      }),
    setListSort: (listId: string, sortBy: SortMode) =>
      act(() => repo.setListSort(listId, sortBy)),
    reorderList: (listId: string, from: number, to: number) =>
      act(() => repo.reorderList(listId, from, to)),
  };
}

export { DEFAULT_ID, WISHLIST_ID };
