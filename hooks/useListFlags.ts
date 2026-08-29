"use client";

import { useCallback, useSyncExternalStore } from "react";
import { getRepository, repositoryKey, subscribeRepository } from "@/lib/data";
import type { LibraryRepository } from "@/lib/data/types";

/**
 * Lo que has hecho tú con una lista: la tienes guardada, le has dado al
 * corazón. Dos banderas, una máquina.
 *
 * Se comparte a nivel de módulo por dos razones, y las dos se ven en pantalla:
 *
 * **No es N+1.** Un corazón por tarjeta preguntando "¿ésta la he marcado?" son
 * catorce viajes para catorce booleanos, y llegan desordenados: la fila de
 * corazones se rellena a trompicones. Se pregunta una vez por pantalla.
 *
 * **La misma lista aparece dos veces.** En el carril de Explorar y en la ficha
 * que abres encima; en la cabecera de la lista y en la tarjeta de la que
 * viniste. Con estado local, una se entera y la otra no, y el usuario ve dos
 * respuestas distintas a la misma pregunta.
 *
 * Optimista, y con memoria de lo que dijo el servidor: los contadores vienen
 * del backend y ya te incluyen si marcaste ayer, así que comparar contra esa
 * línea base es lo que convierte "¿lo he marcado?" en "¿el número necesita un
 * +1?" sin volver a pedir la lista para mover un dígito.
 */

type Flag = {
  read: (repo: LibraryRepository) => Promise<string[]>;
  write: (repo: LibraryRepository, listId: string, on: boolean) => Promise<void>;
};

function createFlagStore({ read, write }: Flag) {
  let ids: Set<string> | null = null;
  /** lo que sabía el servidor cuando cargamos; un toggle no lo toca */
  let baseline = new Set<string>();
  let loading: Promise<void> | null = null;
  const listeners = new Set<() => void>();
  /** el snapshot se compara por identidad: cambia cuando cambia el conjunto */
  let snapshot: ReadonlySet<string> = new Set<string>();

  const publish = () => {
    snapshot = new Set(ids ?? []);
    listeners.forEach((l) => l());
  };

  // entrar con tu cuenta cambia el backend debajo: lo que habías marcado sin
  // sesión no viaja contigo, y seguir enseñándolo sería mentir
  subscribeRepository(() => {
    ids = null;
    baseline = new Set();
    loading = null;
    publish();
  });

  const load = () => {
    if (ids || loading) return;
    loading = read(getRepository())
      .then((all) => {
        ids = new Set(all);
        baseline = new Set(all);
        publish();
      })
      .catch(() => {
        // sin sesión no hay nada marcado: un conjunto vacío es la respuesta
        // honesta, y deja que el corazón se dibuje en vez de dejar un hueco
        ids = new Set();
        baseline = new Set();
        publish();
      })
      .finally(() => {
        loading = null;
      });
  };

  return function useFlag() {
    const current = useSyncExternalStore(
      (cb) => {
        listeners.add(cb);
        load();
        return () => listeners.delete(cb);
      },
      () => snapshot,
      () => snapshot,
    );

    const toggle = useCallback(async (listId: string, next?: boolean) => {
      const was = (ids ?? new Set()).has(listId);
      const on = next ?? !was;
      if (on === was) return on;
      ids = new Set(ids ?? []);
      if (on) ids.add(listId);
      else ids.delete(listId);
      publish();
      try {
        await write(getRepository(), listId, on);
        return on;
      } catch (e) {
        ids = new Set(ids);
        if (was) ids.add(listId);
        else ids.delete(listId);
        publish();
        throw e;
      }
    }, []);

    return {
      has: (listId: string) => current.has(listId),
      /** lo que hay que sumarle al contador del backend para que cuadre */
      delta: (listId: string) =>
        (current.has(listId) ? 1 : 0) - (baseline.has(listId) ? 1 : 0),
      toggle,
      /** hasta que no ha cargado, el botón no sabe qué cara poner */
      ready: ids !== null,
    };
  };
}

export const useLikes = createFlagStore({
  read: (repo) => repo.likedLists(),
  write: (repo, id, on) => (on ? repo.likeList(id) : repo.unlikeList(id)),
});

export const useSaves = createFlagStore({
  read: (repo) => repo.savedLists().then((ls) => ls.map((l) => l.id)),
  write: (repo, id, on) => (on ? repo.saveList(id) : repo.unsaveList(id)),
});

/** la clave sobre la que se reconstruye todo, expuesta para tests */
export const flagsKey = repositoryKey;
