import { DEMO_LISTS, DEMO_WISHLIST } from "@/lib/demo";

export type SortMode =
  | "custom"
  | "added"
  | "year"
  | "artistAZ"
  | "artistZA"
  | "titleAZ"
  | "titleZA";

export const SORT_LABELS: Record<SortMode, string> = {
  custom: "Personalizado",
  added: "Fecha de incorporación",
  year: "Año del álbum",
  artistAZ: "Artista A–Z",
  artistZA: "Artista Z–A",
  titleAZ: "Álbum A–Z",
  titleZA: "Álbum Z–A",
};

export type Collection = {
  id: string;
  name: string;
  vinylIds: string[];
  sortBy?: SortMode;
  /** what the list IS. Never infer this from the id: with an account the
   *  predefined lists are database uuids, not the local constants. */
  kind?: "collection" | "wishlist" | "custom";
  /** who can see it once you have an account; local-only lists keep it too */
  visibility?: "public" | "unlisted" | "private";
  /** somebody else's list that you have been invited to edit */
  sharedBy?: { id: string; username: string; displayName: string };
};

const KEY = "vinilos.collections.v1";
const ACTIVE_KEY = "vinilos.activeCollection";

export const DEFAULT_ID = "default";
export const WISHLIST_ID = "wishlist";
export const PRIMARY_IDS = [DEFAULT_ID, WISHLIST_ID] as const;

/**
 * A first-run shelf is the preview: the curated lists come along so that
 * someone arriving without an account lands in a collection with a point of
 * view, not in an empty grid. Filtered against the catalogue actually present,
 * so a trimmed data file can never seed a list pointing at nothing.
 */
const seedCollections = (allIds: string[]): Collection[] => {
  const have = new Set(allIds);
  const keep = (ids: string[]) => ids.filter((id) => have.has(id));
  return [
    { id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds, sortBy: "custom" },
    ...DEMO_LISTS.map((l) => ({
      id: l.id,
      name: l.name,
      vinylIds: keep(l.vinylIds),
      sortBy: "custom" as SortMode,
      kind: "custom" as const,
      visibility: "public" as const,
    })).filter((l) => l.vinylIds.length > 0),
    {
      id: WISHLIST_ID,
      name: "Lista de deseos",
      vinylIds: keep(DEMO_WISHLIST),
      sortBy: "custom",
    },
  ];
};

export function loadCollections(allIds: string[]): Collection[] {
  if (typeof window === "undefined") return seedCollections(allIds);
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Collection[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // ensure the two primary lists always exist
        const out = [...parsed];
        if (!out.some((c) => c.id === DEFAULT_ID)) {
          out.unshift({ id: DEFAULT_ID, name: "Mi Colección", vinylIds: allIds, sortBy: "custom" });
        }
        if (!out.some((c) => c.id === WISHLIST_ID)) {
          out.push({ id: WISHLIST_ID, name: "Lista de deseos", vinylIds: [], sortBy: "custom" });
        }
        return out;
      }
    }
  } catch {}
  return seedCollections(allIds);
}

export function saveCollections(cols: Collection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cols));
}

export function loadActiveId(): string {
  if (typeof window === "undefined") return DEFAULT_ID;
  return localStorage.getItem(ACTIVE_KEY) || DEFAULT_ID;
}

export function saveActiveId(id: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVE_KEY, id);
}

/**
 * "Mi Colección" is DERIVED, never stored: it is everything in your library
 * that isn't wished. A record saved into any custom list therefore shows up
 * here too, and taking it out of a list never makes it disappear from the
 * library. The wishlist is the exception — it lives on its own and a record
 * is either owned or wished, never both.
 */
export function resolveCollections(cols: Collection[], allVinylIds: string[]): Collection[] {
  const wished = new Set(cols.find((c) => c.id === WISHLIST_ID)?.vinylIds ?? []);
  const owned = allVinylIds.filter((id) => !wished.has(id));
  return cols.map((c) => (c.id === DEFAULT_ID ? { ...c, vinylIds: owned } : c));
}

/** Neither of the two predefined lists can be deleted. */
export function isDeletable(id: string) {
  return id !== DEFAULT_ID && id !== WISHLIST_ID;
}

export function newCollection(name: string): Collection {
  return { id: `col-${Date.now()}`, name, vinylIds: [], sortBy: "custom" };
}

import type { Vinyl } from "./types";

export function sortedVinylIds(c: Collection, all: Vinyl[]): string[] {
  const items = c.vinylIds
    .map((id) => all.find((v) => v.id === id))
    .filter((v): v is Vinyl => !!v);
  const sortBy = c.sortBy ?? "custom";
  let out = items;
  if (sortBy === "added") {
    // most recently added first; vinylIds is the insertion order, so reverse it
    out = [...items].reverse();
  } else if (sortBy === "year") {
    out = [...items].sort((a, b) => (a.year || 0) - (b.year || 0));
  } else if (sortBy === "artistAZ") {
    out = [...items].sort((a, b) => a.artist.localeCompare(b.artist));
  } else if (sortBy === "artistZA") {
    out = [...items].sort((a, b) => b.artist.localeCompare(a.artist));
  } else if (sortBy === "titleAZ") {
    out = [...items].sort((a, b) => a.title.localeCompare(b.title));
  } else if (sortBy === "titleZA") {
    out = [...items].sort((a, b) => b.title.localeCompare(a.title));
  }
  return out.map((v) => v.id);
}
