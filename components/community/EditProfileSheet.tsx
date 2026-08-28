"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import Avatar from "@/components/ui/Avatar";
import { useToast } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import { useSession } from "@/hooks/useSession";
import { fileToAvatar } from "@/lib/avatar";
import type { Profile } from "@/lib/data/types";

/**
 * Editing who you are.
 *
 * The handle is the only field that can fail, so it is the only one that gets
 * validated while you type — checked after you stop, never on every keystroke,
 * and answered in place. Telling someone their username was taken *after* they
 * press Save is the classic version of this form, and it is the one that makes
 * people abandon it.
 *
 * Save is disabled until something actually changed. A form whose primary
 * button is always live invites a pointless round trip and, worse, makes
 * "nothing happened" look identical to "it worked".
 */
export default function EditProfileSheet({
  open,
  onClose,
  profile,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  profile: Profile;
  onSaved: (p: Profile) => void;
}) {
  const repo = useRepository();
  const { user } = useSession();
  const toast = useToast();
  // the picture Google handed over at sign-in, still reachable after you have
  // replaced it — changing your mind should not mean going to find it again
  const googleAvatar =
    (user?.user_metadata?.avatar_url as string | undefined) ??
    (user?.user_metadata?.picture as string | undefined) ??
    null;
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [username, setUsername] = useState(profile.username);
  const [bio, setBio] = useState(profile.bio);
  const [saving, setSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatarUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const [handleState, setHandleState] = useState<"idle" | "checking" | "free" | "taken" | "invalid">(
    "idle",
  );
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // reopening after a cancel must not show yesterday's half-typed edit
  useEffect(() => {
    if (!open) return;
    setDisplayName(profile.displayName);
    setUsername(profile.username);
    setBio(profile.bio);
    setAvatarUrl(profile.avatarUrl);
    setHandleState("idle");
  }, [open, profile]);

  useEffect(() => {
    clearTimeout(timer.current);
    const clean = username.trim().toLowerCase();
    if (clean === profile.username) return setHandleState("idle");
    if (!/^[a-z0-9_]{3,24}$/.test(clean)) return setHandleState(clean ? "invalid" : "idle");
    setHandleState("checking");
    // 400ms: long enough that typing "marta" isn't five requests, short enough
    // that the answer feels like part of typing
    timer.current = setTimeout(async () => {
      const free = await repo.isUsernameAvailable(clean);
      setHandleState(free ? "free" : "taken");
    }, 400);
    return () => clearTimeout(timer.current);
  }, [username, profile.username, repo]);

  const dirty =
    displayName !== profile.displayName ||
    username !== profile.username ||
    bio !== profile.bio ||
    avatarUrl !== profile.avatarUrl;
  const blocked = handleState === "taken" || handleState === "invalid" || handleState === "checking";

  const save = async () => {
    setSaving(true);
    try {
      const next = await repo.updateProfile({
        displayName: displayName.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
        avatarUrl,
      });
      onSaved(next);
      onClose();
      toast.show("Perfil actualizado");
    } catch (e) {
      toast.show(e instanceof Error ? e.message : "No se pudo guardar.", { tone: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Editar perfil"
      size="tall"
      width={440}
      action={
        <Button size="sm" variant="primary" disabled={!dirty || blocked} loading={saving} onClick={save}>
          Guardar
        </Button>
      }
    >
      <div className="px-5 py-5">
        {/* The photo is a button, not a label with a button next to it: the
            thing you want to press is the picture of yourself. */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="pressable relative shrink-0 rounded-full"
            aria-label="Cambiar la foto"
          >
            <Avatar name={displayName || "?"} handle={username} src={avatarUrl} size="xl" />
            <span className="absolute inset-0 flex items-end justify-center rounded-full bg-gradient-to-t from-ink/75 to-transparent pb-2 text-caption font-medium text-paper">
              Cambiar
            </span>
          </button>
          <div className="min-w-0 text-sub text-content-muted">
            <p>
              {avatarUrl && avatarUrl === googleAvatar
                ? "Tu foto de Google."
                : "Se recorta cuadrada desde el centro y se guarda pequeña."}
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {googleAvatar && avatarUrl !== googleAvatar && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(googleAvatar)}
                  className="pressable text-sub text-content-secondary underline-offset-4 hover:text-paper hover:underline"
                >
                  Usar la de Google
                </button>
              )}
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="pressable text-sub text-content-muted underline-offset-4 hover:text-paper hover:underline"
                >
                  Quitar la foto
                </button>
              )}
            </div>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              // reset first, so picking the same file twice still fires
              e.target.value = "";
              if (!file) return;
              try {
                setAvatarUrl(await fileToAvatar(file));
              } catch (err) {
                toast.show(err instanceof Error ? err.message : "No se pudo leer la imagen.", {
                  tone: "error",
                });
              }
            }}
          />
        </div>

        <Field label="Nombre" hint={`${displayName.length}/40`}>
          <input
            value={displayName}
            maxLength={40}
            onChange={(e) => setDisplayName(e.target.value)}
            className={inputCls}
          />
        </Field>

        <Field
          label="Nombre de usuario"
          hint={
            handleState === "checking"
              ? "Comprobando…"
              : handleState === "free"
                ? "Disponible"
                : handleState === "taken"
                  ? "Ya está cogido"
                  : handleState === "invalid"
                    ? "Solo minúsculas, números y _ (3–24)"
                    : undefined
          }
          tone={handleState === "taken" || handleState === "invalid" ? "error" : "default"}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-content-faint">
              @
            </span>
            <input
              value={username}
              maxLength={24}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(e) => setUsername(e.target.value.replace(/\s/g, ""))}
              className={`${inputCls} pl-7`}
            />
          </div>
          <p className="mt-1.5 text-caption text-content-faint">
            rackr.app/u/{username || "…"}
          </p>
        </Field>

        <Field label="Sobre ti" hint={`${bio.length}/160`}>
          <textarea
            value={bio}
            maxLength={160}
            rows={3}
            onChange={(e) => setBio(e.target.value)}
            className={`${inputCls} h-auto resize-none py-3 leading-relaxed`}
          />
        </Field>
      </div>
    </Sheet>
  );
}

const inputCls =
  "h-11 w-full rounded-control border border-line-strong bg-transparent px-3 text-body text-paper outline-none placeholder:text-content-faint focus:border-line-focus transition-colors duration-fast";

function Field({
  label,
  hint,
  tone = "default",
  children,
}: {
  label: string;
  hint?: string;
  tone?: "default" | "error";
  children: React.ReactNode;
}) {
  return (
    <label className="mt-6 block">
      <span className="flex items-baseline justify-between">
        <span className="text-caption uppercase tracking-label text-content-muted">{label}</span>
        {hint && (
          <span className={`text-caption ${tone === "error" ? "text-[#ff6b57]" : "text-content-faint"}`}>
            {hint}
          </span>
        )}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
