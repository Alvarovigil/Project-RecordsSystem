"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { type SortMode, DEFAULT_ID, WISHLIST_ID, loadActiveId, saveActiveId } from "@/lib/collections";
import { type List, type NewListInput } from "@/lib/data";
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
      /**
       * One request for every list, not one request per list.
       *
       * This used to fan out into `listItems` per list — seven lists, seven
       * round trips on a phone before the shelf could say how many records
       * were in anything. They ran in parallel, which hides it on a laptop and
       * does not on a connection where each one costs a hundred milliseconds
       * of latency it does not share.
       */
      const map = await repo.itemsOfLists(lists.map((l) => l.id));
      if (alive) setItemsByList(map);
    })();
  }, [lists, repo]);

  const idsOf = useCallback((listId: string) => itemsByList[listId] ?? [], [itemsByList]);

  const activate = useCallback((listId: string) => {
    setActiveListId(listId);
    saveActiveId(listId);
  }, []);

  // ---- actions: every one refreshes from the source of truth --------------
  /**
   * Do the thing, then re-read the truth.
   *
   * The re-read is the point — the database applies rules the client does not
   * know (the wishlist is exclusive, counters are triggers) so guessing the
   * new state is how the two drift apart. What it must not do is cost more
   * than the action did: this was `listLists` and then one request per list on
   * top of the refresh, so adding a single record fired nine requests before
   * the interface settled. That is the delay you feel after a tap.
   *
   * Now: the library and the lists together, then their contents in one go.
   * Three requests, whatever the shelf is holding.
   */
  const act = useCallback(
    async (fn: () => Promise<unknown>) => {
      await fn();
      const [r, l] = await Promise.all([repo.listReleases(), repo.listLists()]);
      setReleases(r);
      setLists(l);
      setItemsByList(await repo.itemsOfLists(l.map((x) => x.id)));
    },
    [repo],
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
