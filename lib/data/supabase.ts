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

/**
 * Every embed of `profiles` names its foreign key, and has to.
 *
 * Adding list_collaborators gave `lists` a second path to `profiles` — owner,
 * and collaborator — and PostgREST will not guess between them: it refuses the
 * query outright with PGRST201. Which meant that the moment collaboration
 * shipped, every community read on this backend stopped working. Not returning
 * less; erroring. The screens saw an empty array and reported, in good faith,
 * that people had no lists.
 *
 * Naming the constraint is not verbosity, it is the only unambiguous way to
 * ask. And it stays correct the next time another table points at profiles.
 */
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

    async getProfile(handleOrId) {
      // a uuid is an id, anything else is a handle
      const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(handleOrId);
      const { data } = await sb
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .eq(isId ? "id" : "username", handleOrId)
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
        .select("*, profiles!lists_owner_id_fkey!inner(username, display_name, avatar_url)")
        .eq("owner_id", profileId)
        .eq("visibility", "public")
        .order("position");
      return ((data ?? []) as any[]).map(withOwner);
    },

    async coversOfLists(listIds) {
      if (listIds.length === 0) return {};
      const { data } = await sb
        .from("list_items")
        .select("list_id, added_at, releases!inner(cover_url)")
        .in("list_id", listIds)
        // newest first: the crate shows what went in last, which is the only
        // ordering that makes a preview worth looking at twice
        .order("added_at", { ascending: false })
        .limit(400);
      const out: Record<string, string[]> = {};
      for (const row of (data ?? []) as any[]) {
        const url = row.releases?.cover_url;
        if (!url) continue;
        const bucket = (out[row.list_id] ??= []);
        // six, not three: the crate shows three and the hover card shows six.
        // One request answers both rather than the screen making two.
        if (bucket.length < 6) bucket.push(url);
      }
      return out;
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
        .select("*, profiles!lists_owner_id_fkey!inner(username, display_name, avatar_url)")
        .eq("visibility", "public")
        .ilike("title", `%${query.trim()}%`)
        .order("item_count", { ascending: false })
        .limit(20);
      return ((data ?? []) as any[]).map(withOwner);
    },

    async activity(): Promise<ActivityEvent[]> {
      // One round trip for four verbs: see supabase/migrations/0011_activity.sql.
      // Grouping happens in lib/activity.ts, on rows, not in SQL — the rule for
      // what counts as "one thing that happened" is a design decision and it
      // belongs where it can be read and changed.
      const { data } = await sb.rpc("activity_for_me", { max_rows: 160 });
      return ((data ?? []) as any[]).map((r) => ({
        // the tuple that identifies the event; there is no id column because
        // none of the four source tables has one
        id: `${r.kind}:${r.actor_id}:${r.list_id ?? r.target_id ?? ""}:${r.release_slug ?? ""}:${r.at}`,
        kind: r.kind,
        at: r.at,
        actor: {
          id: r.actor_id,
          username: r.actor_handle,
          displayName: r.actor_name,
          avatarUrl: r.actor_avatar,
        },
        list: r.list_id
          ? {
              id: r.list_id,
              title: r.list_title,
              slug: r.list_slug,
              ownerId: r.list_owner_id,
              ownerHandle: r.list_owner_handle,
            }
          : undefined,
        target: r.target_id
          ? {
              id: r.target_id,
              username: r.target_handle,
              displayName: r.target_name,
              avatarUrl: r.target_avatar,
            }
          : undefined,
        release: r.release_slug
          ? {
              slug: r.release_slug,
              title: r.release_title,
              artist: r.release_artist,
              cover: r.release_cover,
            }
          : undefined,
        mine: Boolean(r.mine),
      }));
    },

    async popularLists() {
      const { data } = await sb
        .from("lists")
        .select("*, profiles!lists_owner_id_fkey!inner(username, display_name, avatar_url)")
        .eq("visibility", "public")
        .gt("item_count", 0)
        .order("item_count", { ascending: false })
        .limit(12);
      return ((data ?? []) as any[]).map(withOwner);
    },

    async suggestedProfiles() {
      // "gente que colecciona" is a place to find someone, and you are not
      // someone you need to find. Asked for, not required: signed out there is
      // nobody to exclude and the list is the same.
      const { data: auth } = await sb.auth.getUser();
      let q = sb
        .from("profiles")
        .select("id, username, display_name, bio, avatar_url")
        .order("created_at", { ascending: false })
        .limit(12);
      if (auth.user) q = q.neq("id", auth.user.id);
      const { data } = await q;
      return ((data ?? []) as any[]).map(toProfile);
    },

    async followedLists() {
      const userId = await requireUser();
      const { data } = await sb
        .from("list_follows")
        .select("lists!inner(*, profiles!lists_owner_id_fkey!inner(username, display_name, avatar_url))")
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

    // ---- profiles ---------------------------------------------------------
    async relationship(profileId): Promise<Relationship> {
      const userId = await requireUser();
      if (userId === profileId) return { following: false, followsYou: false, isYou: true };
      // both directions in one round trip: the button and the badge next to it
      // must never disagree, and two requests can land out of order
      const { data } = await sb
        .from("follows")
        .select("follower_id, following_id")
        .or(
          `and(follower_id.eq.${userId},following_id.eq.${profileId}),` +
            `and(follower_id.eq.${profileId},following_id.eq.${userId})`,
        );
      const rows = (data ?? []) as { follower_id: string; following_id: string }[];
      return {
        following: rows.some((r) => r.follower_id === userId),
        followsYou: rows.some((r) => r.follower_id === profileId),
        isYou: false,
      };
    },

    async profileStats(profileId): Promise<ProfileStats> {
      // counts only: head + exact tells Postgres to count without shipping rows
      const [lists, followers, following] = await Promise.all([
        sb
          .from("lists")
          .select("id", { count: "exact", head: true })
          .eq("owner_id", profileId)
          .eq("kind", "custom"),
        sb
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", profileId),
        sb
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", profileId),
      ]);
      const { data: collection } = await sb
        .from("lists")
        .select("item_count")
        .eq("owner_id", profileId)
        .eq("kind", "collection")
        .maybeSingle();
      return {
        records: (collection?.item_count as number) ?? 0,
        lists: lists.count ?? 0,
        followers: followers.count ?? 0,
        following: following.count ?? 0,
      };
    },

    async updateProfile(patch: ProfilePatch) {
      const userId = await requireUser();
      const row: Record<string, unknown> = {};
      if (patch.displayName !== undefined) row.display_name = patch.displayName;
      if (patch.username !== undefined) row.username = patch.username;
      if (patch.bio !== undefined) row.bio = patch.bio;
      if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
      const { data, error } = await sb
        .from("profiles")
        .update(row)
        .eq("id", userId)
        .select("id, username, display_name, bio, avatar_url")
        .single();
      // the unique index on username is the real check; surface its refusal
      // instead of pretending the save worked
      if (error) throw new Error(error.message);
      return toProfile(data);
    },

    async isUsernameAvailable(username) {
      const clean = username.trim().toLowerCase();
      if (!/^[a-z0-9_]{3,24}$/.test(clean)) return false;
      const userId = await requireUser();
      const { data } = await sb
        .from("profiles")
        .select("id")
        .eq("username", clean)
        .maybeSingle();
      return !data || data.id === userId;
    },

    // ---- keeping other people's lists -------------------------------------
    async savedLists(): Promise<SavedList[]> {
      const userId = await requireUser();
      const { data } = await sb
        .from("list_follows")
        .select("created_at, lists!inner(*, profiles!lists_owner_id_fkey!inner(username, display_name, avatar_url))")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      return ((data ?? []) as any[]).map((row) => ({
        ...withOwner(row.lists),
        savedAt: row.created_at as string,
      }));
    },

    async saveList(listId) {
      const userId = await requireUser();
      const { error } = await sb.from("list_follows").insert({ user_id: userId, list_id: listId });
      /**
       * Thrown, not swallowed.
       *
       * This used to discard the error, so a save that the database refused —
       * a list you cannot read, a row that is already there, a policy you do
       * not satisfy — looked exactly like a save that worked: the button said
       * "Guardada" and the list was gone again on the next load. The button
       * already knows how to put itself back and say so; it just never got
       * told. Duplicates are the one case that is not a failure, because
       * saving something twice is what the user wanted anyway.
       */
      if (error && error.code !== "23505") throw new Error(error.message);
    },

    async unsaveList(listId) {
      const userId = await requireUser();
      const { error } = await sb
        .from("list_follows")
        .delete()
        .eq("user_id", userId)
        .eq("list_id", listId);
      if (error) throw new Error(error.message);
    },

    async duplicateList(listId, title) {
      const userId = await requireUser();
      const { data: source } = await sb
        .from("lists")
        .select("title, description")
        .eq("id", listId)
        .single();
      const name = title ?? `${source?.title ?? "Lista"} (copia)`;
      const { data: created, error } = await sb
        .from("lists")
        .insert({
          owner_id: userId,
          title: name,
          slug: slugify(name),
          description: source?.description ?? "",
          kind: "custom",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      const { data: items } = await sb
        .from("list_items")
        .select("release_id, position")
        .eq("list_id", listId)
        .order("position");
      if (items?.length) {
        await sb.from("list_items").insert(
          items.map((i) => ({
            list_id: created.id,
            release_id: i.release_id,
            position: i.position,
            added_by: userId,
          })),
        );
      }
      return toList(created);
    },

    // ---- collaboration ----------------------------------------------------
    async collaboratorsOf(listId): Promise<Collaborator[]> {
      const [{ data: list }, { data: rows }] = await Promise.all([
        sb
          .from("lists")
          .select("created_at, profiles!lists_owner_id_fkey!inner(id, username, display_name, avatar_url)")
          .eq("id", listId)
          .single(),
        sb
          .from("list_collaborators")
          .select("role, status, created_at, profiles!list_collaborators_user_id_fkey!inner(id, username, display_name, avatar_url)")
          .eq("list_id", listId),
      ]);
      const owner: Collaborator[] = list
        ? [
            {
              profile: toShallow((list as any).profiles),
              role: "owner",
              since: (list as any).created_at,
            },
          ]
        : [];
      return [
        ...owner,
        ...((rows ?? []) as any[])
          .filter((r) => r.status !== "declined")
          .map((r) => ({
            profile: toShallow(r.profiles),
            role: "editor" as const,
            since: r.created_at as string,
            pending: r.status === "pending",
          })),
      ];
    },

    async inviteCollaborator(listId, username) {
      const userId = await requireUser();
      const clean = username.trim().replace(/^@/, "").toLowerCase();
      const { data: target } = await sb
        .from("profiles")
        .select("id")
        .eq("username", clean)
        .maybeSingle();
      if (!target) return { ok: false, error: `No encontramos a @${clean}.` };
      if (target.id === userId) return { ok: false, error: "Esta lista ya es tuya." };
      const { error } = await sb
        .from("list_collaborators")
        .insert({ list_id: listId, user_id: target.id, invited_by: userId });
      // 23505 is the primary key: they are already invited, which is not a
      // failure worth a red message
      if (error) {
        return error.code === "23505"
          ? { ok: false, error: `@${clean} ya está en esta lista.` }
          : { ok: false, error: "No se pudo invitar." };
      }
      return { ok: true };
    },

    async removeCollaborator(listId, profileId) {
      await sb.from("list_collaborators").delete().eq("list_id", listId).eq("user_id", profileId);
    },

    async leaveList(listId) {
      const userId = await requireUser();
      await sb.from("list_collaborators").delete().eq("list_id", listId).eq("user_id", userId);
    },

    async addedBy(listId, releaseSlug) {
      const releaseId = await releaseIdOf(releaseSlug);
      if (!releaseId) return null;
      const { data } = await sb
        .from("list_items")
        .select("profiles!list_items_added_by_fkey(id, username, display_name)")
        .eq("list_id", listId)
        .eq("release_id", releaseId)
        .maybeSingle();
      const p = (data as any)?.profiles;
      return p ? { id: p.id, username: p.username, displayName: p.display_name } : null;
    },

    // ---- notifications ----------------------------------------------------
    async notifications(): Promise<Notification[]> {
      const userId = await requireUser();
      const { data } = await sb
        .from("notifications")
        .select(
          "id, kind, actionable, read_at, created_at, list_id, " +
            "profiles!notifications_actor_id_fkey(id, username, display_name, avatar_url), " +
            "lists(title, slug), releases(slug, title, artist, cover_url)",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(60);
      return ((data ?? []) as any[]).map((r) => ({
        id: r.id,
        kind: r.kind,
        at: r.created_at,
        read: Boolean(r.read_at),
        actionable: r.actionable,
        actor: toShallow(r.profiles),
        listId: r.list_id ?? undefined,
        listTitle: r.lists?.title,
        listSlug: r.lists?.slug,
        release: r.releases
          ? {
              slug: r.releases.slug,
              title: r.releases.title,
              artist: r.releases.artist,
              cover: r.releases.cover_url,
            }
          : undefined,
      }));
    },

    async markNotificationsRead() {
      const userId = await requireUser();
      await sb
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
    },

    async respondToInvite(notificationId, accept) {
      const userId = await requireUser();
      const { data: n } = await sb
        .from("notifications")
        .select("list_id")
        .eq("id", notificationId)
        .single();
      if (n?.list_id) {
        await sb
          .from("list_collaborators")
          .update({ status: accept ? "accepted" : "declined" })
          .eq("list_id", n.list_id)
          .eq("user_id", userId);
      }
      // answered means answered: it stops being a fork in the road
      await sb
        .from("notifications")
        .update({ actionable: false, read_at: new Date().toISOString() })
        .eq("id", notificationId);
    },
  };
}

/** The shallow profile shape the community types pass around. */
function toShallow(p: any) {
  return {
    id: p?.id,
    username: p?.username,
    displayName: p?.display_name,
    avatarUrl: p?.avatar_url ?? null,
  };
}
