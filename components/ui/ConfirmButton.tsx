"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Press once to ask, press again to do it.
 *
 * The alternative for a small destructive action is a dialogue, and a dialogue
 * over a panel to stop following a list is heavier than the thing it guards.
 * This keeps the weight proportionate: the first press costs nothing and is
 * plainly reversible, the second is the decision.
 *
 * Two rules make it safe rather than merely compact:
 *
 * **It disarms itself.** After a few seconds, or when the pointer leaves, it
 * goes back to resting. An armed control left lying around is a trap for the
 * next click that lands near it.
 *
 * **It says what it will do, in words, while armed.** An icon that changes
 * colour is not a question. The label is the whole point of the first press.
 */
export default function ConfirmButton({
  icon,
  label,
  confirmLabel,
  onConfirm,
  className = "",
}: {
  icon: React.ReactNode;
  /** what it does, for screen readers and the tooltip */
  label: string;
  /** what the second press will do, shown once armed */
  confirmLabel: string;
  onConfirm: () => void;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!armed) return;
    timer.current = setTimeout(() => setArmed(false), 3200);
    return () => clearTimeout(timer.current);
  }, [armed]);

  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      title={label}
      aria-label={armed ? confirmLabel : label}
      onMouseLeave={() => setArmed(false)}
      onBlur={() => setArmed(false)}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={`pressable flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-caption font-medium transition-colors duration-fast ${
        armed
          ? "bg-[#ff6b57]/15 text-[#ff6b57]"
          : "text-content-faint hover:bg-fill hover:text-paper"
      } ${className}`}
    >
      <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      {/* the word only exists while it matters */}
      {armed && <span className="whitespace-nowrap">{confirmLabel}</span>}
    </button>
  );
}

/** A bookmark with a line through it: kept, and about to stop being kept. */
export function UnsaveIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M4 2.6h8a.6.6 0 0 1 .6.6v10.2L8 10.9l-4.6 2.5V3.2a.6.6 0 0 1 .6-.6Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M2 14 L14 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
