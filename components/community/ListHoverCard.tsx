"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "./FollowButton";
import ConfirmButton, { UnsaveIcon } from "@/components/ui/ConfirmButton";
import type { ListWithRecord } from "@/lib/data/types";

/**
 * What a kept list actually is, shown on the way past it.
 *
 * The row itself now looks exactly like one of your own — same cover, same
 * type, same weight — because in your collection that is what it is: a shelf
 * you can open. Everything that makes it *not* yours moves in here: whose it
 * is, whether you follow them, and how to stop keeping it.
 *
 * That trade is the point. A row carrying its own unfollow button spends its
 * width on an action nobody performs, every time they look at it, forever. A
 * hover card spends nothing until asked and then has room to say something
 * worth reading.
 *
 * Positioned in fixed coordinates against the row: the panel it lives in
 * scrolls and clips, and a card that gets cut off by its own container is
 * worse than no card.
 */
export default function ListHoverCard({
  list,
  anchor,
  count,
  onUnfollow,
  onClose,
}: {
  list: ListWithRecord;
  anchor: HTMLElement | null;
  count: number;
  onUnfollow: () => void;
  onClose: () => void;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const W = 268;

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    if (!r) return;
    // to the right of the row, unless there is no room — then to its left
    const right = r.right + 10;
    const fits = right + W < window.innerWidth - 12;
    setPos({
      top: Math.min(Math.max(12, r.top - 8), window.innerHeight - 240),
      left: fits ? right : Math.max(12, r.left - W - 10),
    });
  }, [anchor]);

  // Escape closes it without waiting for the pointer to travel back out
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!pos) return null;

  return (
    <div
      ref={ref}
      // staying inside keeps it open: an action you have to reach for must not
      // disappear on the way there
      onMouseEnter={() => {}}
      onMouseLeave={onClose}
      style={{ top: pos.top, left: pos.left, width: W }}
      className="fixed z-[80] rounded-lg border border-line-strong bg-surface-overlay/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl"
    >
      <p className="truncate text-body font-medium text-paper">{list.title}</p>
      {list.description && (
        <p className="mt-1 line-clamp-2 text-sub leading-snug text-content-muted">
          {list.description}
        </p>
      )}
      <p className="mt-1.5 text-sub text-content-muted">
        {count} {count === 1 ? "disco" : "discos"}
        {list.followers > 0 && ` · ${list.followers} la siguen`}
      </p>

      <div className="mt-3.5 flex items-center gap-2.5 border-t border-line pt-3.5">
        <Link
          href={`/u/${list.owner.username}`}
          className="group pressable flex min-w-0 flex-1 items-center gap-2"
        >
          <Avatar
            name={list.owner.displayName}
            handle={list.owner.username}
            src={list.owner.avatarUrl}
            size="sm"
            interactive
          />
          <span className="min-w-0">
            <span className="block truncate text-sub text-paper">{list.owner.displayName}</span>
            <span className="mono block truncate text-caption text-content-faint">
              @{list.owner.username}
            </span>
          </span>
        </Link>
        <FollowButton
          profileId={list.owner.id}
          displayName={list.owner.displayName}
          size="sm"
        />
      </div>

      {/* the one destructive thing, out of the row and behind two presses */}
      <div className="mt-3 border-t border-line pt-3">
        <ConfirmButton
          icon={<UnsaveIcon />}
          label={`Dejar de guardar «${list.title}»`}
          confirmLabel="Quitar de mi colección"
          onConfirm={() => {
            onUnfollow();
            onClose();
          }}
          className="w-full justify-center"
        />
      </div>
    </div>
  );
}
