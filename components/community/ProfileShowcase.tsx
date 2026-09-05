"use client";

import { Cover } from "@/components/ui/Avatar";
import { coverFor } from "@/lib/cover";
import { cleanArtist } from "@/lib/artist";
import type { Vinyl } from "@/lib/types";

/**
 * Tus tres: los discos con los que alguien decide presentarse.
 *
 * Los elige la persona, no un algoritmo. La aplicación sabe perfectamente
 * cuáles coloca más veces y eso es un dato interesante, pero no es lo mismo:
 * uno describe una estantería y el otro presenta a alguien. Y «los que más
 * colocas» tampoco se entendía — hacía falta conocer el funcionamiento interno
 * de la aplicación para leer el titular de una sección.
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
  mine,
  onEdit,
}: {
  records: Vinyl[];
  onOpen: (v: Vinyl) => void;
  mine: boolean;
  /** solo en el tuyo: cambiar con qué te presentas */
  onEdit?: () => void;
}) {
  if (records.length === 0)
    return mine && onEdit ? (
      /* Un hueco que invita, y no una sección que no existe: los tres discos
         son lo primero que ve quien entra a tu perfil, y no tenerlos elegidos
         es la única cosa de esta pantalla que merece pedirse. */
      <section className="pb-10">
        <button
          onClick={onEdit}
          className="pressable flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line-strong px-4 py-5 text-left transition-colors hover:border-line-focus"
        >
          <span className="flex shrink-0 gap-1.5">
            {[0, 1, 2].map((i) => (
              <span key={i} className="h-9 w-9 rounded-[3px] border border-dashed border-line-strong" />
            ))}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-body text-paper">Elige tus tres</span>
            <span className="block text-caption text-content-muted">
              Los discos con los que quieres presentarte.
            </span>
          </span>
        </button>
      </section>
    ) : null;

  return (
    <section className="pb-10">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-heading font-medium leading-tight text-paper">
          {mine ? "Tus tres" : "Sus tres"}
        </h2>
        {mine && onEdit && (
          <button
            onClick={onEdit}
            className="pressable text-caption uppercase tracking-label text-content-faint transition-colors hover:text-paper"
          >
            Cambiar
          </button>
        )}
      </div>
      <p className="mt-1.5 text-sub text-content-muted">
        {mine
          ? "Con lo que te presentas, elegido por ti."
          : "Con lo que se presenta, elegidos por quien los tiene."}
      </p>

      <ul className="mt-4 grid grid-cols-3 gap-3 sm:gap-5">
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
