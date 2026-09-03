"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCovers } from "@/components/ui/Skeleton";
import SaveListButton from "./SaveListButton";
import FollowButton from "./FollowButton";
import ListMetrics from "./ListMetrics";
import CollaboratorsSheet, { CollaboratorFaces } from "./CollaboratorsSheet";
import RecordSheet from "@/components/mobile/RecordSheet";
import Crate from "@/components/ui/Crate";
import { coverFor } from "@/lib/cover";
import { useLibrary } from "@/hooks/useLibrary";
import { usePlaybackContext } from "@/lib/playback-context";
import ShareSheet from "@/components/ShareSheet";
import { SITE_URL } from "@/lib/site";
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
  /** the 9:16 card, which is a different thing from inviting a collaborator */
  const [shareCard, setShareCard] = useState(false);
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

  /**
   * Sharing opens the card rather than the system dialog.
   *
   * It used to hand the URL straight to `navigator.share`, which on a phone
   * means the receiving app gets a line of text — and a rack is a wall of
   * covers, which is the only part of it worth looking at. The sheet makes the
   * picture first and still offers the link underneath for anybody who wanted
   * the link.
   */
  const share = () => setShareCard(true);

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
       * The crate, centred, with the room lit by what is in it.
       *
       * This was a left-aligned row: a small crate beside a column of title,
       * paragraph, chips and buttons — the same header shape as a settings
       * page. A rack is not a document with an illustration; it is an object
       * somebody assembled, and the page should open on the object.
       *
       * So the crate is the subject, on the centre line, at a size you can
       * actually see the sleeves in, and everything else is caption under it.
       * Behind it the covers bleed upward as a wash of their own colour — the
       * same idea as the light the desktop shelf throws when you open a
       * record, and the reason a rack of Blue Note reissues and a rack of
       * hardcore no longer arrive on identical black.
       *
       * The measure stays narrow even though the block is centred: centred
       * text is harder to read line-to-line, so it is only allowed where it is
       * short.
       */}
      <header className="relative mt-2 border-b border-line pb-10 text-center">
        {/* the wash: three covers, blurred past recognition, as light rather
            than as an image. Screen so it can only ever brighten the ground. */}
        {items && items.length > 0 && (
          <div
            aria-hidden
            /* No negative z-index: that would put it behind the page's own
               background, which is opaque, and the wash would never be seen.
               It is absolutely positioned and the content after it is
               positioned too, so painting order alone puts the light behind
               the words. */
            className="pointer-events-none absolute inset-x-0 top-0 h-[280px] overflow-hidden"
          >
            <div className="absolute inset-x-[-20%] top-[-30%] flex h-[320px] opacity-45 blur-[64px]">
              {items.slice(-3).map((v) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={v.id}
                  src={coverFor(v)}
                  alt=""
                  className="h-full flex-1 object-cover"
                />
              ))}
            </div>
            <div className="absolute inset-0 bg-gradient-to-b from-surface/45 via-surface/70 to-surface" />
          </div>
        )}

        <div className="relative">
        {items && items.length > 0 && (
          <span className="mx-auto block w-[200px] sm:w-[248px]">
            <Crate covers={items.slice(-3).reverse().map((v) => coverFor(v))} />
          </span>
        )}

        <h1 className="mx-auto mt-7 max-w-[18ch] text-display font-medium leading-tight text-paper">
          {title}
        </h1>

        {(list?.description || initial?.description) && (
          <p className="mx-auto mt-3.5 max-w-[46ch] text-body leading-relaxed text-content-secondary">
            {list?.description ?? initial?.description}
          </p>
        )}

        {/* Whose it is, and how big — one line, centred, with the two measures
            after it. Here they are not a decoration on a card: they are part
            of what the rack is. */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
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
          <span aria-hidden className="text-content-faint">·</span>
          <span className="text-sub text-content-muted">
            {items?.length ?? list?.itemCount ?? 0} discos
          </span>
          {list && (
            <ListMetrics listId={list.id} saves={list.saves} likes={list.likes} size="md" />
          )}
          {list && <CollaboratorFaces listId={list.id} onOpen={() => setSharing(true)} />}
        </div>

        {/* The controls, by who you are. Never a disabled button explaining
            what you would be able to do if you were someone else. */}
        <div className="mt-7 flex flex-wrap justify-center gap-2.5">
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
        </div>
      </header>

      <div className="mt-8">
        {items === null ? (
          <SkeletonCovers n={10} cols="grid-cols-3 sm:grid-cols-5" />
        ) : items.length === 0 ? (
          <EmptyState
            title={isOwner ? "Este rack todavía está vacío" : "Aquí no hay discos todavía"}
            body={
              isOwner
                ? "Abre tu colección y arrastra discos a este rack, o guárdalos desde el buscador."
                : "Quien la hizo no ha añadido nada por ahora. Guárdala y te enterarás cuando lo haga."
            }
            action={
              isOwner
                ? { label: "Ir a mi colección", href: "/coleccion" }
                : { label: "Explorar otros racks", href: "/explorar" }
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

      {owner && list && (
        <ShareSheet
          open={shareCard}
          onClose={() => setShareCard(false)}
          image={`/api/share/list?user=${encodeURIComponent(owner.username)}&list=${encodeURIComponent(list.slug)}`}
          link={`${SITE_URL}/u/${owner.username}/${list.slug}`}
          title={`${title} · un rack de ${owner.displayName}`}
          filename={`${list.slug}.png`}
        />
      )}

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
