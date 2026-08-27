"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountMenu from "@/components/AccountMenu";
import { useSession } from "@/hooks/useSession";
import { useDevice } from "@/hooks/useDevice";
import { DEMO_PROFILE } from "@/lib/demo";

/**
 * The same bar everywhere, including over the 3D shelf.
 *
 * Set in the reading face at reading size, not in small caps: a row of tracked
 * uppercase micro-type reads as a caption you skim past, and a navigation you
 * skim past is a navigation nobody uses. The wordmark, a slash, and then the
 * places — the sections sit at the same rank as the name of the product, which
 * is the honest hierarchy: this is a place you move around in.
 *
 * Where you are is said with weight and colour, never with an underline or a
 * pill. Nothing moves when the active item changes.
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
  const { available, user, profile } = useSession();
  // A tablet gets this bar, not the phone's tab bar — but it drives it with a
  // finger, and 15px of text with no padding is a 20px-tall target. The ink
  // stays identical; only the hit area grows.
  const { touch } = useDevice();

  // signed out there is no shelf of yours to open, but there is a demo one —
  // a dead link would be worse than a smaller promise
  const preview = available && !user;
  const handle = profile?.username ?? DEMO_PROFILE.username;

  const links = [
    preview
      ? { href: "/demo", label: "Colección" }
      : { href: "/coleccion", label: "Colección" },
    { href: "/feed", label: "Feed" },
    { href: "/explorar", label: "Explorar" },
    // your own profile lives under the avatar on the right; naming it twice in
    // one bar just makes the row longer. Signed out there is no avatar menu to
    // hold it, and the preview collector's shelf is part of what there is to
    // see, so there it earns its place.
    ...(preview ? [{ href: `/u/${handle}`, label: "Perfil" }] : []),
  ];

  return (
    <nav
      className={`${transparent ? "absolute inset-x-0 top-0" : "sticky top-0 border-b border-paper/[0.07] bg-ink/85 backdrop-blur-sm"} z-40`}
    >
      {/* Full width on purpose. A centred 1180px bar over a shelf that runs
          edge to edge draws a margin that nothing else in the layout respects,
          and the controls end up floating in the middle of a black field
          instead of anchored to the corners of the screen. */}
      <div className="flex w-full items-center justify-between gap-6 px-6 py-4">
        <div className="flex min-w-0 items-baseline gap-2.5">
          <Link
            href={preview ? "/demo" : "/coleccion"}
            aria-label="Rackr"
            className="shrink-0 transition hover:opacity-100"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="" className="h-[13px] w-auto translate-y-[1px]" />
          </Link>
          <span aria-hidden className="select-none text-[15px] text-paper/25">
            /
          </span>
          <ul className="flex min-w-0 items-baseline">
            {links.map((l, i) => {
              const active = pathname === l.href || pathname.startsWith(`${l.href}/`);
              return (
                <li key={l.href} className="flex items-baseline">
                  {i > 0 && (
                    <span aria-hidden className="select-none px-2 text-[13px] text-paper/20">
                      ·
                    </span>
                  )}
                  <Link
                    href={l.href}
                    aria-current={active ? "page" : undefined}
                    style={touch ? { paddingBlock: 12, marginBlock: -12 } : undefined}
                    className={`text-[15px] leading-none transition-colors duration-150 ${
                      active
                        ? "font-semibold text-paper"
                        : "font-medium text-paper/40 hover:text-paper/75"
                    }`}
                  >
                    {l.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="flex shrink-0 items-center gap-5">
          {right}
          {!right && (
            <Link
              href="/explorar?buscar=1"
              style={touch ? { paddingBlock: 12, marginBlock: -12 } : undefined}
              className="group flex items-center gap-2 text-[13px] text-paper/40 transition hover:text-paper"
              aria-label="Buscar"
            >
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
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
