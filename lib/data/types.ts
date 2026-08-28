/**
 * The single door to data.
 *
 * Every screen talks to this interface and nothing else. Today it is backed by
 * localStorage; when Supabase is connected the implementation swaps and no
 * component changes. That is the whole point of writing it down.
 */
import type { Vinyl } from "@/lib/types";
import type { SortMode } from "@/lib/collections";

export type ListKind = "collection" | "wishlist" | "custom";
export type ListVisibility = "public" | "unlisted" | "private";

export type List = {
  id: string;
  ownerId: string;
  title: string;
  slug: string;
  description: string;
  kind: ListKind;
  visibility: ListVisibility;
  sortBy: SortMode;
  position: number;
  itemCount: number;
  updatedAt: string;
};

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
};

/** A list as seen from a record: the bridge into someone else's collection. */
export type ListWithRecord = List & {
  owner: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  followers: number;
};

export type FriendWithRecord = {
  user: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  viaListId: string;
  viaListTitle: string;
};

/** One thing that happened: someone put a record in a list. */
export type FeedEntry = {
  at: string;
  actor: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  listId: string;
  listTitle: string;
  listSlug: string;
  release: { slug: string; title: string; artist: string; cover: string | null };
};

/**
 * Where you stand with someone.
 *
 * Both directions in one object because the interface needs both at once: the
 * button says "Seguir" or "Siguiendo" from the first field, and the row under
 * their name says "te sigue" from the second. Instagram taught everyone that
 * "follows you" is the single most useful thing you can tell someone about a
 * stranger — it converts a cold profile into a decision.
 */
export type Relationship = {
  following: boolean;
  followsYou: boolean;
  /** you are looking at yourself; the whole follow apparatus disappears */
  isYou: boolean;
};

/** The four numbers under a profile's name. */
export type ProfileStats = {
  records: number;
  lists: number;
  followers: number;
  following: number;
};

/**
 * A list you kept that someone else made.
 *
 * Distinguished from your own lists everywhere it appears, always by naming
 * the owner rather than by a badge reading "guardada" — whose it is, is the
 * useful fact; that you saved it is not.
 */
export type SavedList = ListWithRecord & {
  savedAt: string;
};

/** Someone who can add to a list they do not own. */
export type Collaborator = {
  profile: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  role: "owner" | "editor";
  since: string;
  /** an invitation that hasn't been accepted yet */
  pending?: boolean;
};

/**
 * Something that happened *to you*, as opposed to the feed, which is what
 * happened around you.
 *
 * The distinction is load-bearing: mixing an invitation you must answer into a
 * river of activity is how invitations get missed. Anything with `actionable`
 * set is a fork in a flow and must not be dismissable without an answer.
 */
export type NotificationKind = "follow" | "invite" | "added-to-list" | "saved-list";

export type Notification = {
  id: string;
  kind: NotificationKind;
  at: string;
  read: boolean;
  actor: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  listId?: string;
  listTitle?: string;
  listSlug?: string;
  release?: { slug: string; title: string; artist: string; cover: string | null };
  /** requires an answer (accept / decline), not just an acknowledgement */
  actionable?: boolean;
};

export type ProfilePatch = {
  displayName?: string;
  username?: string;
  bio?: string;
  avatarUrl?: string | null;
};

export type NewListInput = {
  title: string;
  description?: string;
  visibility?: ListVisibility;
};

export interface LibraryRepository {
  // ---- identity -----------------------------------------------------------
  /** null while signed out; the local backend returns a fixed local identity */
  getCurrentProfile(): Promise<Profile | null>;

  // ---- catalogue ----------------------------------------------------------
  /** every record the current user can see in their own library */
  listReleases(): Promise<Vinyl[]>;
  /** adds a record to the shared catalogue if it isn't there yet */
  upsertRelease(release: Vinyl): Promise<Vinyl>;
  /** removes it from the user's library entirely */
  deleteRelease(releaseId: string): Promise<void>;

  // ---- lists --------------------------------------------------------------
  listLists(): Promise<List[]>;
  createList(input: NewListInput): Promise<List>;
  renameList(listId: string, title: string): Promise<void>;
  deleteList(listId: string): Promise<void>;
  setListSort(listId: string, sortBy: SortMode): Promise<void>;
  setListVisibility(listId: string, visibility: ListVisibility): Promise<void>;

