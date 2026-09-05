"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository, type ListWithRecord, type Profile } from "@/lib/data";
import type { Vinyl } from "@/lib/types";
import { artistFromCatalogueTitle, artistSlug, matchArtists } from "@/lib/artist";

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
  /**
   * True when this row is a Discogs *master* — the canonical entry for an
   * album, standing above its forty pressings. Its id is not a release id, and
   * asking for it as one returns a different record entirely, so the flag has
   * to travel with the row all the way to the import.
   */
  isMaster?: boolean;
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
  /**
   * When the catalogue could not answer properly, and why.
   *
   * Kept separate from `results` because the two are not exclusive: a
   * throttled search often returns *some* rows, and showing them with no word
   * about the rest is how "no está en Discogs" gets believed about a record
   * that is. null means the answer is whole.
   */
  const [degraded, setDegraded] = useState<"rate-limit" | "down" | "partial" | null>(null);
  const [adding, setAdding] = useState<number | null>(null);
  const [savedIn, setSavedIn] = useState<Record<string, SaveRecord>>({});

  // ---- the catalogue, over the network -----------------------------------
  useEffect(() => {
    if (mode !== "vinyls" || !query.trim()) {
      setResults([]);
      setDegraded(null);
      return;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(query)}`);
        const data = await r.json();
        if (cancelled) return;
        setResults(data.results ?? []);
        setDegraded(r.ok ? (data.degraded ?? null) : "down");
      } catch {
        // the network, not them: same consequence, same honesty
        if (!cancelled) {
          setResults([]);
          setDegraded("down");
        }
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
   * Artists, which this search never offered.
   *
   * Typing a name gave you their records one by one and no way to ask the
   * obvious next question — what else of theirs is there. The rows come from
   * two places and cost nothing extra: your own library, grouped by name, and
   * the artist half of the catalogue rows already on screen. Discogs titles
   * are "Artist - Album", so that half is free; asking Discogs for artists
   * properly would be another query against a sixty-a-minute budget, for an
   * answer this one already contains.
   */
  const artists = useMemo(() => {
    if (mode !== "vinyls" || query.trim().length < 2) return [];
    const own = matchArtists(localVinilos, query.trim(), 4);
    const seen = new Set(own.map((a) => a.slug));
    const q = query.trim().toLowerCase();
    const fromCatalogue: { name: string; slug: string; records: Vinyl[] }[] = [];
    for (const r of results) {
      const name = artistFromCatalogueTitle(r.title);
      if (!name || !name.toLowerCase().includes(q)) continue;
      const slug = artistSlug(name);
      if (seen.has(slug)) continue;
      seen.add(slug);
      fromCatalogue.push({ name, slug, records: [] });
      if (own.length + fromCatalogue.length >= 5) break;
    }
    return [...own, ...fromCatalogue];
  }, [mode, query, localVinilos, results]);

  /**
   * Fetch the full release and put it in a list.
   *
   * Returns the vinyl so the caller can say its name in a toast — "Guardado"
   * on its own leaves you wondering what was.
   */
  /** el porqué del último «no», en las palabras del servidor */
  const lastError = useRef<string | null>(null);

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
          body: JSON.stringify({ releaseId: r.id, isMaster: r.isMaster }),
        });
        const data = await res.json();
        if (!data.vinyl) {
          /* El servidor sabe por qué ha dicho que no — «esto no es un vinilo,
             es un Blu-ray» — y esa frase vale mucho más que «no se pudo». Se
             guarda aquí para que quien haya llamado la enseñe. */
          lastError.current = typeof data.message === "string" ? data.message : null;
          return null;
        }
        lastError.current = null;
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

  /**
   * Una cara junto a cada artista.
   *
   * Antes esto preguntaba por cada artista en modo caché — y solo sabía
   * preguntar por los que tenían un disco tuyo con id de catálogo, que son
   * precisamente los que menos falta hacen. Los que salen de la búsqueda no
   * tenían ninguno, así que la lista entera se quedaba con el disco gris de
   * relleno.
   *
   * Ahora es una sola consulta por búsqueda, la misma que devuelve cien
   * artistas con su miniatura, y el servidor la guarda un mes. Las filas se
   * emparejan por slug: si el catálogo no conoce a alguien, esa fila se queda
   * sin cara y las demás no lo pagan.
   */
  const [artistPhotos, setArtistPhotos] = useState<Record<string, string>>({});
  const askedPhotos = useRef(new Set<string>());
  useEffect(() => {
    const q = query.trim();
    if (mode !== "vinyls" || q.length < 2 || artists.length === 0) return;
    const key = q.toLowerCase();
    if (askedPhotos.current.has(key)) return;
    let alive = true;
    const t = setTimeout(() => {
      askedPhotos.current.add(key);
      fetch(`/api/discogs/artist?photos=${encodeURIComponent(q)}`)
        .then((r) => r.json())
        .then((d: { artists?: { slug: string; image: string }[] }) => {
          if (!alive || !d?.artists?.length) return;
          setArtistPhotos((m) => {
            const next = { ...m };
            for (const a of d.artists!) if (!next[a.slug]) next[a.slug] = a.image;
            return next;
          });
        })
        .catch(() => {});
    }, 260);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [mode, query, artists.length]);

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
    artists,
    artistPhotos,
    lastError,
    people,
    communityLists,
    loading,
    /** null when the catalogue answered in full; see CatalogueNotice */
    degraded,
    adding,
    savedIn,
    addFromCatalogue,
    noteSave,
    forgetSave,
  };
}
