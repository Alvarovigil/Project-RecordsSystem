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
  /**
   * Set when this list is somebody else's and you edit it with them.
   *
   * A shared list lives on both shelves and belongs to one of them. Naming its
   * owner here is what lets every screen say "de Marta y tú" instead of
   * quietly presenting somebody else's work as yours — and it is the flag the
   * collaborative mark on the crate reads.
   */
  sharedBy?: { id: string; username: string; displayName: string };
  title: string;
  slug: string;
  description: string;
  kind: ListKind;
  visibility: ListVisibility;
  sortBy: SortMode;
  position: number;
  itemCount: number;
  updatedAt: string;
  /**
   * Las dos medidas de una lista, siempre juntas.
   *
   * `saves` es cuánta gente la tiene en su estantería y `likes` cuánta pasó
   * por delante y le gustó. Separadas dicen cosas distintas — mucho like y
   * poca guardada es una lista bonita que nadie usa — y juntas son con lo que
   * se ordena lo que se enseña en Explorar.
   */
  saves: number;
  likes: number;
};

export type Profile = {
  id: string;
  username: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  /**
   * Granted by hand from the admin panel, never by its owner.
   *
   * It says "this account is who it says it is", which matters exactly once:
   * when somebody is deciding whether the list signed "Rackr Club" is ours.
   */
  verified?: boolean;
};

/** A list as seen from a record: the bridge into someone else's collection. */
export type ListWithRecord = List & {
  owner: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
};

export type FriendWithRecord = {
  user: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  viaListId: string;
  viaListTitle: string;
};

/**
 * Somebody worth following, and the reason.
 *
 * The numbers travel with the person because the card shows them: a suggestion
 * that says "5 discos en común" is a reason, and one that says nothing is an
 * advert. The covers come along for the same purpose — a collector is their
 * records, and a row of faces tells you nothing about who to follow.
 */
export type SuggestedProfile = Profile & {
  /** records of yours that are also in their public lists */
  shared: number;
  /** people you follow who follow them */
  mutuals: number;
  followers: number;
  /**
   * The three they present themselves with — or, until they have chosen, the
   * last three they added. `chosen` says which of the two you are looking at,
   * because a card built from someone's own choice and a card built from
   * whatever they bought last are not making the same claim.
   */
  covers: string[];
  chosen: boolean;
};

export type ShallowProfile = Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;

/**
 * One thing that happened near you.
 *
 * Four verbs, one shape. The alternative — a type per verb — pushes the union
 * into every consumer and makes grouping (lib/activity.ts) a switch statement
 * over four almost-identical branches. What varies between verbs is which of
 * the optional objects is filled in, and that is exactly what the fields say.
 *
 * `mine` means the OBJECT is yours: your list was saved, you were followed.
 * It is not "I did this" — your own actions never appear in your activity.
 */
export type ActivityKind =
  | "added"
  | "list-created"
  | "list-saved"
  | "list-liked"
  | "followed";

export type ActivityEvent = {
  /** stable across refetches: kind + actor + object + timestamp */
  id: string;
  kind: ActivityKind;
  at: string;
  actor: ShallowProfile;
  list?: { id: string; title: string; slug: string; ownerId: string; ownerHandle: string };
  /** the person on the receiving end, when the object is a person */
  target?: ShallowProfile;
  release?: { slug: string; title: string; artist: string; cover: string | null };
  mine: boolean;
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
export type NotificationKind =
  | "follow"
  | "invite"
  | "added-to-list"
  | "saved-list"
  | "liked-list";

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
  /**
   * The contents of several lists at once.
   *
   * The shelf needs every list's records the moment it opens — to know what is
   * in each one, to sort them, to say "5 discos" — and asking list by list is
   * one request per list on every load and after every edit. On a phone that
   * is the difference between a screen that answers and a screen that thinks
   * about it.
   */
  itemsOfLists(listIds: string[]): Promise<Record<string, string[]>>;
  addToList(listId: string, releaseId: string): Promise<void>;
  removeFromList(listId: string, releaseId: string): Promise<void>;
  reorderList(listId: string, fromIndex: number, toIndex: number): Promise<void>;

  // ---- discovery ----------------------------------------------------------
  searchProfiles(query: string): Promise<Profile[]>;
  searchLists(query: string): Promise<ListWithRecord[]>;
  /** what to show someone who hasn't searched for anything yet */
  popularLists(): Promise<ListWithRecord[]>;
  suggestedProfiles(): Promise<SuggestedProfile[]>;
  /** everything moving around you: additions, new lists, saves, follows */
  activity(): Promise<ActivityEvent[]>;

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
  /**
   * Up to six cover URLs per list, newest first — the crate takes three, the
   * hover card takes six.
   *
   * One request for every list on a screen rather than one per list: a profile
   * with fourteen lists would otherwise open fourteen connections to draw its
   * thumbnails. Covers only — nothing here needs the rest of the record.
   */
  coversOfLists(listIds: string[]): Promise<Record<string, string[]>>;

  // ---- profiles -----------------------------------------------------------
  /** where you stand with someone: both directions, plus "this is you" */
  relationship(profileId: string): Promise<Relationship>;
  /** the numbers under a profile's name */
  profileStats(profileId: string): Promise<ProfileStats>;
  /** edit your own profile; returns the saved result, not the request */
  updateProfile(patch: ProfilePatch): Promise<Profile>;

  /**
   * Los tres discos con los que alguien se presenta.
   *
   * Elegidos y no calculados. La aplicación puede adivinar cuáles son los que
   * más colocas, y esa adivinanza es interesante, pero no es lo mismo que
   * decidir con qué te presentas: lo primero describe una estantería y lo
   * segundo a una persona. El orden importa — el primero es el que se ve
   * entero en las tarjetas — así que se guarda como lista ordenada.
   */
  picksOf(profileId: string): Promise<string[]>;
  setPicks(releaseIds: string[]): Promise<void>;
  /** is this handle free? the answer has to arrive while you're still typing */
  isUsernameAvailable(username: string): Promise<boolean>;

  // ---- keeping other people's lists ---------------------------------------
  /** lists made by other people that you kept, newest first */
  savedLists(): Promise<SavedList[]>;
  saveList(listId: string): Promise<void>;
  unsaveList(listId: string): Promise<void>;
  /**
   * Me gusta: el gesto barato, al lado del caro.
   *
   * Guardar dice "esto me sirve"; un me gusta dice "esto está bien hecho", y
   * es lo único que la mayoría de la gente va a dar. Sin él, una lista buena
   * que nadie necesita en su estantería no tiene forma de destacar.
   */
  likeList(listId: string): Promise<void>;
  unlikeList(listId: string): Promise<void>;
  /** los ids de las listas a las que has dado me gusta */
  likedLists(): Promise<string[]>;
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
