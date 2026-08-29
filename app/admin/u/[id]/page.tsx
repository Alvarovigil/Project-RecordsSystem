import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin/auth";
import { getAccount, getUserDetail } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminUser({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { done?: string; error?: string };
}) {
  if (!(await isAdmin())) redirect("/admin/login");

  const [detail, account] = await Promise.all([
    getUserDetail(params.id),
    getAccount(params.id),
  ]);
  if (!detail) notFound();
  const { profile, lists, items, followers, following } = detail;
  const suspended = Boolean(account?.bannedUntil);

  const fecha = (iso?: string | null) =>
    iso ? new Date(iso).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—";

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
          <div className="flex flex-wrap items-start gap-3">
            <Link
              href={`/u/${profile.username}`}
              className="border border-paper/20 px-4 py-2 text-[12px] text-paper/70 transition hover:border-paper/50 hover:text-paper"
            >
              Ver perfil público
            </Link>

            {/* Verification: a mark, not a permission. Nothing about the
                account changes — it only says, next to the name, that this is
                who it claims to be. Reversible in one press, because a badge
                granted by mistake is a lie the product is telling. */}
            <form action="/api/admin/actions" method="post">
              <input
                type="hidden"
                name="action"
                value={profile.verified ? "unverify-user" : "verify-user"}
              />
              <input type="hidden" name="userId" value={profile.id} />
              <button className="border border-paper/20 px-4 py-2 text-[12px] text-paper/70 transition hover:border-paper/50 hover:text-paper">
                {profile.verified ? "Quitar verificación" : "Verificar cuenta"}
              </button>
            </form>

            {/* Suspending comes first and looks ordinary, because it is the
                action you almost always want: reversible, and it leaves the
                collection standing. */}
            <form action="/api/admin/actions" method="post">
              <input type="hidden" name="action" value={suspended ? "unsuspend-user" : "suspend-user"} />
              <input type="hidden" name="userId" value={profile.id} />
              <button className="border border-paper/20 px-4 py-2 text-[12px] text-paper/70 transition hover:border-paper/50 hover:text-paper">
                {suspended ? "Reactivar cuenta" : "Suspender cuenta"}
              </button>
            </form>

            {/* Deleting is folded away and asks you to type the handle. The
                server checks it too — this is the reminder, not the lock. */}
            <details className="group">
              <summary className="cursor-pointer list-none border border-red-500/25 px-4 py-2 text-[12px] text-red-400/70 transition hover:border-red-500/50 hover:text-red-400">
                Eliminar cuenta…
              </summary>
              <form
                action="/api/admin/actions"
                method="post"
                className="mt-2 w-[280px] border border-red-500/25 bg-[#160c0c] p-3"
              >
                <input type="hidden" name="action" value="delete-user" />
                <input type="hidden" name="userId" value={profile.id} />
                <p className="text-[12px] leading-relaxed text-paper/60">
                  Se borran el perfil, {lists.length} {lists.length === 1 ? "lista" : "listas"},
                  sus discos y todo su grafo de seguimiento. No se puede deshacer.
                </p>
                <label className="mono mt-3 block text-[9px] uppercase tracking-[0.18em] text-paper/40">
                  Escribe {profile.username} para confirmar
                </label>
                <input
                  name="confirm"
                  autoComplete="off"
                  spellCheck={false}
                  className="mt-1.5 h-9 w-full border border-paper/20 bg-transparent px-2 text-[13px] text-paper outline-none focus:border-paper/60"
                />
                <button className="mt-2 w-full bg-red-500/80 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-red-500">
                  Eliminar definitivamente
                </button>
              </form>
            </details>
          </div>
        </header>

        {searchParams.error === "confirmacion" && (
          <p role="alert" className="mt-4 border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-400">
            El nombre no coincidía, así que no se ha borrado nada.
          </p>
        )}
        {searchParams.done && (
          <p className="mt-4 border border-paper/15 px-4 py-3 text-[13px] text-paper/70">
            Cuenta {searchParams.done}.
          </p>
        )}

        {/* the account, as opposed to the profile: what you need to answer an
            email about it */}
        <section className="mt-8 grid grid-cols-2 gap-px bg-paper/[0.07] sm:grid-cols-4">
          <Fact label="Correo" value={account?.email ?? "—"} />
          <Fact label="Entra con" value={account?.provider ?? "—"} />
          <Fact label="Última visita" value={fecha(account?.lastSignInAt)} />
          <Fact
            label="Estado"
            value={suspended ? "Suspendida" : account?.confirmed ? "Activa" : "Sin confirmar"}
            tone={suspended ? "warn" : "normal"}
          />
        </section>

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

function Fact({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "warn";
}) {
  return (
    <div className="bg-ink px-4 py-4">
      <div className="mono text-[9px] uppercase tracking-[0.18em] text-paper/35">{label}</div>
      <div
        className={`mt-1.5 truncate text-[14px] ${tone === "warn" ? "text-[#ff6b57]" : "text-paper/85"}`}
        title={value}
      >
        {value}
      </div>
    </div>
  );
}
