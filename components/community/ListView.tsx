"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState, { CoverGridSkeleton } from "@/components/ui/EmptyState";
import SaveListButton from "./SaveListButton";
import FollowButton from "./FollowButton";
import CollaboratorsSheet, { CollaboratorFaces } from "./CollaboratorsSheet";
import { useRepository } from "@/hooks/useRepository";
import { useRelationship } from "@/hooks/useRelationship";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import { listTitleFor } from "@/lib/list-title";

/**
 * A list, whoever made it.
 *
 * One screen for your own list, someone else's, and one you share — because
 * the alternative (which this replaced) was two components that had already
 * grown different headers, different empty states, and a follow button on one
 * of them only.
 *
 * What changes by ownership is which controls appear, never the shape:
 *
 * | you own it        | Compartir · Invitar · (editar en la estantería) |
 * | someone else's    | Guardar · ⋯ (duplicar, compartir, ver perfil)   |
 * | you collaborate   | as above, plus the faces and "salir de la lista" |
 *
 * The back link names the person rather than saying "Atrás". You arrived here
 * from a feed, a search or a record — the browser's back button is a guess,
 * and "← Marta Ferrán" is a destination.
 */
export default function ListView({
  listId,
  ownerId,
  slug,
  /** rendered before the fetch lands so the title doesn't pop in */
  initial,
}: {
  listId?: string;
  ownerId: string;
  slug: string;
  initial?: Partial<ListWithRecord>;
}) {
  const repo = useRepository();
  const [list, setList] = useState<ListWithRecord | null>(null);
  const [items, setItems] = useState<Vinyl[] | null>(null);
  const [attribution, setAttribution] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const { rel } = useRelationship(ownerId);
  const isOwner = rel?.isYou ?? false;

  const load = useCallback(async () => {
    const lists = await repo.listsOfProfile(ownerId);
    const found = lists.find((l) => (listId ? l.id === listId : l.slug === slug)) ?? null;
    setList(found);
    if (!found) return setItems([]);
    const releases = await repo.releasesOfList(found.id);
    setItems(releases);

    // Who put each record here — only worth asking on a shared list, where the
    // answer is the difference between "our list" and "a pile".
    const people = await repo.collaboratorsOf(found.id);
    if (people.filter((p) => !p.pending).length > 1) {
      const pairs = await Promise.all(
        releases.map(async (r) => [r.id, (await repo.addedBy(found.id, r.id))?.displayName ?? ""] as const),
      );
      setAttribution(Object.fromEntries(pairs.filter(([, name]) => name)));
    }
  }, [repo, ownerId, listId, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  // "Mi Colección" on someone else's page names a person who is not you
  const title = list
    ? listTitleFor(list, isOwner)
    : initial?.title
      ? listTitleFor(initial as Parameters<typeof listTitleFor>[0], isOwner)
      : "…";
  const owner = list?.owner ?? initial?.owner;

  const share = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        /* cancelling is not failing */
      }
      return;
    }
    await navigator.clipboard?.writeText(url);
  };

  return (
    <Page width={1000}>
      {owner && (
        <Link
          href={`/u/${owner.username}`}
          className="pressable inline-flex items-center gap-2 text-sub text-content-muted transition-colors hover:text-paper"
        >
          <span aria-hidden>←</span>
          {owner.displayName}
        </Link>
      )}

      <header className="mt-5 border-b border-line pb-7">
        <h1 className="text-display font-medium leading-tight text-paper">{title}</h1>
        {(list?.description || initial?.description) && (
          <p className="mt-2.5 max-w-[58ch] text-body leading-relaxed text-content-secondary">
            {list?.description ?? initial?.description}
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-3">
          {owner && (
            <Link
              href={`/u/${owner.username}`}
              className="pressable flex items-center gap-2 text-sub text-content-secondary transition-colors hover:text-paper"
            >
              <Avatar
                name={owner.displayName}
                handle={owner.username}
                src={owner.avatarUrl}
                size="sm"
              />
              {owner.displayName}
            </Link>
          )}
          <span className="text-sub text-content-muted">
            {items?.length ?? list?.itemCount ?? 0} discos
          </span>
          {list && <CollaboratorFaces listId={list.id} onOpen={() => setSharing(true)} />}
        </div>

        {/* The controls, by who you are. Never a disabled button explaining
            what you would be able to do if you were someone else. */}
        <div className="mt-6 flex flex-wrap gap-2.5">
          {isOwner ? (
            <>
              <Button variant="secondary" onClick={() => setSharing(true)}>
                Invitar a editar
              </Button>
              <Button variant="ghost" onClick={share}>
                Compartir
              </Button>
              <Button variant="ghost" href="/coleccion">
                Editar en mi colección
              </Button>
            </>
          ) : list?.kind === "collection" && owner ? (
            /**
             * Somebody's collection is not a list you keep.
             *
             * Every account has exactly one and it is not authored — it is
             * everything they own, and it changes every time they buy a
             * record. Keeping a copy of that on your shelf would be keeping a
             * copy of a person. So the button is not disabled here, it is
             * absent, and what replaces it is the thing you actually wanted
             * when you pressed it: follow them, and their additions come to
             * you in Actividad.
             */
            <>
              <FollowButton profileId={owner.id} displayName={owner.displayName} />
              <Button variant="ghost" onClick={share}>
                Compartir
              </Button>
            </>
          ) : (
            list &&
            owner && (
              <SaveListButton
                listId={list.id}
                listTitle={title}
                ownerName={owner.displayName}
                ownerHandle={owner.username}
              />
            )
          )}
        </div>
        {!isOwner && list?.kind === "collection" && owner && (
          <p className="mt-3 max-w-[52ch] text-sub leading-relaxed text-content-muted">
            La colección de alguien no se guarda: es todo lo que tiene y cambia cada vez que compra
            un disco. Sigue a {owner.displayName} y verás lo que va añadiendo.
          </p>
        )}
      </header>

      <div className="mt-8">
        {items === null ? (
          <CoverGridSkeleton count={10} />
        ) : items.length === 0 ? (
          <EmptyState
            title={isOwner ? "Esta lista todavía está vacía" : "Aquí no hay discos todavía"}
            body={
              isOwner
                ? "Abre tu colección y arrastra discos a esta lista, o guárdalos desde el buscador."
                : "Quien la hizo no ha añadido nada por ahora. Guárdala y te enterarás cuando lo haga."
            }
            action={
              isOwner
                ? { label: "Ir a mi colección", href: "/coleccion" }
                : { label: "Explorar otras listas", href: "/explorar" }
            }
          />
        ) : (
          <ul className="grid grid-cols-2 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-5">
            {items.map((v) => (
              <li key={v.id}>
                <Cover vinyl={v} alt={v.title} />
                <p className="mt-2 truncate text-sub text-paper">{v.title}</p>
                <p className="truncate text-caption text-content-muted">{v.artist}</p>
                {/* attribution only where it means something: on a shared list */}
                {attribution[v.id] && (
                  <p className="mt-1 truncate text-caption text-content-faint">
                    lo puso {attribution[v.id]}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {list && (
        <CollaboratorsSheet
          open={sharing}
          onClose={() => {
            setSharing(false);
            void load();
          }}
          listId={list.id}
          listTitle={list.title}
          isOwner={isOwner}
          myId={ownerId}
        />
      )}
    </Page>
  );
}
