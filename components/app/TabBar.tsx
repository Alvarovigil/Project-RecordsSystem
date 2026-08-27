"use client";

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
  { href: "/feed", label: "Feed", icon: Waves },
  { href: "/explorar", label: "Explorar", icon: Glass },
] as const;

export default function TabBar() {
  const pathname = usePathname();
  const { available, user, profile } = useSession();
  const unread = useUnreadCount();
  const preview = available && !user;
  const handle = profile?.username ?? DEMO_PROFILE.username;

  const tabs = [
    ...TABS.map((t) =>
      // signed out there is no shelf of yours, but there is one to look at
      t.href === "/coleccion" && preview ? { ...t, href: "/demo" } : t,
    ),
    { href: `/u/${handle}`, label: "Perfil", icon: Person },
  ];

  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-paper/10 bg-ink/92 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <ul className="flex items-stretch">
        {tabs.map((t) => {
          const active = isActive(pathname, t.href);
          const Icon = t.icon;
          return (
            <li key={t.href} className="flex-1">
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className="pressable relative flex h-[54px] flex-col items-center justify-center gap-[3px]"
              >
                <span className={active ? "text-paper" : "text-paper/40"}>
                  <Icon filled={active} />
                </span>
                <span
                  className={`text-[10px] leading-none tracking-[0.01em] ${
                    active ? "font-semibold text-paper" : "font-medium text-paper/40"
                  }`}
                >
                  {t.label}
                </span>
                {t.href === "/feed" && unread > 0 && (
                  <span
                    aria-label={`${unread} novedades`}
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
