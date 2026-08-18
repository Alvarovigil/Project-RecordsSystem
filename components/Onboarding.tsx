"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getRepository } from "@/lib/data";
import { migrateLocalLibrary, localLibraryMigrated, localLibrarySize } from "@/lib/migrate";
import { useSession } from "@/hooks/useSession";

const HANDLE_RULE = /^[a-z0-9_]{3,24}$/;

/**
 * First run after signing in: claim a name, and bring your collection with you.
 *
 * Two steps, both skippable in one click, because nothing here should stand
 * between you and the shelf you were already using.
 */
export default function Onboarding({ onDone }: { onDone?: () => void }) {
  const { user, profile } = useSession();
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState<"identity" | "library" | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!user || !profile) return;
    // an account that has never been through here keeps the auto-generated
    // handle; that's our signal, and it costs no extra column
    const seen = localStorage.getItem(`vinilos.onboarded.${user.id}`);
    if (seen) return;
    setUsername(profile.username);
    setDisplayName(profile.displayName);
    setPending(localLibraryMigrated() ? 0 : localLibrarySize());
    setStep("identity");
  }, [user, profile]);

  if (!step || !user) return null;

  const finish = () => {
    localStorage.setItem(`vinilos.onboarded.${user.id}`, new Date().toISOString());
    setStep(null);
    onDone?.();
  };

  const saveIdentity = async () => {
    const handle = username.trim().toLowerCase();
    if (!HANDLE_RULE.test(handle)) {
      setError("De 3 a 24 caracteres: letras, números o guion bajo.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await supabase!
      .from("profiles")
      .update({ username: handle, display_name: displayName.trim() || handle })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      setError(
        error.code === "23505" ? "Ese nombre ya está cogido." : "No se ha podido guardar.",
      );
      return;
    }
    if (pending > 0) setStep("library");
    else finish();
  };

  const importLibrary = async () => {
    setBusy(true);
    await migrateLocalLibrary(getRepository());
    setBusy(false);
    finish();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm">
      <div className="w-[440px] max-w-full border border-paper/12 bg-[#0b0b0b]">
        <div className="flex items-center justify-between border-b border-paper/10 px-6 py-3">
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
            {step === "identity" ? "Tu nombre" : "Tu colección"}
          </span>
          <span className="mono text-[10px] tracking-[0.16em] text-paper/25">
            {step === "identity" ? "1 / 2" : "2 / 2"}
          </span>
        </div>

        {step === "identity" ? (
          <div className="px-6 py-6">
            <p className="text-[15px] text-paper">¿Con qué nombre te encuentran?</p>
            <p className="mt-1.5 text-[13px] text-paper/45">
              Tu perfil vivirá en rackr.com/u/{username || "tu-nombre"}
            </p>

            <label className="mono mt-6 block text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Usuario
            </label>
            <div className="mt-1 flex items-center gap-1 border-b border-paper/15 focus-within:border-paper/60">
              <span className="text-[15px] text-paper/30">@</span>
              <input
                autoFocus
                value={username}
                onChange={(e) => setUsername(e.target.value.toLowerCase())}
                className="w-full bg-transparent py-1.5 text-[15px] text-paper outline-none"
              />
            </div>

            <label className="mono mt-5 block text-[10px] uppercase tracking-[0.2em] text-paper/40">
              Nombre visible
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="mt-1 w-full border-b border-paper/15 bg-transparent py-1.5 text-[15px] text-paper outline-none focus:border-paper/60"
            />

            {error && <p className="mt-3 text-[12px] text-red-400">{error}</p>}

            <div className="mt-7 flex items-center justify-between">
              <button
                onClick={finish}
                className="mono text-[10px] uppercase tracking-[0.18em] text-paper/35 transition hover:text-paper"
              >
                Ahora no
              </button>
              <button
                onClick={saveIdentity}
                disabled={busy}
                className="bg-paper px-5 py-2 text-[13px] text-ink transition hover:bg-paper/85 disabled:opacity-40"
              >
                {busy ? "Guardando…" : "Continuar"}
              </button>
            </div>
          </div>
        ) : (
          <div className="px-6 py-6">
            <p className="text-[15px] text-paper">
              Tienes {pending} {pending === 1 ? "disco" : "discos"} en este navegador.
            </p>
            <p className="mt-1.5 text-[13px] text-paper/45">
              Los subimos a tu cuenta con sus listas, y así los ves desde cualquier sitio.
              Tu copia local se queda como está.
            </p>
            <div className="mt-7 flex items-center justify-between">
              <button
                onClick={finish}
                className="mono text-[10px] uppercase tracking-[0.18em] text-paper/35 transition hover:text-paper"
              >
                Empezar de cero
              </button>
              <button
                onClick={importLibrary}
                disabled={busy}
                className="bg-paper px-5 py-2 text-[13px] text-ink transition hover:bg-paper/85 disabled:opacity-40"
              >
                {busy ? "Subiendo…" : "Subir mi colección"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
