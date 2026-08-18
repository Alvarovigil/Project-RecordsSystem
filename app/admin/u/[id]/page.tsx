import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/admin/auth";
import { getUserDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminUser({ params }: { params: { id: string } }) {
  if (!isAdminRequest()) redirect("/admin/login");

  const detail = await getUserDetail(params.id);
  if (!detail) notFound();
  const { profile, lists, items, followers, following } = detail;

  const itemsOf = (listId: string) => items.filter((i) => i.list_id === listId);

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-12">
        <Link
          href="/admin"
          className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40 transition hover:text-paper"
        >
          ← Panel
        </Link>

        <header className="mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-paper/[0.08] pb-6">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-paper/10 text-[15px] text-paper/60">
              {profile.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
              ) : (
                profile.display_name?.slice(0, 2).toUpperCase()
              )}
            </span>
            <div>
              <h1 className="text-[22px] leading-tight">{profile.display_name}</h1>
              <p className="mono mt-0.5 text-[11px] text-paper/40">@{profile.username}</p>
              {profile.bio && <p className="mt-2 max-w-[52ch] text-[13px] text-paper/55">{profile.bio}</p>}
              <p className="mono mt-3 text-[10px] uppercase tracking-[0.16em] text-paper/30">
                Alta {new Date(profile.created_at).toLocaleDateString("es-ES")} · id {profile.id.slice(0, 8)}
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link
              href={`/u/${profile.username}`}
              className="border border-paper/20 px-4 py-2 text-[12px] text-paper/70 transition hover:border-paper/50 hover:text-paper"
            >
              Ver perfil público
            </Link>
            <form action="/api/admin/actions" method="post">
              <input type="hidden" name="action" value="delete-user" />
              <input type="hidden" name="userId" value={profile.id} />
              <button className="border border-red-500/30 px-4 py-2 text-[12px] text-red-400/80 transition hover:border-red-500/60 hover:text-red-400">
                Eliminar usuario
              </button>
            </form>
          </div>
        </header>

        <div className="mt-8 grid gap-10 lg:grid-cols-[1.4fr_1fr]">
          <section>
            <h2 className="mono border-b border-paper/[0.07] pb-2 text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Listas · {lists.length}
            </h2>
            <ul className="mt-3 space-y-6">
              {lists.map((l) => (
                <li key={l.id}>
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-[15px]">{l.title}</span>
                      <span className="mono ml-3 text-[10px] uppercase tracking-[0.16em] text-paper/30">
                        {l.kind} · {l.visibility} · {l.item_count} discos
                      </span>
                    </div>
                    {l.kind === "custom" && (
                      <form action="/api/admin/actions" method="post" className="flex gap-2">
                        <input type="hidden" name="listId" value={l.id} />
                        <button
                          name="action"
                          value={l.visibility === "public" ? "hide-list" : "publish-list"}
                          className="mono text-[10px] uppercase tracking-[0.16em] text-paper/35 transition hover:text-paper"
                        >
                          {l.visibility === "public" ? "Ocultar" : "Publicar"}
                        </button>
                        <button
                          name="action"
                          value="delete-list"
                          className="mono text-[10px] uppercase tracking-[0.16em] text-paper/25 transition hover:text-red-400"
                        >
                          Borrar
                        </button>
                      </form>
                    )}
                  </div>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {itemsOf(l.id).slice(0, 14).map((i) => (
                      <li key={i.releases.slug} title={`${i.releases.artist} — ${i.releases.title}`}>
                        <span className="block h-10 w-10 overflow-hidden bg-paper/[0.06]">
                          {i.releases.cover_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={i.releases.cover_url} alt="" className="h-full w-full object-cover" />
                          )}
                        </span>
                      </li>
                    ))}
                    {itemsOf(l.id).length === 0 && (
                      <li className="text-[12px] text-paper/25">vacía</li>
                    )}
                  </ul>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mono border-b border-paper/[0.07] pb-2 text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Seguidores · {followers.length}
            </h2>
            <ul className="mt-3 space-y-1 text-[13px] text-paper/70">
              {followers.map((f: any) => (
                <li key={f.follower_id}>{f.profiles?.display_name ?? f.follower_id}</li>
              ))}
              {followers.length === 0 && <li className="text-paper/25">nadie todavía</li>}
            </ul>

            <h2 className="mono mt-8 border-b border-paper/[0.07] pb-2 text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Siguiendo · {following.length}
            </h2>
            <ul className="mt-3 space-y-1 text-[13px] text-paper/70">
              {following.map((f: any) => (
                <li key={f.following_id}>{f.profiles?.display_name ?? f.following_id}</li>
              ))}
              {following.length === 0 && <li className="text-paper/25">a nadie todavía</li>}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
}
