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
 * only one of them is asked every time — which is why this is folded away
 * behind a line you press instead of another eight rows nobody reads.
 *
 * It loads when it opens, never before. The data is a request to somebody
 * else's API, and spending it on every record somebody merely glances at would
 * burn the rate limit for the whole application on curiosity nobody had.
 */
export default function RecordSpecsCard({ discogsId }: { discogsId: number | null }) {
  const [open, setOpen] = useState(false);
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
    setOpen(false);
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
    <section className="mt-6">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="pressable flex w-full items-center justify-between gap-3 border-y border-line py-3 text-left"
      >
        <span className="text-sub text-content-secondary">Ficha técnica</span>
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
            /* height, not opacity: the card pushes the tracklist down rather
               than appearing over it, because it is part of the page and not a
               layer above it */
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-3 bg-fill-subtle p-4 ring-1 ring-inset ring-line">
              {state === "loading" && <Skeleton />}

              {state === "limit" && (
                <Note>
                  Discogs ha cortado las consultas por un momento — el límite lo
                  compartimos entre todos. Vuelve a abrirla en un minuto.
                </Note>
              )}
              {state === "error" && (
                <Note>No hemos podido traer la ficha de este disco.</Note>
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
 * When the sheet could not be fetched, said in the register of a margin note.
 *
 * Same shape as the notice the catalogue search uses, different words: this is
 * one card that did not load, not a search that came back thin, and telling
 * somebody their results are incomplete when they asked for one record's
 * credits would be answering a question they did not ask.
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
    <div className="space-y-3" aria-label="Cargando la ficha">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5">
          <div className="h-2 w-16 animate-pulse rounded-[2px] bg-fill" />
          <div className="h-3 w-full animate-pulse rounded-[2px] bg-fill" style={{ opacity: 0.7 }} />
        </div>
      ))}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[104px_1fr] gap-3 border-t border-line py-2.5 first:border-t-0 first:pt-0">
      <dt className="text-caption uppercase tracking-label text-content-faint">{label}</dt>
      <dd className="min-w-0 text-sub text-content-secondary">{children}</dd>
    </div>
  );
}

function Specs({ specs: s }: { specs: RecordSpecs }) {
  const styles = s.styles.length ? s.styles : s.genres;

  return (
    <>
      {/**
       * The catalogue number gets the top line on its own, because it is the
       * only field here that identifies one pressing out of forty. It is what
       * you read out on the phone to a shop and what you check against a
       * listing before paying reissue money for a reissue.
       */}
      {(s.catno || s.label) && (
        <div className="pb-3">
          <p className="mono text-heading leading-none text-paper">{s.catno ?? "—"}</p>
          {s.label && <p className="mt-1.5 text-sub text-content-muted">{s.label}</p>}
        </div>
      )}

      <dl className="border-t border-line">
        {s.formats.length > 0 && <Row label="Formato">{s.formats.join(" · ")}</Row>}
        {(s.released || s.country) && (
          <Row label="Edición">{[s.released, s.country].filter(Boolean).join(" · ")}</Row>
        )}
        {s.pressedBy && <Row label="Prensado">{s.pressedBy}</Row>}
        {styles.length > 0 && <Row label="Estilo">{styles.join(", ")}</Row>}

        {s.credits.map((c) => (
          <Row key={c.role} label={c.role}>
            {c.names.join(", ")}
          </Row>
        ))}

        {s.barcode && (
          <Row label="Cód. barras">
            <span className="mono text-caption">{s.barcode}</span>
          </Row>
        )}
        {/* The run-out groove: the etching between the last track and the
            label, and the closest thing a record has to a signature. It is how
            you tell an original from a repress when everything else matches,
            so it is set in mono and printed whole. */}
        {s.matrix && (
          <Row label="Matriz">
            <span className="mono break-words text-caption">{s.matrix}</span>
          </Row>
        )}
      </dl>

      {s.notes && (
        <p className="mt-3 whitespace-pre-line border-t border-line pt-3 text-caption leading-relaxed text-content-muted">
          {s.notes}
        </p>
      )}

      {/**
       * The market, kept to one line and kept last.
       *
       * How many people have it, how many want it and what the cheapest copy
       * costs is genuinely interesting — it is the first thing collectors look
       * at — but leading with money would turn a shelf into a portfolio. It
       * sits under everything else, in the small type, next to the way out to
       * Discogs where those numbers actually live.
       */}
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-line pt-3">
        {s.have !== null && (
          <Stat value={s.have.toLocaleString("es-ES")} label="la tienen" />
        )}
        {s.want !== null && (
          <Stat value={s.want.toLocaleString("es-ES")} label="la quieren" />
        )}
        {s.rating !== null && s.ratingCount ? (
          <Stat value={`${s.rating.toFixed(2)}/5`} label={`${s.ratingCount} votos`} />
        ) : null}
        {s.lowestPrice !== null && (
          <Stat
            value={`${Math.round(s.lowestPrice)} €`}
            label={s.forSale ? `${s.forSale} en venta` : "desde"}
          />
        )}
      </div>

      <a
        href={s.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex items-center gap-1.5 text-caption uppercase tracking-label text-content-faint transition-colors hover:text-paper"
      >
        Ver en Discogs
        <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden>
          <path
            d="M2 8 L8 2 M3.6 2 H8 V6.4"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-sub text-paper">{value}</span>
      <span className="text-caption text-content-faint">{label}</span>
    </span>
  );
}
