"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Card from "@/components/ui/Card";
import type { RecordSpecs } from "@/lib/types";

/**
 * The shelf talker: everything about *this pressing* rather than about the
 * album.
 *
 * A record sheet already answers "what is this record" — cover, artist, year,
 * tracklist. This answers the other question, the one people actually ask in a
 * shop while holding the sleeve: which pressing is it, who cut it, what is
 * stamped in the run-out, is it worth anything. Two different questions, and
 * only one of them is asked every time — which is why it is folded away behind
 * a line you press.
 *
 * **It is blocks, not a table.** The first version was a definition list:
 * label left, value right, eleven rows of it. Everything was there and nobody
 * would ever read it — a spec sheet is what a database prints, not what a shop
 * hands you. So it is stacked cards with one subject each, the way a listening
 * app lays out what is playing: a heading you can skim, air around it, and the
 * photographs of the actual object doing the work eleven rows of grey type
 * could not. It is long, and that is fine. Scrolling is free; reading a table
 * is not.
 *
 * It loads when it opens, never before. The data is a request to somebody
 * else's API, and spending it on every record somebody merely glances at would
 * burn the rate limit for the whole application on curiosity nobody had.
 */
export default function RecordSpecsCard({
  discogsId,
  open: controlledOpen,
  onOpenChange,
}: {
  discogsId: number | null;
  /** the shelf drives it, because opening it rearranges the column around it */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [ownOpen, setOwnOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setOwnOpen(v));



  // Without a Discogs id there is no pressing to describe — the record was
  // typed in by hand. Nothing to open, so nothing to offer.
  if (!discogsId) return null;

  return (
    <section>
      {/* The trigger is a card too, not a rule between cards. On a screen
          built out of one repeated shape, the row that opts out of it is the
          one that looks broken. */}
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-3 rounded-[14px] bg-fill-subtle px-5 py-4 text-left"
      >
        <span className="text-body text-paper">Ficha técnica</span>
        <span className="flex items-center gap-2">
          <span className="text-caption uppercase tracking-label text-content-faint">
            {open ? "Cerrar" : "Ver"}
          </span>
          <svg
            width="11"
            height="11"
            viewBox="0 0 12 12"
            fill="none"
            aria-hidden
            className={`text-content-faint transition-transform duration-base ease-out ${
              open ? "rotate-180" : ""
            }`}
          >
            <path
              d="M2.5 4.5 L6 8 L9.5 4.5"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            /* height, not opacity: the card pushes what follows down rather
               than appearing over it, because it is part of the page and not a
               layer above it */
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-2.5">
              <RecordSpecsContent discogsId={discogsId} open={open} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}


/**
 * The sheet itself, without the line that opens it.
 *
 * Split out because the two places this appears disagree about where the
 * content goes: on a phone it belongs in the flow of the record screen, and on
 * the shelf it belongs over the sleeve, in a scroller of its own. Only the
 * trigger differs, so only the trigger is duplicated.
 */
export function RecordSpecsContent({
  discogsId,
  open,
}: {
  discogsId: number | null;
  open: boolean;
}) {
  const [specs, setSpecs] = useState<RecordSpecs | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error" | "limit">("idle");

  /**
   * Which record we have already asked about.
   *
   * A ref rather than the state above, because the state is what changes when
   * the request starts — and an effect that both sets state and depends on it
   * tears its own fetch down: React runs the cleanup as soon as the deps
   * change, the `alive` flag flips, and the answer arrives to a handler that
   * has been told to ignore it. The card sat on its skeleton forever with a
   * perfectly good 200 in the network panel.
   */
  const asked = useRef<number | null>(null);

  // a different record under the same card: forget what the last one said
  useEffect(() => {
    setSpecs(null);
    setState("idle");
    asked.current = null;
  }, [discogsId]);

  useEffect(() => {
    if (!open || !discogsId || asked.current === discogsId) return;
    asked.current = discogsId;
    let alive = true;
    setState("loading");
    fetch(`/api/discogs/specs?id=${discogsId}`)
      .then(async (r) => {
        if (!alive) return;
        if (r.status === 429) return setState("limit");
        if (!r.ok) return setState("error");
        const { specs: s } = await r.json();
        setSpecs(s);
        setState("idle");
      })
      .catch(() => {
        if (!alive) return;
        // let a failure be retried by closing and opening again
        asked.current = null;
        setState("error");
      });
    return () => {
      alive = false;
    };
  }, [open, discogsId]);

  return (
    <>
      {state === "loading" && <Skeleton />}

      {state === "limit" && (
        <Block>
          <Note>
            Discogs ha cortado las consultas por un momento — el límite lo compartimos
            entre todos. Vuelve a abrirla en un minuto.
          </Note>
        </Block>
      )}
      {state === "error" && (
        <Block>
          <Note>No hemos podido traer la ficha de este disco.</Note>
        </Block>
      )}

      {specs && <Specs specs={specs} />}
    </>
  );
}

/**
 * One subject per card, with room around it.
 *
 * The separation is what makes this readable at a glance: each block answers
 * one question, so the eye can skip three of them and land on the one it came
 * for. A single bordered box with everything inside would be the table again
 * wearing a different frame.
 *
 * The box itself is the app's card, not a local one — this sheet sits inside a
 * screen made of the same cards, and a block here that disagreed with the
 * tracklist card by two pixels would be the tell.
 */
function Block({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5 last:mb-0">
      <Card title={title}>{children}</Card>
    </div>
  );
}

/**
 * When the sheet could not be fetched, said in the register of a margin note:
 * one card that did not load, not a search that came back thin.
 */
function Note({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="flex items-start gap-2.5 text-sub leading-snug text-content-muted">
      <span aria-hidden className="mt-[3px] shrink-0 text-content-faint">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="7" cy="9.9" r="0.75" fill="currentColor" />
        </svg>
      </span>
      <span className="min-w-0">{children}</span>
    </p>
  );
}

function Skeleton() {
  return (
    <div aria-label="Cargando la ficha">
      <Block>
        <div className="skeleton h-[132px] rounded-[3px]" />
      </Block>
      <Block>
        <div className="skeleton h-6 w-40 rounded-full" />
        <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <div className="skeleton h-2 w-14 rounded-full" />
              <div className="skeleton mt-2 h-3 w-2/3 rounded-full" />
            </div>
          ))}
        </div>
      </Block>
    </div>
  );
}

