import Link from "next/link";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import FollowButton from "@/components/ProfileHeader";

export const dynamic = "force-dynamic";

/**
 * A public profile: who someone is, and what they've built.
 *
 * Server-rendered, so it can be linked and shared. RLS decides what a visitor
 * sees — private lists never reach this page in the first place.
 */
export default async function ProfilePage({
  params,
}: {
  params: { username: string };
}) {
  const supabase = getSupabaseServerClient();
  if (!supabase) return <NotConfigured />;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at")
    .eq("username", params.username)
    .maybeSingle();

  if (!profile) notFound();

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, slug, description, item_count, updated_at, visibility")
    .eq("owner_id", profile.id)
    .eq("visibility", "public")
    .order("position");

  const { count: followers } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_id", profile.id);

  const discos = (lists ?? []).reduce((n, l) => n + (l.item_count ?? 0), 0);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-[880px] px-6 py-16">
        <Link
          href="/"
          className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40 transition hover:text-paper"
        >
          ← Mi estantería
        </Link>

        <header className="mt-8 flex items-start justify-between gap-6 border-b border-paper/[0.08] pb-8">
          <div className="flex items-start gap-5">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 text-[16px] text-paper/70">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                profile.display_name?.slice(0, 2).toUpperCase()
              )}
            </span>
            <div>
              <h1 className="text-[26px] leading-tight">{profile.display_name}</h1>
              <p className="mono mt-1 text-[12px] text-paper/40">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-3 max-w-[46ch] text-[14px] text-paper/60">{profile.bio}</p>
              )}
              <p className="mono mt-4 text-[10px] uppercase tracking-[0.18em] text-paper/30">
                {lists?.length ?? 0} listas · {discos} discos · {followers ?? 0} seguidores
              </p>
            </div>
          </div>
          <FollowButton profileId={profile.id} />
        </header>

        <section className="mt-8">
          <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Listas</h2>
          <ul className="mt-4 divide-y divide-paper/[0.07] border-y border-paper/[0.07]">
            {(lists ?? []).map((l) => (
              <li key={l.id}>
                <Link
                  href={`/u/${profile.username}/${l.slug}`}
                  className="flex items-center gap-4 py-4 transition hover:bg-paper/[0.03]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px]">{l.title}</span>
                    {l.description && (
                      <span className="mt-0.5 block truncate text-[12px] text-paper/45">
                        {l.description}
                      </span>
                    )}
                  </span>
                  <span className="mono text-[10px] uppercase tracking-[0.16em] text-paper/30">
                    {l.item_count} discos
                  </span>
                  <span className="text-paper/25">→</span>
                </Link>
              </li>
            ))}
            {(lists ?? []).length === 0 && (
              <li className="py-6 text-[13px] text-paper/35">
                Todavía no ha publicado ninguna lista.
              </li>
            )}
          </ul>
        </section>
      </div>
    </main>
  );
}

function NotConfigured() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink text-paper/50">
      <p className="text-[13px]">Los perfiles necesitan la base de datos configurada.</p>
    </main>
  );
}
