"use client";

import Link from "next/link";
import { artistSlug, cleanArtist } from "@/lib/artist";
import { decades, distribution, topArtists } from "@/lib/collection-portrait";
import type { Vinyl } from "@/lib/types";

/**
 * El retrato de una estantería, dibujado.
 *
 * Antes eran cuatro tarjetas con una palabra dentro: «Sobre todo — Rock —
 * 35%». Correcto y plano: un dato suelto es una etiqueta, y cuatro etiquetas
 * puestas en cuadrícula son una ficha de base de datos con esquinas
 * redondeadas.
 *
 * El reparto entero, en cambio, es una **forma**. De un vistazo se ve si
 * alguien es monotemático o tiene tres mundos, si compra reediciones o si su
 * estantería es un agujero negro de los setenta con dos discos modernos de
 * cortesía. Eso no cabe en una frase, y en dos barras se lee sin leer.
 *
 * Nada de librería de gráficos: son divs con un ancho en porcentaje. Una
 * dependencia de 40 kB para pintar seis rectángulos es exactamente el tipo de
 * cosa que hace que una aplicación tarde en abrir.
 */
export default function ProfileCharts({
  records,
  mine,
}: {
  records: Vinyl[];
  mine: boolean;
}) {
  const genres = distribution(records.map((r) => r.genre));
  const dec = decades(records);
  const labels = distribution(records.map((r) => r.label), 3);
  const artists = topArtists(records.map((r) => ({ artist: cleanArtist(r.artist) })));

  if (records.length < 5) return null;

  const peak = Math.max(...dec.map((d) => d.count), 1);

  return (
    <section className="pb-10">
      <h2 className="text-heading font-medium leading-tight text-paper">
        {mine ? "Cómo suena tu estantería" : "Cómo suena su estantería"}
      </h2>
      <p className="mt-1.5 text-sub text-content-muted">
        {records.length} discos, y a qué se parecen entre ellos.
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {/* ---------------------------------------------------- los géneros */}
        {genres.length > 0 && (
          <div className="rounded-[14px] bg-fill-subtle p-4">
            <p className="text-micro uppercase tracking-label text-content-faint">Géneros</p>
            <ul className="mt-3 space-y-2.5">
              {genres.map((g, i) => (
                <li key={g.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sub text-paper">{g.name}</span>
                    <span
                      className="shrink-0 text-caption text-content-muted"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {g.share}%
                    </span>
                  </div>
                  {/* El primero lleno y los demás apagados: el orden ya está
                      en la longitud, y cinco barras del mismo color obligan a
                      compararlas una por una para encontrar la mayor. */}
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-paper" : "bg-paper/35"}`}
                      style={{ width: `${Math.max(g.share, 3)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ---------------------------------------------------- las décadas */}
        {dec.length > 1 && (
          <div className="rounded-[14px] bg-fill-subtle p-4">
            <p className="text-micro uppercase tracking-label text-content-faint">Por décadas</p>
            {/* Un histograma con sus huecos: sin las décadas vacías esto sería
                un ranking, y el agujero de los ochenta dice tanto como el pico
                de los setenta. */}
            <ul className="mt-4 flex h-[86px] items-end gap-1.5">
              {dec.map((d) => (
                <li key={d.decade} className="flex h-full flex-1 flex-col justify-end gap-1.5">
                  <span
                    className={`w-full rounded-[3px] ${d.count === peak ? "bg-paper" : "bg-paper/30"}`}
                    style={{ height: `${Math.max((d.count / peak) * 100, 4)}%` }}
                    title={`${d.decade}: ${d.count}`}
                  />
                  <span className="text-center text-micro text-content-faint">
                    {String(d.decade).slice(2)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ------------------------------------------------- los de siempre */}
        {artists.length > 0 && (
          <div className="rounded-[14px] bg-fill-subtle p-4">
            <p className="text-micro uppercase tracking-label text-content-faint">
              Artistas destacados
            </p>
            <ul className="mt-3 space-y-1">
              {artists.map((a) => (
                <li key={a.name}>
                  <Link
                    href={`/artista/${artistSlug(a.name)}`}
                    className="pressable -mx-2 flex items-center justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-fill"
                  >
                    <span className="truncate text-sub text-paper">{a.name}</span>
                    <span
                      className="shrink-0 text-caption text-content-muted"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {a.count}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* ----------------------------------------------------- los sellos */}
        {labels.length > 0 && (
          <div className="rounded-[14px] bg-fill-subtle p-4">
            <p className="text-micro uppercase tracking-label text-content-faint">Sellos</p>
            <ul className="mt-3 space-y-2.5">
              {labels.map((l, i) => (
                <li key={l.name}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sub text-paper">{l.name}</span>
                    <span
                      className="shrink-0 text-caption text-content-muted"
                      style={{ fontVariantNumeric: "tabular-nums" }}
                    >
                      {l.count}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-fill">
                    <div
                      className={`h-full rounded-full ${i === 0 ? "bg-paper" : "bg-paper/35"}`}
                      style={{ width: `${Math.max(l.share, 3)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
