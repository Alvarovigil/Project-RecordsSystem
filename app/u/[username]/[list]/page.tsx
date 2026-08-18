import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** A public list: the page you land on from the bridge, and the one you share. */
export default async function ListPage({
  params,
}: {
  params: { username: string; list: string };
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) notFound();

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .eq("username", params.username)
    .maybeSingle();
  if (!profile) notFound();

  const { data: list } = await supabase
    .from("lists")
    .select("id, title, description, item_count, updated_at")
    .eq("owner_id", profile.id)
    .eq("slug", params.list)
    .maybeSingle();
  if (!list) notFound();

  const { data: items } = await supabase
    .from("list_items")
    .select("position, releases!inner(slug, title, artist, cover_url)")
    .eq("list_id", list.id)
    .order("position");

  const records = ((items ?? []) as unknown as {
    releases: { slug: string; title: string; artist: string; cover_url: string | null };
  }[]).map((r) => r.releases);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-[1000px] px-6 py-16">
        <Link
          href={`/u/${profile.username}`}
          className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40 transition hover:text-paper"
        >
          ← {profile.display_name}
        </Link>

        <header className="mt-8 border-b border-paper/[0.08] pb-8">
          <h1 className="text-[30px] leading-tight">{list.title}</h1>
          {list.description && (
            <p className="mt-2 max-w-[56ch] text-[14px] text-paper/55">{list.description}</p>
          )}
          <p className="mono mt-4 text-[10px] uppercase tracking-[0.18em] text-paper/30">
            {list.item_count} discos
          </p>
        </header>

        <ul className="mt-8 grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-5">
          {records.map((r) => (
            <li key={r.slug}>
              <div className="aspect-square w-full overflow-hidden bg-paper/[0.04]">
                {r.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.cover_url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="mt-2 truncate text-[13px]">{r.title}</div>
              <div className="truncate text-[11px] uppercase tracking-[0.14em] text-paper/45">
                {r.artist}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
