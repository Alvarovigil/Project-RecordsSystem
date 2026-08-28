"use client";

import { useCallback, useEffect, useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import Confirm from "@/components/ui/Confirm";
import { useToast, ToastIcon } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import type { Collaborator } from "@/lib/data/types";

/**
 * Making a list with someone else.
 *
 * Three decisions, each one a place other apps leave a dead end:
 *
 * **The invitation is pending until it is answered.** Adding someone shows them
 * greyed out with "invitación enviada" rather than as a member. Showing them as
 * a collaborator immediately is a small lie, and the moment they never accept,
 * the owner is looking at a list of people who were never there.
 *
 * **A collaborator adds and removes records; only the owner touches the list
 * itself.** Renaming, deleting and inviting stay with one person. If joining a
 * list meant someone could delete it, nobody would ever invite anybody — the
 * asymmetry is what makes the feature usable, not a limitation of it.
 *
 * **Leaving is always available, and it is not the same as being removed.**
 * The owner's menu says "Quitar"; yours says "Salir de la lista". Both exist,
 * both are honest about who is doing what.
 *
 * Invitation is by handle, with the failure spelled out ("No encontramos a
 * @x") rather than a silent no-op — the most common dead end in every invite
 * flow ever shipped.
 */
export default function CollaboratorsSheet({
  open,
  onClose,
  listId,
  listTitle,
  isOwner,
  myId,
}: {
  open: boolean;
  onClose: () => void;
  listId: string;
  listTitle: string;
  isOwner: boolean;
  myId: string;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [people, setPeople] = useState<Collaborator[] | null>(null);
  const [handle, setHandle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removing, setRemoving] = useState<Collaborator | null>(null);

  const load = useCallback(() => {
    repo
      .collaboratorsOf(listId)
      .then(setPeople)
      .catch(() => setPeople([]));
  }, [repo, listId]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!handle.trim() || sending) return;
    setSending(true);
    setError(null);
    // captured before the field is cleared, so the confirmation can name them
    const invited = handle.trim().replace(/^@/, "").toLowerCase();
    const res = await repo.inviteCollaborator(listId, handle);
    setSending(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo invitar.");
      return;
    }
    setHandle("");
    load();
    toast.show(`Invitación enviada a @${invited}`, { media: { icon: ToastIcon.person } });
  };

  const remove = async (c: Collaborator) => {
    setPeople((prev) => prev?.filter((p) => p.profile.id !== c.profile.id) ?? prev);
    await repo.removeCollaborator(listId, c.profile.id);
    toast.show(`${c.profile.displayName} ya no colabora`, { media: { icon: ToastIcon.person } });
  };

  const leave = async () => {
    await repo.leaveList(listId);
    onClose();
    toast.show(`Has salido de ${listTitle}`, { media: { icon: ToastIcon.list } });
  };

  const iCollaborate = people?.some((p) => p.profile.id === myId && p.role === "editor");

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        title="Quién puede editar"
        subtitle={listTitle}
        size="auto"
        width={420}
      >
        {isOwner && (
          <form onSubmit={invite} className="border-b border-line px-5 py-4">
            <label htmlFor="collab-handle" className="text-caption uppercase tracking-label text-content-muted">
              Invitar por nombre de usuario
            </label>
            <div className="mt-2 flex gap-2">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-content-faint">
                  @
                </span>
                <input
                  id="collab-handle"
                  value={handle}
                  onChange={(e) => {
                    setHandle(e.target.value);
                    setError(null);
                  }}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  placeholder="martaferran"
                  className="h-11 w-full rounded-sm border border-line-strong bg-transparent pl-7 pr-3 text-body text-paper outline-none placeholder:text-content-faint focus:border-line-focus"
                />
              </div>
              <Button type="submit" variant="primary" loading={sending} disabled={!handle.trim()}>
                Invitar
              </Button>
            </div>
            {/* the reason, in words, at the place where it failed */}
            {error && (
              <p role="alert" className="mt-2 text-sub text-[#ff6b57]">
                {error}
              </p>
            )}
          </form>
        )}

        <ul className="px-5 py-2">
          {(people ?? []).map((c) => (
            <li key={c.profile.id} className="flex items-center gap-3 py-2.5">
              <Avatar
                name={c.profile.displayName}
                handle={c.profile.username}
                src={c.profile.avatarUrl}
                size="md"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-body ${c.pending ? "text-content-muted" : "text-paper"}`}>
                  {c.profile.displayName}
                  {c.profile.id === myId && <span className="text-content-muted"> · tú</span>}
                </p>
                <p className="truncate text-sub text-content-muted">
                  {c.role === "owner"
                    ? "Propietaria"
                    : c.pending
                      ? "Invitación enviada"
                      : "Puede añadir y quitar discos"}
                </p>
              </div>
              {isOwner && c.role !== "owner" && (
                <button
                  onClick={() => setRemoving(c)}
                  className="pressable shrink-0 px-2 py-2 text-sub text-content-muted transition-colors hover:text-[#ff6b57]"
                >
                  Quitar
                </button>
              )}
            </li>
          ))}
        </ul>

        {/* what an editor can and cannot do, stated once, so nobody has to
            discover it by pressing something that isn't there */}
        {isOwner && (
          <p className="border-t border-line px-5 py-3.5 text-caption leading-relaxed text-content-muted">
            Quien colabora puede añadir y quitar discos. Renombrar, borrar la lista o invitar a más
            gente sigue siendo cosa tuya.
          </p>
        )}

        {!isOwner && iCollaborate && (
          <div className="border-t border-line px-5 py-4">
            <Button variant="danger" block onClick={() => setLeaving(true)}>
              Salir de la lista
            </Button>
          </div>
        )}
      </Sheet>

      <Confirm
        open={leaving}
        onClose={() => setLeaving(false)}
        title={`¿Salir de «${listTitle}»?`}
        body="Dejarás de poder editarla. Los discos que añadiste se quedan en la lista."
        confirmLabel="Salir"
        onConfirm={() => void leave()}
      />
      <Confirm
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        title={`¿Quitar a ${removing?.profile.displayName ?? ""}?`}
        body="Dejará de poder editar esta lista. Lo que ya añadió se queda."
        confirmLabel="Quitar"
        onConfirm={() => removing && void remove(removing)}
      />
    </>
  );
}

/** The faces on a shared list's header — the cheapest way to say "this is shared". */
export function CollaboratorFaces({
  listId,
  onOpen,
}: {
  listId: string;
  onOpen: () => void;
}) {
  const repo = useRepository();
  const [people, setPeople] = useState<Collaborator[]>([]);

  useEffect(() => {
    let alive = true;
    repo
      .collaboratorsOf(listId)
      .then((all) => alive && setPeople(all.filter((c) => !c.pending)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repo, listId]);

  // one person is not a collaboration, and saying so would be noise
  if (people.length < 2) return null;

  return (
    <button
      onClick={onOpen}
      className="pressable flex items-center gap-2 text-sub text-content-muted transition-colors hover:text-paper"
    >
      <span className="flex -space-x-2">
        {people.slice(0, 3).map((c) => (
          <span key={c.profile.id} className="rounded-full ring-2 ring-surface">
            <Avatar
              name={c.profile.displayName}
              handle={c.profile.username}
              src={c.profile.avatarUrl}
              size="xs"
            />
          </span>
        ))}
      </span>
      <span>
        {people.length} {people.length === 1 ? "persona" : "personas"}
      </span>
    </button>
  );
}
