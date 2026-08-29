"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import { AnimatePresence, motion } from "framer-motion";
import { useDevice } from "@/hooks/useDevice";
import Avatar from "@/components/ui/Avatar";
import Confirm from "@/components/ui/Confirm";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import ShareSheet from "@/components/ShareSheet";
import { SITE_URL } from "@/lib/site";
import { useToast } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import { coverFor } from "@/lib/cover";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";

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
            className="scroll-y fixed inset-0 z-[60] overflow-y-auto bg-surface-raised"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
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
        <div className="sticky top-0 z-30 bg-surface-raised">
          <div className="flex items-center justify-between px-2 pb-1 pt-1.5 sm:hidden">
            <button
              onClick={onClose}
              aria-label="Cerrar"
              className="pressable flex h-11 w-11 items-center justify-center rounded-full text-content-muted transition-colors hover:text-paper"
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
          </div>
          {/**
           * Once the artwork has scrolled away, the title and the transport
           * come with you. Reading a tracklist and having to scroll back up to
           * press play is the whole reason people close these.
           *
           * It hangs BELOW the sticky strip instead of sitting inside it, and
           * that is not a layout preference — it is the fix for a flicker. When
           * the bar grew inside the flow it pushed everything down, which slid
           * the sentinel back into view, which hid the bar, which pulled
           * everything up again: a loop that ran as fast as the browser could
           * paint it. Out of the flow, appearing costs nothing below it and
           * there is nothing to oscillate.
           */}
          <div
            className={`absolute inset-x-0 top-full flex items-center gap-3 border-b border-line bg-surface-raised px-5 py-2.5 transition-all duration-base ease-out ${
              scrolled ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
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
              <span className="block truncate text-caption text-content-muted">{vinyl.artist}</span>
            </span>
            <button
              onClick={() => onTogglePlay(vinyl)}
              disabled={!vinyl.previewUrl}
              aria-label={playing ? "Pausar" : `Escuchar ${vinyl.title}`}
              className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-strong text-paper disabled:opacity-30"
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

        <div className="px-5 pb-8">
          <div className="mx-auto w-full max-w-[420px]">
            {/* The record, half out of its sleeve — the same object the shelf
                is made of rather than a thumbnail of it. The disc is a couple
                of gradients, not an image: at this size nobody is reading a
                label, and a real one would be another download. */}
            <div className="relative mx-auto mt-2 w-[80%]">
              <span
                aria-hidden
                className="absolute right-[-15%] top-[5%] aspect-square w-[94%] rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 50% 50%, #2a2a2a 0 17%, #101010 17.4% 18.5%, #1a1a1a 19% 100%)",
                  boxShadow: "0 18px 40px rgba(0,0,0,0.6)",
                }}
              />
              <span
                aria-hidden
                className="absolute right-[-15%] top-[5%] aspect-square w-[94%] rounded-full opacity-40"
                style={{
                  background:
                    "repeating-radial-gradient(circle at 50% 50%, rgba(255,255,255,0.05) 0 1px, transparent 1px 3px)",
                }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverFor(vinyl)}
                alt={`Portada de ${vinyl.title}`}
                className="relative aspect-square w-full rounded-[3px] object-cover shadow-[0_26px_60px_rgba(0,0,0,0.62)]"
              />
            </div>

            <div ref={sentinel} aria-hidden />

            <h2 className="mt-7 text-title font-medium leading-tight text-paper">{vinyl.title}</h2>
            <p className="mt-1 text-body text-content-secondary">{vinyl.artist}</p>

            {/* The facts, as a sheet of paper rather than a run-on line. Year,
                pressing, label and country are what someone compares between
                two copies of the same record, and a middle dot between them
                makes four different things look like one sentence. */}
            <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-y border-line py-4">
              {(
                [
                  ["Año", vinyl.year ? String(vinyl.year) : null],
                  ["Género", vinyl.genre],
                  ["Sello", vinyl.label],
                  ["País", vinyl.country],
                ] as const
              )
                .filter(([, v]) => Boolean(v))
                .map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-caption uppercase tracking-label text-content-faint">{k}</dt>
                    <dd className="mt-0.5 truncate text-sub text-content-secondary">{v}</dd>
                  </div>
                ))}
            </dl>

            {/* the two things you came for, side by side and thumb-sized */}
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-control bg-paper text-body font-medium text-ink disabled:opacity-35"
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
              <button
                onClick={() => setPicking(true)}
                className="pressable flex h-12 items-center justify-center gap-2 rounded-control border border-line-strong px-5 text-body font-medium text-paper"
              >
                Guardar
              </button>
              {/* Sharing is an icon, not a word: it is wanted often enough to
                  be one press away and rarely enough that it should not take
                  a third of the row from the two things you came for. */}
              <button
                onClick={() => setSharing(true)}
                aria-label="Compartir"
                className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-control border border-line-strong text-paper"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M8 10.5V2.6 M5 5.4 L8 2.4 L11 5.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  <path d="M3.2 9.4v3.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V9.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {/* where it already lives, so "guardar" never means "otra vez" */}
            {inLists.length > 0 && (
              <p className="mt-3.5 text-sub text-content-muted">
                También en {inLists.map((c) => c.name).join(", ")}.
              </p>
            )}

            {/* Folded away under the actions and above the tracklist, which is
                where the question belongs in time: you decide to listen, you
                decide to keep it, and only then — still holding the sleeve —
                do you wonder which pressing this is. */}
            <RecordSpecsCard discogsId={vinyl.discogsId} />

            {/* By side, because that is how the object works: you do not play
                a record from track 1 to track 12, you play a side and then get
                up and turn it over. A flat list under a heading that says
                "Cara A / Cara B" was naming the thing without doing it. */}
            {sides.length > 0 && (
              <section className="mt-9">
                {sides.map(([side, tracks]) => (
                  <div key={side} className="mt-6 first:mt-0">
                    <h3 className="flex items-baseline gap-2 text-caption uppercase tracking-label text-content-muted">
                      {side === "?" ? "Canciones" : `Cara ${side}`}
                      <span className="text-content-faint">{tracks.length}</span>
                    </h3>
                    <ol className="mt-2.5 divide-y divide-line">
                      {tracks.map((t, i) => (
                        <li key={i} className="flex items-baseline gap-3 py-2.5">
                          <span className="mono w-5 shrink-0 text-caption text-content-faint">
                            {t.position?.replace(/^[A-Z]/, "") || i + 1}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sub text-content-secondary">
                            {t.title}
                          </span>
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
              </section>
            )}

            {/* the bridge: this record is the door into other people's shelves */}
            {elsewhere.length > 0 && (
              <section className="mt-9">
                <h3 className="text-caption uppercase tracking-label text-content-muted">
                  Quién más lo tiene
                </h3>
                <ul className="mt-3 divide-y divide-line">
                  {elsewhere.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/u/${l.owner.username}/${l.slug}`}
                        className="pressable flex items-center gap-3 py-3"
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
              </section>
            )}

            {canEdit && (
            <section className="mt-9 border-t border-line pt-2">
              <SheetRow
                label="Quitar de esta lista"
                onClick={() => {
                  // the shelf's handler confirms this one, with its undo
                  onRemoveFromActive(vinyl);
                  onClose();
                }}
              />
              <SheetRow label="Borrar de mi colección" danger onClick={() => setDeleting(true)} />
            </section>
            )}
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
      <Sheet open={picking} onClose={() => setPicking(false)} title="Guardar en" size="auto" width={380}>
        <div className="py-1">
          {collections.map((c) => {
            const has = c.vinylIds.includes(vinyl.id);
            return (
              <SheetRow
                key={c.id}
                label={c.name}
                detail={has ? "✓" : `${c.vinylIds.length}`}
                onClick={() => {
                  onAddTo(c.id, vinyl);
                  setPicking(false);
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
        body={`${vinyl.title} desaparecerá de todas tus listas. Esto no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={() => {
          onDelete(vinyl);
          onClose();
        }}
      />
    </>
  );
}
