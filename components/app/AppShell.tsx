"use client";

import { usePathname } from "next/navigation";
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

  // The shelf is its own world — a 3D canvas edge to edge — so it draws its own
  // header over the artwork. It still gets the tab bar: leaving is not
  // something a screen should be allowed to take away from you.
  const ownsHeader = bare || pathname.startsWith("/coleccion") || pathname.startsWith("/demo");

  return (
    <>
      {!isPhone && !ownsHeader && <TopNav />}
      {children}
      {isPhone && <TabBar />}
    </>
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
  width?: number;
  className?: string;
}) {
  return (
    <main className={`min-h-screen-d bg-surface text-paper ${className}`}>
      <div
        className="mx-auto w-full px-5 pb-chrome pt-6 sm:px-6 sm:pt-10"
        style={{ maxWidth: width, paddingTop: "max(1.5rem, var(--safe-top))" }}
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
