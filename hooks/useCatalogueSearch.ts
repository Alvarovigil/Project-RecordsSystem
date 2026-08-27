"use client";

import { useCallback, useEffect, useState } from "react";
import { getRepository, type ListWithRecord, type Profile } from "@/lib/data";
import type { Vinyl } from "@/lib/types";

/**
 * Searching for a record, wherever it happens to be.
 *
 * One question — "do I have this, and if not can I get it?" — answered from two
 * places at once: your own library, instantly and offline, and the Discogs
 * catalogue, over the network. Making someone choose the source first means
 * guessing, and they guess wrong about half the time.
 *
 * This lives in a hook rather than in the overlay because there are now two
 * bodies for it: a command palette on a desktop and a full screen on a phone.
 * They differ in every pixel and in not one line of logic — and the moment the
 * logic is copied instead of shared, one of them starts quietly missing a fix.
 */

export type DiscogsResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  genre?: string;
  cover_image?: string;
  thumb?: string;
  format?: string[];
};

/** What a save actually did, so undo can reverse exactly that. */
export type SaveRecord = { listId: string; vinylId: string; wasNew: boolean };

export function useCatalogueSearch({
  query,
  mode,
  localVinilos,
  allVinilos,
}: {
  query: string;
  mode: "vinyls" | "people";
  localVinilos: Vinyl[];
  allVinilos: Vinyl[];
}) {
  const [results, setResults] = useState<DiscogsResult[]>([]);
  const [people, setPeople] = useState<Profile[]>([]);
  const [communityLists, setCommunityLists] = useState<ListWithRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<number | null>(null);
  const [savedIn, setSavedIn] = useState<Record<string, SaveRecord>>({});

  // ---- the catalogue, over the network -----------------------------------
  useEffect(() => {
    if (mode !== "vinyls" || !query.trim()) {
      setResults([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(query)}`);
        const data = await r.json();
        if (!cancelled) setResults(data.results ?? []);
      } catch {
        if (!cancelled) setResults([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, mode]);

  // ---- people and lists, searched together --------------------------------
  useEffect(() => {
    if (mode !== "people" || !query.trim()) {
      setPeople([]);
      setCommunityLists([]);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      const repo = getRepository();
      const [p, l] = await Promise.all([repo.searchProfiles(query), repo.searchLists(query)]);
      if (cancelled) return;
      setPeople(p);
      setCommunityLists(l);
      setLoading(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query, mode]);

  // ---- your own shelf, instantly ------------------------------------------
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const localResults =
    mode === "vinyls" && query.trim()
      ? localVinilos.filter((v) => norm(`${v.title} ${v.artist}`).includes(norm(query.trim())))
      : [];

  // A catalogue hit for something already on your shelf would be a second copy
  // of the row above it; the local section already speaks for it.
  const addable = results.filter((r) => !localResults.some((v) => v.discogsId === r.id));

  /**
   * Fetch the full release and put it in a list.
   *
   * Returns the vinyl so the caller can say its name in a toast — "Guardado"
   * on its own leaves you wondering what was.
   */
  const addFromCatalogue = useCallback(
    async (
      r: DiscogsResult,
      listId: string,
      onSaveToList: (v: Vinyl, listId: string) => void,
    ): Promise<Vinyl | null> => {
      setAdding(r.id);
      try {
        const res = await fetch(`/api/discogs/release`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseId: r.id }),
        });
        const data = await res.json();
        if (!data.vinyl) return null;
        // whether it was new decides what undo has to do: leave the list, or
        // leave the library entirely
        const wasNew = !allVinilos.some((v) => v.id === data.vinyl.id);
        onSaveToList(data.vinyl, listId);
        setSavedIn((m) => ({ ...m, [`d${r.id}`]: { listId, vinylId: data.vinyl.id, wasNew } }));
        return data.vinyl as Vinyl;
      } catch {
        return null;
      } finally {
        setAdding(null);
      }
    },
    [allVinilos],
  );

  const noteSave = useCallback((key: string, record: SaveRecord) => {
    setSavedIn((m) => ({ ...m, [key]: record }));
  }, []);

  const forgetSave = useCallback((key: string) => {
    setSavedIn((m) => {
      const next = { ...m };
      delete next[key];
      return next;
    });
  }, []);

  return {
    localResults,
    addable,
    people,
    communityLists,
    loading,
    adding,
    savedIn,
    addFromCatalogue,
    noteSave,
    forgetSave,
  };
}
