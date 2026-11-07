"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * The shape of what is coming, while it comes.
 *
 * Not a spinner. A spinner says "wait" and tells you nothing about what you
 * are waiting for; a skeleton is a promise about the layout, so the screen you
 * end up with is the screen you were already looking at. That is most of what
 * separates an application from a page: the furniture arrives first and the
 * content fills it, rather than the whole thing appearing at once after a
 * pause.
 *
 * The shimmer travels rather than pulsing. A block that fades in and out reads
 * as something broken blinking at you; a highlight moving across a surface
 * reads as loading, and it is the convention every phone has taught people for
 * a decade.
 */
export default function Skeleton({
  className = "",
  radius = 3,
}: {
  className?: string;
  /** sleeves are 3px, cards are 14, text is a pill — match the real thing.
   *  A token (`var(--r-lg)`) when the real thing is drawn with one. */
  radius?: number | string;
}) {
  return (
    <span
      aria-hidden
      className={`skeleton block ${className}`}
      style={{ borderRadius: radius }}
    />
  );
}

/** a line of type that has not arrived: 1em tall, and never full width */
export function SkeletonText({
  w = "70%",
  className = "",
}: {
  w?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={`skeleton block ${className}`}
      style={{ width: w, height: "0.72em", borderRadius: 999 }}
    />
  );
}

/**
 * Una línea de texto que ocupa lo mismo que la de verdad.
 *
 * `SkeletonText` mide 0,72em y no tiene interlineado: debajo de una portada,
 * tres de ellas suman menos que tres líneas de texto, y al llegar el texto la
 * fila crece y empuja lo de abajo. Esta lleva dentro un espacio en blanco con
 * la clase de tipo que tendrá la línea real (`text-sub`, `text-caption`…), así
 * que mide exactamente una línea de esa letra, y la barra va pintada encima.
 */
export function SkeletonLine({
  w = "70%",
  className = "",
}: {
  w?: string;
  /** la misma clase de tipo y el mismo margen que la línea que sustituye */
  className?: string;
}) {
  return (
    <span aria-hidden className={`relative block ${className}`}>
      {"\u00a0"}
      <span
        className="skeleton absolute left-0 top-1/2 -translate-y-1/2"
        style={{ width: w, height: "0.72em", borderRadius: 999 }}
      />
    </span>
  );
}

/**
 * Every skeleton below is the shape of one real screen, and that is the whole
 * of the discipline here.
 *
 * A generic three-column grid standing in for a two-column grid, a horizontal
 * rail and a list of rows is worse than no skeleton at all: the layout jumps
 * the moment the answer lands, which is the exact thing a skeleton exists to
 * prevent. So each of these mirrors its caller's grid — the same columns, the
 * same gaps, the same aspect, the same two lines of caption underneath — and
 * when a screen's layout changes, its skeleton is next to it in the diff.
 */

/** the phone's collection: two columns, title and artist under each sleeve */
export function SkeletonGrid({ n = 6 }: { n?: number }) {
  return (
    <ul aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-7">
      {Array.from({ length: n }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full" />
          <SkeletonText className="mt-2.5" w={i % 2 ? "58%" : "76%"} />
          <SkeletonText className="mt-1.5" w={i % 3 ? "40%" : "52%"} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A rack's records, and an artist's: the wider grids, which are not the phone's
 * two columns and must not pretend to be.
 */
export function SkeletonCovers({
  n = 10,
  cols = "grid-cols-3 sm:grid-cols-5",
  gap = "gap-x-4 gap-y-6",
}: {
  n?: number;
  cols?: string;
  gap?: string;
}) {
  return (
    <ul aria-hidden className={`grid ${cols} ${gap}`}>
      {Array.from({ length: n }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full" />
          <SkeletonText className="mt-2.5" w={i % 2 ? "64%" : "82%"} />
        </li>
      ))}
    </ul>
  );
}

/**
 * A rack card: the crate, its name, whose it is, and the two metrics under it.
 *
 * The crate is square — `Crate` pads to 100% of its own width — and the three
 * lines below it are what `ListCard` prints, in the order it prints them.
 */
function RackCardShape() {
  return (
    <div>
      <Skeleton className="aspect-square w-full" radius={3} />
      {/* título (`text-body`), firma (`text-sub`) y cifras (`text-caption`),
          con los márgenes de ListCard: así mide lo mismo que la tarjeta */}
      <SkeletonLine className="mt-2.5 text-body" w="72%" />
      <SkeletonLine className="mt-1 text-sub" w="48%" />
      <SkeletonLine className="mt-1.5 text-caption" w="34%" />
    </div>
  );
}

/** racks in a grid — a profile's own, and the ones it keeps */
export function SkeletonRackGrid({ n = 6 }: { n?: number }) {
  return (
    <ul
      aria-hidden
      className="grid grid-cols-2 gap-x-9 gap-y-14 sm:grid-cols-3 lg:grid-cols-4"
    >
      {Array.from({ length: n }).map((_, i) => (
        <li key={i}>
          <RackCardShape />
        </li>
      ))}
    </ul>
  );
}

/**
 * Racks in a rail — Explorar.
 *
 * Cut off at the right edge like the real one, because that overhang is how
 * the row says there is more of it. A skeleton that stops neatly inside the
 * screen teaches the wrong thing for the half-second it is up.
 */
export function SkeletonRackRail({ n = 5 }: { n?: number }) {
  return (
    <ul
      aria-hidden
      className="-mx-5 flex gap-9 overflow-hidden px-5 pb-2 pr-10 sm:-mx-8 sm:px-8 sm:pr-14"
    >
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="w-[44vw] shrink-0 sm:w-[200px]">
          <RackCardShape />
        </li>
      ))}
    </ul>
  );
}

