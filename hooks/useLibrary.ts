"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { type SortMode, DEFAULT_ID, WISHLIST_ID, loadActiveId, saveActiveId } from "@/lib/collections";
import { type List, type NewListInput } from "@/lib/data";
import { useRepository } from "./useRepository";
import { repositoryKey } from "@/lib/data";
import { readSnapshot, writeSnapshot } from "@/lib/data/snapshot";
import { useToast } from "@/components/ui/Toast";

/** lo que la estantería sabe de tu biblioteca en un momento dado */
type LibState = {
  releases: Vinyl[];
  lists: List[];
  items: Record<string, string[]>;
};

/**
 * Por qué no se ha guardado, dicho como lo diría una persona.
 *
 * Tres causas reales: sin red (el metro), el servidor que dice que no, y el
 * navegador sin sitio (Safari privado, el disco lleno). Las dos primeras se
 * arreglan reintentando; la tercera no, así que no se ofrece «Reintentar»:
 * se dice cómo seguir.
 */
function failureOf(e: unknown, what: string): { text: string; retry: boolean } {
  const quota =
    e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
  if (quota)
    return { text: `${what}: el móvil no tiene espacio. Libera algo y vuelve a intentarlo.`, retry: false };
  const offline = typeof navigator !== "undefined" && navigator.onLine === false;
  const network = e instanceof TypeError || /fetch|network|conexi/i.test(String(e));
  if (offline || network) return { text: `${what}: no hay conexión.`, retry: true };
  return { text: `${what}.`, retry: true };
}

/** cómo se cuenta una escritura que falla y la que sale bien al reintentar */
type ActSay = {
  /** «No se ha guardado» por defecto; «No se ha borrado» en un borrado */
  failed?: string;
  /** lo que se confirma cuando «Reintentar» sí lo consigue */
  retried?: () => string | null;
};

