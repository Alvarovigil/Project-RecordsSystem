import { redirect } from "next/navigation";
import { adminConfigured, isAdmin } from "@/lib/admin/auth";

export const dynamic = "force-dynamic";

export default async function AdminLogin({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  if (await isAdmin()) redirect("/admin");

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink px-6 text-paper">
      <form
        action="/api/admin/login"
        method="post"
        className="w-[360px] max-w-full border border-paper/12 bg-[#0b0b0b]"
      >
        <div className="border-b border-paper/10 px-6 py-3">
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
            Panel · acceso restringido
          </span>
        </div>
        <div className="px-6 py-6">
          {!adminConfigured() ? (
            <p className="text-[13px] text-paper/50">
              Falta definir <code className="text-paper/70">ADMIN_PASSWORD</code> en el entorno
              (mínimo 8 caracteres).
            </p>
          ) : (
            <>
              <label className="mono block text-[10px] uppercase tracking-[0.2em] text-paper/40">
                Contraseña
              </label>
              <input
                type="password"
                name="password"
                autoFocus
                className="mt-1 w-full border-b border-paper/15 bg-transparent py-1.5 text-[15px] text-paper outline-none focus:border-paper/60"
              />
              {searchParams.error && (
                <p className="mt-3 text-[12px] text-red-400">Contraseña incorrecta.</p>
              )}
              <button
                type="submit"
                className="mt-6 w-full bg-paper py-2 text-[13px] text-ink transition hover:bg-paper/85"
              >
                Entrar
              </button>
            </>
          )}
        </div>
      </form>
    </main>
  );
}
