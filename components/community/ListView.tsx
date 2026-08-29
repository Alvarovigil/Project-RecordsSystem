"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState, { CoverGridSkeleton } from "@/components/ui/EmptyState";
import SaveListButton from "./SaveListButton";
import FollowButton from "./FollowButton";
import ListMetrics from "./ListMetrics";
import CollaboratorsSheet, { CollaboratorFaces } from "./CollaboratorsSheet";
import RecordSheet from "@/components/mobile/RecordSheet";
import Crate from "@/components/ui/Crate";
import { coverFor } from "@/lib/cover";
import { useLibrary } from "@/hooks/useLibrary";
import { usePlaybackContext } from "@/lib/playback-context";
import { useRepository } from "@/hooks/useRepository";
import { useRelationship } from "@/hooks/useRelationship";
import { useBackTo } from "@/hooks/useBackTo";
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
 * The back link names a place rather than saying "Atrás", and the place is
 * where you actually came from: Explorar, Actividad, a profile. Naming the
 * owner every time was right for one of the four ways in and sent everybody
 * else somewhere they had never been.
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
  /** the record whose sheet is open, wherever you found it */
  const [open, setOpen] = useState<Vinyl | null>(null);
  const lib = useLibrary();
  const audio = usePlaybackContext();
  const { nowPlaying, playing } = audio;
  const { rel } = useRelationship(ownerId);
  // where you came from, when it was one of ours; the owner's profile when it
  // was not — the one destination that is always true for this page
  const cameFrom = useBackTo();
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
          href={cameFrom?.href ?? `/u/${owner.username}`}
          className="pressable inline-flex items-center gap-2 text-sub text-content-muted transition-colors hover:text-paper"
        >
          <span aria-hidden>←</span>
          {/* coming from the owner's own profile, say their name rather than
              their handle — the page already knows it, and "@nachobeltran" is
              an address where "Nacho Beltrán" is a person */}
          {cameFrom && cameFrom.href !== `/u/${owner.username}`
            ? cameFrom.label
            : owner.displayName}
        </Link>
      )}

      {/**
       * The crate, then the words.
       *
       * A list opened cold was a title over a paragraph over a row of chips —
       * the same header any page anywhere has. But a list IS its records, and
       * the fastest way to know whether this one is for you is to see three of
       * them. The crate is the same object the card in Explorar shows, so
       * arriving here confirms what you clicked instead of replacing it.
       */}
      <header className="mt-5 flex flex-col gap-6 border-b border-line pb-7 sm:flex-row sm:items-end sm:gap-8">
        {items && items.length > 0 && (
          <span className="w-[168px] shrink-0 sm:w-[196px]">
            <Crate covers={items.slice(-3).reverse().map((v) => coverFor(v))} />
          </span>
        )}

        <div className="min-w-0 flex-1">
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
          {/* Las dos medidas, en la misma línea que el autor y el tamaño:
              aquí no son un adorno de la tarjeta, son parte de lo que es la
              lista. El corazón es el único gesto que se puede dar sin
              decidir nada — guardarla se decide en el botón de abajo. */}
          {list && (
            <ListMetrics
              listId={list.id}
              saves={list.saves}
              likes={list.likes}
              size="md"
            />
          )}
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
        </div>
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
            {items.map((v) => {
              const sounding = nowPlaying?.id === v.id;
              return (
                <li key={v.id} className="group relative">
                  {/**
                   * The same tile as the collection's grid, because it is the
                   * same object. A record on somebody else's list was a
                   * picture with a caption — you could not play it, open it or
                   * take it. But what you want when you see a record you like
                   * on a stranger's shelf is exactly what you want on your
                   * own, and the answer should not depend on whose page you
                   * happen to be standing on.
                   */}
                  <button
                    onClick={() => setOpen(v)}
                    className="block w-full text-left"
                    aria-label={`${v.artist} — ${v.title}`}
                  >
                    <span
                      className={`relative block aspect-square w-full overflow-hidden bg-fill-subtle outline-offset-2 transition ${
                        sounding ? "outline outline-1 outline-paper/70" : ""
                      }`}
                    >
                      <Cover vinyl={v} alt={v.title} />
                    </span>
                  </button>

                  {v.previewUrl && (
                    <button
                      onClick={() => (sounding ? audio.toggleCurrent() : audio.play(v))}
                      aria-label={sounding && playing ? `Pausar ${v.title}` : `Escuchar ${v.title}`}
                      className={`pressable absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-line-strong bg-ink/70 text-paper backdrop-blur-sm transition focus:opacity-100 ${
                        sounding ? "opacity-100" : "reveal-on-hover"
                      }`}
                    >
                      {sounding && playing ? (
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                          <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                          <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                        </svg>
                      ) : (
                        <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                          <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                        </svg>
                      )}
                    </button>
                  )}

                  <button onClick={() => setOpen(v)} className="block w-full text-left" tabIndex={-1}>
                    <span className="mt-2 block truncate text-sub text-paper">{v.title}</span>
                    <span className="block truncate text-caption text-content-muted">{v.artist}</span>
                  </button>

                  {/* attribution only where it means something: on a shared list */}
                  {attribution[v.id] && (
                    <p className="mt-1 truncate text-caption text-content-faint">
                      lo puso {attribution[v.id]}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Playing, and saving into a list of your own, work here exactly as
          they do on your own shelf. Taking a record OUT is the one thing that
          does not: those two rows act on your collection, and this is not it. */}
      <RecordSheet
        vinyl={open}
        onClose={() => setOpen(null)}
        canEdit={false}
        collections={lib.lists.map((l) => ({
          id: l.id,
          name: l.title,
          vinylIds: lib.idsOf(l.id),
          kind: l.kind,
        }))}
        activeListId=""
        playing={playing && nowPlaying?.id === open?.id}
        onTogglePlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : audio.play(v))}
        onAddTo={(listId, v) => void lib.saveToList(v, listId)}
        onRemoveFromActive={() => {}}
        onDelete={() => {}}
      />

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
