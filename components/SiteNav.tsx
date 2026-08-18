"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "./AccountMenu";

const LINKS = [
  { href: "/estanteria", label: "Mi estantería" },
  { href: "/feed", label: "Novedades" },
  { href: "/explorar", label: "Explorar" },
];

/**
 * One bar across every flat page, so the social side reads as a single place
 * rather than a set of pages that happen to share a colour.
 */
export default function SiteNav() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-30 border-b border-paper/[0.07] bg-ink/85 backdrop-blur-sm">
      <div className="mx-auto flex w-full max-w-[1100px] items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-center gap-7">
          <Link href="/estanteria" aria-label="Rackr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-4 w-auto opacity-80" />
          </Link>
          <ul className="flex items-center gap-6">
            {LINKS.map((l) => {
              const active = pathname === l.href;
              return (
                <li key={l.href}>
                  <Link
                    href={l.href}
                    className={`mono text-[10px] uppercase tracking-[0.18em] transition ${
                      active ? "text-paper" : "text-paper/40 hover:text-paper/80"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <AccountMenu />
      </div>
    </nav>
  );
}