/**
 * «Lo tienen ellos, tú no» — Explorar.
 *
 * La misma fila que `FromOthersRail`: el mismo ancho por funda, el mismo hueco,
 * y debajo las tres líneas que imprime (título, artista, de dónde sale) con su
 * interlineado real. Antes era una rejilla de seis que en el móvil hacía dos
 * filas: medía casi el doble que el carril y, al llegar, todo lo de abajo
 * subía de golpe.
 */
export function SkeletonFindRail({ n = 6 }: { n?: number }) {
  return (
    <ul aria-hidden className="rail rail-page mt-4 flex gap-3.5 overflow-hidden pb-2">
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="w-[142px] shrink-0 sm:w-[164px]">
          <Skeleton className="aspect-square w-full" />
          <SkeletonLine className="mt-2.5 text-sub" w={i % 2 ? "64%" : "82%"} />
          <SkeletonLine className="text-sub" w="52%" />
          <SkeletonLine className="mt-1 text-caption" w="74%" />
        </li>
      ))}
    </ul>
  );
}

/**
 * «Coleccionan como tú» — Explorar: tarjetas de persona en un carril.
 *
 * `PersonCard` es una tarjeta 3:4 de esquina `lg`; la fila tenía título y
 * nada debajo mientras cargaba, y al llegar las tarjetas aparecía de golpe una
 * franja de trescientos píxeles.
 */
export function SkeletonPersonRail({ n = 4 }: { n?: number }) {
  return (
    <ul aria-hidden className="rail rail-page flex gap-4 overflow-hidden pb-2 sm:gap-5">
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="w-[46vw] shrink-0 sm:w-[196px] lg:w-[212px]">
          <Skeleton className="aspect-[3/4] w-full" radius="var(--r-lg)" />
        </li>
      ))}
    </ul>
  );
}

/** a stack of rows: lists, people, racks inside the community panel */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <ul aria-hidden className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="flex items-center gap-3.5 rounded-lg bg-fill-subtle p-3">
          <Skeleton className="h-11 w-11 shrink-0" />
          <span className="min-w-0 flex-1">
            <SkeletonText w={i % 2 ? "50%" : "68%"} />
            <SkeletonText className="mt-2" w="34%" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Actividad: a day heading, then entries of a face and a sentence.
 *
 * Two lines for the sentence and sometimes a row of covers under it, which is
 * what the real entries are made of — an activity feed skeletoned as flat rows
 * of one line is a different screen wearing the same grey.
 */
