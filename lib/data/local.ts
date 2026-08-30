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
import { DEMO_FRIENDS, DEMO_LISTS, DEMO_PROFILE } from "@/lib/demo";
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
  Collaborator,
  ActivityEvent,
  FriendWithRecord,
  LibraryRepository,
  List,
  ListVisibility,
  ListWithRecord,
  NewListInput,
  Notification,
  Profile,
  ProfilePatch,
  ProfileStats,
  Relationship,
  SavedList,
} from "./types";
import {
  collaboratorsOf as readCollaborators,
  getAddedBy,
  hasSeededNotifications,
  isLiked,
  isSaved,
  loadLiked,
  setLiked,
  listsIveJoined,
  loadNotifications,
  loadProfileOverrides,
  loadSaved,
  markAllRead,
  markSeeded,
  newId,
  pushNotification,
  saveNotifications,
  saveProfileOverrides,
  setAddedBy,
  setCollaborators,
  setSaved,
} from "./local-community";

const RELEASES_KEY = "vinilos.releases.v1";
// Without an account you are borrowing the preview's identity: a collector who
// already has lists, friends and taste. See lib/demo.ts.
const BASE_PROFILE: Profile = DEMO_PROFILE;

/** The preview collector, plus anything you edited about them. */
function localProfile(): Profile {
  const o = loadProfileOverrides();
  return {
    ...BASE_PROFILE,
    ...(o.displayName ? { displayName: o.displayName } : {}),
    ...(o.username ? { username: o.username } : {}),
    ...(o.bio !== undefined ? { bio: o.bio } : {}),
    ...(o.avatarUrl !== undefined ? { avatarUrl: o.avatarUrl } : {}),
  };
}

/**
 * Kept as a getter-backed object so the many existing references to
 * `LOCAL_PROFILE.username` keep working while the value itself becomes
 * editable. Replacing ~20 call sites with a function call would have been the
 * same change written louder.
 */
const LOCAL_PROFILE: Profile = {
  get id() {
    return BASE_PROFILE.id;
  },
  get username() {
    return localProfile().username;
  },
  get displayName() {
    return localProfile().displayName;
  },
  get bio() {
    return localProfile().bio;
  },
  get avatarUrl() {
    return localProfile().avatarUrl;
  },
} as Profile;

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
    saves: 0,
    likes: 0,
  };
}

const communityUsers = allUsers;

/** One shape for every community list the placeholder layer hands out. */
function toCommunityList(
  l: {
    id: string;
    title: string;
    description: string;
    vinylIds: string[];
    saves: number;
    likes: number;
    updated: string;
  },
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
    // lo que la gente de mentira ya había hecho, más lo tuyo: si guardas o
    // das me gusta a una lista, el número que ves tiene que moverse
    saves: l.saves + (isSaved(l.id) ? 1 : 0),
    likes: l.likes + (isLiked(l.id) ? 1 : 0),
    vinylIds: l.vinylIds,
    owner: {
      id: ownerId,
      username: owner?.handle ?? ownerId,
      displayName: owner?.name ?? ownerId,
      avatarUrl: null,
    },
  } as ListWithRecord;
}

