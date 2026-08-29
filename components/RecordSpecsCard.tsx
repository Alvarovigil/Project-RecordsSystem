"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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

  // Without a Discogs id there is no pressing to describe — the record was
  // typed in by hand. Nothing to open, so nothing to offer.
  if (!discogsId) return null;

  return (
    <section className="mt-7">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-3 border-y border-line py-3.5 text-left"
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
            <div className="mt-3">
              {state === "loading" && <Skeleton />}

              {state === "limit" && (
                <Block>
                  <Note>
                    Discogs ha cortado las consultas por un momento — el límite lo
                    compartimos entre todos. Vuelve a abrirla en un minuto.
                  </Note>
                </Block>
              )}
              {state === "error" && (
                <Block>
                  <Note>No hemos podido traer la ficha de este disco.</Note>
                </Block>
              )}

              {specs && <Specs specs={specs} />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}

/**
 * One subject per card, with room around it.
 *
 * The separation is what makes this readable at a glance: each block answers
 * one question, so the eye can skip three of them and land on the one it came
 * for. A single bordered box with everything inside would be the table again
 * wearing a different frame.
 */
function Block({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-2.5 rounded-[3px] bg-fill-subtle p-5 last:mb-0">
      {title && <h3 className="text-body font-medium text-paper">{title}</h3>}
      <div className={title ? "mt-4" : ""}>{children}</div>
    </section>
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
        <div className="h-[104px] animate-pulse rounded-[3px] bg-fill" />
      </Block>
      <Block>
        <div className="h-5 w-40 animate-pulse rounded-[2px] bg-fill" />
        <div className="mt-5 space-y-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-2">
              <div className="h-2 w-14 animate-pulse rounded-[2px] bg-fill" />
              <div className="h-3 w-2/3 animate-pulse rounded-[2px] bg-fill opacity-70" />
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

function Specs({ specs: s }: { specs: RecordSpecs }) {
  const styles = s.styles.length ? s.styles : s.genres;
  const market =
    s.have !== null || s.want !== null || s.rating !== null || s.lowestPrice !== null;

  return (
    <>
      {/**
       * The object, photographed.
       *
       * The back, the gatefold, the inner sleeves, a scan of each label — the
       * things you turn a record over to look at, and the only part of a
       * technical sheet that is genuinely a pleasure to browse. They scroll
       * sideways so the block stays one screen tall however many the release
       * has, and each one opens full size, because a label scan is worth
       * reading and 132 pixels is not enough to read it.
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
                  className={`h-[132px] rounded-[3px] bg-fill object-cover ${
                    img.wide ? "w-[240px]" : "w-[132px]"
                  }`}
                />
              </a>
            ))}
          </div>
        </Block>
      )}

      {/**
       * The catalogue number gets the biggest type on the card, because it is
       * the only field here that identifies one pressing out of forty. It is
       * what you read out on the phone to a shop and what you check against a
       * listing before paying original money for a repress.
       */}
      <Block title="La prensada">
        {s.catno && (
          <div className="pb-4">
            <p className="mono text-title leading-none text-paper">{s.catno}</p>
            {s.label && <p className="mt-2 text-sub text-content-muted">{s.label}</p>}
          </div>
        )}

        {/* the format as a row of chips: "2×", "LP", "Album" and "Gatefold" are
            four separate facts about the object, and reading them as one comma
            sentence hides the one you were looking for */}
        {s.formats.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
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

        <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-5">
          {s.released && <Fact label="Publicada" value={s.released} />}
          {s.country && <Fact label="País" value={s.country} />}
          {s.pressedBy && <Fact label="Prensada por" value={s.pressedBy} />}
          {styles.length > 0 && <Fact label="Estilo" value={styles.join(", ")} />}
        </dl>
      </Block>

      {/**
       * By person, not by job — the way a sleeve prints it. Kevin Parker wrote,
       * played, produced and mixed Currents; as a list of roles that is his
       * name four times, and as a list of people it is the single most
       * interesting fact about the record.
       */}
      {s.people.length > 0 && (
        <Block title="Quién la hizo">
          <ul className="space-y-4">
            {s.people.map((p) => (
              <li key={p.name}>
                <p className="text-body text-paper">{p.name}</p>
                <p className="mt-0.5 text-caption text-content-muted">{p.roles.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {/**
       * The run-out groove: the etching between the last track and the label,
       * and the closest thing a record has to a signature. It is how you tell
       * an original from a repress when everything else matches — so it is set
       * in mono, printed whole, and given a plate of its own rather than a row.
       */}
      {(s.matrix || s.barcode) && (
        <Block title="Grabado en el disco">
          {s.matrix && (
            <div>
              <p className="text-micro uppercase tracking-label text-content-faint">Matriz</p>
              <p className="mono mt-1.5 break-words rounded-[3px] bg-ink px-3 py-2.5 text-sub text-paper">
                {s.matrix}
              </p>
            </div>
          )}
          {s.barcode && (
            <div className={s.matrix ? "mt-4" : ""}>
              <p className="text-micro uppercase tracking-label text-content-faint">
                Código de barras
              </p>
              <p className="mono mt-1.5 break-words rounded-[3px] bg-ink px-3 py-2.5 text-sub text-paper">
                {s.barcode}
              </p>
            </div>
          )}
        </Block>
      )}

      {s.notes && (
        <Block title="Notas de la edición">
          <p className="whitespace-pre-line text-sub leading-relaxed text-content-secondary">
            {s.notes}
          </p>
        </Block>
      )}

      {/**
       * The market, last and on purpose.
       *
       * How many people have it, how many want it and what the cheapest copy
       * costs is the first thing a collector looks at — but leading with money
       * turns a shelf into a portfolio. It sits under everything else, next to
       * the way out to Discogs where those numbers actually live.
       */}
      {market && (
        <Block title="En Discogs">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-5">
            {s.have !== null && <Fact label="La tienen" value={s.have.toLocaleString("es-ES")} />}
            {s.want !== null && <Fact label="La quieren" value={s.want.toLocaleString("es-ES")} />}
            {s.rating !== null && s.ratingCount ? (
              <Fact label={`Nota · ${s.ratingCount} votos`} value={`${s.rating.toFixed(2)} / 5`} />
            ) : null}
            {s.lowestPrice !== null && (
              <Fact
                label={s.forSale ? `${s.forSale} en venta` : "Más barata"}
                value={`${Math.round(s.lowestPrice)} €`}
              />
            )}
          </dl>

          <a
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="pressable mt-5 flex h-11 items-center justify-center gap-2 rounded-control border border-line-strong text-sub text-paper transition-colors hover:border-paper/40"
          >
            Ver en Discogs
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
