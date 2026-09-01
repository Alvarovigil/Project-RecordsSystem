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

/** the collection, before it has been read */
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

/** a stack of rows: lists, people, racks */
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
 * A row of sleeve-shaped skeletons: the shape almost every list here takes.
 *
 * It lived in EmptyState with a `animate-pulse` of its own, which meant the
 * product had two skeletons that blinked differently depending on which screen
 * you were on. One implementation, one motion.
 */
export function CoverGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full" radius={3} />
          <SkeletonText className="mt-2.5" w={i % 2 ? "62%" : "80%"} />
          <SkeletonText className="mt-1.5" w={i % 3 ? "44%" : "56%"} />
        </li>
      ))}
    </ul>
  );
}
