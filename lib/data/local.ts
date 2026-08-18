/**
 * localStorage backend — what the app runs on until Supabase is connected.
 *
 * It keeps today's exact behaviour (including the derived "Mi Colección" and
 * the exclusive wishlist) behind the repository interface, so the switch to
 * the real backend is a one-line change in lib/data/index.ts.
 */
import data from "@/data/vinilos.json";
import type { Vinyl } from "@/lib/types";
import {
  type Collection,
  type SortMode,
  DEFAULT_ID,
  WISHLIST_ID,
  loadCollections,
  saveCollections,
  newCollection,
} from "@/lib/collections";
import { friendsWithRecord, listsWithRecord, listsOfUser, getUser, loadFollows, saveFollows } from "@/lib/community";
import type {
  FriendWithRecord,
  LibraryRepository,
  List,
  ListVisibility,
  ListWithRecord,
  NewListInput,
  Profile,
} from "./types";

const RELEASES_KEY = "vinilos.releases.v1";
const LOCAL_PROFILE: Profile = {
  id: "local",
  username: "yo",
  displayName: "Mi biblioteca",
  bio: "",
  avatarUrl: null,
};

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "lista";

function readReleases(): Vinyl[] {
  if (typeof window === "undefined") return data as Vinyl[];
  try {
    const raw = localStorage.getItem(RELEASES_KEY);
    if (raw) return JSON.parse(raw) as Vinyl[];
  } catch {}
  return data as Vinyl[];
}

