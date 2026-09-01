"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { type SortMode, DEFAULT_ID, WISHLIST_ID, loadActiveId, saveActiveId } from "@/lib/collections";
import { type List, type NewListInput } from "@/lib/data";
import { useRepository } from "./useRepository";
import { repositoryKey } from "@/lib/data";
import { readSnapshot, writeSnapshot } from "@/lib/data/snapshot";

/**
 * Your library: records, lists and everything you can do to them.
 *
 * Components never touch storage — they call these actions. Swapping the
 * backend (localStorage → Supabase) changes nothing here.
 */
export function useLibrary() {
  const repo = useRepository();

  /**
   * Open on what this device already knew, then correct it.
   *
   * The initial state used to be empty, so every mount of the shelf — a cold
   * launch, or simply coming back from Explorar — went blank and waited three
   * round trips before it could draw a single sleeve. The snapshot is read
   * synchronously during the first render, which means the collection is on
   * screen in the same frame the component mounts. See lib/data/snapshot.
   */
  const seed = useMemo(() => readSnapshot(repositoryKey()), [repo]);

  const [releases, setReleases] = useState<Vinyl[]>(seed?.releases ?? []);
  const [lists, setLists] = useState<List[]>(seed?.lists ?? []);
  const [activeListId, setActiveListId] = useState<string>(DEFAULT_ID);
  /**
   * `ready` means "there is something to draw", not "the network has spoken".
   *
   * A loader shown over data that is already correct is a loader that exists
   * to describe the transport rather than the content, and it is exactly what
   * made moving between screens feel like page loads.
   */
  const [ready, setReady] = useState(Boolean(seed));

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
      const items = await repo.itemsOfLists(l.map((x) => x.id));
      if (!alive) return;
      setItemsByList(items);
      writeSnapshot(repositoryKey(), { releases: r, lists: l, items, at: Date.now() });
    })();
    return () => {
      alive = false;
    };
  }, [repo]);

  const activeList = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;

  /** ids of the records in a list, honouring its sort */
  const [itemsByList, setItemsByList] = useState<Record<string, string[]>>(seed?.items ?? {});
  useEffect(() => {
    // the mount above already fetched these once; this effect exists for the
    // times the set of lists changes underneath us
    if (lists.length === 0) return;
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
      const items = await repo.itemsOfLists(l.map((x) => x.id));
      setReleases(r);
      setLists(l);
      setItemsByList(items);
      // the snapshot follows every write, so the next cold start opens on what
      // you actually did rather than on the shelf as it was two sessions ago
      writeSnapshot(repositoryKey(), { releases: r, lists: l, items, at: Date.now() });
    },
    [repo],
  );

  return {
    ready,
    /** the first paint came from the snapshot, not from the network */
    fromCache: Boolean(seed),
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
