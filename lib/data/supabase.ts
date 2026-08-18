/**
 * Supabase backend. Mirrors lib/data/local.ts exactly, so switching is a
 * configuration change rather than a rewrite.
 *
 * Note what ISN'T here: no visibility filtering, no "can I see this list"
 * checks, no wishlist-exclusivity bookkeeping. Those live in RLS and triggers
 * (see supabase/migrations), where a bug in this file can't defeat them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Vinyl } from "@/lib/types";
import type { SortMode } from "@/lib/collections";
import type {
  FriendWithRecord,
  LibraryRepository,
  List,
  ListVisibility,
  ListWithRecord,
  NewListInput,
  Profile,
} from "./types";

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "lista";

type ReleaseRow = {
  id: string;
  slug: string;
  discogs_id: number | null;
  title: string;
  artist: string;
  year: number | null;
  genre: string | null;
  label: string | null;
  country: string | null;
  cover_url: string | null;
  preview_url: string | null;
  palette: string[];
  tracklist: Vinyl["tracklist"];
};

type ListRow = {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  description: string;
  kind: List["kind"];
  visibility: ListVisibility;
  sort_by: string;
  position: number;
  item_count: number;
  updated_at: string;
};

const toVinyl = (r: ReleaseRow): Vinyl => ({
  id: r.slug,
  title: r.title,
  artist: r.artist,
  year: r.year ?? 0,
  genre: r.genre ?? "",
  label: r.label ?? "",
  country: r.country ?? "",
  palette: r.palette ?? [],
  discogsId: r.discogs_id,
  cover: r.cover_url,
  previewUrl: r.preview_url,
  tracklist: r.tracklist ?? [],
});

const SORT_TO_DB: Record<SortMode, string> = {
  custom: "custom",
  added: "added",
  year: "year",
  artistAZ: "artist_az",
  artistZA: "artist_za",
  titleAZ: "title_az",
  titleZA: "title_za",
};
const SORT_FROM_DB = Object.fromEntries(
  Object.entries(SORT_TO_DB).map(([k, v]) => [v, k]),
) as Record<string, SortMode>;

const toList = (r: ListRow): List => ({
  id: r.id,
  ownerId: r.owner_id,
  title: r.title,
  slug: r.slug,
  description: r.description,
  kind: r.kind,
  visibility: r.visibility,
  sortBy: SORT_FROM_DB[r.sort_by] ?? "custom",
  position: r.position,
  itemCount: r.item_count,
  updatedAt: r.updated_at,
});

const toProfile = (p: any): Profile => ({
  id: p.id,
  username: p.username,
  displayName: p.display_name,
  bio: p.bio ?? "",
  avatarUrl: p.avatar_url,
});

/** A list row joined with its owner, as the community surfaces expect it. */
const withOwner = (row: any): ListWithRecord => ({
  ...toList(row as ListRow),
  followers: 0,
  owner: {
    id: row.owner_id,
    username: row.profiles.username,
    displayName: row.profiles.display_name,
    avatarUrl: row.profiles.avatar_url,
  },
});

