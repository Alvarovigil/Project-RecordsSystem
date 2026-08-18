import Link from "next/link";
import SiteNav from "@/components/SiteNav";
import { notFound } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import FollowButton from "@/components/ProfileHeader";

export const dynamic = "force-dynamic";

/** Shared links should show who they lead to. */
export async function generateMetadata({ params }: { params: { username: string } }) {
  const supabase = getSupabaseServerClient();
  const { data } = (await supabase
    ?.from("profiles")
    .select("display_name, bio, avatar_url")
    .eq("username", params.username)
    .maybeSingle()) ?? { data: null };

  if (!data) return { title: "Rackr" };
  return {
    title: data.display_name,
    description: data.bio || `La colección de vinilos de ${data.display_name}.`,
    openGraph: {
      title: `${data.display_name} en Rackr`,
      description: data.bio || `La colección de vinilos de ${data.display_name}.`,
      images: data.avatar_url ? [data.avatar_url] : undefined,
    },
  };
}

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

  const { data: followedLists } = await supabase
    .from("list_follows")
    .select("lists!inner(id, title, slug, item_count, visibility, profiles!inner(username, display_name))")
    .eq("user_id", profile.id)
    .limit(12);

  const { data: lists } = await supabase
    .from("lists")
    .select("id, title, slug, description, item_count, updated_at, visibility")
    .eq("owner_id", profile.id)
    .eq("visibility", "public")
    .order("position");

  const [{ data: followers }, { data: following }] = await Promise.all([
    supabase
      .from("follows")
      .select("profiles!follows_follower_id_fkey(id, username, display_name, avatar_url)")
      .eq("following_id", profile.id),
    supabase
      .from("follows")
      .select("profiles!follows_following_id_fkey(id, username, display_name, avatar_url)")
      .eq("follower_id", profile.id),
  ]);

  const people = (rows: any[] | null) =>
    (rows ?? []).map((r) => r.profiles).filter(Boolean) as {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    }[];

  const discos = (lists ?? []).reduce((n, l) => n + (l.item_count ?? 0), 0);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <SiteNav />
      <div className="mx-auto w-full max-w-[880px] px-6 py-16">
        <header className="mt-2 flex items-start justify-between gap-6 border-b border-paper/[0.08] pb-8">
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
                {lists?.length ?? 0} listas · {discos} discos ·{" "}
                {people(followers).length} seguidores · {people(following).length} siguiendo
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
        {(followedLists ?? []).length > 0 && (
          <section className="mt-12">
            <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Listas que sigue
            </h2>
            <ul className="mt-4 divide-y divide-paper/[0.07] border-y border-paper/[0.07]">
              {((followedLists ?? []) as any[])
                .map((r) => r.lists)
                .filter((l) => l && l.visibility === "public")
                .map((l) => (
                  <li key={l.id}>
                    <Link
                      href={`/u/${l.profiles.username}/${l.slug}`}
                      className="flex items-center gap-4 py-3.5 transition hover:bg-paper/[0.03]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px]">{l.title}</span>
                        <span className="mono mt-0.5 block truncate text-[10px] uppercase tracking-[0.16em] text-paper/35">
                          de {l.profiles.display_name} · {l.item_count} discos
                        </span>
                      </span>
                      <span className="text-paper/25">→</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        )}

        <section className="mt-14 grid gap-10 border-t border-paper/[0.08] pt-8 sm:grid-cols-2">
          <People title="Seguidores" people={people(followers)} empty="Nadie todavía." />
          <People title="Siguiendo" people={people(following)} empty="A nadie todavía." />
        </section>
      </div>
    </main>
  );
}

/** The people around a profile: the other half of a social object. */
function People({
  title,
  people,
  empty,
}: {
  title: string;
  people: { id: string; username: string; display_name: string; avatar_url: string | null }[];
  empty: string;
}) {
  return (
    <div>
      <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
        {title} · {people.length}
      </h2>
      <ul className="mt-4 space-y-3">
        {people.map((p) => (
          <li key={p.id}>
            <Link href={`/u/${p.username}`} className="group flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60">
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  p.display_name.slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="min-w-0">
                <span className="block truncate text-[14px] text-paper/85 transition group-hover:text-paper">
                  {p.display_name}
                </span>
                <span className="mono block truncate text-[11px] text-paper/35">@{p.username}</span>
              </span>
            </Link>
          </li>
        ))}
        {people.length === 0 && <li className="text-[13px] text-paper/30">{empty}</li>}
      </ul>
    </div>
  );
}

function NotConfigured() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink text-paper/50">
      <p className="text-[13px]">Los perfiles necesitan la base de datos configurada.</p>
    </main>
  );
}