/** el disco añadido a una lista, con lo que eso arrastra según su tipo */
function withAdded(s: LibState, release: Vinyl, listId: string): LibState {
  const target = s.lists.find((l) => l.id === listId);
  const items = { ...s.items };
  const add = (id: string) => {
    const cur = items[id] ?? [];
    if (!cur.includes(release.id)) items[id] = [...cur, release.id];
  };
  const drop = (id: string) => {
    items[id] = (items[id] ?? []).filter((x) => x !== release.id);
  };
  add(listId);
  // un rack de otra persona no toca tu colección ni tus deseos
  if (target && !target.sharedBy) {
    for (const l of s.lists) {
      if (l.id === listId || l.sharedBy) continue;
      if (target.kind === "wishlist") {
        if (l.kind !== "wishlist") drop(l.id);
      } else {
        if (l.kind === "wishlist") drop(l.id);
        // meterlo en un rack tuyo es tenerlo (0021)
        if (target.kind === "custom" && l.kind === "collection") add(l.id);
      }
    }
  }
  const releases = s.releases.some((v) => v.id === release.id) ? s.releases : [...s.releases, release];
  return { ...s, releases, items };
}

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
  const toast = useToast();
  /* lo último que se pintó, para el cambio optimista y su vuelta atrás: las
     acciones se llaman desde cierres de renders anteriores */
  const stateRef = useRef<LibState>({ releases, lists, items: itemsByList });
  stateRef.current = { releases, lists, items: itemsByList };
  /**
   * Do the thing, then re-read the truth.
   *
   * The re-read is the point — the database applies rules the client does not
   * know (the wishlist is exclusive, counters are triggers) so guessing the
   * new state is how the two drift apart. What it must not do is cost more
   * than the action did: the library and the lists together, then their
   * contents in one go. Three requests, whatever the shelf is holding.
   *
   * Lo que dices que pasó, pasó. Antes esto no tenía `catch` y todos lo
   * llamaban con `void`: el aviso de «Guardado» salía antes de saber nada, y
   * con el metro sin cobertura no se había guardado. Ahora:
   *
   *  - la estantería cambia ya (optimista), sin esperar los tres viajes;
   *  - si la escritura falla, vuelve a como estaba y lo dice con «Reintentar»;
   *  - devuelve si se ha guardado, para que quien lo llama solo diga «hecho»
   *    cuando está hecho.
   */
  type Act = (
    fn: () => Promise<unknown>,
    optimistic?: (s: LibState) => LibState,
    say?: ActSay,
    retrying?: boolean,
  ) => Promise<boolean>;
  const actRef = useRef<Act>(async () => false);
  const act = useCallback<Act>(
    async (fn, optimistic, say, retrying = false) => {
      const before = stateRef.current;
      if (optimistic) {
        const next = optimistic(before);
        stateRef.current = next;
        setReleases(next.releases);
        setLists(next.lists);
        setItemsByList(next.items);
      }
      try {
        await fn();
      } catch (e) {
        /* Vuelta a lo que había. No se relee: con la red caída la relectura
           también falla, y algunas lecturas devuelven vacío en vez de fallar —
           una estantería vacía es peor mentira que la que estamos arreglando. */
        if (optimistic) {
          stateRef.current = before;
          setReleases(before.releases);
          setLists(before.lists);
          setItemsByList(before.items);
        }
        const failure = failureOf(e, say?.failed ?? "No se ha guardado");
        toast.show(failure.text, {
          tone: "error",
          action: failure.retry
            ? { label: "Reintentar", onClick: () => void actRef.current(fn, optimistic, say, true) }
            : undefined,
        });
        return false;
      }
      // el primer intento lo confirma quien lo pidió; un reintento no tiene a
      // nadie esperando, así que lo confirma aquí
      if (retrying) {
        const ok = say?.retried?.();
        if (ok) toast.show(ok);
      }
      try {
        const [r, l] = await Promise.all([repo.listReleases(), repo.listLists()]);
        const items = await repo.itemsOfLists(l.map((x) => x.id));
        setReleases(r);
        setLists(l);
        setItemsByList(items);
        // the snapshot follows every write, so the next cold start opens on
        // what you actually did rather than on the shelf as it was before
        writeSnapshot(repositoryKey(), { releases: r, lists: l, items, at: Date.now() });
      } catch {
        /* lo escrito está escrito; la próxima lectura pondrá al día el resto */
      }
      return true;
    },
    [repo, toast],
  );
  actRef.current = act;

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
      act(
        async () => {
          await repo.upsertRelease(release);
          await repo.addToList(listId, release.id);
        },
        (s) => withAdded(s, release, listId),
        {
          retried: () => {
            const title = stateRef.current.lists.find((l) => l.id === listId)?.title;
            return title ? `Añadido a ${title}` : "Añadido";
          },
        },
      ),
    removeFromList: (listId: string, releaseId: string) =>
      act(
        () => repo.removeFromList(listId, releaseId),
        (s) => ({
          ...s,
          items: { ...s.items, [listId]: (s.items[listId] ?? []).filter((x) => x !== releaseId) },
        }),
      ),
    deleteRelease: (releaseId: string) =>
      act(
        () => repo.deleteRelease(releaseId),
        (s) => ({
          ...s,
          releases: s.releases.filter((v) => v.id !== releaseId),
          items: Object.fromEntries(
            Object.entries(s.items).map(([k, ids]) => [k, ids.filter((x) => x !== releaseId)]),
          ),
        }),
        { failed: "No se ha borrado" },
      ),
    /**
     * Dejar un disco exactamente donde estaba: el «Deshacer» de verdad.
     *
     * `inLibrary` falso es «no lo tenías»: sale de la biblioteca entera.
     * Si no, se quita de donde no estaba y se devuelve a donde sí, primero la
     * colección o los deseos (que deciden lo demás) y después los racks.
     */
    restoreRecord: (release: Vinyl, before: { inLibrary: boolean; lists: string[] }) =>
      act(
        async () => {
          if (!before.inLibrary) return repo.deleteRelease(release.id);
          /* Borrar quita la ficha de tu biblioteca (en local, de la lista de
             discos; en Supabase, sus filas). Sin volver a crearla, devolverlo
             a las listas no devolvía nada: en local la colección se deriva
             de los discos y `addToList(DEFAULT_ID)` no guarda. */
          await repo.upsertRelease(release);
          const ls = await repo.listLists();
          const now = await repo.itemsOfLists(ls.map((l) => l.id));
          const had = new Set(before.lists);
          for (const l of ls) {
            if (!had.has(l.id) && now[l.id]?.includes(release.id)) {
              await repo.removeFromList(l.id, release.id);
            }
          }
          const kindOf = (id: string) => ls.find((l) => l.id === id)?.kind ?? "custom";
          const order = [...before.lists].sort(
            (a, b) => Number(kindOf(a) === "custom") - Number(kindOf(b) === "custom"),
          );
          for (const id of order) {
            if (!now[id]?.includes(release.id)) await repo.addToList(id, release.id);
          }
        },
        (s) =>
          before.inLibrary
            ? {
                ...s,
                releases: s.releases.some((v) => v.id === release.id)
                  ? s.releases
                  : [...s.releases, release],
                items: Object.fromEntries(
                  Object.entries(s.items).map(([k, ids]) => {
                    const keep = before.lists.includes(k);
                    const has = ids.includes(release.id);
                    if (keep && !has) return [k, [...ids, release.id]];
                    if (!keep && has) return [k, ids.filter((x) => x !== release.id)];
                    return [k, ids];
                  }),
                ),
              }
            : {
                ...s,
                releases: s.releases.filter((v) => v.id !== release.id),
                items: Object.fromEntries(
                  Object.entries(s.items).map(([k, ids]) => [k, ids.filter((x) => x !== release.id)]),
                ),
              },
      ),
    /**
     * Quedarse con otra portada del mismo disco.
     *
     * No pasa por `upsertRelease`: esa función deja la ficha compartida como
     * está si el disco ya existe — y hace bien, porque el catálogo es de todos
     * y una corrección tuya no puede cambiar la estantería de los demás. La
     * elección se guarda aparte y se superpone al leer.
     */
    setCover: (release: Vinyl, cover: string) =>
      act(() => repo.setReleaseCover(release.id, cover), undefined, {
        failed: "No se ha guardado la portada",
      }),
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
