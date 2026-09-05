"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import { AnimatePresence, motion } from "framer-motion";
import { useDevice } from "@/hooks/useDevice";
import Avatar from "@/components/ui/Avatar";
import Confirm from "@/components/ui/Confirm";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import SaveSheet from "./SaveSheet";
import Tracklist from "./Tracklist";
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
  onRemoveFromList,
  coverOf,
  nowPlayingId,
  onPlayTrack,
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
  /** take it out of one particular rack — the save sheet needs this */
  onRemoveFromList?: (listId: string, v: Vinyl) => void;
  /** resolves a record id to a cover, so a rack can show what is inside it */
  coverOf?: (vinylId: string) => string | null;
  /** which record — or which track of it — is sounding right now */
  nowPlayingId?: string;
  /** play one track: a synthetic record, so the player learns nothing new */
  onPlayTrack?: (v: Vinyl) => void;
  canEdit?: boolean;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [elsewhere, setElsewhere] = useState<ListWithRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [toWishlist, setToWishlist] = useState(false);
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
      // matches the header's height: the bar arrives exactly when the sentinel
      // passes under it, and 56 was the old 14-unit bar
      { rootMargin: "-64px 0px 0px 0px", threshold: [0, 1] },
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
  /**
   * What the save control says, which is not simply a count.
   *
   * Every record you own is in Mi Colección, so counting containers would
   * print "En 1 rack" on everything and mean nothing. The two predefined
   * lists are states rather than racks — owned, or still wanted — and they
   * only get named when they are the whole answer. The moment a record is in
   * a rack somebody made, that is what the button is about, and the count is
   * of those alone.
   */
  const savedLabel = (() => {
    const holding = collections.filter((c) => c.vinylIds.includes(vinyl.id));
    const racks = holding.filter((c) => (c.kind ?? "custom") === "custom");
    if (racks.length > 0) return `En ${racks.length} ${racks.length === 1 ? "rack" : "racks"}`;
    if (holding.some((c) => c.kind === "wishlist")) return "En deseos";
    if (holding.some((c) => c.kind === "collection")) return "En colección";
    return null;
  })();

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
   * Sides and containers used to be worked out here. Both moved: the tracklist
   * knows about discs and sides now (it has to, to page between them), and
   * where a record is kept is answered by the save control and its sheet.
   */

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
        <div className="sticky top-0 z-30 h-16">
          {/**
           * The same bar as the player at the foot of the app.
           *
           * There were two designs for one object: down there a square sleeve
           * with the artist set in mono capitals and an outlined circle for
           * play; up here a rounded thumbnail, sentence case and a filled
           * circle. Both were fine and together they said the app was built by
           * two people. This is the player's design, with a back button on the
           * left and pinned to the top instead of the bottom — which is the
           * whole of the difference, and the only part of it that is a
           * difference in *job*.
           *
           * It keeps its own glass rather than the player's flat ink, because
           * a bar at the top of a record has that record's artwork moving
           * underneath it and a solid one would be a lid.
           */}
          <div
            className={`absolute inset-0 transition-opacity duration-base ease-out ${
              scrolled ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-0 bg-ink/88 backdrop-blur-2xl" />
            <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
          </div>

          <div className="relative flex h-16 items-center gap-3 px-4">
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-paper/[0.10] text-paper backdrop-blur-xl transition-colors hover:bg-paper/20"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M11.5 3.5 L5.5 9 L11.5 14.5"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* Once the artwork has scrolled away, the title and the transport
                come with you. Reading a tracklist and having to scroll back up
                to press play is the whole reason people close these. */}
            <div
              className={`flex min-w-0 flex-1 items-center gap-3 transition-[opacity,transform] duration-base ease-out ${
                scrolled
                  ? "translate-y-0 opacity-100"
                  : "pointer-events-none translate-y-1.5 opacity-0"
              }`}
            >
              {/* square and unrounded, like the player's: a sleeve is square */}
              <span className="h-10 w-10 shrink-0 overflow-hidden bg-paper/[0.06]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverFor(vinyl)} alt="" className="h-full w-full object-cover" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-paper">{vinyl.title}</span>
                <span className="mono block truncate text-[10px] uppercase tracking-[0.16em] text-paper/40">
                  {cleanArtist(vinyl.artist)}
                </span>
              </span>
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                aria-label={playing ? "Pausar" : `Escuchar ${vinyl.title}`}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-paper/25 text-paper transition hover:border-paper/60 disabled:opacity-30"
              >
                {playing ? (
                  <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                    <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                    <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden className="translate-x-[1px]">
                    <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="relative -mt-16 pb-10">
          {/* The sleeve behind the sleeve. It costs nothing — the image is
              already downloaded — and it is what stops a black page with a
              square in the middle from looking like a file browser. */}
          <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-16 h-[94svh] overflow-hidden">
            {/**
             * The cover itself, softened and taken to black.
             *
             * It was a light: blown up 1.7×, saturated past the artwork's own
             * colours and blurred until nothing of the image survived — a
             * coloured glow that happened to have been made from the sleeve.
             * This is the sleeve. Enough blur that it is a ground and never
             * competes with the record printed sharply on top of it, and no
             * saturation of its own, so the colour on screen is the colour of
             * the cover rather than a version of it.
             *
             * The gradient is the other half: it holds the artwork through the
             * top of the screen and is fully black well before the words, so
             * everything under the title is read on the app's own ground. And
             * it must never end in a visible line, which is the whole reason
             * it goes all the way to black inside its own box rather than
             * stopping at the edge of it.
             */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverFor(vinyl)}
              alt=""
              className="h-full w-full scale-125 object-cover blur-2xl"
            />
            {/**
             * Six stops instead of three, and the black arrives late.
             *
             * A gradient with one midpoint ramps in a straight line, and a
             * straight ramp against a blurred image has a visible middle — the
             * eye finds the exact height where the picture "starts going
             * dark". These stops are eased: almost nothing for the first
             * third, so the artwork is simply the artwork; then a curve that
             * accelerates, which is how light actually falls off; then black
             * with room to spare before the words.
             *
             * Written out rather than composed from utility classes because
             * the point is the shape of the curve, and three stops cannot make
             * one.
             */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom," +
                  "rgba(10,10,10,0) 0%," +
                  "rgba(10,10,10,0.04) 30%," +
                  "rgba(10,10,10,0.16) 46%," +
                  "rgba(10,10,10,0.42) 60%," +
                  "rgba(10,10,10,0.74) 73%," +
                  "rgba(10,10,10,0.93) 84%," +
                  "#0a0a0a 94%)",
              }}
            />
          </div>

          {/* The wash starts at the very top of the screen — the column it
              lives in is pulled up under the header — so the content puts the
              header's height back, or the sleeve would begin under the back
              button. */}
          <div className="relative mx-auto w-full max-w-[440px] px-5 pt-16">
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

            {/**
             * The caption, centred under a centred sleeve.
             *
             * Left-aligned it read as the start of a document — a heading with
             * a body under it — while the object it names sits in the middle
             * of the screen. Centred, the name belongs to the record above it
             * rather than to the page.
             *
             * The chips come with it: they are the same block, and a centred
             * title over a left-aligned row of facts is two decisions where
             * there should be one.
             */}
            <div className="text-center">
              <h2 className="mt-7 text-title font-medium leading-tight text-paper">
                {vinyl.title}
              </h2>
              {/* The artist is a door, not a caption. No arrow beside it: the
                  underline on press already says it leads somewhere, and an
                  arrow after a centred name pulls the whole line off centre by
                  its own width. */}
              <Link
                href={`/artista/${artistSlug(vinyl.artist)}`}
                onClick={onClose}
                className="pressable mt-1.5 inline-block text-body text-content-secondary underline-offset-4 transition hover:text-paper hover:underline"
              >
                {cleanArtist(vinyl.artist)}
              </Link>

              {/* Year, genre and label as chips under the name rather than as a
                  four-cell table. They are how you place a record at a glance —
                  a caption, not data — and the table that held them made four
                  different kinds of fact look like one form to fill in. The
                  full set is one press away in the technical sheet. */}
              <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
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
            </div>

            {/**
             * Play, as a play button.
             *
             * It was a wide capsule with the word "Escuchar" in it, which is
             * the shape a form's submit button has. Nothing else in music
             * labels this control: a filled circle with a triangle in it is
             * understood by everyone who has ever used a phone, it reads at a
             * glance instead of being read, and it stops the row from looking
             * like a toolbar of three equal things.
             *
             * Bigger than the two beside it on purpose. It stays the only
             * filled control on the screen — one thing here is the obvious
             * thing to do, and it should look like it — and the size is what
             * carries the hierarchy now that the word is gone.
             *
             * The label survives for anyone not looking at it, and it says
             * what will happen rather than what the button is.
             */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                aria-label={
                  playing
                    ? "Pausar"
                    : vinyl.previewUrl
                      ? `Escuchar ${vinyl.title}`
                      : "Este disco no tiene fragmento"
                }
                /* The same 44px as the controls beside it. It was 56 to carry
                   the hierarchy on its own; the save control next to it now
                   says what it is in words, so the row has a shape without
                   needing one button to shout. Filled is still what marks it
                   as the thing to press. */
                className="pressable flex h-tap w-tap shrink-0 items-center justify-center rounded-full bg-paper text-ink disabled:opacity-30"
              >
                {playing ? (
                  <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
                    <rect x="3" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
                    <rect x="8" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
                  </svg>
                ) : (
                  /* nudged right by a hair: a triangle centred on its bounding
                     box looks off-centre inside a circle, which is why every
                     play button ever drawn is offset */
                  <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden className="translate-x-[1px]">
                    <path d="M3 1.8 L12 7 L3 12.2 Z" fill="currentColor" />
                  </svg>
                )}
              </button>

              {/**
               * The save control says what it knows.
               *
               * It was a bookmark glyph and nothing else, which asks you to
               * press it to find out whether you have already pressed it. The
               * answer was one tap away and there was no reason not to print
               * it: a record is either somewhere or it is not, and if it is,
               * how many places is the next thing anybody wants.
               *
               * It takes the width left over, so the row reads as one action
               * with two shortcuts beside it rather than as four equal icons.
               */}
              <button
                onClick={() => setPicking(true)}
                aria-label={
                  savedLabel ? `Guardado: ${savedLabel}. Cambiar.` : "Guardar en un rack"
                }
                className={`pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sub font-medium transition-colors ${
                  savedLabel
                    ? "bg-fill text-paper hover:bg-fill-strong"
                    : "border border-line-strong text-content hover:border-line-focus"
                }`}
              >
                {/* A crate, not a bookmark. A bookmark is what you put in a
                    book you are coming back to; this app keeps records in
                    boxes, and it is the object every other screen already
                    draws — the crate in Explorar, the one on a rack's page. */}
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0">
                  <path
                    d="M2.6 4.4h10.8l-.85 8.5a.7.7 0 0 1-.7.6H4.15a.7.7 0 0 1-.7-.6L2.6 4.4Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                  <path d="M6.3 7.1h3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
                <span className="truncate">{savedLabel ?? "Guardar"}</span>
              </button>

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

              {/**
               * Everything else, behind three dots.
               *
               * The screen used to end in a card holding "Quitar de esta
               * lista" and "Borrar de mi colección" — two administrative
               * sentences under the tracklist, one of them destructive, both
               * of them the last thing you read about a record you had opened
               * to look at. Nobody opens a sleeve in order to delete it.
               *
               * A menu is the honest place for them: present, one press away,
               * and not part of the page. It is also where anything else that
               * is not listening, keeping or sharing will go, so the screen
               * stops growing a new row every time the app learns a verb.
               */}
              {canEdit && (
                <IconButton label="Más opciones" onClick={() => setMenuOpen(true)}>
                  <circle cx="8" cy="3.4" r="1.25" fill="currentColor" />
                  <circle cx="8" cy="8" r="1.25" fill="currentColor" />
                  <circle cx="8" cy="12.6" r="1.25" fill="currentColor" />
                </IconButton>
              )}
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
              {/* "Ya está en" used to sit here as a card of pills. The save
                  control says it now — "En 2 racks" — and the sheet behind it
                  shows which, so the card was the same answer given twice, the
                  second time without a way to act on it. */}
              {/* One disc at a time, its sides under it, and the titles
                  playable — see Tracklist. */}
              <Tracklist
                vinyl={vinyl}
                nowPlayingId={nowPlayingId}
                playing={playing}
                onPlayTrack={onPlayTrack ?? (() => {})}
              />

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

            </div>
          </div>
        </div>

      </Panel>

      {/**
       * The secondary verbs, and only the ones that are not already on screen.
       *
       * It had "Guardar en un rack" and "Compartir" in it, which are the two
       * controls sitting three centimetres above it — a menu whose first job
       * is to repeat the toolbar is a menu nobody trusts to hold anything
       * else. And it opened with the record's name, which you have just been
       * looking at, on a screen that is entirely about that record.
       *
       * What is left is the two things that change where a record lives, with
       * room around them: at this size a menu row is a target for a thumb, not
       * a line of a list.
       */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} size="auto" width={380}>
        <div className="py-3">
          {!wished && (
            <SheetRow
              icon={
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path
                    d="M9 15.2S2.4 11.3 2.4 6.9a3.4 3.4 0 0 1 6.6-1.2 3.4 3.4 0 0 1 6.6 1.2c0 4.4-6.6 8.3-6.6 8.3Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              label="Mover a la lista de deseos"
              onClick={() => {
                setMenuOpen(false);
                setToWishlist(true);
              }}
            />
          )}
          <div className="my-2 h-px bg-line" />
          <SheetRow
            icon={
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M3.6 5.2h10.8M7.2 5.2V3.6h3.6v1.6M5 5.2l.7 9.2h6.6l.7-9.2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            label="Borrar de mi colección"
            danger
            onClick={() => {
              setMenuOpen(false);
              setDeleting(true);
            }}
          />
        </div>
      </Sheet>

      {/**
       * Moving to the wishlist is not a small edit, so it is confirmed.
       *
       * Owned and wanted are exclusive in this app: saving a record into the
       * wishlist takes it out of the collection *and* out of every rack you
       * had put it in. That is the correct behaviour and it is invisible from
       * the outside — somebody who has spent an evening sorting a record into
       * three racks would lose all three to one press. The same double step as
       * deleting, for the same reason: the consequence is not in the label.
       */}
      <Confirm
        open={toWishlist}
        onClose={() => setToWishlist(false)}
        title="Pasará a tus deseos"
        body={`${vinyl.title} saldrá de tu colección y de los racks en los que lo tengas guardado. Un disco está en una cosa o en la otra, nunca en las dos.`}
        confirmLabel="Mover a deseos"
        danger={false}
        onConfirm={() => {
          setToWishlist(false);
          if (wishlist) onAddTo(wishlist.id, vinyl);
          toast.show(`${vinyl.title} → Lista de deseos`, {
            media: { src: coverFor(vinyl) },
          });
        }}
      />

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

      {/**
       * Where it lives, and everywhere it could — see SaveSheet.
       *
       * This used to be a menu of rack names with a tick beside the ones that
       * already held the record, and pressing one of those did nothing you
       * could see. It answered "which rack shall I add this to" and left the
       * two questions somebody actually opens it with — where is this, and
       * take it out of there — unanswerable.
       */}
      <SaveSheet
        open={picking}
        onClose={() => {
          setPicking(false);
          setAcquiring(false);
        }}
        vinyl={vinyl}
        collections={acquiring ? collections.filter((c) => c.id !== wishlist?.id) : collections}
        coverOf={coverOf}
        onAdd={(listId) => {
          setPicking(false);
          if (acquiring) {
            setAcquiring(false);
            return acquire(listId);
          }
          const name = collections.find((c) => c.id === listId)?.name ?? "tu rack";
          onAddTo(listId, vinyl);
          toast.show(`Guardado en ${name}`, { media: { src: coverFor(vinyl) } });
        }}
        onRemove={(listId) => {
          const name = collections.find((c) => c.id === listId)?.name ?? "ese rack";
          onRemoveFromList?.(listId, vinyl);
          toast.show(`Fuera de ${name}`, { media: { src: coverFor(vinyl) } });
        }}
      />

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