export function createSupabaseRepository(sb: SupabaseClient): LibraryRepository {
  /** release slug → uuid, resolved once per call site */
  const releaseIdOf = async (slug: string) => {
    const { data } = await sb.from("releases").select("id").eq("slug", slug).single();
    return data?.id as string | undefined;
  };

  const requireUser = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Sin sesión");
    return data.user.id;
  };

  return {
    async getCurrentProfile(): Promise<Profile | null> {
      const { data: auth } = await sb.auth.getUser();
      if (!auth.user) return null;
      const { data } = await sb
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("id", auth.user.id)
        .single();
      return data
        ? {
            id: data.id,
            username: data.username,
            displayName: data.display_name,
            bio: data.bio,
            avatarUrl: data.avatar_url,
          }
        : null;
    },

    async listReleases() {
      const userId = await requireUser();
      // everything in any of my lists — the library is the union of them
      const { data } = await sb
        .from("releases")
        .select("*, list_items!inner(list_id, lists!inner(owner_id))")
        .eq("list_items.lists.owner_id", userId);
      const seen = new Set<string>();
      return ((data ?? []) as unknown as ReleaseRow[])
        .filter((r) => (seen.has(r.id) ? false : (seen.add(r.id), true)))
        .map(toVinyl);
    },

    async upsertRelease(release) {
      const userId = await requireUser();
      // The catalogue is shared: if the record is already there we reuse it
      // rather than making a private copy — that is what lets us answer "who
      // else has this record?".
      const { data: existing } = await sb
        .from("releases")
        .select("id")
        .eq("slug", release.id)
        .maybeSingle();
      if (existing) return release;

      await sb.from("releases").insert({
        slug: release.id,
        discogs_id: release.discogsId,
        title: release.title,
        artist: release.artist,
        year: release.year || null,
        genre: release.genre || null,
        label: release.label || null,
        country: release.country || null,
        cover_url: release.cover,
        preview_url: release.previewUrl,
        palette: release.palette,
        tracklist: release.tracklist,
        created_by: userId,
      });
      return release;
    },

    async deleteRelease(releaseSlug) {
      const userId = await requireUser();
      const id = await releaseIdOf(releaseSlug);
      if (!id) return;
      const { data: lists } = await sb.from("lists").select("id").eq("owner_id", userId);
      await sb
        .from("list_items")
        .delete()
        .eq("release_id", id)
        .in("list_id", (lists ?? []).map((l) => l.id));
    },

    async listLists() {
      const userId = await requireUser();
      const { data } = await sb
        .from("lists")
        .select("*")
        .eq("owner_id", userId)
        .order("position");
      return ((data ?? []) as ListRow[]).map(toList);
    },

    async createList({ title, description = "", visibility = "public" }: NewListInput) {
      const userId = await requireUser();
      const { data, error } = await sb
        .from("lists")
        .insert({
          owner_id: userId,
          title,
          slug: slugify(title),
          description,
          visibility,
          kind: "custom",
        })
        .select()
        .single();
      if (error) throw error;
      return toList(data as ListRow);
    },

    async renameList(listId, title) {
      await sb.from("lists").update({ title, slug: slugify(title) }).eq("id", listId);
    },

    async deleteList(listId) {
      await sb.from("lists").delete().eq("id", listId);
    },

    async setListSort(listId, sortBy) {
      await sb.from("lists").update({ sort_by: SORT_TO_DB[sortBy] }).eq("id", listId);
    },

    async setListVisibility(listId, visibility) {
      await sb.from("lists").update({ visibility }).eq("id", listId);
    },

    async listItems(listId) {
      const { data } = await sb
        .from("list_items")
        .select("position, releases!inner(slug)")
        .eq("list_id", listId)
        .order("position");
      return ((data ?? []) as unknown as { releases: { slug: string } }[]).map(
        (r) => r.releases.slug,
      );
    },

    async addToList(listId, releaseSlug) {
      const id = await releaseIdOf(releaseSlug);
      if (!id) return;
      const { count } = await sb
        .from("list_items")
        .select("*", { count: "exact", head: true })
        .eq("list_id", listId);
      await sb
        .from("list_items")
        .upsert({ list_id: listId, release_id: id, position: count ?? 0 });
    },

    async removeFromList(listId, releaseSlug) {
      const id = await releaseIdOf(releaseSlug);
      if (!id) return;
      await sb.from("list_items").delete().eq("list_id", listId).eq("release_id", id);
    },

    async reorderList(listId, fromIndex, toIndex) {
      const { data } = await sb
        .from("list_items")
        .select("release_id, position")
        .eq("list_id", listId)
        .order("position");
      const rows = (data ?? []) as { release_id: string; position: number }[];
      const [moved] = rows.splice(fromIndex, 1);
      rows.splice(toIndex, 0, moved);
      await Promise.all(
        rows.map((r, i) =>
          sb
            .from("list_items")
            .update({ position: i })
            .eq("list_id", listId)
            .eq("release_id", r.release_id),
        ),
      );
      await sb.from("lists").update({ sort_by: "custom" }).eq("id", listId);
    },

    // ---- community: the bridge, served by SQL functions -------------------
    async listsWithRelease(releaseSlug): Promise<ListWithRecord[]> {
      const id = await releaseIdOf(releaseSlug);
      if (!id) return [];
      const { data } = await sb.rpc("lists_with_release", { target_release: id });
      return ((data ?? []) as any[]).map((r) => ({
        id: r.list_id,
        ownerId: r.owner_id,
        title: r.title,
        slug: slugify(r.title),
        description: r.description ?? "",
        kind: "custom",
        visibility: "public",
        sortBy: "custom",
        position: 0,
        itemCount: r.item_count,
        updatedAt: r.updated_at,
        followers: Number(r.followers ?? 0),
        owner: {
          id: r.owner_id,
          username: r.owner_handle,
          displayName: r.owner_name,
          avatarUrl: null,
        },
      }));
    },

    async friendsWithRelease(releaseSlug): Promise<FriendWithRecord[]> {
      const id = await releaseIdOf(releaseSlug);
      if (!id) return [];
      const { data } = await sb.rpc("friends_with_release", { target_release: id });
      return ((data ?? []) as any[]).map((r) => ({
        user: {
          id: r.user_id,
          username: r.username,
          displayName: r.display_name,
          avatarUrl: r.avatar_url,
        },
        viaListId: r.list_id,
        viaListTitle: r.list_title,
      }));
    },

    async getProfile(username) {
      const { data } = await sb
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq("username", username)
        .maybeSingle();
      return data
        ? {
            id: data.id,
            username: data.username,
            displayName: data.display_name,
            bio: data.bio,
            avatarUrl: data.avatar_url,
          }
        : null;
    },

    async listsOfProfile(profileId): Promise<ListWithRecord[]> {
      const { data } = await sb
        .from("lists")
        .select("*, profiles!inner(username, display_name, avatar_url)")
        .eq("owner_id", profileId)
        .eq("visibility", "public")
        .order("position");
      return ((data ?? []) as any[]).map(withOwner);
    },

    async releasesOfList(listId) {
      const { data } = await sb
        .from("list_items")
        .select("position, releases!inner(*)")
        .eq("list_id", listId)
        .order("position");
      return ((data ?? []) as unknown as { releases: ReleaseRow }[]).map((r) =>
        toVinyl(r.releases),
      );
    },

    // ---- discovery --------------------------------------------------------
    async searchProfiles(query) {
      if (!query.trim()) return [];
      const { data } = await sb.rpc("search_profiles", { q: query.trim() });
      return ((data ?? []) as any[]).map((p) => ({
        id: p.id,
        username: p.username,
        displayName: p.display_name,
        bio: p.bio ?? "",
        avatarUrl: p.avatar_url,
      }));
    },

    async searchLists(query) {
      if (!query.trim()) return [];
      const { data } = await sb
        .from("lists")
        .select("*, profiles!inner(username, display_name, avatar_url)")
        .eq("visibility", "public")
        .ilike("title", `%${query.trim()}%`)
        .order("item_count", { ascending: false })
        .limit(20);
      return ((data ?? []) as any[]).map(withOwner);
    },

    async popularLists() {
      const { data } = await sb
        .from("lists")
        .select("*, profiles!inner(username, display_name, avatar_url)")
        .eq("visibility", "public")
        .gt("item_count", 0)
        .order("item_count", { ascending: false })
        .limit(12);
      return ((data ?? []) as any[]).map(withOwner);
    },

    async suggestedProfiles() {
      const { data } = await sb
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .order("created_at", { ascending: false })
        .limit(12);
      return ((data ?? []) as any[]).map(toProfile);
    },

    async followedLists() {
      const userId = await requireUser();
      const { data } = await sb
        .from("list_follows")
        .select("lists!inner(*, profiles!inner(username, display_name, avatar_url))")
        .eq("user_id", userId);
      return ((data ?? []) as any[]).map((row) => withOwner(row.lists));
    },

    async followersOf(profileId) {
      const { data } = await sb
        .from("follows")
        .select("profiles!follows_follower_id_fkey(id, username, display_name, bio, avatar_url)")
        .eq("following_id", profileId);
      return ((data ?? []) as any[]).map((r) => toProfile(r.profiles));
    },

    async followingOf(profileId) {
      const { data } = await sb
        .from("follows")
        .select("profiles!follows_following_id_fkey(id, username, display_name, bio, avatar_url)")
        .eq("follower_id", profileId);
      return ((data ?? []) as any[]).map((r) => toProfile(r.profiles));
    },

    async follow(kind, id) {
      const userId = await requireUser();
      if (kind === "profile") {
        await sb.from("follows").insert({ follower_id: userId, following_id: id });
      } else {
        await sb.from("list_follows").insert({ user_id: userId, list_id: id });
      }
    },

    async unfollow(kind, id) {
      const userId = await requireUser();
      if (kind === "profile") {
        await sb.from("follows").delete().eq("follower_id", userId).eq("following_id", id);
      } else {
        await sb.from("list_follows").delete().eq("user_id", userId).eq("list_id", id);
      }
    },

    async following() {
      const userId = await requireUser();
      const [{ data: profiles }, { data: lists }] = await Promise.all([
        sb.from("follows").select("following_id").eq("follower_id", userId),
        sb.from("list_follows").select("list_id").eq("user_id", userId),
      ]);
      return {
        profiles: (profiles ?? []).map((r) => r.following_id as string),
        lists: (lists ?? []).map((r) => r.list_id as string),
      };
    },
  };
}
