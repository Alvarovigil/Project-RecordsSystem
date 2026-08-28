import Link from "next/link";
import InstallCTA from "@/components/InstallCTA";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Instalar Rackr",
  description: "Tu colección de vinilos en la pantalla de inicio, sin tienda de aplicaciones.",
  alternates: { canonical: `${SITE_URL}/instalar` },
};

/**
 * The link you send to someone.
 *
 * Not the landing page with an install button bolted on: the landing has to
 * explain what this is to somebody who arrived by accident, and this page is
 * for somebody a friend has already told. It says what it is in one line and
 * then spends the whole screen on the one thing it is for.
 */
export default function InstalarPage() {
  return (
    <main className="min-h-screen-d bg-surface px-6 py-16 sm:px-10">
      <div className="mx-auto w-full max-w-[560px]">
        <Link href="/" className="inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt={SITE_NAME} className="h-[15px] w-auto" />
        </Link>

        <h1 className="mt-12 text-display font-medium leading-tight text-paper">
          Tu estantería, en el móvil.
        </h1>
        <p className="mt-3 max-w-[46ch] text-body leading-relaxed text-content-secondary">
          {SITE_DESCRIPTION}
        </p>

        <InstallCTA url={`${SITE_URL}/instalar`} />

        <ul className="mt-12 space-y-3 border-t border-line pt-6">
          {[
            "Tus discos en una estantería que se hojea con el pulgar.",
            "Escaneas el código de barras y el disco entra solo.",
            "Ves qué tiene la gente que colecciona como tú.",
          ].map((t) => (
            <li key={t} className="flex gap-3 text-sub leading-relaxed text-content-muted">
              <span aria-hidden className="text-content-faint">
                ·
              </span>
              {t}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
