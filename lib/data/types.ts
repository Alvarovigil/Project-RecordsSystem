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

  // ---- community ----------------------------------------------------------
  listsWithRelease(releaseId: string): Promise<ListWithRecord[]>;
  friendsWithRelease(releaseId: string): Promise<FriendWithRecord[]>;
  getProfile(username: string): Promise<Profile | null>;
  listsOfProfile(profileId: string): Promise<ListWithRecord[]>;
  /** full records of any list you're allowed to read, owned by you or not */
  releasesOfList(listId: string): Promise<Vinyl[]>;

  // ---- follow graph -------------------------------------------------------
  follow(kind: "profile" | "list", id: string): Promise<void>;
  unfollow(kind: "profile" | "list", id: string): Promise<void>;
  following(): Promise<{ profiles: string[]; lists: string[] }>;
}
