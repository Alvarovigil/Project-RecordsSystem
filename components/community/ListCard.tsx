"use client";

import Link from "next/link";
import Avatar, { Cover } from "@/components/ui/Avatar";
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
  /** up to four sleeves; a list with no artwork still has to have a shape */
  covers?: string[];
  mine?: boolean;
  href?: string;
}) {
  const to = href ?? (list.owner ? `/u/${list.owner.username}/${list.slug}` : `/coleccion`);
  const four = covers.slice(0, 4);

  return (
    <Link
      href={to}
      className="pressable group block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
    >
      {/* a mosaic of four, or one sleeve — never an icon standing in for the
          contents, which tells you nothing about the list */}
      <span className="relative block aspect-square w-full overflow-hidden bg-fill-subtle">
        {four.length > 1 ? (
          <span className="grid h-full w-full grid-cols-2 grid-rows-2">
            {four.map((c, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={i} src={c} alt="" loading="lazy" className="h-full w-full object-cover" />
            ))}
          </span>
        ) : (
          <Cover src={four[0] ?? null} />
        )}
      </span>

      <span className="mt-2.5 block">
        <span className="block truncate text-body font-medium text-paper">{list.title}</span>
        <span className="mt-1 flex items-center gap-1.5 text-sub text-content-muted">
          {!mine && list.owner && (
            <>
              <Avatar
                name={list.owner.displayName}
                handle={list.owner.username}
                src={list.owner.avatarUrl}
                size="xs"
              />
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
