import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import ListView from "@/components/community/ListView";
import { getUserByHandle } from "@/lib/community";
import { DEMO_PROFILE } from "@/lib/demo";

export const dynamic = "force-dynamic";

/** A shared list should arrive with its name, its owner and a cover. */
export async function generateMetadata({
  params,
}: {
  params: { username: string; list: string };
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return { title: "Rackr" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("username", params.username)
    .maybeSingle();
  if (!profile) return { title: "Rackr" };

  const { data: list } = await supabase
    .from("lists")
    .select("title, description, item_count")
    .eq("owner_id", profile.id)
    .eq("slug", params.list)
    .maybeSingle();
  if (!list) return { title: "Rackr" };

  const description =
    list.description || `${list.item_count} discos en la colección de ${profile.display_name}.`;
  return {
    title: `${list.title} — ${profile.display_name}`,
    description,
    openGraph: { title: list.title, description },
  };
}

/**
 * A public list: the page you land on from the bridge, and the one you share.
 *
 * The server resolves who and which; one client view renders it, whether the
 * list belongs to a real account, to you, or to the placeholder community.
 */
export default async function ListPage({
  params,
}: {
  params: { username: string; list: string };
}) {
  const supabase = getSupabaseServerClient();

  if (supabase) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url")
      .eq("username", params.username)
      .maybeSingle();

    if (profile) {
      const { data: list } = await supabase
        .from("lists")
        .select("id, title, description, item_count")
        .eq("owner_id", profile.id)
        .eq("slug", params.list)
        .maybeSingle();
      if (!list) notFound();
      return (
        <ListView
          listId={list.id}
          ownerId={profile.id}
          slug={params.list}
          initial={{
            title: list.title,
            description: list.description,
            itemCount: list.item_count,
            owner: {
              id: profile.id,
              username: profile.username,
              displayName: profile.display_name,
              avatarUrl: profile.avatar_url,
            },
          }}
        />
      );
    }
  }

  // The preview collector and the placeholder community both live in the
  // visitor's browser. Every link in the demo has to lead somewhere.
  if (params.username === DEMO_PROFILE.username) {
    return <ListView ownerId={DEMO_PROFILE.id} slug={params.list} />;
  }
  const demo = getUserByHandle(params.username);
  if (demo) return <ListView ownerId={demo.id} slug={params.list} />;
  notFound();
}
