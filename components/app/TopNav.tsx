"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "@/components/AccountMenu";
import { useSession } from "@/hooks/useSession";

/**
 * The same bar everywhere, including over the 3D shelf.
 *
 * Nothing says "you are still in the same product" like chrome that doesn't
 * move when the content does.
 */
export default function TopNav({
  transparent = false,
  right,
}: {
  transparent?: boolean;
  /** surface-specific controls, sharing the row instead of stacking bars */
  right?: React.ReactNode;
}) {
  const pathname = usePathname();
  const { available, user } = useSession();

  // signed out there is no shelf of yours to open, but there is a demo one —
  // a dead link would be worse than a smaller promise
  const links = [
    { href: "/inicio", label: "Inicio" },
    available && !user
      ? { href: "/demo", label: "Estantería" }
      : { href: "/estanteria", label: "Mi estantería" },
    { href: "/explorar", label: "Explorar" },
  ];

  return (
    <nav
      className={`${transparent ? "absolute inset-x-0 top-0" : "sticky top-0 border-b border-paper/[0.07] bg-ink/85 backdrop-blur-sm"} z-40`}
    >
      <div className="mx-auto flex w-full max-w-[1180px] items-center justify-between gap-6 px-6 py-3.5">
        <div className="flex items-center gap-8">
          <Link href="/inicio" aria-label="Rackr">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-4 w-auto opacity-85" />
          </Link>
          <ul className="flex items-center gap-6">
            {links.map((l) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
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
        <div className="flex items-center gap-5">
          {right}
          {!right && (
            <Link
              href="/explorar?buscar=1"
              className="group flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-paper/50 transition hover:text-paper"
              aria-label="Buscar"
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" aria-hidden>
                <circle cx="6" cy="6" r="4.2" stroke="currentColor" strokeWidth="1.2" />
                <path d="M9.2 9.2 L12.5 12.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              </svg>
              <span className="hidden sm:inline">Buscar</span>
            </Link>
          )}
          <AccountMenu />
        </div>
      </div>
    </nav>
  );
}