  // ---- list contents ------------------------------------------------------
  listItems(listId: string): Promise<string[]>;
  addToList(listId: string, releaseId: string): Promise<void>;
  removeFromList(listId: string, releaseId: string): Promise<void>;
  reorderList(listId: string, fromIndex: number, toIndex: number): Promise<void>;

  // ---- discovery ----------------------------------------------------------
  searchProfiles(query: string): Promise<Profile[]>;
  searchLists(query: string): Promise<ListWithRecord[]>;
  /** what to show someone who hasn't searched for anything yet */
  popularLists(): Promise<ListWithRecord[]>;
  suggestedProfiles(): Promise<Profile[]>;
  /** what the people and lists you follow have been adding */
  feed(): Promise<FeedEntry[]>;

  // ---- community ----------------------------------------------------------
  listsWithRelease(releaseId: string): Promise<ListWithRecord[]>;
  friendsWithRelease(releaseId: string): Promise<FriendWithRecord[]>;
  /**
   * By handle or by id — callers legitimately hold one or the other.
   *
   * It used to take a handle only, and the profile screen passes an id. The
   * query matched nothing, returned null, and that null overwrote the profile
   * the server had already resolved: a page showing the right counts above a
   * blank name and a bare "@".
   */
  getProfile(handleOrId: string): Promise<Profile | null>;
  listsOfProfile(profileId: string): Promise<ListWithRecord[]>;
  /** full records of any list you're allowed to read, owned by you or not */
  releasesOfList(listId: string): Promise<Vinyl[]>;

  // ---- profiles -----------------------------------------------------------
  /** where you stand with someone: both directions, plus "this is you" */
  relationship(profileId: string): Promise<Relationship>;
  /** the numbers under a profile's name */
  profileStats(profileId: string): Promise<ProfileStats>;
  /** edit your own profile; returns the saved result, not the request */
  updateProfile(patch: ProfilePatch): Promise<Profile>;
  /** is this handle free? the answer has to arrive while you're still typing */
  isUsernameAvailable(username: string): Promise<boolean>;

  // ---- keeping other people's lists ---------------------------------------
  /** lists made by other people that you kept, newest first */
  savedLists(): Promise<SavedList[]>;
  saveList(listId: string): Promise<void>;
  unsaveList(listId: string): Promise<void>;
  /**
   * Copy someone's list into one of your own.
   *
   * The escape hatch that makes a saved list safe to be read-only: you never
   * have to choose between keeping a reference and being able to change it.
   * The copy is yours, disconnected, and says where it came from.
   */
  duplicateList(listId: string, title?: string): Promise<List>;

  // ---- collaboration ------------------------------------------------------
  collaboratorsOf(listId: string): Promise<Collaborator[]>;
  /** returns a plain reason on failure; the UI needs to say why, not just fail */
  inviteCollaborator(listId: string, username: string): Promise<{ ok: boolean; error?: string }>;
  removeCollaborator(listId: string, profileId: string): Promise<void>;
  /** leave a list you collaborate on but do not own */
  leaveList(listId: string): Promise<void>;
  /** who put this record in this list — attribution inside a shared list */
  addedBy(listId: string, releaseId: string): Promise<Pick<Profile, "id" | "username" | "displayName"> | null>;

  // ---- notifications ------------------------------------------------------
  notifications(): Promise<Notification[]>;
  markNotificationsRead(): Promise<void>;
  respondToInvite(notificationId: string, accept: boolean): Promise<void>;

  // ---- follow graph -------------------------------------------------------
  follow(kind: "profile" | "list", id: string): Promise<void>;
  unfollow(kind: "profile" | "list", id: string): Promise<void>;
  following(): Promise<{ profiles: string[]; lists: string[] }>;
  /** the lists you follow, ready to show alongside your own */
  followedLists(): Promise<ListWithRecord[]>;
  /** the people around a profile */
  followersOf(profileId: string): Promise<Profile[]>;
  followingOf(profileId: string): Promise<Profile[]>;
}
