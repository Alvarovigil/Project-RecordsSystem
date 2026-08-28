"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * A menu that belongs to this product rather than to the operating system.
 *
 * A native `<select>` is the one control a designer cannot touch: it opens
 * macOS's own popup, in macOS's blue, with macOS's radius and its own idea of
 * type. On a dark, square, hairline-ruled interface it arrives like a window
 * from another program — and it is the only place in the app where that
 * happens, which makes it worse, not better.
 *
 * So: a button that says what is chosen, and a panel that lists the rest in
 * the same language as every other panel here. Square, a 5% edge, frosted so
 * that what it covers stays visible as colour.
 *
 * What it keeps from the native one, because these are the parts people
 * actually rely on:
 *
 * - **Escape closes it, and the trigger keeps focus.** A menu you can only
 *   leave with the mouse is a trap for anyone who opened it with a keyboard.
 * - **Clicking anywhere else closes it**, including on another one of these.
 * - **The current value is marked, not just highlighted.** Highlight follows
 *   the pointer; the mark stays where the truth is.
 */
export default function Select<T extends string>({
  value,
  options,
  onChange,
  label,
  align = "right",
}: {
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (value: T) => void;
  /** what this select is for, for anyone not looking at the label beside it */
  label: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const id = useId();
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
        wrap.current?.querySelector("button")?.focus();
      }
    };
    // pointerdown rather than click: a menu that survives until mouseup can be
    // dismissed and re-triggered by the same press
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 text-[12px] text-paper/80 transition-colors hover:text-paper"
      >
        {current?.label ?? ""}
        <svg
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
          aria-hidden
          className={`shrink-0 text-paper/40 transition-transform duration-fast ${
            open ? "rotate-180" : ""
          }`}
        >
          <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          aria-labelledby={id}
          className={`absolute z-50 mt-1.5 min-w-[180px] bg-surface-overlay/85 py-1 shadow-popover ring-1 ring-inset ring-paper/[0.05] backdrop-blur-2xl ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          {options.map((o) => {
            const active = o.value === value;
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-[12px] transition-colors ${
                  active ? "text-paper" : "text-paper/60 hover:bg-paper/[0.06] hover:text-paper"
                }`}
              >
                {/* a dot, not a tick: at 12px a check mark is a smudge, and
                    this only ever has to answer "which one is it" */}
                <span
                  aria-hidden
                  className={`h-1 w-1 shrink-0 rounded-full ${active ? "bg-accent" : "bg-transparent"}`}
                />
                <span className="flex-1 truncate">{o.label}</span>
                {o.hint && <span className="mono shrink-0 text-[10px] text-paper/25">{o.hint}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
