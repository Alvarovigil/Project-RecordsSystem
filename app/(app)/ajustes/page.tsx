"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import TopNav from "@/components/app/TopNav";
import { useSession } from "@/hooks/useSession";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

const HANDLE_RULE = /^[a-z0-9_]{3,24}$/;

/** Your account: who you are, and how to leave. */
export default function SettingsPage() {
  const { available, loading, user, profile, signInWithGoogle, signOut } = useSession();
  const supabase = getSupabaseBrowserClient();
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setBio(profile.bio ?? "");
  }, [profile]);

  const save = async () => {
    const handle = username.trim().toLowerCase();
    if (!HANDLE_RULE.test(handle)) {
      setError("De 3 a 24 caracteres: letras, números o guion bajo.");
      setState("error");
      return;
    }
    setState("saving");
    setError(null);
    const { error } = await supabase!
      .from("profiles")
      .update({ username: handle, display_name: displayName.trim(), bio: bio.trim() })
      .eq("id", user!.id);
    if (error) {
      setError(error.code === "23505" ? "Ese nombre ya está cogido." : "No se ha podido guardar.");
      setState("error");
      return;
    }
    setState("saved");
    setTimeout(() => setState("idle"), 2000);
  };

  return (
    <main className="min-h-screen bg-ink pb-28 text-paper">
      <TopNav />
      <div className="mx-auto w-full max-w-[560px] px-6 py-16">
        <h1 className="mt-2 text-[26px] leading-tight">Ajustes</h1>

        {!available ? (
          <p className="mt-8 text-[13px] text-paper/45">
            Sin base de datos configurada, tu colección vive solo en este navegador.
          </p>
        ) : loading ? null : !user ? (
          <div className="mt-8">
            <p className="text-[14px] text-paper/60">
              Entra para guardar tu colección y que otros puedan verla.
            </p>
            <button
              onClick={signInWithGoogle}
              className="mt-5 bg-paper px-5 py-2 text-[13px] text-ink transition hover:bg-paper/85"
            >
              Entrar con Google
            </button>
          </div>
        ) : (
          <>
            <section className="mt-10">
              <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Perfil</h2>

              <Field label="Usuario">
                <div className="flex items-center gap-1">
                  <span className="text-[15px] text-paper/30">@</span>
                  <input
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    className="w-full bg-transparent py-1.5 text-[15px] text-paper outline-none"
                  />
                </div>
              </Field>

              <Field label="Nombre visible">
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full bg-transparent py-1.5 text-[15px] text-paper outline-none"
                />
              </Field>

              <Field label="Bio">
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={3}
                  placeholder="Qué coleccionas, y por qué"
                  className="w-full resize-none bg-transparent py-1.5 text-[15px] text-paper outline-none placeholder:text-paper/25"
                />
              </Field>

              {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}

              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={save}
                  disabled={state === "saving"}
                  className="bg-paper px-5 py-2 text-[13px] text-ink transition hover:bg-paper/85 disabled:opacity-40"
                >
                  {state === "saving" ? "Guardando…" : "Guardar"}
                </button>
                {state === "saved" && (
                  <span className="mono text-[10px] uppercase tracking-[0.18em] text-paper/40">
                    Guardado
                  </span>
                )}
                <Link
                  href={`/u/${profile?.username ?? ""}`}
                  className="mono text-[10px] uppercase tracking-[0.18em] text-paper/40 transition hover:text-paper"
                >
                  Ver mi perfil →
                </Link>
              </div>
            </section>

            <section className="mt-14 border-t border-paper/[0.08] pt-8">
              <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">Cuenta</h2>
              <p className="mt-3 text-[13px] text-paper/45">
                Entraste con Google como {user.email}.
              </p>
              <button
                onClick={() => void signOut()}
                className="mt-5 border border-paper/25 px-4 py-2 text-[13px] text-paper/70 transition hover:border-paper/60 hover:text-paper"
              >
                Cerrar sesión
              </button>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-6 block">
      <span className="mono block text-[10px] uppercase tracking-[0.2em] text-paper/40">
        {label}
      </span>
      <div className="mt-1 border-b border-paper/15 focus-within:border-paper/60">{children}</div>
    </label>
  );
}
