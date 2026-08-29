import Link from "next/link";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site";

export const metadata = {
  title: "Rackr Club · Enlaces",
  description: "Todo lo de Rackr Club, en un sitio.",
  // Not indexed on purpose: this is a hub for a bio line, and a search engine
  // finding it instead of the landing would put a menu between somebody and
  // the thing they were looking for.
  robots: { index: false, follow: false },
};

/**
 * The page that goes in a bio.
 *
 * Every product ends up needing one — a single address that leads to all the
 * others — and it is usually a stack of grey pills from a service. This one is
 * made of the same parts as everything else here: a row is a destination, its
 * second line says what happens if you press it, and nothing is dressed up as
 * more important than it is.
 *
 * Ordered by what somebody arriving actually wants. Installing is first
 * because that is what the link is for; the QR is last because it is a tool
 * for whoever runs the account rather than for whoever reads it — but it is
 * here, because the alternative is remembering a URL nobody wrote down.
 */

const LINKS = [
  {
    href: "/instalar",
    label: "Instalar la app",
    hint: "En la pantalla de inicio, sin tienda",
  },
  { href: "/", label: "Qué es Rackr Club", hint: "La casa, con el estante girando" },
  { href: "/explorar", label: "Explorar", hint: "Racks y gente que colecciona" },
  { href: "/qr", label: "El QR", hint: "Para enseñárselo a alguien en persona" },
];

export default function LinksPage() {
  return (
    // centred rather than top-aligned: four rows at the top of a phone leave a
    // screen that looks half-loaded
    <main className="flex min-h-screen-d w-full flex-col items-center justify-center bg-ink px-6 py-16">
      <div className="flex w-full max-w-[420px] flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt={SITE_NAME} className="h-[34px] w-auto sm:h-[40px]" />
        <p className="mt-2.5 text-[10px] uppercase tracking-[0.24em] text-paper/45 sm:text-[11px]">
          {SITE_TAGLINE}
        </p>

        <ul className="mt-10 w-full space-y-2.5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link
                href={l.href}
                className="pressable group flex items-center gap-4 border border-line bg-fill-subtle/40 px-5 py-4 transition-colors hover:border-line-strong hover:bg-fill-subtle"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-body font-medium text-paper">{l.label}</span>
                  {/* not truncated: a hint cut off mid-word is worse than a
                      hint on two lines */}
                  <span className="mt-0.5 block text-sub leading-snug text-content-muted">
                    {l.hint}
                  </span>
                </span>
                <span
                  aria-hidden
                  className="shrink-0 text-content-faint transition-transform duration-fast group-hover:translate-x-0.5 group-hover:text-paper"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
