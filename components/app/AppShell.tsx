"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { recordVisit } from "@/lib/nav-history";
import TopNav from "./TopNav";
import TabBar from "./TabBar";
import { useDevice } from "@/hooks/useDevice";

/**
 * The chrome, chosen by device rather than reflowed for it.
 *
 * Same destinations, two genuinely different objects: a bar across the top
 * where a cursor lives, a bar under the thumb where a hand does. Neither is a
 * shrunken version of the other, and this is the only place that decides which
 * one you get — so a screen never has to think about it.
 *
 * Rendered from the layout, so it survives navigation: the tab bar does not
 * unmount and remount between routes, which is what keeps a page transition
 * feeling like moving inside an app instead of loading a new one.
 */
export default function AppShell({
  children,
  /** surfaces that own the whole screen and bring their own chrome */
  bare = false,
}: {
  children: React.ReactNode;
  bare?: boolean;
}) {
  const { isPhone } = useDevice();
  const pathname = usePathname();

  // the trail every back link reads; kept here because this is the one
  // component that survives navigation
  useEffect(() => {
    recordVisit(pathname);
  }, [pathname]);

  // The shelf is its own world — a 3D canvas edge to edge — so it draws its own
  // header over the artwork. It still gets the tab bar: leaving is not
  // something a screen should be allowed to take away from you.
  const ownsHeader = bare || pathname.startsWith("/coleccion") || pathname.startsWith("/demo");

  return (
    <>
      {!isPhone && !ownsHeader && <TopNav />}
      {/* The shelf is a 3D canvas edge to edge; blurring it on arrival would
          be a full-screen filter over a live scene, which is the one place a
          phone cannot afford one. It has its own way in — the sleeves fold up
          as their covers decode — so it is left alone. */}
      {ownsHeader ? children : <PageFade key={pathname}>{children}</PageFade>}
      {isPhone && <TabBar />}
    </>
  );
}

/**
 * How one screen becomes another.
 *
 * Hard cuts are what make a set of routes feel like a set of documents. The
 * fix is not a slide or a push — those imply a spatial relationship between
 * two screens that mostly do not have one — but a defocus: the new screen
 * arrives slightly out of focus and settles, the way something does when your
 * eye lands on it. It is short (220ms), it never moves anything, and it plays
 * only on the way in, because an exit animation delays the thing you asked
 * for in order to say goodbye to the thing you left.
 *
 * Blur is expensive, so it is spent carefully: one composited layer, removed
 * the moment it finishes, and skipped entirely for anyone who has asked the
 * system for less motion.
 */
function PageFade({ children }: { children: React.ReactNode }) {
  const [arrived, setArrived] = useState(false);

  useEffect(() => {
    // one frame late on purpose: setting the end state in the same paint as
    // the start state is a transition the browser never runs
    const id = requestAnimationFrame(() => setArrived(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      className="page-fade"
      data-arrived={arrived ? "1" : undefined}
      // dropped once it has played: a permanent filter on the page root makes
      // every descendant its own compositing layer for ever
      onTransitionEnd={(e) => {
        if (e.propertyName === "filter") e.currentTarget.style.filter = "none";
      }}
    >
      {children}
    </div>
  );
}

/**
 * A page that scrolls, with room for whatever floats over it.
 *
 * Every non-shelf screen uses this so that the last row of a list is never
 * hidden under the tab bar — the single most common bug in a phone layout, and
 * one that only appears when the list happens to be long enough.
 */
export function Page({
  children,
  width = 900,
  className = "",
}: {
  children: React.ReactNode;
  /**
   * A reading measure, or "full" to run edge to edge.
   *
   * Most screens want a measure: a paragraph 1800px wide is unreadable however
   * much room there is. The ones that are mostly grids of artwork want the
   * opposite — a centred column there leaves the sides empty and makes a large
   * display feel like a small one.
   */
  width?: number | "full";
  className?: string;
}) {
  const full = width === "full";
  return (
    <main className={`min-h-screen-d bg-surface text-paper ${className}`}>
      <div
        className={`w-full pb-chrome ${full ? "px-5 sm:px-8" : "mx-auto px-5 sm:px-6"}`}
        style={{
          maxWidth: full ? undefined : width,
          paddingTop: "max(1.5rem, var(--safe-top))",
        }}
      >
        {children}
      </div>
    </main>
  );
}

/**
 * A screen's title row.
 *
 * Large, at the top, in the reading face — the phone convention that replaced
 * the centred 17px header, because a big title tells you where you are while
 * you are still scrolling toward the content.
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-start justify-between gap-4 pb-6">
      <div className="min-w-0">
        <h1 className="text-display font-medium text-paper">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sub text-content-muted">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </header>
  );
}

/** A titled region inside a page, optionally with a way out of it. */
export function Section({
  title,
  href,
  linkLabel = "Ver todo",
  children,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-9 first:mt-0">
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="text-caption uppercase tracking-label text-content-muted">{title}</h2>
        {href && (
          <a
            href={href}
            className="text-caption uppercase tracking-label text-content-faint transition-colors hover:text-paper"
          >
            {linkLabel}
          </a>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}
