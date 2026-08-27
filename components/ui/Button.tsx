"use client";

import Link from "next/link";
import { forwardRef } from "react";

/**
 * Every button in the app, and there are only four kinds.
 *
 * primary   — the one thing this screen is for. At most one per view.
 * secondary — a real action that isn't the main one. Outlined.
 * ghost     — a control that shouldn't compete: cancel, close, "ver todo".
 * danger    — destroys something. Never the default focus of a dialog.
 *
 * Sizes exist so a finger and a mouse can share a component: `md` is the touch
 * default at 44px, `sm` is for dense desktop rows, and both keep their hit area
 * even when the ink inside them is smaller.
 */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  // paper on ink: maximum contrast, used once per screen so it keeps meaning it
  primary: "bg-paper text-ink hover:bg-paper/88 disabled:bg-paper/30",
  secondary:
    "border border-line-strong text-paper hover:border-line-focus hover:bg-fill-subtle disabled:text-content-muted",
  ghost: "text-content-secondary hover:text-paper hover:bg-fill-subtle",
  danger: "border border-[#ff6b57]/35 text-[#ff6b57] hover:bg-[#ff6b57]/10",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-sub",
  md: "h-11 px-4 text-body",
  lg: "h-12 px-6 text-body",
};

export type ButtonProps = {
  variant?: Variant;
  size?: Size;
  /** takes the full width of its container — the phone default for anything final */
  block?: boolean;
  loading?: boolean;
  href?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref">;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", block, loading, href, className = "", children, disabled, ...rest },
  ref,
) {
  const cls = [
    "pressable inline-flex select-none items-center justify-center gap-2 rounded-sm font-medium",
    "transition-colors duration-fast ease-out",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
    "disabled:cursor-not-allowed disabled:opacity-45",
    VARIANTS[variant],
    SIZES[size],
    block ? "w-full" : "",
    className,
  ].join(" ");

  if (href && !disabled) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} className={cls} disabled={disabled || loading} {...rest}>
      {/* the label stays put while it loads: a button that changes width
          mid-press moves out from under the finger that pressed it */}
      {loading ? <Spinner /> : null}
      <span className={loading ? "opacity-60" : undefined}>{children}</span>
    </button>
  );
});

export default Button;

export function Spinner({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className="animate-spin" aria-hidden>
      <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.8" opacity="0.25" fill="none" />
      <path d="M8 1.8 A6.2 6.2 0 0 1 14.2 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** An icon-only control that still honours the 44px floor around it. */
export function IconButton({
  label,
  children,
  className = "",
  ...rest
}: { label: string } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "ref">) {
  return (
    <button
      aria-label={label}
      className={`pressable inline-flex h-tap w-tap items-center justify-center rounded-full text-content-secondary transition-colors duration-fast hover:text-paper ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}
