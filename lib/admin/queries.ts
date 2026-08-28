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

/**
 * The account behind the profile.
 *
 * `profiles` is the public half — a name, a handle, a bio. Everything you
 * actually need to answer a support email lives in `auth.users`: the address
 * it was opened with, whether it was ever confirmed, when they last came back,
 * and whether they are currently suspended. A panel that shows only the public
 * half can tell you who someone is and nothing about their account.
 */
export type AdminAccount = {
  email: string | null;
  provider: string | null;
  confirmed: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  /** an ISO date while a suspension is in force, null when active */
  bannedUntil: string | null;
};

export async function getAccount(id: string): Promise<AdminAccount | null> {
  const sb = getSupabaseAdminClient();
  if (!sb) return null;
  const { data, error } = await sb.auth.admin.getUserById(id);
  if (error || !data.user) return null;
  const u = data.user as typeof data.user & { banned_until?: string | null };
  return {
    email: u.email ?? null,
    provider: (u.app_metadata?.provider as string) ?? null,
    confirmed: Boolean(u.email_confirmed_at ?? u.confirmed_at),
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    // Supabase writes a far-future date to ban; a past one has simply expired
    bannedUntil:
      u.banned_until && new Date(u.banned_until) > new Date() ? u.banned_until : null,
  };
}

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

  /**
   * A total tells you the size of the thing; it tells you nothing about where
   * it is going. Two windows are enough to see that without building charts:
   * the last seven days against the last thirty.
   */
  const since = (days: number) =>
    new Date(Date.now() - days * 864e5).toISOString();

  const window = async (table: "profiles" | "list_items", column: string, days: number) => {
    const { count } = await sb
      .from(table)
      .select("*", { count: "exact", head: true })
      .gte(column, since(days));
    return count ?? 0;
  };

  const [signups7, signups30, added7, added30] = await Promise.all([
    window("profiles", "created_at", 7),
    window("profiles", "created_at", 30),
    window("list_items", "added_at", 7),
    window("list_items", "added_at", 30),
  ]);

  return {
    counts: Object.fromEntries(counts) as Record<string, number>,
    recent: recent ?? [],
    growth: { signups7, signups30, added7, added30 },
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
