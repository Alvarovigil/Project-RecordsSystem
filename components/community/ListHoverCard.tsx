"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "./FollowButton";
import ConfirmButton, { UnsaveIcon } from "@/components/ui/ConfirmButton";
import { useRepository } from "@/hooks/useRepository";
import { useImagesReady } from "@/hooks/useImagesReady";
import { useToast } from "@/components/ui/Toast";
import type { ListWithRecord } from "@/lib/data/types";

/**
 * What a kept list actually is, shown on the way past it.
 *
 * The row itself looks exactly like one of your own — same cover, same type,
 * same weight — because in your collection that is what it is: a shelf you can
 * open. Everything that makes it *not* yours lives in here: what is inside it,
 * whose it is, whether you follow them, and every way out of it.
 *
 * That trade is the point. A row carrying its own unfollow button spends its
 * width on an action nobody performs, every time they look at it, forever. A
 * card spends nothing until asked and then has room to say something worth
 * reading — so it should say something. Six covers is the difference between
 * "a list with eight records in it" and "*that* list": nobody remembers a
 * title, everybody recognises a sleeve.
 *
 * The three actions along the bottom are the same three that live behind the ⋯
 * on a list anywhere else in the app, in the same order and with the same
 * words. A menu that appears in two places and disagrees with itself teaches
 * people not to trust either copy.
 *
 * Positioned in fixed coordinates against the row: the panel it lives in
 * scrolls and clips, and a card cut off by its own container is worse than no
 * card at all.
 */
export default function ListHoverCard({
  list,
  anchor,
  count,
  onUnfollow,
  onEnter,
  onClose,
}: {
  list: ListWithRecord;
  anchor: HTMLElement | null;
  count: number;
  onUnfollow: () => void;
  /** the pointer made it across the gap — cancel the pending close */
  onEnter: () => void;
  onClose: () => void;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [covers, setCovers] = useState<string[] | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const W = 300;
  /** three across, two down: enough to recognise, not enough to browse */
  const SLOTS = 6;

  // The card only mounts once the pointer has dwelt, so this request is never
  // made by someone merely moving across the panel.
  useEffect(() => {
    let alive = true;
    repo
      .coversOfLists([list.id])
      .then((byList) => alive && setCovers(byList[list.id] ?? []))
      .catch(() => alive && setCovers([]));
    return () => {
      alive = false;
    };
  }, [repo, list.id]);

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    if (!r) return;
    // to the right of the row, unless there is no room — then to its left
    const right = r.right + 10;
    const fits = right + W < window.innerWidth - 12;
    setPos({
      top: Math.min(Math.max(12, r.top - 8), Math.max(12, window.innerHeight - 420)),
      left: fits ? right : Math.max(12, r.left - W - 10),
    });
  }, [anchor]);

  // Escape closes it without waiting for the pointer to travel back out
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // six covers arriving one by one under a stationary pointer is six events
  // where there is one thing to look at
  const gridReady = useImagesReady((covers ?? []).slice(0, 6));

  const listHref = `/u/${list.owner.username}/${list.slug}`;

  const share = async () => {
    const url = `${window.location.origin}${listHref}`;
    // the platform sheet when there is one; the clipboard is the honest
    // fallback, and it says so rather than silently doing nothing
    if (navigator.share) {
      try {
        await navigator.share({ title: list.title, url });
        return;
      } catch {
        return; // cancelled: not an error, and not something to report
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.show("Enlace copiado");
    } catch {
      toast.show("No se pudo copiar el enlace.", { tone: "error" });
    }
  };

  if (!pos) return null;

  return (
    <div
      ref={ref}
      // staying inside keeps it open: an action you have to reach for must not
      // disappear on the way there
      onMouseEnter={onEnter}
      onMouseLeave={onClose}
      style={{ top: pos.top, left: pos.left, width: W }}
      className="fixed z-[80] overflow-hidden rounded-lg border border-line-overlay bg-surface-overlay/95 shadow-popover backdrop-blur-xl"
    >
      <div className="px-4 pb-3.5 pt-4">
        <Link href={listHref} className="block">
          <p className="truncate text-body font-medium text-paper hover:underline">{list.title}</p>
        </Link>
        {list.description && (
          <p className="mt-1 line-clamp-2 text-sub leading-snug text-content-muted">
            {list.description}
          </p>
        )}
        <p className="mt-1.5 text-sub text-content-muted">
          {count} {count === 1 ? "disco" : "discos"}
          {list.followers > 0 && ` · ${list.followers} la siguen`}
        </p>
      </div>

      {/* What is in it. The empty slots stay drawn while the covers load, so
          the card does not grow under the pointer — a panel that changes
          height while you are reaching for something in it is a panel that
          moves the thing you were reaching for. */}
      <ul
        className={`grid grid-cols-3 gap-1.5 px-4 pb-4 transition-opacity duration-base ease-out ${
          covers && gridReady ? "opacity-100" : "opacity-0"
        }`}
      >
        {Array.from({ length: SLOTS }, (_, i) => {
          const src = covers?.[i];
          return (
            <li key={i} className="aspect-square overflow-hidden rounded-[3px] bg-fill-subtle">
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex items-center gap-2.5 border-t border-line px-4 py-3.5">
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

      {/* The ⋯ menu, opened flat. There is room here, and a menu inside a card
          that only exists while the pointer hovers it is a door behind a door. */}
      <div className="flex items-center border-t border-line">
        <CardAction label="Compartir" onClick={share}>
          <path
            d="M7 9.5V2.5M7 2.5 4.6 4.9M7 2.5l2.4 2.4M2.6 8v3.4h8.8V8"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </CardAction>
        <span aria-hidden className="h-6 w-px shrink-0 bg-line" />
        <CardAction label="Ver perfil" href={`/u/${list.owner.username}`}>
          <g stroke="currentColor" strokeWidth="1.2" fill="none">
            <circle cx="7" cy="5" r="2.4" />
            <path d="M2.8 12c0-2.3 1.9-3.6 4.2-3.6s4.2 1.3 4.2 3.6" strokeLinecap="round" />
          </g>
        </CardAction>
        <span aria-hidden className="h-6 w-px shrink-0 bg-line" />
        {/* the one destructive thing, and still behind two presses */}
        <ConfirmButton
          icon={<UnsaveIcon />}
          label="Quitar de mi colección"
          confirmLabel="Quitar de mi colección"
          onConfirm={() => {
            onUnfollow();
            onClose();
          }}
          className="h-11 flex-1 justify-center"
        />
      </div>
    </div>
  );
}

/**
 * One of the three doors along the bottom.
 *
 * Icon over label, not icon alone: three unlabelled glyphs in a row is a
 * puzzle, and this card exists to save someone a click, not to charge them one
 * in guesses.
 */
function CardAction({
  label,
  onClick,
  href,
  children,
}: {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
}) {
  const cls =
    "pressable flex h-11 flex-1 items-center justify-center gap-1.5 text-caption text-content-muted transition-colors hover:bg-fill-subtle hover:text-paper";
  const inner = (
    <>
      <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
        {children}
      </svg>
      <span>{label}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
