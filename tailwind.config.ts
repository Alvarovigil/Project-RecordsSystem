import type { Config } from "tailwindcss";

/**
 * Utilities that resolve to tokens.
 *
 * The point of this file is that `text-secondary` and `bg-raised` mean whatever
 * app/globals.css says they mean today. Feature code writes roles; the identity
 * lives in one `:root` block and can be replaced without touching a component.
 *
 * `ink` and `paper` stay as literal colours because opacity utilities
 * (`border-paper/10`) need a real value to modulate, and because the existing
 * surfaces are built on them. New code should prefer the role tokens.
 */
export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      colors: {
        ink: "#0a0a0a",
        paper: "#f5f3ee",
        accent: "var(--accent)",
        surface: {
          DEFAULT: "var(--surface)",
          raised: "var(--surface-raised)",
          overlay: "var(--surface-overlay)",
          sunken: "var(--surface-sunken)",
        },
        content: {
          DEFAULT: "var(--text)",
          secondary: "var(--text-secondary)",
          muted: "var(--text-muted)",
          faint: "var(--text-faint)",
        },
        line: {
          DEFAULT: "var(--line)",
          strong: "var(--line-strong)",
          focus: "var(--line-focus)",
          overlay: "var(--line-overlay)",
        },
        fill: {
          subtle: "var(--fill-subtle)",
          DEFAULT: "var(--fill)",
          strong: "var(--fill-strong)",
        },
      },
      boxShadow: {
        overlay: "var(--shadow-overlay)",
        popover: "var(--shadow-popover)",
        toast: "var(--shadow-toast)",
      },
      borderRadius: {
        none: "var(--r-none)",
        sm: "var(--r-sm)",
        control: "var(--r-control)",
        md: "var(--r-md)",
        lg: "var(--r-lg)",
        sheet: "var(--r-sheet)",
        full: "var(--r-full)",
      },
      fontSize: {
        display: ["var(--t-display)", { lineHeight: "1.08", letterSpacing: "-0.02em" }],
        title: ["var(--t-title)", { lineHeight: "1.15", letterSpacing: "-0.015em" }],
        heading: ["var(--t-heading)", { lineHeight: "1.25", letterSpacing: "-0.01em" }],
        body: ["var(--t-body)", { lineHeight: "1.45" }],
        sub: ["var(--t-sub)", { lineHeight: "1.4" }],
        caption: ["var(--t-caption)", { lineHeight: "1.35" }],
        micro: ["var(--t-micro)", { lineHeight: "1.3" }],
      },
      letterSpacing: {
        label: "var(--track-label)",
      },
      transitionDuration: {
        fast: "var(--d-fast)",
        base: "var(--d-base)",
        slow: "var(--d-slow)",
      },
      transitionTimingFunction: {
        out: "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
      },
      spacing: {
        tap: "var(--tap)",
        safeTop: "var(--safe-top)",
        safeBottom: "var(--safe-bottom)",
        tabbar: "var(--tabbar-h)",
      },
    },
  },
  plugins: [],
} satisfies Config;
