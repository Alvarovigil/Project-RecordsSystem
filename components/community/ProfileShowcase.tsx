"use client";

import Link from "next/link";
import { Cover } from "@/components/ui/Avatar";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist } from "@/lib/artist";
import type { Portrait } from "@/lib/collection-portrait";
import type { Vinyl } from "@/lib/types";

/**
 * Tres discos, en grande, antes que ningún número.
 *
 * Un perfil se abría con «38 discos · 6 racks · 12 seguidores», que es la ficha
 * de un inventario. Nadie decide seguir a alguien por su inventario: se decide
 * por lo que tiene, y basta ver tres portadas para saber si esa persona te
 * interesa — más rápido que cualquier cifra y más honesto que una biografía.
 *
 * Tres y no seis: cuatro ya es una rejilla, y una rejilla se hojea. Tres se
 * miran de uno en uno.
 */
export function Standouts({
  records,
  onOpen,
  title,
}: {
  records: Vinyl[];
  onOpen: (v: Vinyl) => void;
  title: string;
}) {
  if (records.length === 0) return null;

  return (
    <section className="pb-10">
      <h2 className="text-caption uppercase tracking-label text-content-muted">{title}</h2>
      <ul className="mt-3.5 grid grid-cols-3 gap-3 sm:gap-5">
        {records.map((v, i) => (
          <li key={v.id}>
            <button onClick={() => onOpen(v)} className="pressable block w-full text-left">
              <Cover
                src={coverFor(v)}
                eager={i < 3}
                className="aspect-square w-full rounded-[3px]"
              />
              <span className="mt-2.5 block truncate text-sub font-medium text-paper">
                {v.title}
              </span>
              <span className="block truncate text-caption text-content-muted">
                {cleanArtist(v.artist)}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * El retrato, en frases y no en tabla.
 *
 * «Rock · 1978 · Island · UK» son cuatro celdas de una base de datos. «Sobre
 * todo rock, y casi todo de los setenta» es alguien. Cada dato que existe se
 * dice en una tarjeta, y el que no llega al umbral no aparece: media pantalla
 * de guiones es peor que media pantalla vacía.
 */
export function PortraitCard({ portrait, records }: { portrait: Portrait; records: number }) {
  const facts: { k: string; v: string; note?: string }[] = [];
  if (portrait.genre)
    facts.push({ k: "Sobre todo", v: portrait.genre.name, note: `${portrait.genre.share}% de la estantería` });
  if (portrait.decade)
    facts.push({ k: "Su década", v: portrait.decade.label, note: `${portrait.decade.count} discos` });
  if (portrait.label)
    facts.push({ k: "Sello que repite", v: portrait.label.name, note: `${portrait.label.count} veces` });
  if (portrait.span)
    facts.push({ k: "De", v: `${portrait.span.from} a ${portrait.span.to}`, note: `${records} discos` });

  if (facts.length === 0) return null;

  return (
    <section className="pb-10">
      <h2 className="text-caption uppercase tracking-label text-content-muted">
        Cómo suena esta estantería
      </h2>
      <ul className="mt-3.5 grid grid-cols-2 gap-2.5">
        {facts.map((f) => (
          <li key={f.k} className="rounded-[14px] bg-fill-subtle px-4 py-3.5">
            <p className="text-micro uppercase tracking-label text-content-faint">{f.k}</p>
            <p className="mt-1.5 truncate text-body leading-snug text-paper">{f.v}</p>
            {f.note && <p className="mt-0.5 truncate text-caption text-content-muted">{f.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Lo que tenéis los dos.
 *
 * Es la razón de ser de la aplicación puesta en una fila: no «esta persona
 * tiene 38 discos», sino «esta persona y tú tenéis nueve discos en común, y
 * mira cuáles». Un desconocido con nueve discos tuyos deja de ser un
 * desconocido — es exactamente el momento en el que alguien pulsa seguir.
 */
export function InCommon({
  records,
  onOpen,
}: {
  records: Vinyl[];
  onOpen: (v: Vinyl) => void;
}) {
  if (records.length === 0) return null;

  return (
    <section className="pb-10">
      <h2 className="text-caption uppercase tracking-label text-content-muted">
        {records.length === 1 ? "Un disco que tenéis los dos" : `${records.length} discos que tenéis los dos`}
      </h2>
      <ul className="rail rail-page mt-3.5 flex gap-3 pb-2">
        {records.slice(0, 20).map((v) => (
          <li key={v.id} className="w-[96px] shrink-0 snap-start">
            <button onClick={() => onOpen(v)} className="pressable block w-full text-left">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverFor(v)}
                alt={v.title}
                loading="lazy"
                className="aspect-square w-full rounded-[3px] object-cover"
              />
              <span className="mt-2 block truncate text-caption text-content-secondary">
                {v.title}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Los artistas que más se repiten, como puertas.
 *
 * Tres discos del mismo artista en una estantería no son tres discos: son un
 * artista. Y un artista es una página de esta aplicación, así que la lista de
 * los que más aparecen es, literalmente, un pasillo desde la colección de
 * alguien hacia el resto del catálogo.
 */
export function Regulars({ records }: { records: Vinyl[] }) {
  const tally = new Map<string, number>();
  for (const r of records) {
    const name = cleanArtist(r.artist);
    if (name) tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  const regulars = [...tally.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (regulars.length === 0) return null;

  return (
    <section className="pb-10">
      <h2 className="text-caption uppercase tracking-label text-content-muted">Los de casa</h2>
      <ul className="mt-3.5 flex flex-wrap gap-2">
        {regulars.map(([name, n]) => (
          <li key={name}>
            <Link
              href={`/artista/${artistSlug(name)}`}
              className="pressable flex items-center gap-2 rounded-full bg-fill px-3.5 py-1.5 text-sub text-content-secondary transition-colors hover:bg-fill-strong hover:text-paper"
            >
              {name}
              <span className="text-caption text-content-faint" style={{ fontVariantNumeric: "tabular-nums" }}>
                {n}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
