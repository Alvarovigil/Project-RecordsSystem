import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Admin reads use the service key, which bypasses RLS on purpose: the panel
 * has to see private lists to moderate them. Nothing here is ever reachable
 * without a valid admin cookie — see lib/admin/auth.ts.
 */
export type AdminUser = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  lists: number;
  records: number;
  followers: number;
  following: number;
};

export async function getOverview() {
  const sb = getSupabaseAdminClient();
  if (!sb) return null;

  const counts = await Promise.all(
    (["profiles", "releases", "lists", "list_items", "follows", "list_follows"] as const).map(
      async (table) => {
        const { count } = await sb.from(table).select("*", { count: "exact", head: true });
        return [table, count ?? 0] as const;
      },
    ),
  );

  const { data: recent } = await sb
    .from("profiles")
    .select("id, username, display_name, created_at")
    .order("created_at", { ascending: false })
    .limit(5);

  return {
    counts: Object.fromEntries(counts) as Record<string, number>,
    recent: recent ?? [],
  };
}

export async function listUsers(query = ""): Promise<AdminUser[]> {
  const sb = getSupabaseAdminClient();
  if (!sb) return [];

  let request = sb
    .from("profiles")
    .select("id, username, display_name, avatar_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (query.trim()) {
    request = request.or(`username.ilike.%${query}%,display_name.ilike.%${query}%`);
  }
  const { data: profiles } = await request;

  // one round trip per metric instead of per user
  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) return [];

  const [{ data: lists }, { data: follows }] = await Promise.all([
    sb.from("lists").select("id, owner_id, item_count").in("owner_id", ids),
    sb.from("follows").select("follower_id, following_id"),
  ]);

  return (profiles ?? []).map((p) => {
    const own = (lists ?? []).filter((l) => l.owner_id === p.id);
    return {
      id: p.id,
      username: p.username,
      displayName: p.display_name,
      avatarUrl: p.avatar_url,
      createdAt: p.created_at,
      lists: own.length,
      records: own.reduce((n, l) => n + (l.item_count ?? 0), 0),
      followers: (follows ?? []).filter((f) => f.following_id === p.id).length,
      following: (follows ?? []).filter((f) => f.follower_id === p.id).length,
    };
  });
}

export async function getUserDetail(id: string) {
  const sb = getSupabaseAdminClient();
  if (!sb) return null;

  const { data: profile } = await sb.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!profile) return null;

  const [{ data: lists }, { data: followers }, { data: following }] = await Promise.all([
    sb.from("lists").select("*").eq("owner_id", id).order("position"),
    sb.from("follows").select("follower_id, profiles!follows_follower_id_fkey(username, display_name)").eq("following_id", id),
    sb.from("follows").select("following_id, profiles!follows_following_id_fkey(username, display_name)").eq("follower_id", id),
  ]);

  const listIds = (lists ?? []).map((l) => l.id);
  const { data: items } = listIds.length
    ? await sb
        .from("list_items")
        .select("list_id, added_at, releases!inner(slug, title, artist, cover_url)")
        .in("list_id", listIds)
        .order("added_at", { ascending: false })
        .limit(200)
    : { data: [] };

  return {
    profile,
    lists: lists ?? [],
    items: (items ?? []) as unknown as {
      list_id: string;
      added_at: string;
      releases: { slug: string; title: string; artist: string; cover_url: string | null };
    }[],
    followers: followers ?? [],
    following: following ?? [],
  };
}
