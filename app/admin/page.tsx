import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminRequest } from "@/lib/admin/auth";
import { getOverview, listUsers } from "@/lib/admin/queries";

export const dynamic = "force-dynamic";

export default async function AdminHome({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  if (!isAdminRequest()) redirect("/admin/login");

  const overview = await getOverview();
  const users = await listUsers(searchParams.q ?? "");

  if (!overview) return <NoService />;

  const LABELS: Record<string, string> = {
    profiles: "Usuarios",
    releases: "Discos en catálogo",
    lists: "Listas",
    list_items: "Discos en listas",
    follows: "Seguimientos",
    list_follows: "Listas seguidas",
  };

  return (
    <main className="min-h-screen bg-ink text-paper">
      <div className="mx-auto w-full max-w-[1100px] px-6 py-12">
        <header className="flex items-baseline justify-between border-b border-paper/[0.08] pb-5">
          <h1 className="text-[22px]">Panel</h1>
          <div className="flex items-center gap-5">
            <Link
              href="/coleccion"
              className="mono text-[10px] uppercase tracking-[0.18em] text-paper/40 transition hover:text-paper"
            >
              Ir a la app
            </Link>
            <Link
              href="/api/admin/login"
              className="mono text-[10px] uppercase tracking-[0.18em] text-paper/40 transition hover:text-paper"
            >
              Salir
            </Link>
          </div>
        </header>

        {/* A total tells you how big the thing is. It says nothing about which
            way it is going, which is the only question you actually have when
            you open a panel — so the last seven days ride under the number. */}
        <section className="mt-8 grid grid-cols-2 gap-px bg-paper/[0.07] sm:grid-cols-3 lg:grid-cols-6">
          {Object.entries(LABELS).map(([key, label]) => {
            const delta =
              key === "profiles"
                ? overview.growth.signups7
                : key === "list_items"
                  ? overview.growth.added7
                  : null;
            return (
              <div key={key} className="bg-ink px-4 py-5">
                <div className="mono text-[9px] uppercase tracking-[0.18em] text-paper/35">
                  {label}
                </div>
                <div className="mt-2 text-[26px] leading-none">{overview.counts[key] ?? 0}</div>
                {delta !== null && (
                  <div className="mono mt-2 text-[9px] uppercase tracking-[0.16em] text-paper/30">
                    {delta > 0 ? `+${delta} en 7 días` : "sin novedad en 7 días"}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {/* Two windows beside each other: whether this week looks like the
            month it sits in. A ratio a person can read at a glance beats a
            chart nobody scrolls to. */}
        <section className="mt-px grid grid-cols-2 gap-px bg-paper/[0.07]">
          <Window
            label="Altas"
            week={overview.growth.signups7}
            month={overview.growth.signups30}
          />
          <Window
            label="Discos guardados"
            week={overview.growth.added7}
            month={overview.growth.added30}
          />
        </section>

        <section className="mt-12">
          <div className="flex items-baseline justify-between border-b border-paper/[0.07] pb-3">
            <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Usuarios</h2>
            <form className="flex items-center gap-2">
              <input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Buscar por nombre o usuario"
                className="w-[240px] border-b border-paper/15 bg-transparent py-1 text-[13px] text-paper outline-none placeholder:text-paper/25 focus:border-paper/50"
              />
            </form>
          </div>

          <table className="mt-2 w-full text-left">
            <thead>
              <tr className="mono text-[9px] uppercase tracking-[0.16em] text-paper/30">
                <th className="py-3 font-normal">Usuario</th>
                <th className="py-3 text-right font-normal">Listas</th>
                <th className="py-3 text-right font-normal">Discos</th>
                <th className="py-3 text-right font-normal">Seguidores</th>
                <th className="py-3 text-right font-normal">Siguiendo</th>
                <th className="py-3 text-right font-normal">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-paper/[0.06]">
              {users.map((u) => (
                <tr key={u.id} className="transition hover:bg-paper/[0.03]">
                  <td className="py-3">
                    <Link href={`/admin/u/${u.id}`} className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60">
                        {u.avatarUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={u.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          u.displayName.slice(0, 2).toUpperCase()
                        )}
                      </span>
                      <span>
                        <span className="block text-[14px]">{u.displayName}</span>
                        <span className="mono block text-[11px] text-paper/35">@{u.username}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="py-3 text-right text-[13px] text-paper/70">{u.lists}</td>
                  <td className="py-3 text-right text-[13px] text-paper/70">{u.records}</td>
                  <td className="py-3 text-right text-[13px] text-paper/70">{u.followers}</td>
                  <td className="py-3 text-right text-[13px] text-paper/70">{u.following}</td>
                  <td className="mono py-3 text-right text-[11px] text-paper/30">
                    {new Date(u.createdAt).toLocaleDateString("es-ES")}
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-[13px] text-paper/35">
                    Todavía no hay usuarios registrados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

function NoService() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper/50">
      <p className="max-w-[40ch] text-center text-[13px]">
        El panel necesita <code className="text-paper/70">SUPABASE_SERVICE_ROLE_KEY</code> en el
        entorno para poder leer todos los datos.
      </p>
    </main>
  );
}

/**
 * One measure, two windows.
 *
 * Seven days against thirty, with the week's share of the month spelled out.
 * If the last week holds a quarter of the month it is steady; much more and
 * something is happening; much less and something stopped.
 */
function Window({ label, week, month }: { label: string; week: number; month: number }) {
  const share = month > 0 ? Math.round((week / month) * 100) : 0;
  return (
    <div className="bg-ink px-4 py-5">
      <div className="mono text-[9px] uppercase tracking-[0.18em] text-paper/35">{label}</div>
      <div className="mt-2 flex items-baseline gap-3">
        <span className="text-[26px] leading-none">{week}</span>
        <span className="text-[13px] text-paper/40">esta semana</span>
      </div>
      <div className="mono mt-2 text-[9px] uppercase tracking-[0.16em] text-paper/30">
        {month} en 30 días{month > 0 ? ` · la semana es el ${share}%` : ""}
      </div>
    </div>
  );
}