export function SkeletonActivity({ n = 4 }: { n?: number }) {
  return (
    <div aria-hidden>
      <SkeletonText w="88px" className="mb-5" />
      <ul className="space-y-7">
        {Array.from({ length: n }).map((_, i) => (
          <li key={i} className="flex gap-3.5">
            <Skeleton className="h-9 w-9 shrink-0" radius={999} />
            <span className="min-w-0 flex-1">
              <SkeletonText w={i % 2 ? "78%" : "62%"} />
              <SkeletonText className="mt-2" w="44%" />
              {i % 2 === 0 && (
                <span className="mt-3 flex gap-2">
                  {[0, 1, 2, 3].map((c) => (
                    <Skeleton key={c} className="h-12 w-12" />
                  ))}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The one that existed before any of these, kept because four screens import
 * it — and now shaped like what they actually draw rather than like a grid
 * that belonged to none of them.
 */
export function CoverGridSkeleton({ count = 6 }: { count?: number }) {
  return <SkeletonCovers n={count} cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" />;
}

/**
 * Una pantalla que aparece entera, y no a trozos.
 *
 * El patrón que usa cualquier aplicación nativa y casi ninguna web: mientras
 * falta algo se enseña el hueco con su forma, y cuando está todo se cambia por
 * el contenido con un fundido corto. Lo que nunca se hace es ir soltando las
 * piezas según llegan — primero el título, luego la foto, luego una fila de
 * datos que empuja lo de abajo — porque cada pieza que entra mueve la
 * anterior y el resultado se lee como lentitud aunque haya tardado lo mismo.
 *
 * El fundido es del contenido, no del esqueleto: el esqueleto ya ha hecho su
 * trabajo — sostener la caja — y lo que importa es que lo que llega no dé un
 * salto.
 */
export function Reveal({
  ready,
  skeleton,
  children,
  className = "",
}: {
  ready: boolean;
  /** el hueco, con la forma exacta de lo que va a ocuparlo */
  skeleton: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      {ready ? (
        <div className="reveal-in">{children}</div>
      ) : (
        <div aria-busy className="reveal-in">
          {skeleton}
        </div>
      )}
    </div>
  );
}

/**
 * Un hueco que llega tarde y, si al final no hay nada, se cierra sin mover lo
 * que estás mirando.
 *
 * Una sección que solo existe si hay datos tiene dos maneras de dar un salto:
 * aparecer de golpe cuando llegan, y desaparecer cuando resulta que no había
 * nada. Lo primero lo arregla su esqueleto, que ocupa lo mismo desde el primer
 * fotograma. Lo segundo es esto: si la sección queda vacía estando por debajo
 * de lo que se ve, se quita y no se entera nadie; si está a la vista, conserva
 * su altura (enseñando `fallback`, que dice por qué no hay nada y puede
 * llenarla con `flex-1`) y se quita en
 * cuanto deja de verse por abajo. Lo que tienes delante no se mueve nunca.
 *
 * `className` lleva el ritmo vertical de la sección (`mt-9 first:mt-0`): la
 * sección de dentro queda como primera de su caja y pierde su margen, y el
 * hueco lo pone esta caja, que también se va cuando se cierra.
 */
export function Hold({
  empty,
  fallback = null,
  className = "",
  children,
}: {
  /** ya se sabe que no hay nada que enseñar */
  empty: boolean;
  /** lo que ocupa el hueco mientras se ve vacío */
  fallback?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  /** la altura que tenía mientras era algo: la que se sostiene */
  const last = useRef(0);
  const [held, setHeld] = useState<number | null>(null);
  const [gone, setGone] = useState(false);

  // De layout, no pasivo: el observador tiene que soltarse en el mismo commit
  // en que la sección se vacía, antes de que mida la caja ya encogida.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || empty) return;
    last.current = el.offsetHeight;
    const ro = new ResizeObserver(() => {
      last.current = el.offsetHeight;
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [empty, gone]);

  // se decide antes de pintar: el fotograma vacío no llega a verse
  useLayoutEffect(() => {
    if (!empty) {
      setHeld(null);
      setGone(false);
      return;
    }
    const el = ref.current;
    if (!el || last.current === 0) return setGone(true);
    if (el.getBoundingClientRect().top >= window.innerHeight) setGone(true);
    else setHeld(last.current);
  }, [empty]);

  // sostenido a la vista: se quita en cuanto queda por debajo de lo visible
  useEffect(() => {
    const el = ref.current;
    if (held === null || gone || !el) return;
    const io = new IntersectionObserver(([e]) => {
      const bottom = e.rootBounds?.bottom ?? window.innerHeight;
      if (!e.isIntersecting && e.boundingClientRect.top >= bottom) setGone(true);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [held, gone]);

  if (gone) return null;
  return (
    <div
      ref={ref}
      className={className}
      // en columna, para que el `fallback` pueda llenar el alto sostenido
      style={
        empty && held !== null
          ? { minHeight: held, display: "flex", flexDirection: "column" }
          : undefined
      }
    >
      {empty ? fallback : children}
    </div>
  );
}

/**
 * Un plazo, para que nada se quede colgado esperando.
 *
 * Una petición que no contesta no puede dejar una pantalla en blanco para
 * siempre: pasado el plazo se enseña lo que haya, que en el peor caso es el
 * nombre y un fondo. Esperar a la perfección es cómo un estado de carga se
 * convierte en un error.
 */
export function useDeadline(ms: number) {
  const [passed, setPassed] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setPassed(true), ms);
    return () => clearTimeout(t);
  }, [ms]);
  return passed;
}
