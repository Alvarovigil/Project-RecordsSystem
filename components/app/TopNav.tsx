"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  onSearch,
}: {
  transparent?: boolean;
  /** surface-specific controls, sharing the row instead of stacking bars */
  right?: React.ReactNode;
  /**
   * A screen that has its own search takes it over; everything else falls
   * through to Explorar. Either way the control is in the same corner of the
   * same bar on every screen, which is the only reason anyone learns it is
   * there. It used to appear only on screens that had nothing else to put in
   * that corner — so the shelf had a search and the rest of the app looked
   * like it had none.
   */
  onSearch?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { available, user, profile } = useSession();
  // A tablet gets this bar, not the phone's tab bar — but it drives it with a
  // finger, and 15px of text with no padding is a 20px-tall target. The ink
  // stays identical; only the hit area grows.
  const { touch } = useDevice();

  // signed out there is no shelf of yours to open, but there is a demo one —
  // a dead link would be worse than a smaller promise
  const preview = available && !user;
  const handle = profile?.username ?? DEMO_PROFILE.username;

  const search = () => {
    if (onSearch) return onSearch();
    router.push("/explorar?buscar=1");
  };

  // "/" opens search from anywhere, the way it does in every tool that has one
  // — except while you are typing, where a slash is a slash.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = document.activeElement as HTMLElement | null;
      const typing =
        el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
      if (typing || document.body.dataset.sheetOpen) return;
      e.preventDefault();
      search();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const links = [
    preview
      ? { href: "/demo", label: "Colección" }
      : { href: "/coleccion", label: "Colección" },
    { href: "/actividad", label: "Actividad" },
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
            aria-label="Rackr Club"
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
          <button
            onClick={search}
            style={touch ? { paddingBlock: 12, marginBlock: -12 } : undefined}
            className="group flex items-center gap-2 text-[15px] font-medium leading-none text-paper/40 transition-colors duration-150 hover:text-paper/75"
          >
            {/**
             * No magnifying glass.
             *
             * This bar is set in words at reading size — Colección, Actividad,
             * Explorar — and it has no icons in it anywhere else. A glyph next
             * to the word "Buscar" was the same thing said twice, in two
             * different languages, and the one that broke the row's rhythm was
             * the picture.
             *
             * What is left is the word, at the same size and weight as the
             * places, plus the key that opens it. The slash carries the whole
             * job the icon was doing badly: it says this is a control rather
             * than a destination, and it teaches the shortcut by being it.
             * Where there is no keyboard it disappears, and the word alone is
             * enough — a finger has nowhere else to go.
             */}
            Buscar
            {!touch && (
              <kbd className="mono inline-flex h-[19px] min-w-[19px] items-center justify-center rounded-[4px] border border-line px-1 text-[11px] font-normal normal-case leading-none tracking-normal text-content-faint transition-colors duration-150 group-hover:border-line-strong group-hover:text-content-secondary">
                /
              </kbd>
            )}
          </button>
          <AccountMenu />
        </div>
      </div>
    </nav>
  );
}