/** A fact, said the way a caption is: the label small above, the value below. */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-micro uppercase tracking-label text-content-faint">{label}</dt>
      <dd className="mt-1 text-body leading-snug text-paper">{value}</dd>
    </div>
  );
}

/**
 * What this sheet says, and what it stopped saying.
 *
 * A Discogs release carries about thirty fields and the temptation is to
 * print all of them, which is how the first version of this ended up as a
 * database row wearing a card. The question for every line is the same: would
 * somebody holding this sleeve ever look for it?
 *
 * **Gone: the barcode.** You scanned it to get here. Printing it back is the
 * app telling you the thing you just told it.
 *
 * **Gone: the rating.** "4,32 / 5 · 118 votos" is a stranger's mark out of
 * ten for a record you own, and the product says out loud on its own landing
 * that it is not that — no puntuar los discos del uno al diez. Keeping it in
 * the one screen a collector reads most carefully would have been the tell.
 *
 * **Capped: the credits.** Discogs lists everybody, and "Lacquer Cut By" and
 * "A&R Coordinator" are twenty names between you and the four that matter.
 * Six, then a line to open the rest.
 *
 * **Clamped: the notes.** Sometimes "Limited to 500 numbered copies", which
 * is gold; sometimes nine paragraphs of English about a licensing dispute.
 * Three lines, then more if you want them.
 *
 * What is left leads with the one field that identifies a pressing out of
 * forty, and ends with the two numbers a collector actually reads: how many
 * people have it and how many want it.
 */
