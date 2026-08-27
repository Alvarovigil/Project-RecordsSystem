"use client";

import Button from "./Button";

/**
 * The most important screen in the app, and the one that always gets built
 * last.
 *
 * Every empty state here answers three questions in order: what is this place,
 * why is it empty, and what do I press. The third is not optional — a dead end
 * is a screen that tells you it is empty and then leaves you there. That is the
 * single rule this component exists to enforce: you cannot render one without
 * an action, because the type won't let you.
 *
 * Deliberately quiet. An illustration and an exclamation mark make an empty
 * shelf feel like a failure; a card that reads like an index card in an archive
 * makes it feel like the beginning of one.
 */
export default function EmptyState({
  title,
  body,
  action,
  secondary,
  compact = false,
}: {
  title: string;
  body: string;
  /** required: there is always somewhere to go from here */
  action: { label: string; href?: string; onClick?: () => void };
  secondary?: { label: string; href?: string; onClick?: () => void };
  compact?: boolean;
}) {
  return (
    <div
      className={`border border-line bg-fill-subtle/40 ${compact ? "px-5 py-6" : "px-6 py-9"}`}
    >
      <p className="text-heading text-paper">{title}</p>
      <p className="mt-2 max-w-[52ch] text-sub text-content-muted">{body}</p>
      <div className="mt-5 flex flex-wrap gap-2.5">
        <Button variant="secondary" size="md" href={action.href} onClick={action.onClick}>
          {action.label}
        </Button>
        {secondary && (
          <Button variant="ghost" size="md" href={secondary.href} onClick={secondary.onClick}>
            {secondary.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/** Loading that holds the shape of what is coming, so nothing jumps. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <span className={`block animate-pulse rounded-sm bg-fill ${className}`} aria-hidden />;
}

/** A row of sleeve-shaped skeletons: the shape almost every list here takes. */
export function CoverGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <li key={i}>
          <Skeleton className="aspect-square w-full" />
          <Skeleton className="mt-2 h-3 w-4/5" />
          <Skeleton className="mt-1.5 h-2.5 w-1/2" />
        </li>
      ))}
    </ul>
  );
}
