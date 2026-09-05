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
 * **It is one list, in one card.** It went the other way first — a block per
 * subject, chips, tiles, a gallery of the object — and stacking four shapes
 * made the sheet read as a second record screen rather than as the footnote it
 * is. Cut back to the eight lines somebody would actually look for, one list is
 * the honest shape: short enough to take in at a glance, and it stops
 * competing with the record above it.
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
            Hay demasiadas consultas ahora mismo. Vuelve a abrirla en un minuto.
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
      <Card>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-5 border-b border-line py-3.5 last:border-b-0"
          >
            <div className="skeleton h-2 w-16 rounded-full" />
            <div className="skeleton h-3 w-24 rounded-full" />
          </div>
        ))}
      </Card>
    </div>
  );
}

/**
 * One fact, as a row.
 *
 * The tiles were the second attempt and the grid was the first, and both had
 * the same problem: they cut the sheet into subjects, so reading it meant
 * changing shape four times. A record's technical sheet is one subject — this
 * pressing — and a list is what one subject looks like. Label left, value
 * right, a hairline between, in the order somebody holding the sleeve would
 * ask: what it is, when, where, who put it out, what it is called on the
 * spine, and then whether anybody else is chasing it.
 */
function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-5 border-b border-line py-3.5 last:border-b-0">
      <dt className="shrink-0 text-caption uppercase tracking-label text-content-faint">{label}</dt>
      <dd className="min-w-0 truncate text-right text-body leading-snug text-paper">{value}</dd>
    </div>
  );
}

/**
 * What this sheet says, and what it stopped saying.
 *
 * A release carries about thirty fields and the first version printed most of
 * them. That is the right instinct for an archive and the wrong one here: this
 * is not a database anybody is contributing to, it is a shelf, and the person
 * reading is somebody who buys records rather than catalogues them.
 *
 * So the question for every line is not "is it true" but "would somebody
 * holding this sleeve ever look for it". Almost nothing survives that: gone
 * the run-out groove, the credits, the edition notes, the pressing plant, the
 * styles, and the barcode you scanned to get here.
 *
 * **Gone too: the photographs of the object.** They were the pleasure of this
 * card and they were also the reason it read as a second record screen — a
 * gallery under a cover, two sets of images about the same sleeve. The sheet
 * is the facts; the pictures belong to the record above it.
 *
 * And **gone: the link out.** Everything worth reading is already here, and a
 * button that hands the reader to somebody else's site is the shelf admitting
 * it is a front end for a catalogue.
 */
function Specs({ specs: s }: { specs: RecordSpecs }) {
  const formats = s.formats.join(", ").split(", ").filter(Boolean);
  const price =
    s.lowestPrice === null
      ? null
      : s.forSale
        ? `${s.forSale} a la venta, desde ${Math.round(s.lowestPrice)} €`
        : `Desde ${Math.round(s.lowestPrice)} €`;
  const num = (n: number | null) => (n === null ? null : n.toLocaleString("es-ES"));

  return (
    <Card>
      <dl>
        {formats.length > 0 && <Row label="Formato" value={formats.join(" · ")} />}
        {s.released && <Row label="Publicada" value={String(s.released).slice(0, 4)} />}
        {s.country && <Row label="País" value={s.country} />}
        {s.label && <Row label="Sello" value={s.label} />}
        {/* The one specialist field that stays: it is the only thing here that
            identifies one pressing out of forty, which is what you read out to
            a shop before paying original money for a repress. */}
        {s.catno && <Row label="Referencia" value={<span className="mono">{s.catno}</span>} />}
        {s.have !== null && <Row label="Lo tienen" value={num(s.have)} />}
        {s.want !== null && <Row label="Lo quieren" value={num(s.want)} />}
        {price && <Row label="Se vende" value={price} />}
      </dl>
    </Card>
  );
}
