"use client";

import { motion } from "framer-motion";
import { useId } from "react";

/**
 * Two or three views of the same thing.
 *
 * The reference for this app's shelf — MD Vinyl's floating Álbumes / Listas
 * pill — gets one thing exactly right: on a phone, switching between two views
 * of your own collection is not navigation, so it must not look like it. A tab
 * bar says "somewhere else"; a segmented control says "same place, other lens".
 *
 * The selected background is a shared layout animation, so the pill *travels*
 * between options instead of blinking. That movement is what tells you the two
 * options are the same kind of thing — the cheapest bit of meaning in the
 * whole component.
 *
 * Never more than three segments: past that the labels shrink below reading
 * size and it should have been a menu.
 */

export type Segment<T extends string> = {
  value: T;
  /** always written, even when it is not shown: it is what a screen reader says */
  label: string;
  /**
   * Shown instead of the label.
   *
   * Only for pairs a glance can tell apart without reading — a record and a
   * grid, where the two shapes ARE the two views. Anything you would have to
   * learn keeps its word: an icon nobody recognises is a word you have made
   * unreadable.
   */
  icon?: React.ReactNode;
  count?: number;
};

export default function Segmented<T extends string>({
  segments,
  value,
  onChange,
  size = "md",
  className = "",
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const pad = size === "sm" ? "h-8 text-sub" : "h-10 text-body";

  return (
    <div
      role="tablist"
      className={`relative inline-flex select-none items-center rounded-full bg-fill p-1 backdrop-blur-md ${className}`}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            aria-label={s.icon ? s.label : undefined}
            title={s.icon ? s.label : undefined}
            className={`pressable relative z-10 flex items-center justify-center gap-1.5 rounded-full font-medium transition-colors duration-fast ${
              s.icon ? (size === "sm" ? "w-11" : "w-12") : "px-4"
            } ${pad} ${active ? "text-ink" : "text-content-secondary hover:text-paper"}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
                className="absolute inset-0 -z-10 rounded-full bg-paper"
              />
            )}
            {s.icon ?? <span>{s.label}</span>}
            {s.count !== undefined && (
              <span className={active ? "text-ink/50" : "text-content-faint"}>{s.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The other kind of switch: underlined tabs for sections of a page.
 *
 * Used where a segmented pill would over-claim — a profile's Listas / Discos /
 * Guardadas, where you really are moving between parts of a document. Scrolls
 * horizontally rather than wrapping, because a nav that reflows to two rows
 * shifts everything under it.
 */
export function Tabs<T extends string>({
  segments,
  value,
  onChange,
}: {
  segments: Segment<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div role="tablist" className="scroll-y flex gap-6 overflow-x-auto border-b border-line">
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            className={`relative shrink-0 pb-3 pt-1 text-body font-medium transition-colors duration-fast ${
              active ? "text-paper" : "text-content-muted hover:text-content-secondary"
            }`}
          >
            {s.label}
            {s.count !== undefined && (
              <span className="ml-1.5 text-content-faint">{s.count}</span>
            )}
            {active && (
              <motion.span
                layoutId={`tab-${id}`}
                transition={{ type: "spring", damping: 30, stiffness: 420 }}
                className="absolute inset-x-0 -bottom-px h-[2px] bg-paper"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
