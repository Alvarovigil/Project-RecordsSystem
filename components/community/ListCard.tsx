"use client";

import Link from "next/link";
import Crate from "@/components/ui/Crate";
import type { ListWithRecord } from "@/lib/data/types";

/**
 * Someone's list, as an object you can recognise across the app.
 *
 * Whose it is comes first, in the byline, always — never as a "guardada" badge.
 * Who made a list is the useful fact about it; that you happen to have kept it
 * is bookkeeping. This is the rule that keeps your own collection honest once
 * other people's lists start living inside it: you can always tell at a glance
 * which shelves are yours.
 *
 * Letterboxd's list cards do the same thing and it is why their lists read as
 * authored objects rather than as folders.
 */
export default function ListCard({
  list,
  covers = [],
  mine = false,
  href,
}: {
  list: Pick<ListWithRecord, "id" | "title" | "description" | "itemCount" | "slug"> & {
    owner?: ListWithRecord["owner"];
    followers?: number;
  };
  /** newest first; the crate shows three */
  covers?: string[];
  mine?: boolean;
  href?: string;
}) {
  const to = href ?? (list.owner ? `/u/${list.owner.username}/${list.slug}` : `/coleccion`);

  return (
    <Link
      href={to}
      className="pressable group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {/* A crate with the last three records in it, rather than a grid of four
          thumbnails. The grid told you a list had images in it; this tells you
          it is a stack of records, which is what it is. */}
      <Crate covers={covers} />

      <span className="mt-2.5 block">
        <span className="block truncate text-body font-medium text-paper">{list.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-sub text-content-muted">
          {!mine && list.owner && (
            <>
              {/* the name alone. An avatar repeated down a grid of cards is
                  fourteen copies of the same face saying the same thing, and
                  it crowds out the line it sits on */}
              <span className="truncate">{list.owner.displayName}</span>
              <span aria-hidden className="text-content-faint">
                ·
              </span>
            </>
          )}
          <span className="shrink-0 whitespace-nowrap">
            {list.itemCount} {list.itemCount === 1 ? "disco" : "discos"}
          </span>
        </span>
      </span>
    </Link>
  );
}
