"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getRepository, type ListWithRecord, type Profile } from "@/lib/data";
import type { Vinyl } from "@/lib/types";
import { useWriteBlocked } from "./useSession";
import { artistFromCatalogueTitle, artistSlug, matchArtists } from "@/lib/artist";
import {
  CATALOGUE_DEBOUNCE_MS,
  catalogueQueryKey,
  createQueryCache,
  retryDelayMs,
  shouldSearchCatalogue,
} from "@/lib/catalogue-query";

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

/**
 * Lo que ya se preguntó, para no volver a preguntarlo.
 *
 * A nivel de módulo y no del hook: el buscador de escritorio, el del móvil y
 * Explorar son tres cuerpos para la misma pregunta, y lo que uno ya sabe no
 * tiene por qué volver a costarle el minuto al otro. Solo respuestas enteras.
 */
const recent = createQueryCache<DiscogsResult[]>({ max: 50, ttlMs: 5 * 60_000 });
/** hasta cuándo el catálogo ha pedido que no se le pregunte (epoch ms) */
let coolUntil = 0;

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

  /**
   * El catálogo ha pedido que se espere. Va aparte de `degraded` (que sigue
   * diciendo "rate-limit" para quien ya lo leía) para que la interfaz pueda
   * contar el tiempo: `retryInMs` es cuánto quedaba cuando se supo, no una
   * cuenta atrás viva.
   */
  const [rateLimited, setRateLimited] = useState(false);
  const [retryInMs, setRetryInMs] = useState<number | null>(null);

  // ---- the catalogue, over the network -----------------------------------
  /**
   * Una búsqueda por frase, no por letra.
   *
   * Antes salía una petición cada vez que el dedo se paraba 300 ms, desde la
   * primera letra, y ninguna se cancelaba: «fleetwood mac rumours» escrito a
   * ritmo de móvil eran dos o tres búsquedas enteras, y el servidor las
   * terminaba todas aunque ya nadie esperase la respuesta. Ahora:
   *
   * - se espera medio segundo después de la última tecla;
   * - con menos de tres letras no se pregunta (salvo un código de barras);
   * - la clave es el texto normalizado, así que un espacio de más no cuenta;
   * - lo que ya se preguntó hace poco sale de memoria, sin red;
   * - la petición anterior se aborta, y el servidor deja de gastar con ella;
   * - ante un 429 se espera lo que diga el servidor y se reintenta una vez.
   */
  const key = catalogueQueryKey(query);
  /**
   * «Buscar» o Intro: la persona ha terminado de escribir.
   *
   * El mínimo de tres letras es para no gastar el catálogo mientras se
   * teclea, no para negarle «U2» o «Yes» a quien ya ha dicho que es eso. Con
   * `searchNow()` la frase de ahora sale ya, sin espera y aunque sea corta.
   * Vale solo para esa frase: en cuanto cambia una letra, vuelven las reglas.
   */
  const [forcedKey, setForcedKey] = useState<string | null>(null);
  const force = forcedKey !== null && forcedKey === key;
  /** la última frase que llegó a salir a la red, para no repetirla al forzar */
  const firedKey = useRef<string | null>(null);
  const searchNow = useCallback(() => {
    if (mode !== "vinyls" || !key || firedKey.current === key) return;
    setForcedKey(key);
  }, [mode, key]);

  /**
   * La frase a la que el catálogo ya ha contestado (bien, a medias o con un
   * «no puedo»). Mientras no sea la de ahora, la respuesta está pendiente: en
   * la espera, en vuelo o sin preguntar (menos de tres letras). Sin esto, la
   * pantalla decía «Nada para «tusk»» antes de haber preguntado.
   */
  const [answeredKey, setAnsweredKey] = useState<string | null>(null);
  /** «Reintentar» tras un 429 o un 503: la misma frase, otra vez */
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => {
    if (mode !== "vinyls" || !key) return;
    firedKey.current = null;
    setForcedKey(key);
    setAttempt((n) => n + 1);
  }, [mode, key]);
  /**
   * La última tecla, sea la que sea. La clave ignora los espacios, así que el
   * espacio entre «radiohead» e «in» no cambiaba nada y la espera seguía
   * corriendo: quien escribe despacio disparaba una búsqueda a mitad de frase.
   */
  const typedAt = useRef(0);
  useEffect(() => {
    typedAt.current = Date.now();
  }, [query]);

  useEffect(() => {
    if (mode !== "vinyls" || !key) {
      setResults([]);
      setDegraded(null);
      setRateLimited(false);
      setRetryInMs(null);
      return;
    }
    if (!force && !shouldSearchCatalogue(key)) {
      // dos letras: tu estantería sí contesta, el catálogo todavía no
      setResults([]);
      setDegraded(null);
      setLoading(false);
      return;
    }
    const hit = recent.get(key);
    if (hit) {
      setResults(hit);
      setDegraded(null);
      setRateLimited(false);
      setRetryInMs(null);
      setLoading(false);
      setAnsweredKey(key);
      return;
    }

    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight = false;
    let retried = false;

    const run = async () => {
      // un espacio no cambia la clave, pero sí es una tecla: la espera vuelve a empezar
      const since = Date.now() - typedAt.current;
      if (!force && since < CATALOGUE_DEBOUNCE_MS) {
        timer = setTimeout(run, CATALOGUE_DEBOUNCE_MS - since);
        return;
      }
      inFlight = true;
      firedKey.current = key;
      setLoading(true);
      try {
        const r = await fetch(`/api/discogs/search?q=${encodeURIComponent(key)}`, {
          signal: controller.signal,
        });
        const data = await r.json().catch(() => ({}));
        if (controller.signal.aborted) return;
        if (r.status === 429) {
          const wait = retryDelayMs(data?.retryAfter, r.headers.get("Retry-After"));
          coolUntil = Math.max(coolUntil, Date.now() + wait);
          // las filas que sí llegaron se enseñan, con el aviso; si no llegó
          // ninguna, no se quedan las de la frase anterior
          setResults(Array.isArray(data?.results) ? data.results : []);
          setAnsweredKey(key);
          setDegraded("rate-limit");
          setRateLimited(true);
          setRetryInMs(wait);
          if (!retried) {
            retried = true;
            timer = setTimeout(run, wait);
          }
          return;
        }
        const rows: DiscogsResult[] = data?.results ?? [];
        const deg = r.ok ? (data?.degraded ?? null) : "down";
        setResults(rows);
        setDegraded(deg);
        setAnsweredKey(key);
        setRateLimited(false);
        setRetryInMs(null);
        if (r.ok && deg === null) recent.set(key, rows);
      } catch {
        // abortada: la siguiente búsqueda ya se encarga
        if (controller.signal.aborted) return;
        // the network, not them: same consequence, same honesty
        setResults([]);
        setDegraded("down");
        setAnsweredKey(key);
        // un «espera N s» de antes no puede quedarse encima de un «sin conexión»
        setRateLimited(false);
        setRetryInMs(null);
      } finally {
        inFlight = false;
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    // Si el catálogo pidió esperar, la siguiente sale cuando toque, no antes.
    const cooling = coolUntil - Date.now();
    if (cooling > 0) {
      setRateLimited(true);
      setRetryInMs(cooling);
      setDegraded("rate-limit");
    }
    timer = setTimeout(run, Math.max(force ? 0 : CATALOGUE_DEBOUNCE_MS, cooling));
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
      if (inFlight) {
        setLoading(false);
        // abortada a medias: si se vuelve a pedir, que salga
        if (firedKey.current === key) firedKey.current = null;
      }
    };
  }, [key, mode, force, attempt]);

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

  const blocked = useWriteBlocked();
  const addFromCatalogue = useCallback(
    async (
      r: DiscogsResult,
      listId: string,
      onSaveToList: (v: Vinyl, listId: string) => void,
    ): Promise<Vinyl | null> => {
      // La última red, por si algún botón no pasó por useEntryGate: sin
      // sesión no se importa nada (la importación escribe de verdad) ni se
      // guarda en la estantería de ejemplo.
      if (blocked) return null;
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
    [allVinilos, blocked],
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
  /* Se mira si hay artistas, no cuántos: cuando llegan las filas del catálogo
     la cuenta cambia, y eso no debe cancelar la petición de caras en vuelo. */
  const hasArtists = artists.length > 0;
  /* Solo detrás de la búsqueda principal, y cuando ya ha contestado a ESTA
     frase. Antes bastaba con que la frase pasara la puerta y llevara medio
     segundo quieta, así que las consultas intermedias — «radiohead», luego
     «radiohead in» — pedían cada una sus caras y gastaban del mismo minuto
     del catálogo que la búsqueda. Si la frase cambia antes de la respuesta,
     no sale nada. */
  const answered = answeredKey !== null && answeredKey === key;
  useEffect(() => {
    if (mode !== "vinyls" || !answered || !hasArtists) return;
    if (askedPhotos.current.has(key)) return;
    let alive = true;
    const controller = new AbortController();
    const t = setTimeout(() => {
      if (Date.now() < coolUntil) return;
      askedPhotos.current.add(key);
      fetch(`/api/discogs/artist?photos=${encodeURIComponent(key)}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((d: { artists?: { slug: string; image: string }[] }) => {
          if (!alive || !d?.artists?.length) return;
          setArtistPhotos((m) => {
            const next = { ...m };
            for (const a of d.artists!) if (!next[a.slug]) next[a.slug] = a.image;
            return next;
          });
        })
        .catch(() => {
          // abortada antes de contestar: que se pueda volver a pedir
          if (controller.signal.aborted) askedPhotos.current.delete(key);
        });
    }, 0);
    return () => {
      alive = false;
      clearTimeout(t);
      controller.abort();
    };
  }, [mode, key, hasArtists, answered]);

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
    /** el catálogo ha pedido esperar (429); las filas, si hay, van a medias */
    rateLimited,
    /** cuánto había que esperar cuando se supo, en ms; null si no hay espera */
    retryInMs,
    adding,
    savedIn,
    /** busca ya la frase de ahora, aunque tenga menos de tres letras */
    searchNow,
    /** vuelve a preguntar la frase de ahora tras un 429 o un 503 */
    retry,
    /**
     * El catálogo todavía no ha contestado a la frase de ahora: en la espera,
     * en vuelo o sin preguntar. Mientras sea true, no hay «nada» que decir.
     */
    pending: mode === "vinyls" && Boolean(key) && answeredKey !== key,
    /** menos de tres letras y sin «Buscar»: el catálogo no se pregunta solo */
    belowMinimum: mode === "vinyls" && Boolean(key) && !force && !shouldSearchCatalogue(key),
    addFromCatalogue,
    noteSave,
    forgetSave,
  };
}