function Specs({ specs: s }: { specs: RecordSpecs }) {
  const styles = s.styles.length ? s.styles : s.genres;
  const [allCredits, setAllCredits] = useState(false);
  const [allNotes, setAllNotes] = useState(false);

  const CREDITS_SHOWN = 6;
  const people = allCredits ? s.people : s.people.slice(0, CREDITS_SHOWN);
  const hidden = Math.max(0, s.people.length - CREDITS_SHOWN);

  const market = s.have !== null || s.want !== null || s.lowestPrice !== null;

  return (
    <>
      {/**
       * The object, photographed — and first, because it is the only part of a
       * technical sheet that is a pleasure rather than a reference. The back,
       * the gatefold, the inner sleeves, a scan of each label: the things you
       * turn a record over to look at.
       */}
      {s.images.length > 0 && (
        <Block title="Esta edición, por dentro">
          <div className="rail -mx-5 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-5 pb-1">
            {s.images.map((img, i) => (
              <a
                key={i}
                href={img.full}
                target="_blank"
                rel="noopener noreferrer"
                className="pressable shrink-0 snap-start"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.thumb}
                  alt=""
                  loading="lazy"
                  className={`skeleton h-[132px] rounded-[3px] object-cover ${
                    img.wide ? "w-[240px]" : "w-[132px]"
                  }`}
                />
              </a>
            ))}
          </div>
        </Block>
      )}

      {/**
       * The shelf talker.
       *
       * The catalogue number gets the biggest type on the card because it is
       * the only field here that identifies one pressing out of forty — it is
       * what you read out on the phone to a shop and what you check against a
       * listing before paying original money for a repress. Everything else in
       * this block is a caption to it.
       */}
      <Block>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-micro uppercase tracking-label text-content-faint">
              Número de catálogo
            </p>
            <p className="mono mt-2 break-words text-title leading-none text-paper">
              {s.catno || "—"}
            </p>
            {s.label && <p className="mt-2.5 text-sub text-content-secondary">{s.label}</p>}
          </div>
          {s.released && (
            <p className="mono shrink-0 text-heading leading-none text-content-faint">
              {String(s.released).slice(0, 4)}
            </p>
          )}
        </div>

        {/* the format as a row of chips: "2×", "LP", "Album" and "Gatefold"
            are four separate facts about the object, and reading them as one
            comma sentence hides the one you were looking for */}
        {s.formats.length > 0 && (
          <ul className="mt-5 flex flex-wrap gap-1.5">
            {s.formats
              .join(", ")
              .split(", ")
              .map((f, i) => (
                <li
                  key={`${f}-${i}`}
                  className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary"
                >
                  {f}
                </li>
              ))}
          </ul>
        )}

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5">
          {s.country && <Fact label="País" value={s.country} />}
          {s.pressedBy && <Fact label="Prensada en" value={s.pressedBy} />}
          {styles.length > 0 && (
            <Fact label="Estilo" value={styles.slice(0, 3).join(" · ")} />
          )}
        </dl>
      </Block>

      {/**
       * The run-out groove: the etching between the last track and the label,
       * and the closest thing a record has to a signature. It is how you tell
       * an original from a repress when everything else matches — so it is set
       * in mono, printed whole, and given a plate of its own.
       *
       * The barcode used to sit beside it and no longer does: you scanned it
       * to get here.
       */}
      {s.matrix && (
        <Block title="Grabado en el surco">
          <p className="mono break-words rounded-[3px] bg-ink px-3.5 py-3 text-sub leading-relaxed text-paper">
            {s.matrix}
          </p>
          <p className="mt-2.5 text-caption leading-relaxed text-content-muted">
            Lo que hay escrito entre el último surco y la etiqueta. Es lo que
            distingue una original de una reedición cuando todo lo demás coincide.
          </p>
        </Block>
      )}

      {/**
       * By person, not by job — the way a sleeve prints it. Kevin Parker wrote,
       * played, produced and mixed Currents; as a list of roles that is his
       * name four times, and as a list of people it is the single most
       * interesting fact about the record.
       */}
      {s.people.length > 0 && (
        <Block title="Quién la hizo">
          <ul className="divide-y divide-line">
            {people.map((p) => (
              <li key={p.name} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2.5 first:pt-0">
                <span className="text-body text-paper">{p.name}</span>
                <span className="text-caption text-content-muted">{p.roles.join(" · ")}</span>
              </li>
            ))}
          </ul>
          {hidden > 0 && (
            <button
              onClick={() => setAllCredits((v) => !v)}
              className="pressable mt-3 text-sub text-content-muted underline-offset-4 transition hover:text-paper hover:underline"
            >
              {allCredits ? "Ver solo lo principal" : `Y ${hidden} más`}
            </button>
          )}
        </Block>
      )}

      {s.notes && (
        <Block title="Notas de la edición">
          <p
            className={`whitespace-pre-line text-sub leading-relaxed text-content-secondary ${
              allNotes ? "" : "line-clamp-3"
            }`}
          >
            {s.notes}
          </p>
          {s.notes.length > 180 && (
            <button
              onClick={() => setAllNotes((v) => !v)}
              className="pressable mt-2.5 text-sub text-content-muted underline-offset-4 transition hover:text-paper hover:underline"
            >
              {allNotes ? "Menos" : "Leer entera"}
            </button>
          )}
        </Block>
      )}

      {/**
       * The market, last and on purpose.
       *
       * How many people have it and how many want it is the first thing a
       * collector looks at — but leading with it turns a shelf into a
       * portfolio. It sits under everything else, next to the way out to the
       * catalogue where those numbers actually live.
       *
       * Two numbers side by side rather than four small facts: "la tienen" and
       * "la quieren" only mean anything against each other, and that
       * comparison is the whole of what a collector reads here.
       */}
      {market && (
        <Block title="Quién lo tiene">
          <div className="flex items-stretch gap-2.5">
            <Count n={s.have} label="la tienen" />
            <Count n={s.want} label="la quieren" />
          </div>

          {s.lowestPrice !== null && (
            <p className="mt-4 text-sub text-content-muted">
              {s.forSale
                ? `${s.forSale} a la venta, desde ${Math.round(s.lowestPrice)} €`
                : `La más barata, ${Math.round(s.lowestPrice)} €`}
            </p>
          )}

          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mt-5 flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong text-sub text-paper transition-colors hover:border-paper/40"
          >
            Ver la ficha completa
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden>
              <path
                d="M2 8 L8 2 M3.6 2 H8 V6.4"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
        </Block>
      )}
    </>
  );
}

/** one of the two numbers that only mean anything beside each other */
function Count({ n, label }: { n: number | null; label: string }) {
  return (
    <div className="flex-1 rounded-[10px] bg-fill-subtle px-4 py-3.5">
      <p className="text-heading leading-none text-paper" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n === null ? "—" : n.toLocaleString("es-ES")}
      </p>
      <p className="mt-1.5 text-caption text-content-muted">{label}</p>
    </div>
  );
}