/** Your own lists as a visitor would see them: public ones, owner attached. */
function ownLists(releases: Vinyl[]): ListWithRecord[] {
  const cols = collectionsOf();
  const wished = new Set(cols.find((c) => c.id === WISHLIST_ID)?.vinylIds ?? []);
  return cols
    .filter((c) => c.id !== WISHLIST_ID && (c.visibility ?? "public") === "public")
    .map((c, i) => {
      const base = toList(c, i, releases, wished);
      const ids = c.id === DEFAULT_ID ? releases.map((v) => v.id).filter((id) => !wished.has(id)) : c.vinylIds;
      return {
        ...base,
        description: DEMO_LISTS.find((d) => d.id === c.id)?.description ?? base.description,
        vinylIds: ids,
        owner: {
          id: LOCAL_PROFILE.id,
          username: LOCAL_PROFILE.username,
          displayName: LOCAL_PROFILE.displayName,
          avatarUrl: LOCAL_PROFILE.avatarUrl,
        },
      } as ListWithRecord;
    });
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

    async itemsOfLists(listIds) {
      const out: Record<string, string[]> = {};
      for (const id of listIds) out[id] = idsOf(id);
      return out;
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
      if (username === LOCAL_PROFILE.id || username === LOCAL_PROFILE.username) {
        return LOCAL_PROFILE;
      }
      const u = getUser(username) ?? null;
      return u
        ? { id: u.id, username: u.handle, displayName: u.name, bio: u.bio, avatarUrl: null }
        : null;
    },

    async listsOfProfile(profileId): Promise<ListWithRecord[]> {
      if (profileId === LOCAL_PROFILE.id || profileId === LOCAL_PROFILE.username) {
        return ownLists(readReleases());
      }
      const ids = readReleases().map((v) => v.id);
      return listsOfUser(profileId, ids).map((l) => toCommunityList(l, profileId));
    },

    async coversOfLists(listIds) {
      const all = readReleases();
      const out: Record<string, string[]> = {};
      for (const id of listIds) {
        const ids = id.startsWith("cl-") ? (getGeneratedList(id)?.vinylIds ?? []) : idsOf(id);
        // vinylIds is insertion order, so the last three added are the tail
        out[id] = [...ids]
          .reverse()
          .map((r) => all.find((v) => v.id === r))
          .filter((v): v is Vinyl => Boolean(v))
          .slice(0, 6)
          .map((v) => v.cover ?? "")
          .filter(Boolean);
      }
      return out;
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

    async activity(): Promise<ActivityEvent[]> {
      // The placeholder layer has no event log — nothing here ever happened —
      // so activity is derived from the same generated community the rest of
      // the local backend uses, with times spread backwards from now. It is a
      // rehearsal of the real screen, and it has to contain all four verbs or
      // it stops being useful for building the thing.
      const followed = loadFollows();
      const all = readReleases();
      const ids = all.map((v) => v.id);
      const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
      const out: ActivityEvent[] = [];

      const followedUsers = followed.filter((id) => id.startsWith("u-"));
      const lists = [
        ...followed.map(getGeneratedList).filter((l): l is NonNullable<typeof l> => !!l),
        ...followedUsers.flatMap((userId) => listsOfUser(userId, ids)),
      ];

      const seen = new Set<string>();
      let clock = 1;
      for (const l of lists) {
        if (seen.has(l.id)) continue;
        seen.add(l.id);
        const cl = toCommunityList(l, l.ownerId);
        // a handful of records added in one sitting: consecutive hours, so the
        // grouping window in lib/activity.ts has something real to chew on
        for (const releaseId of l.vinylIds.slice(0, 4)) {
          const release = all.find((v) => v.id === releaseId);
          if (!release) continue;
          out.push({
            id: `added:${l.id}:${releaseId}`,
            kind: "added",
            at: hoursAgo(clock),
            actor: cl.owner,
            list: { id: cl.id, title: cl.title, slug: cl.slug, ownerId: cl.owner.id, ownerHandle: cl.owner.username },
            release: { slug: release.id, title: release.title, artist: release.artist, cover: release.cover },
            mine: false,
          });
        }
        clock += 7;
      }

      // somebody kept one of yours, and somebody kept somebody else's
      /**
       * A list somebody could actually keep.
       *
       * `ownLists()[0]` is Mi Colección, and the placeholder was inventing
       * three people who had saved it — a thing that cannot happen. Fake data
       * that depicts an impossible state is worse than no data: it is a bug
       * report waiting to be filed against a feature that works.
       */
      const ownFirst = ownLists(all).find((l) => l.kind === "custom");
      const keepers = communityUsers().slice(0, 3);
      if (ownFirst) {
        keepers.forEach((u, i) =>
          out.push({
            id: `saved:${ownFirst.id}:${u.id}`,
            kind: "list-saved",
            at: hoursAgo(2 + i),
            actor: { id: u.id, username: u.handle, displayName: u.name, avatarUrl: null },
            list: {
              id: ownFirst.id,
              title: ownFirst.title,
              slug: ownFirst.slug,
              ownerId: LOCAL_PROFILE.id,
              ownerHandle: LOCAL_PROFILE.username,
            },
            mine: true,
          }),
        );

        // y los me gusta, que son más y de gente que no llegó a guardarla:
        // esa proporción es justo lo que hay que ver al diseñar la línea
        communityUsers()
          .slice(0, 6)
          .forEach((u, i) =>
            out.push({
              id: `liked:${ownFirst.id}:${u.id}`,
              kind: "list-liked",
              at: hoursAgo(1 + i * 0.5),
              actor: { id: u.id, username: u.handle, displayName: u.name, avatarUrl: null },
              list: {
                id: ownFirst.id,
                title: ownFirst.title,
                slug: ownFirst.slug,
                ownerId: LOCAL_PROFILE.id,
                ownerHandle: LOCAL_PROFILE.username,
              },
              mine: true,
            }),
          );
      }

      // and the gossip: who the people you follow have started following
      communityUsers()
        .filter((u) => followedUsers.includes(u.id))
        .slice(0, 3)
        .forEach((u, i) => {
          const target = communityUsers().find((o) => o.id !== u.id);
          if (!target) return;
          out.push({
            id: `followed:${u.id}:${target.id}`,
            kind: "followed",
            at: hoursAgo(5 + i * 3),
            actor: { id: u.id, username: u.handle, displayName: u.name, avatarUrl: null },
            target: { id: target.id, username: target.handle, displayName: target.name, avatarUrl: null },
            mine: false,
          });
        });

      return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 80);
    },

    async popularLists() {
      const ids = readReleases().map((v) => v.id);
      return communityUsers()
        .flatMap((u) => listsOfUser(u.id, ids).map((l) => toCommunityList(l, u.id)))
        // el mismo criterio que en producción: guardar pesa más que gustar
        .sort((a, b) => b.saves * 3 + b.likes - (a.saves * 3 + a.likes))
        .slice(0, 12);
    },

    async suggestedProfiles() {
      /**
       * The placeholder version of the ranking in 0014_people_for_me.sql.
       *
       * It cannot compute affinity — there is no real graph here — so it
       * fabricates it from the same seed everything else in this backend uses,
       * which at least makes the numbers stable between reloads and lets the
       * card be built against something that looks like the real thing.
       */
      const all = readReleases();
      const ids = all.map((v) => v.id);
      return communityUsers().map((u, i) => {
        const lists = listsOfUser(u.id, ids);
        const covers = lists
          .flatMap((l) => l.vinylIds)
          .map((id) => all.find((v) => v.id === id)?.cover)
          .filter((c): c is string => Boolean(c))
          .slice(0, 6);
        return {
          id: u.id,
          username: u.handle,
          displayName: u.name,
          bio: u.bio,
          avatarUrl: null,
          shared: covers.length ? ((i * 7) % 9) + 1 : 0,
          mutuals: (i * 3) % 4,
          followers: 12 + ((i * 11) % 40),
          covers,
          // the placeholder community has not chosen anything: this is what
          // the fallback looks like, which is the state worth designing for
          chosen: false,
        };
      });
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

    async followersOf(profileId) {
      // the preview's own profile shows the people who follow it; a community
      // profile keeps its placeholder emptiness
      if (profileId !== LOCAL_PROFILE.id && profileId !== LOCAL_PROFILE.username) return [];
      return communityUsers()
        .slice(0, 5)
        .map((u) => ({
          id: u.id,
          username: u.handle,
          displayName: u.name,
          bio: u.bio,
          avatarUrl: null,
        }));
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

    // ---- profiles ---------------------------------------------------------
    async relationship(profileId): Promise<Relationship> {
      const isYou = profileId === LOCAL_PROFILE.id || profileId === LOCAL_PROFILE.username;
      if (isYou) return { following: false, followsYou: false, isYou: true };
      const follows = new Set(loadFollows());
      const user = getUser(profileId);
      return {
        following: follows.has(profileId) || (user ? follows.has(user.id) : false),
        // The placeholder community follows you back deterministically rather
        // than randomly: a badge that appears and disappears between two
        // renders of the same profile reads as a bug, and this one is meant to
        // be designed against.
        followsYou: user ? DEMO_FRIENDS.includes(user.id) : false,
        isYou: false,
      };
    },

    async profileStats(profileId): Promise<ProfileStats> {
      const isYou = profileId === LOCAL_PROFILE.id || profileId === LOCAL_PROFILE.username;
      const ids = readReleases().map((v) => v.id);
      if (isYou) {
        const cols = collectionsOf();
        const wished = new Set(cols.find((c) => c.id === WISHLIST_ID)?.vinylIds ?? []);
        const follows = loadFollows();
        return {
          records: ids.filter((id) => !wished.has(id)).length,
          // the wishlist is yours alone and is not a "list" you publish
          lists: cols.filter((c) => c.id !== WISHLIST_ID && c.id !== DEFAULT_ID).length,
          followers: communityUsers().slice(0, 5).length,
          following: follows.filter((f) => f.startsWith("u-")).length,
        };
      }
      const lists = listsOfUser(profileId, ids);
      const records = new Set(lists.flatMap((l) => l.vinylIds));
      return {
        records: records.size,
        lists: lists.length,
        followers: lists.reduce((n, l) => n + l.saves, 0),
        following: 0,
      };
    },

    async updateProfile(patch: ProfilePatch) {
      saveProfileOverrides(patch);
      return localProfile();
    },

    async isUsernameAvailable(username) {
      const clean = username.trim().toLowerCase();
      if (!clean) return false;
      if (clean === BASE_PROFILE.username || clean === localProfile().username) return true;
      return !communityUsers().some((u) => u.handle === clean);
    },

    // ---- keeping other people's lists -------------------------------------
    async savedLists(): Promise<SavedList[]> {
      // Saved and followed are the same act with two names; the storage keeps
      // the timestamp so "recently saved" can be a real order rather than
      // whatever order the registry happens to produce.
      const stamps = new Map(loadSaved().map((s) => [s.listId, s.at]));
      const ids = readReleases().map((v) => v.id);
      const out: SavedList[] = [];
      for (const listId of new Set([...loadFollows(), ...stamps.keys()])) {
        if (!listId.startsWith("cl-")) continue;
        const l = getGeneratedList(listId);
        if (!l) continue;
        out.push({ ...toCommunityList(l, l.ownerId), savedAt: stamps.get(listId) ?? l.updated });
      }
      // a list you were invited into is not "saved", but it does belong beside
      // your own — that distinction is drawn in the interface, not here
      void ids;
      return out.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
    },

    async likeList(listId) {
      setLiked(listId, true);
    },

    async unlikeList(listId) {
      setLiked(listId, false);
    },

    async likedLists() {
      return loadLiked();
    },

    async saveList(listId) {
      setSaved(listId, true);
      saveFollows([...new Set([...loadFollows(), listId])]);
    },

    async unsaveList(listId) {
      setSaved(listId, false);
      saveFollows(loadFollows().filter((x) => x !== listId));
    },

    async duplicateList(listId, title) {
      const source = getGeneratedList(listId);
      const sourceIds = source ? source.vinylIds : idsOf(listId);
      const name = title ?? `${source?.title ?? "Rack"} (copia)`;
      const created = newCollection(name);
      const have = new Set(readReleases().map((v) => v.id));
      // A copy that points at records you do not have would be a list of holes.
      // Only what exists locally comes across; the rest is simply not there.
      mutate((cols) => [...cols, { ...created, vinylIds: sourceIds.filter((id) => have.has(id)) }]);
      return toList(created, 99, readReleases(), new Set());
    },

    // ---- collaboration ----------------------------------------------------
    async collaboratorsOf(listId) {
      const stored = readCollaborators(listId);
      const community = getGeneratedList(listId);
      const ownerId = community?.ownerId ?? LOCAL_PROFILE.id;
      const owner = getUser(ownerId);
      const ownerRow: Collaborator = {
        profile: {
          id: ownerId,
          username: owner?.handle ?? LOCAL_PROFILE.username,
          displayName: owner?.name ?? LOCAL_PROFILE.displayName,
          avatarUrl: null,
        },
        role: "owner",
        since: community?.updated ?? new Date(0).toISOString(),
      };
      // the owner is always first and can never be removed, so the interface
      // never has to special-case an empty list of people
      return [ownerRow, ...stored.filter((c) => c.role !== "owner")];
    },

    async inviteCollaborator(listId, username) {
      const clean = username.trim().replace(/^@/, "").toLowerCase();
      if (!clean) return { ok: false, error: "Escribe un nombre de usuario." };
      const user = communityUsers().find((u) => u.handle === clean);
      if (!user) return { ok: false, error: `No encontramos a @${clean}.` };
      const current = readCollaborators(listId);
      if (current.some((c) => c.profile.username === clean)) {
        return { ok: false, error: `@${clean} ya está en este rack.` };
      }
      setCollaborators(listId, [
        ...current,
        {
          profile: { id: user.id, username: user.handle, displayName: user.name, avatarUrl: null },
          role: "editor",
          since: new Date().toISOString(),
          // An invitation is pending until it is accepted. Showing someone as a
          // collaborator the instant you type their name is a lie the interface
          // tells that the backend will later contradict.
          pending: true,
        },
      ]);
      return { ok: true };
    },

    async removeCollaborator(listId, profileId) {
      setCollaborators(
        listId,
        readCollaborators(listId).filter((c) => c.profile.id !== profileId),
      );
    },

    async leaveList(listId) {
      setCollaborators(
        listId,
        readCollaborators(listId).filter((c) => c.profile.id !== LOCAL_PROFILE.id),
      );
      setSaved(listId, false);
      saveFollows(loadFollows().filter((x) => x !== listId));
    },

    async addedBy(listId, releaseId) {
      const stored = getAddedBy(listId, releaseId);
      if (stored) return stored;
      // Nothing recorded means it predates attribution, which for your own
      // lists means you. Guessing a collaborator here would invent history.
      const community = getGeneratedList(listId);
      if (!community) {
        return { id: LOCAL_PROFILE.id, username: LOCAL_PROFILE.username, displayName: LOCAL_PROFILE.displayName };
      }
      const owner = getUser(community.ownerId);
      return owner ? { id: owner.id, username: owner.handle, displayName: owner.name } : null;
    },

    // ---- notifications ----------------------------------------------------
    async notifications() {
      seedNotificationsOnce();
      return loadNotifications().sort((a, b) => b.at.localeCompare(a.at));
    },

    async markNotificationsRead() {
      markAllRead();
    },

    async respondToInvite(notificationId, accept) {
      const all = loadNotifications();
      const n = all.find((x) => x.id === notificationId);
      // Answering removes the fork: an invitation you already accepted must not
      // keep asking, and one you declined must not linger as a reproach.
      saveNotifications(
        all.map((x) => (x.id === notificationId ? { ...x, read: true, actionable: false } : x)),
      );
      if (!n?.listId) return;
      if (accept) {
        setCollaborators(n.listId, [
          ...readCollaborators(n.listId).filter((c) => c.profile.id !== LOCAL_PROFILE.id),
          {
            profile: {
              id: LOCAL_PROFILE.id,
              username: LOCAL_PROFILE.username,
              displayName: LOCAL_PROFILE.displayName,
              avatarUrl: LOCAL_PROFILE.avatarUrl,
            },
            role: "editor",
            since: new Date().toISOString(),
          },
        ]);
      }
    },
  };
}

/**
 * Something in the inbox on the first visit.
 *
 * An empty notifications screen cannot be designed against — you never find out
 * whether an invitation reads as an invitation until one is sitting there. Runs
 * exactly once and then never again, so it can be dismissed for good.
 */
function seedNotificationsOnce() {
  if (hasSeededNotifications()) return;
  markSeeded();
  const users = allUsers();
  const marta = users.find((u) => u.id === "u-marta");
  const teo = users.find((u) => u.id === "u-teo");
  const ines = users.find((u) => u.id === "u-ines");
  const hoursAgo = (h: number) => new Date(Date.now() - h * 36e5).toISOString();
  const seeded: Notification[] = [];

  if (marta) {
    seeded.push({
      id: newId("n"),
      kind: "invite",
      at: hoursAgo(3),
      read: false,
      actionable: true,
      actor: { id: marta.id, username: marta.handle, displayName: marta.name, avatarUrl: null },
      listId: "cl-invite-demo",
      listTitle: "Compras de Record Store Day",
      listSlug: "compras-de-record-store-day",
    });
  }
  if (teo) {
    seeded.push({
      id: newId("n"),
      kind: "follow",
      at: hoursAgo(9),
      read: false,
      actor: { id: teo.id, username: teo.handle, displayName: teo.name, avatarUrl: null },
    });
  }
  if (marta) {
    seeded.push({
      id: newId("n"),
      kind: "liked-list",
      at: hoursAgo(5),
      read: false,
      actor: { id: marta.id, username: marta.handle, displayName: marta.name, avatarUrl: null },
      listId: "demo-noche",
      listTitle: "El turno de noche",
      listSlug: "el-turno-de-noche",
    });
  }
  if (ines) {
    seeded.push({
      id: newId("n"),
      kind: "saved-list",
      at: hoursAgo(26),
      read: true,
      actor: { id: ines.id, username: ines.handle, displayName: ines.name, avatarUrl: null },
      listId: "demo-noche",
      listTitle: "El turno de noche",
      listSlug: "el-turno-de-noche",
    });
  }
  saveNotifications(seeded);
}