function writeReleases(list: Vinyl[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(RELEASES_KEY, JSON.stringify(list));
}

function collectionsOf(): Collection[] {
  return loadCollections(readReleases().map((v) => v.id));
}

function toList(
  c: Collection,
  index: number,
  releases: Vinyl[],
  wished: Set<string>,
): List {
  const kind = c.id === DEFAULT_ID ? "collection" : c.id === WISHLIST_ID ? "wishlist" : "custom";
  // Mi Colección is derived, never stored: the library minus what is wished
  const ids =
    kind === "collection"
      ? releases.map((v) => v.id).filter((id) => !wished.has(id))
      : c.vinylIds;
  return {
    id: c.id,
    ownerId: LOCAL_PROFILE.id,
    title: c.name,
    slug: slugify(c.name),
    description: "",
    kind,
    visibility: kind === "wishlist" ? "private" : "public",
    sortBy: c.sortBy ?? "custom",
    position: index,
    itemCount: ids.length,
    updatedAt: new Date(0).toISOString(),
  };
}

export function createLocalRepository(): LibraryRepository {
  const mutate = (fn: (cols: Collection[]) => Collection[]) => {
    const next = fn(collectionsOf());
    saveCollections(next);
  };

  /** the derived collection is computed, every other list is stored */
  const idsOf = (listId: string): string[] => {
    const cols = collectionsOf();
    if (listId === DEFAULT_ID) {
      const wished = new Set(cols.find((c) => c.id === WISHLIST_ID)?.vinylIds ?? []);
      return readReleases().map((v) => v.id).filter((id) => !wished.has(id));
    }
    return cols.find((c) => c.id === listId)?.vinylIds ?? [];
  };

  return {
    async getCurrentProfile() {
      return LOCAL_PROFILE;
    },

    async listReleases() {
      return readReleases();
    },

    async upsertRelease(release) {
      const all = readReleases();
      if (!all.some((v) => v.id === release.id)) writeReleases([...all, release]);
      return release;
    },

    async deleteRelease(releaseId) {
      writeReleases(readReleases().filter((v) => v.id !== releaseId));
      mutate((cols) =>
        cols.map((c) => ({ ...c, vinylIds: c.vinylIds.filter((id) => id !== releaseId) })),
      );
    },

    async listLists() {
      const releases = readReleases();
      const cols = collectionsOf();
      const wished = new Set(cols.find((c) => c.id === WISHLIST_ID)?.vinylIds ?? []);
      return cols.map((c, i) => toList(c, i, releases, wished));
    },

    async createList({ title }) {
      const c = newCollection(title);
      mutate((cols) => [...cols, c]);
      return toList(c, 99, readReleases(), new Set());
    },

    async renameList(listId, title) {
      mutate((cols) => cols.map((c) => (c.id === listId ? { ...c, name: title } : c)));
    },

    async deleteList(listId) {
      if (listId === DEFAULT_ID || listId === WISHLIST_ID) return;
      mutate((cols) => cols.filter((c) => c.id !== listId));
    },

    async setListSort(listId, sortBy: SortMode) {
      mutate((cols) => cols.map((c) => (c.id === listId ? { ...c, sortBy } : c)));
    },

    async setListVisibility(_listId: string, _visibility: ListVisibility) {
      // local backend has no audience: everything is yours alone
    },

    async listItems(listId) {
      return idsOf(listId);
    },

    async addToList(listId, releaseId) {
      const toWishlist = listId === WISHLIST_ID;
      mutate((cols) =>
        cols.map((c) => {
          // the derived collection stores nothing: joining it just means
          // leaving the wishlist
          if (listId === DEFAULT_ID) {
            return c.id === WISHLIST_ID
              ? { ...c, vinylIds: c.vinylIds.filter((id) => id !== releaseId) }
              : c;
          }
          if (c.id === listId) {
            return c.vinylIds.includes(releaseId)
              ? c
              : { ...c, vinylIds: [...c.vinylIds, releaseId] };
          }
          // owned or wished, never both
          if (toWishlist || c.id === WISHLIST_ID) {
            return { ...c, vinylIds: c.vinylIds.filter((id) => id !== releaseId) };
          }
          return c;
        }),
      );
    },

    async removeFromList(listId, releaseId) {
      mutate((cols) =>
        cols.map((c) =>
          c.id === listId
            ? { ...c, vinylIds: c.vinylIds.filter((id) => id !== releaseId) }
            : c,
        ),
      );
    },

    async reorderList(listId, fromIndex, toIndex) {
      mutate((cols) =>
        cols.map((c) => {
          if (c.id !== listId) return c;
          const ids = [...c.vinylIds];
          const [moved] = ids.splice(fromIndex, 1);
          ids.splice(toIndex, 0, moved);
          return { ...c, vinylIds: ids, sortBy: "custom" };
        }),
      );
    },

    // ---- community: placeholder data until the backend lands --------------
    async listsWithRelease(releaseId) {
      const ids = readReleases().map((v) => v.id);
      return listsWithRecord(releaseId, ids).map((l) => {
        const owner = getUser(l.ownerId)!;
        return {
          id: l.id,
          ownerId: l.ownerId,
          title: l.title,
          slug: slugify(l.title),
          description: l.description,
          kind: "custom" as const,
          visibility: "public" as const,
          sortBy: "custom" as SortMode,
          position: 0,
          itemCount: l.vinylIds.length,
          updatedAt: l.updated,
          followers: l.followers,
          owner: {
            id: owner.id,
            username: owner.handle,
            displayName: owner.name,
            avatarUrl: null,
          },
        };
      });
    },

    async friendsWithRelease(releaseId): Promise<FriendWithRecord[]> {
      const ids = readReleases().map((v) => v.id);
      return friendsWithRecord(releaseId, ids).map((f) => ({
        user: {
          id: f.user.id,
          username: f.user.handle,
          displayName: f.user.name,
          avatarUrl: null,
        },
        viaListId: f.viaListId,
        viaListTitle: f.viaListTitle,
      }));
    },

    async getProfile(username) {
      const u = getUser(username) ?? null;
      return u
        ? { id: u.id, username: u.handle, displayName: u.name, bio: u.bio, avatarUrl: null }
        : null;
    },

    async listsOfProfile(profileId): Promise<ListWithRecord[]> {
      const ids = readReleases().map((v) => v.id);
      const owner = getUser(profileId);
      return listsOfUser(profileId, ids).map((l) => ({
        id: l.id,
        ownerId: profileId,
        title: l.title,
        slug: slugify(l.title),
        description: l.description,
        kind: "custom" as const,
        visibility: "public" as const,
        sortBy: "custom" as SortMode,
        position: 0,
        itemCount: l.vinylIds.length,
        updatedAt: l.updated,
        followers: l.followers,
        owner: {
          id: profileId,
          username: owner?.handle ?? profileId,
          displayName: owner?.name ?? profileId,
          avatarUrl: null,
        },
      }));
    },

    async follow(_kind, id) {
      const next = [...new Set([...loadFollows(), id])];
      saveFollows(next);
    },

    async unfollow(_kind, id) {
      saveFollows(loadFollows().filter((x) => x !== id));
    },

    async following() {
      const all = loadFollows();
      return { profiles: all.filter((id) => id.startsWith("u-")), lists: all.filter((id) => id.startsWith("cl-")) };
    },
  };
}
