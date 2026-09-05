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

/**
 * A fact, as a tile rather than as a row of a definition list.
 *
 * `dt` over `dd` in a two-column grid is how a spec sheet is printed, and it
 * reads as printing: four labels down the left, four values beside them, all
 * one weight, nothing to look at. Given a surface of its own each fact becomes
 * an object — the eye can land on one and skip three, which is the whole
 * difference between a screen you scan and a page you read.
 *
 * A shade lighter than the card holding them, because a tile the same colour
 * as its container is not a tile.
 */
function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-[10px] bg-fill px-4 py-3">
      <dt className="text-micro uppercase tracking-label text-content-faint">{label}</dt>
      <dd className="mt-1.5 truncate text-body leading-snug text-paper">{value}</dd>
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
 * holding this sleeve ever look for it". Almost nothing survives that.
 *
 * **Gone: the run-out groove.** The etching between the last track and the
 * label is how a specialist tells an original from a repress, and it is the
 * single most connoisseur field there is. It was given a plate of its own and
 * a paragraph explaining what it was — which is the tell: a fact that needs
 * teaching before it can be read belongs to the archive, not to the shelf.
 *
 * **Gone: the credits.** Twenty names, of which two are the ones anybody
 * means, and no way to know which two without reading all of them.
 *
 * **Gone: the edition notes.** Sometimes "limited to 500 numbered copies";
 * more often nine paragraphs of English about a licensing arrangement. What
 * was worth having in them — 180g, gatefold, coloured — is already in the
 * format chips.
 *
 * **Gone: the pressing plant, the styles, and the barcode**, the last of which
 * you scanned to get here.
 *
 * What is left is the two things a person actually opens this for: the photos
 * of the object, which are the only part of a technical sheet that is a
 * pleasure rather than a reference — and the handful of facts that place a
 * record at a glance. Then the two numbers that say whether anybody else is
 * chasing it.
 */
function Specs({ specs: s }: { specs: RecordSpecs }) {
  const market = s.have !== null || s.want !== null || s.lowestPrice !== null;
  const formats = s.formats.join(", ").split(", ").filter(Boolean);

  return (
    <>
      {/**
       * The object, photographed — and first, because it is the reason to open
       * this at all. The back, the gatefold, the inner sleeves, a scan of each
       * label: the things you turn a record over to look at.
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
                  className={`skeleton h-[160px] rounded-[3px] object-cover ${
                    img.wide ? "w-[288px]" : "w-[160px]"
                  }`}
                />
              </a>
            ))}
          </div>
        </Block>
      )}

      {/**
       * What kind of object it is.
       *
       * The format goes first and as chips, because "2×", "LP", "Album" and
       * "Gatefold" are four separate facts about the thing in your hands and
       * reading them as one comma sentence hides the one you were looking for.
       * Everything under it is a caption to that.
       */}
      <Block title="La edición">
        {formats.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {formats.map((f, i) => (
              <li
                key={`${f}-${i}`}
                className="rounded-full bg-fill px-3.5 py-1.5 text-sub text-content-secondary"
              >
                {f}
              </li>
            ))}
          </ul>
        )}

        <dl className={`grid grid-cols-2 gap-x-4 gap-y-5 ${formats.length > 0 ? "mt-6" : ""}`}>
          {s.released && <Fact label="Publicada" value={String(s.released).slice(0, 4)} />}
          {s.country && <Fact label="País" value={s.country} />}
          {s.label && <Fact label="Sello" value={s.label} />}
          {/* The one specialist field that stays, and demoted to a fact among
              facts: it is the only thing here that identifies one pressing out
              of forty, which is what you read out to a shop before paying
              original money for a repress. */}
          {s.catno && <Fact label="Referencia" value={<span className="mono">{s.catno}</span>} />}
        </dl>
      </Block>

      {/**
       * The two numbers, last and on purpose.
       *
       * How many people have it and how many want it is the first thing a
       * collector looks at — and leading with it turns a shelf into a
       * portfolio. Side by side rather than as separate facts, because they
       * only mean anything against each other.
       */}
      {market && (
        <Block title="Quién lo tiene">
          <div className="flex items-stretch gap-2.5">
            <Count n={s.have} label="lo tienen" />
            <Count n={s.want} label="lo quieren" />
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
    <div className="flex-1 rounded-[10px] bg-fill px-4 py-3.5">
      <p className="text-heading leading-none text-paper" style={{ fontVariantNumeric: "tabular-nums" }}>
        {n === null ? "—" : n.toLocaleString("es-ES")}
      </p>
      <p className="mt-1.5 text-caption text-content-muted">{label}</p>
    </div>
  );
}
