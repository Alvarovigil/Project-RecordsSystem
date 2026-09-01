"use client";

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
  /** sleeves are 3px, cards are 14, text is a pill — match the real thing */
  radius?: number;
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
      <SkeletonText className="mt-3" w="72%" />
      <SkeletonText className="mt-2" w="48%" />
      <SkeletonText className="mt-3" w="34%" />
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

/** a stack of rows: lists, people, racks inside the community panel */
export function SkeletonRows({ n = 4 }: { n?: number }) {
  return (
    <ul aria-hidden className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <li key={i} className="flex items-center gap-3.5 rounded-[14px] bg-fill-subtle p-3">
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
