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
import {
  allUsers,
  friendsWithRecord,
  listsWithRecord,
  listsOfUser,
  getGeneratedList,
  getUser,
  loadFollows,
  saveFollows,
} from "@/lib/community";
import type {
  FeedEntry,
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
    if (!raw) return data as Vinyl[];
    const stored = JSON.parse(raw) as Vinyl[];
    const bundled = new Map((data as Vinyl[]).map((v) => [v.id, v]));
    // A copy saved before we had covers or previews for a record would keep
    // showing it as unplayable forever. Fill the gaps from the shipped
    // catalogue — but never resurrect a record the user deleted.
    return stored.map((v) => {
      const source = bundled.get(v.id);
      if (!source) return v;
      return {
        ...v,
        cover: v.cover ?? source.cover,
        previewUrl: v.previewUrl ?? source.previewUrl,
        palette: v.palette?.length ? v.palette : source.palette,
        tracklist: v.tracklist?.length ? v.tracklist : source.tracklist,
      };
    });
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

const communityUsers = allUsers;

/** One shape for every community list the placeholder layer hands out. */
function toCommunityList(
  l: { id: string; title: string; description: string; vinylIds: string[]; followers: number; updated: string },
  ownerId: string,
): ListWithRecord {
  const owner = getUser(ownerId);
  return {
    id: l.id,
    ownerId,
    title: l.title,
    slug: slugify(l.title),
    description: l.description,
    kind: "custom",
    visibility: "public",
    sortBy: "custom",
    position: 0,
    itemCount: l.vinylIds.length,
    updatedAt: l.updated,
    followers: l.followers,
    vinylIds: l.vinylIds,
    owner: {
      id: ownerId,
      username: owner?.handle ?? ownerId,
      displayName: owner?.name ?? ownerId,
      avatarUrl: null,
    },
  } as ListWithRecord;
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

    async setListVisibility(listId, visibility) {
      // nobody can see it yet, but the choice is yours and it travels with
      // the list when you sign in
      mutate((cols) => cols.map((c) => (c.id === listId ? { ...c, visibility } : c)));
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
      return listsWithRecord(releaseId, ids).map((l) => toCommunityList(l, l.ownerId));
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
      return listsOfUser(profileId, ids).map((l) => toCommunityList(l, profileId));
    },

    async releasesOfList(listId) {
      const all = readReleases();
      // yours, or one of the generated community lists
      const ids = listId.startsWith("cl-")
        ? (getGeneratedList(listId)?.vinylIds ?? [])
        : idsOf(listId);
      return ids.map((id) => all.find((v) => v.id === id)).filter((v): v is Vinyl => !!v);
    },

    // ---- discovery: placeholder people and lists ------------------------
    async searchProfiles(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      return communityUsers()
        .filter((u) => u.name.toLowerCase().includes(q) || u.handle.includes(q))
        .map((u) => ({
          id: u.id,
          username: u.handle,
          displayName: u.name,
          bio: u.bio,
          avatarUrl: null,
        }));
    },

    async searchLists(query) {
      const q = query.trim().toLowerCase();
      if (!q) return [];
      const ids = readReleases().map((v) => v.id);
      const seen = new Set<string>();
      const out: ListWithRecord[] = [];
      for (const user of communityUsers()) {
        for (const l of listsOfUser(user.id, ids)) {
          if (seen.has(l.id) || !l.title.toLowerCase().includes(q)) continue;
          seen.add(l.id);
          out.push(toCommunityList(l, user.id));
        }
      }
      return out;
    },

    async feed() {
      // Placeholder activity from what you follow. Lists are resolved through
      // the registry, not by scanning profiles: the same list has a different
      // generated id depending on whether you met it through a record or
      // through its owner.
      const followed = loadFollows();
      const all = readReleases();
      const ids = all.map((v) => v.id);

      const fromLists = followed
        .map(getGeneratedList)
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => toCommunityList(l, l.ownerId));

      const fromPeople = followed
        .filter((id) => id.startsWith("u-"))
        .flatMap((userId) => listsOfUser(userId, ids).map((l) => toCommunityList(l, userId)));

      const seen = new Set<string>();
      const lists = [...fromLists, ...fromPeople].filter((l) =>
        seen.has(l.id) ? false : (seen.add(l.id), true),
      );

      const entries = lists.flatMap((l) =>
        ((l as ListWithRecord & { vinylIds?: string[] }).vinylIds ?? [])
          .slice(0, 4)
          .map((releaseId, i) => {
            const release = all.find((v) => v.id === releaseId);
            if (!release) return null;
            return {
              at: new Date(Date.now() - (i + 1) * 36e5).toISOString(),
              actor: l.owner,
              listId: l.id,
              listTitle: l.title,
              listSlug: l.slug,
              release: {
                slug: release.id,
                title: release.title,
                artist: release.artist,
                cover: release.cover,
              },
            };
          })
          .filter(Boolean),
      ) as FeedEntry[];

      return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
    },

    async popularLists() {
      const ids = readReleases().map((v) => v.id);
      return communityUsers()
        .flatMap((u) => listsOfUser(u.id, ids).map((l) => toCommunityList(l, u.id)))
        .sort((a, b) => b.followers - a.followers)
        .slice(0, 12);
    },

    async suggestedProfiles() {
      return communityUsers().map((u) => ({
        id: u.id,
        username: u.handle,
        displayName: u.name,
        bio: u.bio,
        avatarUrl: null,
      }));
    },

    async followedLists() {
      // resolved from the registry: a list followed from a record's bridge is
      // generated from a different seed than the same list on its owner's
      // profile, so scanning profiles would miss it
      return loadFollows()
        .map(getGeneratedList)
        .filter((l): l is NonNullable<typeof l> => !!l)
        .map((l) => toCommunityList(l, l.ownerId));
    },

    async followersOf() {
      return [];
    },

    async followingOf() {
      const followed = new Set(loadFollows());
      return communityUsers()
        .filter((u) => followed.has(u.id))
        .map((u) => ({
          id: u.id,
          username: u.handle,
          displayName: u.name,
          bio: u.bio,
          avatarUrl: null,
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
