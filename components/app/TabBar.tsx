"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "@/hooks/useSession";
import { DEMO_PROFILE } from "@/lib/demo";
import { useUnreadCount } from "@/hooks/useNotifications";

/**
 * Where you are and where you can go, on a phone.
 *
 * A top bar on a phone is a bad joke: it sits at the far end of the screen from
 * the thumb, it competes with the system status bar, and it shrinks the labels
 * until they are decoration. This is the same navigation put where the hand is.
 *
 * Four destinations, never five. The rule everyone converged on independently —
 * Spotify, Instagram, Letterboxd — because a tab bar is a map, and a map with
 * too many pins stops telling you where you are. Anything that is a *task*
 * rather than a *place* (adding a record, editing a list, sharing) belongs in a
 * sheet raised from the place it happens, not down here.
 *
 * The labels stay. Icon-only bars test well with the people who designed them
 * and badly with everyone else; a vinyl app in Spanish cannot assume its icon
 * for "Explorar" reads as anything at all.
 */

const TABS = [
  { href: "/coleccion", label: "Colección", icon: Disc },
  { href: "/actividad", label: "Actividad", icon: Waves },
  { href: "/explorar", label: "Explorar", icon: Glass },
] as const;

export default function TabBar() {
  const pathname = usePathname();
  const { available, loading, user, profile } = useSession();
  const unread = useUnreadCount();
  // not while the session is still being read: a signed-in tap in that
  // instant would otherwise go through the door and bounce back
  const preview = available && !loading && !user;
  const handle = profile?.username ?? DEMO_PROFILE.username;

  // Signed out there is no shelf and no profile of yours: both tabs lead to the
  // way in, instead of to a sample collector presented as if it were you.
  const tabs = [
    ...TABS.map((t) => (t.href === "/coleccion" && preview ? { ...t, href: "/entrar" } : t)),
    /**
     * Perfil, which is only a door for somebody who is genuinely signed out.
     *
     * Signed in but with the profile not loaded yet (or failed), it used to
     * fall back to /entrar — and /entrar sends a signed-in person straight on
     * to /coleccion, so Perfil opened the shelf. The account id is enough for
     * /u/, which resolves ids as well as handles. While the session itself is
     * still being read there is nothing honest to link to, so it waits (null).
     * Signed out it has its own address (?desde=perfil) so the two doors are
     * two links: with the same href, tapping Perfil lit Colección.
     */
    {
      href: preview
        ? "/entrar?desde=perfil"
        : profile
          ? `/u/${handle}`
          : user
            ? `/u/${user.id}`
            : null,
      label: "Perfil",
      icon: Person,
    },
  ];

  /**
   * Which of the two tabs brought you to /entrar.
   *
   * Read from the address rather than with useSearchParams: that hook makes
   * every page that renders the bar bail out of static rendering unless it
   * sits in its own Suspense boundary, and the bar is on every page. The
   * pathname does not change between /entrar and /entrar?desde=perfil, so the
   * tap itself also says which one it was.
   */
  const [door, setDoor] = useState<"Colección" | "Perfil">("Colección");
  useEffect(() => {
    if (pathname !== "/entrar") return;
    const read = () => {
      const from = new URLSearchParams(window.location.search).get("desde");
      setDoor(from === "perfil" ? "Perfil" : "Colección");
    };
    read();
    // «atrás» between the two doors changes only the query, which the
    // pathname does not see: the history entry says which one it was
    window.addEventListener("popstate", read);
    return () => window.removeEventListener("popstate", read);
  }, [pathname]);

  return (
    <nav
      aria-label="Principal"
      /**
       * The bar, and a floor under it.
       *
       * `bottom-0` should be enough and on every other platform it is. In an
       * installed window on iOS the bar has been seen sitting short of the
       * bottom of the screen at launch — the viewport it is measured against
       * has not settled — and what shows underneath is a band of black that
       * looks like the app ended early. `tabbar-floor` paints the bar's own
       * material from its underside downwards, so a gap that does appear reads
       * as a slightly taller bar rather than as a hole. It is a cover, not a
       * cure: it makes a bug that only happens sometimes stop being visible
       * when it does. The cure was one floor up — the shelf's canvas no longer
       * measures itself in viewport units inside a box that already knows its
       * own size.
       */
      className="tabbar-floor fixed inset-x-0 bottom-0 z-50 border-t border-paper/10 bg-ink/92 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="flex items-stretch">
        {tabs.map((t) => {
          // signed out two tabs lead to /entrar: the one you tapped lights up
          const Icon = t.icon;
          if (t.href === null) {
            return (
              <li key={t.label} className="flex-1">
                <span
                  aria-disabled
                  className="relative flex h-[54px] flex-col items-center justify-center gap-[3px] text-paper/50"
                >
                  <Icon filled={false} />
                  <span className="text-tab font-medium leading-none tracking-[0.01em]">{t.label}</span>
                </span>
              </li>
            );
          }
          const toDoor = t.href.startsWith("/entrar");
          const active = toDoor
            ? pathname === "/entrar" && door === t.label
            : isActive(pathname, t.href);
          return (
            <li key={t.label} className="flex-1">
              <Link
                href={t.href}
                onClick={toDoor ? () => setDoor(t.label as "Colección" | "Perfil") : undefined}
                aria-current={active ? "page" : undefined}
                className="pressable relative flex h-[54px] flex-col items-center justify-center gap-[3px]"
              >
                <span className={active ? "text-paper" : "text-paper/50"}>
                  <Icon filled={active} />
                </span>
                <span
                  className={`text-tab leading-none tracking-[0.01em] ${
                    active ? "font-semibold text-paper" : "font-medium text-paper/50"
                  }`}
                >
                  {t.label}
                </span>
                {t.href === "/actividad" && unread > 0 && (
                  <span
                    aria-label={`${unread} avisos sin ver`}
                    className="absolute right-[calc(50%-18px)] top-[9px] h-[7px] w-[7px] rounded-full bg-[#f83a23]"
                  />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A tab stays lit for everything underneath it.
 *
 * Opening a list from the feed should not drop the feed tab — you are still in
 * that branch of the app, and a bar that goes dark as soon as you go one level
 * deep makes people feel lost. `/u/...` is the exception: it belongs to Perfil
 * only when it is *your* profile, which the caller has already resolved.
 */
function isActive(pathname: string, href: string) {
  if (href === "/coleccion" || href === "/demo") {
    return pathname.startsWith("/coleccion") || pathname.startsWith("/demo");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/* Icons drawn for 20px and for this app: a record, a groove, a loupe, a
   person. Filled when active, outlined when not — the weight difference does
   the work that colour alone cannot on a small, dark bar. */

function Disc({ filled }: { filled: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="7.6" stroke="currentColor" strokeWidth={filled ? 1.8 : 1.3} />
      <circle cx="10" cy="10" r="3.4" stroke="currentColor" strokeWidth={filled ? 1.4 : 1.1} opacity={0.6} />
      <circle cx="10" cy="10" r="1.5" fill="currentColor" />
    </svg>
  );
}

function Waves({ filled }: { filled: boolean }) {
  const w = filled ? 1.9 : 1.35;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M3 12.5 V7.5 M6.7 15 V5 M10.4 13.4 V6.6 M14.1 16 V4 M17.5 11.6 V8.4" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
    </svg>
  );
}

function Glass({ filled }: { filled: boolean }) {
  const w = filled ? 1.9 : 1.35;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="8.8" cy="8.8" r="5.6" stroke="currentColor" strokeWidth={w} />
      <path d="M12.9 12.9 L17.2 17.2" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
    </svg>
  );
}

function Person({ filled }: { filled: boolean }) {
  const w = filled ? 1.9 : 1.35;
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="6.6" r="3.2" stroke="currentColor" strokeWidth={w} />
      <path d="M3.8 16.8 C4.4 13.4 6.9 11.6 10 11.6 C13.1 11.6 15.6 13.4 16.2 16.8" stroke="currentColor" strokeWidth={w} strokeLinecap="round" />
    </svg>
  );
}
