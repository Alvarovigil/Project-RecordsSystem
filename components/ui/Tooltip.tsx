"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The one tooltip in the product, instead of the operating system's.
 *
 * A `title` attribute is the last place a piece of interface design gets made
 * by somebody else: the system picks the typeface, the delay, the corner
 * radius and the colour, and on a dark interface it arrives as a pale box from
 * another program. It is also unusable on touch, where nothing hovers.
 *
 * Three decisions worth keeping:
 *
 * - **It waits.** 450ms, because a tooltip that appears the instant the
 *   pointer crosses something turns a screen into a minefield of popping
 *   labels. Long enough to mean "you stopped here on purpose".
 * - **It is positioned in fixed coordinates**, measured from the anchor. The
 *   panels this lives in scroll and clip, and a label cut in half by its own
 *   container is worse than no label.
 * - **It never carries anything but a hint.** If the words are needed to
 *   operate the control, they belong in the control. This says what a shape
 *   already implies, for the person who is not sure.
 */
export default function Tooltip({
  label,
  children,
  side = "bottom",
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = ref.current?.getBoundingClientRect();
      if (!r) return;
      setAt({
        top: side === "bottom" ? r.bottom + 8 : r.top - 8,
        left: r.left + r.width / 2,
      });
    }, 450);
  };

  const hide = () => {
    clearTimeout(timer.current);
    setAt(null);
  };

  return (
    <>
      <span
        ref={ref}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={hide}
        onPointerDown={hide}
        onFocus={show}
        onBlur={hide}
        className="contents"
      >
        {children}
      </span>

      {at && (
        <span
          role="tooltip"
          style={{
            top: at.top,
            left: at.left,
            transform: side === "bottom" ? "translateX(-50%)" : "translate(-50%, -100%)",
          }}
          className="pointer-events-none fixed z-[95] whitespace-nowrap bg-surface-overlay px-2.5 py-1.5 text-caption text-content-secondary shadow-popover ring-1 ring-inset ring-paper/[0.06]"
        >
          {label}
        </span>
      )}
    </>
  );
}
