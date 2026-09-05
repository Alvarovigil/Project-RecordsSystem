"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import { AnimatePresence, motion } from "framer-motion";
import { useDevice } from "@/hooks/useDevice";
import Avatar from "@/components/ui/Avatar";
import Confirm from "@/components/ui/Confirm";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import Card from "@/components/ui/Card";
import ShareSheet from "@/components/ShareSheet";
import { SITE_URL } from "@/lib/site";
import { useToast } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist } from "@/lib/artist";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import { findCollection, findWishlist, isWished, type Collection } from "@/lib/collections";

/**
 * The surface a record lives on.
 *
 * A phone gets a screen — fixed, full bleed, one scroller, no gesture of its
 * own. A desktop gets the app's dialog, because there the shelf around it is
 * the context and taking the whole window away would be theft.
 */
function Panel({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { isPhone } = useDevice();

  if (!isPhone) {
    return (
      <Sheet open={open} onClose={onClose} size="tall" bare>
        {/**
         * The dialog is a fixed box with its overflow hidden, so the body has
         * to do its own scrolling — otherwise anything past 78vh is simply
         * not reachable, which is what was happening to the end of a long
         * tracklist and to this card the moment it opened.
         */}
        <div className="scroll-y min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Sheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          /* Below the app's dialog layer (70), not above it: this is a
             screen, and everything opened from it — guardar, compartir, el
             confirmar de borrar — is a sheet that has to land on top. At 80 it
             covered them, so pressing Guardar on a phone appeared to do
             nothing at all. */
          /**
           * The frame and the scroller are two elements on purpose.
           *
           * They were one, with the safe-area insets as padding on the
           * scrolling box — and padding on a scroller holds nothing back:
           * content travels up through it and paints in the region the inset
           * existed to keep clear. On an iPhone that means the catalogue
           * number of whatever you were reading sliding out from behind the
           * clock and the island. The inset belongs to the frame, which does
           * not scroll; the scroller lives inside it and is clipped by it.
           */
          /**
           * Black, not the lifted grey.
           *
           * `--surface-raised` is #101010 — a step up from the app's ground so
           * that a panel over a page reads as being on top of it. This screen
           * is not on top of anything: it takes the whole display, and the
           * subject is a square of printed artwork. Any grey behind that is a
           * value competing with the cover, and it is exactly what the wash
           * was fading into and giving away.
           */
          className="fixed inset-0 z-[60] bg-ink"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="scroll-y h-full overflow-y-auto">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A round control that is only an icon: 44px of tap area, no label. */
function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fill text-paper transition-colors hover:bg-fill-strong"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/**
 * A record, on a phone.
 *
 * On a desktop this is the 3D sleeve opening in place, with metadata flanking
 * it. None of that survives a 390px screen, and cramming it in is how you get
 * the reflowed-website feeling. So the phone gets its own thing: a full-height
 * sheet you throw away downward, artwork at the top, actions where the thumb
 * is, and the community bridge — "quién más tiene este disco" — at the bottom
 * where it belongs, as an invitation rather than an interruption.
 *
 * Actions are ordered by how often they are wanted, not by importance:
 * escuchar, guardar en una lista, and only then the destructive end of the
 * menu. The two ways of removing something are deliberately worded apart —
 * "Quitar de esta lista" is reversible bookkeeping, "Borrar de mi colección"
 * is not — because a single "Eliminar" that means either one is how people
 * lose records.
 */
export default function RecordSheet({
  vinyl,
  onClose,
  collections,
  activeListId,
  playing,
  onTogglePlay,
  onAddTo,
  onRemoveFromActive,
  onDelete,
  canEdit = true,
}: {
  vinyl: Vinyl | null;
  onClose: () => void;
  collections: Collection[];
  activeListId: string;
  playing: boolean;
  onTogglePlay: (v: Vinyl) => void;
  onAddTo: (listId: string, v: Vinyl) => void;
  onRemoveFromActive: (v: Vinyl) => void;
  onDelete: (v: Vinyl) => void;
  /**
   * False on somebody else's list.
   *
   * The two ways of removing a record act on YOUR shelf, and offering them
   * over a list you are only visiting is offering to do something to a place
   * you are not in. Everything else — listening, saving it into one of your
   * own lists — is exactly the same act wherever you found the record, which
   * is the point of this sheet being one sheet.
   */
  canEdit?: boolean;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [elsewhere, setElsewhere] = useState<ListWithRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /**
   * Whether the artwork has scrolled out of the way.
   *
   * Read from an observer on a sentinel rather than from scroll offsets: the
   * sheet is dragged as well as scrolled, and a number compared against a
   * threshold flickers at exactly the moment a finger is holding it still.
   */
  const [scrolled, setScrolled] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  /** the picker is doing double duty: "guardar en" and "lo tengo, ¿en qué rack?" */
  const [acquiring, setAcquiring] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!vinyl || !el) return;
    // A band rather than a line: with a single threshold, holding the sheet
    // still at exactly the crossing point leaves it deciding twice a frame.
    const io = new IntersectionObserver(
      ([e]) => setScrolled(e.boundingClientRect.top < 0 ? true : e.isIntersecting ? false : true),
      { rootMargin: "-56px 0px 0px 0px", threshold: [0, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [vinyl]);

  useEffect(() => {
    if (!vinyl) return;
    setElsewhere([]);
    repo
      .listsWithRelease(vinyl.id)
      .then(setElsewhere)
      .catch(() => {});
  }, [repo, vinyl]);

  if (!vinyl) return null;

  const wished = isWished(collections, vinyl.id);
  const mine = findCollection(collections);
  const wishlist = findWishlist(collections);

  /**
   * Acquiring is one write and its reversal, not a flow.
   *
   * The undo has to put it back in the wishlist explicitly — saving into a
   * list is what took it out, so "deshacer" cannot be "remove from the list
   * we just added to" or the record would end up owned and unwished, which is
   * neither of the two states it was ever in.
   */
  const acquire = (listId?: string) => {
    const v = vinyl;
    if (!listId || !v) return;
    onAddTo(listId, v);
    const name = collections.find((c) => c.id === listId)?.name ?? "tu colección";
    toast.undo(
      `${v.title} → ${name}`,
      () => wishlist && onAddTo(wishlist.id, v),
      { media: { src: coverFor(v) } },
    );
  };

  /**
   * Tracks grouped by the side they are printed on.
   *
   * Discogs writes positions as "A1", "B3", sometimes "1" and sometimes
   * nothing at all — so the side is the leading letter when there is one, and
   * everything else falls into a single unlabelled group rather than inventing
   * a side that the pressing does not have.
   */
  const sides = Object.entries(
    vinyl.tracklist.reduce<Record<string, typeof vinyl.tracklist>>((acc, t) => {
      const side = /^[A-Z]/.test(t.position ?? "") ? t.position![0] : "?";
      (acc[side] ??= []).push(t);
      return acc;
    }, {}),
  ).sort(([a], [b]) => a.localeCompare(b));

  const inLists = collections.filter(
    (c) => c.id !== activeListId && c.vinylIds.includes(vinyl.id),
  );

  return (
    <>
      {/**
       * A screen on a phone, a dialog on a desktop.
       *
       * It was a sheet you could throw away, with a scrolling body inside it.
       * That pairing is where iOS gets confused: the drag and the scroll are
       * the same gesture until one of them wins, and when the wrong one does —
       * or when neither does — the page stops answering entirely. Which is
       * exactly the freeze this had, several lists and several records in.
       *
       * A record is not a peek at something behind, it is the thing you went
       * to look at. Full screen says that, and it costs nothing: the way back
       * is a button in the corner rather than a gesture that competes with
       * reading a tracklist.
       */}
      <Panel open={Boolean(vinyl)} onClose={onClose}>
        {/**
         * One header, always the same height.
         *
         * It was two: a transparent strip with the back button, and a bar that
         * hung *below* it on `top-full` — which is why there was a band of
         * page above the title and the play button, with content sliding
         * through it. Hanging it below was itself a fix, for a flicker loop
         * the bar caused when it grew inside the flow and pushed the sentinel
         * back into view.
         *
         * Both problems go away by giving the header a fixed height from the
         * start. Nothing grows, so nothing oscillates, and nothing hangs
         * underneath: the record's name and its play button arrive in the
         * space the back button was already occupying, and the background
         * fades in under them.
         */}
        <div className="sticky top-0 z-30 h-14">
          <div
            className={`absolute inset-0 border-b border-line bg-ink transition-opacity duration-base ease-out ${
              scrolled ? "opacity-100" : "opacity-0"
            }`}
          />
          <div className="relative flex h-14 items-center gap-3 px-2">
            <button
              onClick={onClose}
              aria-label="Cerrar"
              /* Its own dark blur only while it is alone over the artwork: on
                 the bar it would be a pill on a panel. */
              className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-paper transition-colors ${
                scrolled ? "" : "bg-ink/55 backdrop-blur-xl"
              }`}
            >
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M11.5 3.5 L5.5 9 L11.5 14.5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Once the artwork has scrolled away, the title and the transport
                come with you. Reading a tracklist and having to scroll back up
                to press play is the whole reason people close these. */}
            <div
              className={`flex min-w-0 flex-1 items-center gap-3 transition-opacity duration-base ease-out ${
                scrolled ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverFor(vinyl)}
                alt=""
                className="h-9 w-9 shrink-0 rounded-[2px] object-cover"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sub font-medium text-paper">{vinyl.title}</span>
                <span className="block truncate text-caption text-content-muted">
                  {vinyl.artist}
                </span>
              </span>
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                aria-label={playing ? "Pausar" : `Escuchar ${vinyl.title}`}
                className="pressable mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-30"
              >
                {playing ? (
                  <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                    <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                    <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                    <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="relative -mt-14 pb-10">
          {/* The cover's own colour, thrown behind the top of the screen and
              faded out. It costs nothing — the image is already downloaded —
              and it is what stops a black page with a square in the middle
              from looking like a file browser. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 h-[78svh] overflow-hidden">
            {/**
             * Loud, and measured against the screen rather than in pixels.
             *
             * This started at 30% of a 520px box, which on a dark sleeve
             * produced nothing at all. The colour of the cover is the only
             * thing that makes this screen belong to *this* record instead of
             * to the template, so it is worth spending real light on: 80%, a
             * good deal more saturated, blown up further so the corners of the
             * artwork never show as corners, and reaching most of the way down
             * the display.
             *
             * The blur is what keeps it from ever being a picture, and the
             * gradient is what keeps it from ending in a horizontal line — the
             * one thing it must not do.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverFor(vinyl)}
              alt=""
              className="h-full w-full scale-[1.7] object-cover opacity-80 blur-3xl saturate-[1.7]"
            />
            {/* Holds its colour through the top half and then goes to black
                fast, so the title and everything under it are read on the app's
                own ground rather than on a bright sleeve. */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/45 via-[56%] to-ink" />
          </div>

          {/* The wash starts at the very top of the screen — the column it
              lives in is pulled up under the header — so the content puts the
              header's height back, or the sleeve would begin under the back
              button. */}
          <div className="relative mx-auto w-full max-w-[440px] px-5 pt-14">
            {/**
             * The sleeve, and nothing behind it.
             *
             * There was a record sliding out of the right-hand side — two
             * radial gradients standing in for a disc. It was a nice drawing
             * and it was doing damage: it pushed the cover off the centre
             * line, so the one square image this screen is about sat slightly
             * left of where the title, the artist and everything under them
             * are aligned, and the eye reads that as a mistake before it reads
             * it as an object.
             *
             * A record shown by its sleeve is what a shelf looks like. The
             * disc belongs to the 3D stack, where it is the real thing rather
             * than an impression of one.
             */}
            <div className="relative mx-auto mt-3 w-[76%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverFor(vinyl)}
                alt={`Portada de ${vinyl.title}`}
                className="relative aspect-square w-full rounded-[3px] object-cover shadow-[0_26px_60px_rgba(0,0,0,0.62)]"
              />
            </div>

            <div ref={sentinel} aria-hidden />

            <h2 className="mt-7 text-title font-medium leading-tight text-paper">{vinyl.title}</h2>
            {/* The artist is a door, not a caption. It is the most obvious
                thing on this screen to want more of, and until now it was the
                only proper noun in the app you could not press. */}
            <Link
              href={`/artista/${artistSlug(vinyl.artist)}`}
              onClick={onClose}
              className="pressable mt-1.5 inline-flex items-center gap-1.5 text-body text-content-secondary underline-offset-4 transition hover:text-paper hover:underline"
            >
              {cleanArtist(vinyl.artist)}
              <span aria-hidden className="text-content-faint">→</span>
            </Link>

            {/* Year, genre and label as chips under the name rather than as a
                four-cell table. They are how you place a record at a glance —
                a caption, not data — and the table that held them made four
                different kinds of fact look like one form to fill in. The full
                set is one press away in the technical sheet. */}
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {[vinyl.year ? String(vinyl.year) : null, vinyl.genre, vinyl.label, vinyl.country]
                .filter(Boolean)
                .map((f) => (
                  <li
                    key={f as string}
                    className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary"
                  >
                    {f}
                  </li>
                ))}
            </ul>

            {/* The two things you came for, plus the way out. Listening is the
                only filled button on the screen: one thing is the obvious
                thing to do here, and it should look like it. */}
            <div className="mt-6 flex items-center gap-2.5">
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-paper text-body font-medium text-ink disabled:opacity-35"
              >
                {playing ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                      <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                    </svg>
                    Pausar
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                    </svg>
                    {vinyl.previewUrl ? "Escuchar" : "Sin preview"}
                  </>
                )}
              </button>
              <IconButton label="Guardar en un rack" onClick={() => setPicking(true)}>
                <path
                  d="M4.5 2.5h7a.5.5 0 0 1 .5.5v10.2L8 10.8l-4 2.4V3a.5.5 0 0 1 .5-.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </IconButton>
              <IconButton label="Compartir" onClick={() => setSharing(true)}>
                <path
                  d="M8 10.5V2.6 M5 5.4 L8 2.4 L11 5.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.2 9.4v3.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V9.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </IconButton>
            </div>

            {/* --------------------------------------------------- lo tengo */}
            {/**
             * The wishlist's one-way door.
             *
             * A wanted record has exactly one interesting thing that can
             * happen to it, and it is not "guardar en una lista" three taps
             * deep behind a bookmark icon — it is *you bought it*. So while a
             * record is wished, that gets a control of its own, full width,
             * under the row.
             *
             * Nothing here is a new concept in the data: owned and wished are
             * already mutually exclusive, and saving a record into any list
             * takes it out of the wishlist — `Mi Colección` is simply
             * everything you have that you are not still waiting for. This
             * button is that rule, said out loud.
             */}
            {wished && canEdit && (
              <div className="mt-2.5 flex items-center gap-2.5">
                <button
                  onClick={() => acquire(mine?.id)}
                  className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line-strong text-body font-medium text-content"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Ya lo tengo
                </button>
                {/* the same act, aimed somewhere else — a rack you keep for
                    this, rather than the collection at large */}
                <button
                  onClick={() => {
                    setAcquiring(true);
                    setPicking(true);
                  }}
                  aria-label="Lo tengo, guardar en un rack"
                  className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-content-muted"
                >
                  <svg width="10" height="10" viewBox="0 0 8 8" fill="none" aria-hidden>
                    <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            <div className="mt-7 space-y-2.5">
              {/* Where it already lives, so "guardar" never means "otra vez".
                  Its own card and its own line, because it is the answer to a
                  question the button above is about to ask. */}
              {inLists.length > 0 && (
                <Card title="Ya está en">
                  <ul className="flex flex-wrap gap-1.5">
                    {inLists.map((c) => (
                      <li
                        key={c.id}
                        className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary"
                      >
                        {c.name}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* By side, because that is how the object works: you do not play
                  a record from track 1 to track 12, you play a side and then
                  get up and turn it over. */}
              {sides.length > 0 && (
                <Card title="Canciones" padded={false}>
                  {sides.map(([side, tracks], si) => (
                    <div key={side} className={si > 0 ? "mt-5" : ""}>
                      {side !== "?" && (
                        <h4 className="flex items-baseline gap-2 px-5 text-caption uppercase tracking-label text-content-faint">
                          Cara {side}
                          <span>{tracks.length}</span>
                        </h4>
                      )}
                      <ol className={side !== "?" ? "mt-1.5" : ""}>
                        {tracks.map((t, i) => (
                          <li
                            key={i}
                            className="flex items-baseline gap-3 px-5 py-2.5 text-sub"
                          >
                            <span className="mono w-5 shrink-0 text-caption text-content-faint">
                              {t.position?.replace(/^[A-Z]/, "") || i + 1}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-paper">{t.title}</span>
                            {t.duration && (
                              <span className="mono shrink-0 text-caption text-content-faint">
                                {t.duration}
                              </span>
                            )}
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))}
                </Card>
              )}

              {/* Folded away under the songs, which is where the question
                  belongs in time: you decide to listen, you decide to keep it,
                  and only then — still holding the sleeve — do you wonder
                  which pressing this is. */}
              <RecordSpecsCard discogsId={vinyl.discogsId} />

              {/* the bridge: this record is the door into other people's shelves */}
              {elsewhere.length > 0 && (
                <Card title="Quién más lo tiene" padded={false}>
                  <ul>
                    {elsewhere.slice(0, 5).map((l) => (
                      <li key={l.id}>
                        <Link
                          href={`/u/${l.owner.username}/${l.slug}`}
                          className="pressable flex items-center gap-3 px-5 py-2.5"
                        >
                          <Avatar
                            name={l.owner.displayName}
                            handle={l.owner.username}
                            src={l.owner.avatarUrl}
                            size="sm"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sub text-paper">{l.title}</span>
                            <span className="block truncate text-caption text-content-muted">
                              {l.owner.displayName} · {l.itemCount} discos
                            </span>
                          </span>
                          <span aria-hidden className="text-content-faint">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              {/* The two ways of removing something, worded apart on purpose:
                  "Quitar de esta lista" is reversible bookkeeping, "Borrar de
                  mi colección" is not. A single "Eliminar" meaning either one
                  is how people lose records. Last on the screen, in the quiet
                  type, because nobody opens a record in order to delete it. */}
              {canEdit && (
                <Card padded={false}>
                  <button
                    onClick={() => {
                      // the shelf's handler confirms this one, with its undo
                      onRemoveFromActive(vinyl);
                      onClose();
                    }}
                    className="pressable w-full px-5 py-2.5 text-left text-sub text-content-secondary"
                  >
                    Quitar de esta lista
                  </button>
                  <button
                    onClick={() => setDeleting(true)}
                    className="pressable w-full px-5 py-2.5 text-left text-sub text-[#ff6b57]"
                  >
                    Borrar de mi colección
                  </button>
                </Card>
              )}
            </div>
          </div>
        </div>

      </Panel>

      {/* Sharing: its own sheet on top, so the record is still there behind
          it when the share is cancelled — which it often is. */}
      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        image={`/api/share/record?slug=${encodeURIComponent(vinyl.id)}`}
        /* There is no page for a single record yet, so the link is the app
           itself — which is what somebody who liked the card wants anyway. */
        link={SITE_URL}
        title={`${vinyl.title} — ${vinyl.artist}`}
        filename={`${vinyl.id}.png`}
      />

      {/* saving into a list: its own sheet, so the record stays behind it */}
      <Sheet
        open={picking}
        onClose={() => {
          setPicking(false);
          setAcquiring(false);
        }}
        title={acquiring ? "Lo tengo, ¿en qué rack?" : "Guardar en"}
        size="auto"
        width={380}
      >
        <div className="py-1">
          {collections
            .filter((c) => !acquiring || c.id !== wishlist?.id)
            .map((c) => {
            const has = c.vinylIds.includes(vinyl.id);
            return (
              <SheetRow
                key={c.id}
                label={c.name}
                detail={has ? "✓" : `${c.vinylIds.length}`}
                onClick={() => {
                  setPicking(false);
                  if (acquiring) {
                    setAcquiring(false);
                    return acquire(c.id);
                  }
                  onAddTo(c.id, vinyl);
                  toast.show(has ? `Ya estaba en ${c.name}` : `Guardado en ${c.name}`, {
                    media: { src: coverFor(vinyl) },
                  });
                }}
              />
            );
          })}
        </div>
      </Sheet>

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Se borrará de toda tu colección"
        body={`${vinyl.title} desaparecerá de todos tus racks. Esto no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={() => {
          onDelete(vinyl);
          onClose();
        }}
      />
    </>
  );
}
