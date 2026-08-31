"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getRepository, resetRepository } from "@/lib/data";
import { migrateLocalLibrary, localLibraryMigrated, localLibrarySize } from "@/lib/migrate";
import { useSession } from "@/hooks/useSession";
import Avatar from "@/components/ui/Avatar";
import { fileToAvatar } from "@/lib/avatar";
import { useDevice } from "@/hooks/useDevice";
import Slides from "@/components/onboarding/Slides";

const HANDLE_RULE = /^[a-z0-9_]{3,24}$/;

/**
 * First run after signing in: claim a name, and bring your collection with you.
 *
 * Two steps, both skippable in one click, because nothing here should stand
 * between you and the shelf you were already using.
 *
 * "Have you been through this?" is a fact about the account, so it lives on the
 * account. It used to live in localStorage — which Safari purges after seven
 * days of not visiting, as anti-tracking policy that cannot tell a preference
 * from a tracker. The app therefore asked people their name again every week,
 * and again on every new device. A column answers it once, everywhere.
 */
export default function Onboarding({ onDone }: { onDone?: () => void }) {
  const { user, profile } = useSession();
  const { isPhone } = useDevice();
  const supabase = getSupabaseBrowserClient();
  const [step, setStep] = useState<"slides" | "identity" | "library" | null>(null);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /**
   * The photo Google handed over at sign-in, kept apart from the one in use.
   *
   * Signing up with Google already brings a picture — the trigger copies it —
   * so the question here is not "give us a photo", it is "keep this one, or
   * use another". Holding on to the original is what makes that reversible:
   * upload something, change your mind, and the one you arrived with is still
   * there. Ask people to re-find their own face and most will just leave it.
   */
  const googleAvatar =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    if (!user || !profile || !supabase) return;
    let alive = true;
    supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        // Only a definite "no" opens the step. A failed read must not put the
        // form in front of someone who already answered it — asking twice is
        // worse than never asking.
        if (!alive || !data || data.onboarded_at) return;
        setUsername(profile.username);
        setDisplayName(profile.displayName);
        setAvatarUrl(profile.avatarUrl ?? googleAvatar);
        setPending(localLibraryMigrated() ? 0 : localLibrarySize());
        setStep("slides");
      });
    return () => {
      alive = false;
    };
  }, [user, profile, supabase]);

  if (!step || !user) return null;

  const finish = () => {
    // Closed immediately, recorded in the background: waiting on a round trip
    // to dismiss a panel you already finished with is the wrong trade, and if
    // the write fails the worst case is being asked once more.
    setStep(null);
    onDone?.();
    void supabase
      ?.from("profiles")
      .update({ onboarded_at: new Date().toISOString() })
      .eq("id", user.id);
    // the shell hosts this now, so the page underneath re-reads its data
    resetRepository();
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
      .update({
        username: handle,
        display_name: displayName.trim() || handle,
        avatar_url: avatarUrl,
      })
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

  /**
   * A screen on a phone, a dialog on a desktop.
   *
   * The same 440px box in the middle of a black scrim was the whole of this
   * on both, and on a phone that is a website's idea of a first run: a card
   * floating over a page you cannot reach, with the keyboard swallowing half
   * of it. First launch of an installed app owns the screen. On a desktop it
   * is genuinely a dialog — there is a window behind it that still means
   * something — so there it stays a dialog.
   */
  const deck = step === "slides";

  return (
    <div
      className={
        isPhone
          ? "fixed inset-0 z-[70] bg-surface"
          : "fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-6 backdrop-blur-sm"
      }
    >
      <div
        className={
          isPhone
            ? "h-full"
            : `w-[440px] max-w-full border border-line-overlay bg-surface-raised shadow-overlay ${
                deck ? "h-[620px] max-h-[86vh]" : ""
              }`
        }
      >
        {deck ? (
          <Slides onDone={() => setStep("identity")} />
        ) : (
        <div className={isPhone ? "flex h-full flex-col" : undefined}>
        <div
          className="flex items-center justify-between border-b border-paper/10 px-6 py-3"
          style={isPhone ? { paddingTop: "calc(var(--safe-top) + 14px)" } : undefined}
        >
          <span className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
            {step === "identity" ? "Tu nombre" : "Tu colección"}
          </span>
        </div>

        {step === "identity" ? (
          /**
           * Claiming a name, as a screen rather than as a form.
           *
           * It was a dialog's worth of labels: two hairline fields under two
           * mono captions, a photo tucked beside a paragraph of instructions,
           * and the address you were choosing mentioned in passing above it
           * all. Everything was there and nothing was the subject.
           *
           * The subject is your face and your handle, so those are the screen:
           * the photo big and centred, because the thing somebody wants to
           * press is their own face; the handle in a field with the @ printed
           * inside it, so nobody types one and nobody wonders whether they
           * should; and the address it produces written out underneath as it
           * is typed, because that is what the question is really asking and
           * showing the answer beats describing it.
           */
          <div
            className={`px-6 py-6 ${isPhone ? "scroll-y min-h-0 flex-1 overflow-y-auto" : ""}`}
            style={isPhone ? { paddingBottom: "calc(var(--safe-bottom) + 24px)" } : undefined}
          >
            <div className="flex flex-col items-center text-center">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                aria-label="Cambiar la foto"
                className="pressable relative rounded-full transition hover:opacity-90"
              >
                <Avatar name={displayName || "?"} handle={username} src={avatarUrl} size="lg" />
                <span className="absolute -bottom-1 left-1/2 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-full bg-paper text-ink ring-4 ring-surface-raised">
                  <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2 4.6h2.2L5.2 3h3.6l1 1.6H12v6.2H2z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                    <circle cx="7" cy="7.6" r="1.9" stroke="currentColor" strokeWidth="1.2" />
                  </svg>
                </span>
              </button>

              <h2 className="mt-6 text-title font-medium leading-tight text-paper">
                ¿Cómo te encuentran?
              </h2>
              <p className="mt-2 text-sub leading-relaxed text-content-muted">
                {avatarUrl && avatarUrl === googleAvatar
                  ? "Tu foto de Google. Puedes dejarla o tocarla para cambiarla."
                  : avatarUrl
                    ? "Toca la foto para cambiarla."
                    : "Sin foto se usan tus iniciales, que también está bien."}
              </p>
              {googleAvatar && avatarUrl !== googleAvatar && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(googleAvatar)}
                  className="mt-2 text-sub text-content-muted underline-offset-4 transition hover:text-paper hover:underline"
                >
                  Usar la de Google
                </button>
              )}
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // so picking the same file twice still fires
                if (!file) return;
                try {
                  setAvatarUrl(await fileToAvatar(file));
                  setError(null);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "No se pudo leer la imagen.");
                }
              }}
            />

            <div className="mt-8 space-y-3">
              <div className="flex items-center gap-1 rounded-control bg-fill-subtle px-4">
                <span className="text-body text-content-faint">@</span>
                <input
                  autoFocus
                  value={username}
                  onChange={(e) => setUsername(e.target.value.toLowerCase())}
                  aria-label="Tu usuario"
                  placeholder="tu-nombre"
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full bg-transparent py-4 text-body text-paper outline-none placeholder:text-content-faint"
                />
              </div>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                aria-label="Tu nombre visible"
                placeholder="Nombre visible"
                className="w-full rounded-control bg-fill-subtle px-4 py-4 text-body text-paper outline-none placeholder:text-content-faint"
              />
            </div>

            <p className="mt-3 text-center text-caption text-content-faint">
              <span className="mono">rackr.club/u/{username || "tu-nombre"}</span>
            </p>

            {error && <p className="mt-3 text-center text-sub text-[#ff6b57]">{error}</p>}

            <button
              onClick={saveIdentity}
              disabled={busy}
              className="pressable mt-7 flex h-12 w-full items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85 disabled:opacity-40"
            >
              {busy ? "Guardando…" : "Continuar"}
            </button>
            <button
              onClick={finish}
              className="pressable mt-3 h-11 w-full text-sub text-content-muted transition hover:text-paper"
            >
              Ahora no
            </button>
          </div>
        ) : (
          <div
            className={`px-6 py-6 ${isPhone ? "scroll-y min-h-0 flex-1 overflow-y-auto" : ""}`}
            style={isPhone ? { paddingBottom: "calc(var(--safe-bottom) + 24px)" } : undefined}
          >
            <p className="text-heading font-medium leading-tight text-paper">
              Tienes {pending} {pending === 1 ? "disco" : "discos"} en este navegador
            </p>
            <p className="mt-2 text-sub leading-relaxed text-content-muted">
              Los subimos a tu cuenta con sus listas, y así los ves desde cualquier sitio.
              Tu copia local se queda como está.
            </p>
            {/* The same pair of controls as the step before it: one full-width
                capsule for the thing you came to do, one quiet line under it
                for the way past. A screen that ends in a small dark button on
                the left and a small light one on the right is a dialog, and by
                this point nobody is in a dialog. */}
            <button
              onClick={importLibrary}
              disabled={busy}
              className="pressable mt-7 flex h-12 w-full items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85 disabled:opacity-40"
            >
              {busy ? "Subiendo…" : "Subir mi colección"}
            </button>
            <button
              onClick={finish}
              className="pressable mt-3 h-11 w-full text-sub text-content-muted transition hover:text-paper"
            >
              Empezar de cero
            </button>
          </div>
        )}
        </div>
        )}
      </div>
    </div>
  );
}
