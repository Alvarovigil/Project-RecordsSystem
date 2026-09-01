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

/**
 * The skeletons live in `components/ui/Skeleton` now, and are re-exported from
 * here because four screens already import them from this file. There was a
 * second implementation in this module with a pulse of its own — two
 * skeletons blinking differently depending on which screen you were on.
 */
export { default as Skeleton, CoverGridSkeleton } from "./Skeleton";
