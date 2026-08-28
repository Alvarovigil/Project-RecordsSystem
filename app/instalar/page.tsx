import InstallCTA from "@/components/InstallCTA";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Instalar Rackr",
  description:
    "Tu colección de vinilos en la pantalla de inicio, sin tienda de aplicaciones.",
  alternates: { canonical: `${SITE_URL}/instalar` },
};

/**
 * The link you send to someone.
 *
 * Not the landing page with an install button bolted on: the landing explains
 * the product to a stranger who arrived by accident, and this is for somebody
 * a friend has already told. So it opens with the thing they are about to get
 * — the icon, at the size it will sit on their home screen — and then does one
 * job. rackr.club/instalar, with /app as the short one you can say out loud.
 */
export default function InstalarPage() {
  return (
    <main className="min-h-screen-d bg-surface px-6 py-14 sm:px-10">
      <div className="mx-auto flex w-full max-w-[520px] flex-col items-center">
        {/* The icon, rounded the way iOS will round it, at roughly the size it
            ends up on a home screen. Showing someone the object they are about
            to acquire does more than any sentence about installing. */}
        <span className="relative block">
          <span
            aria-hidden
            className="absolute inset-x-3 bottom-2 h-8 rounded-full bg-accent/25 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt=""
            width={104}
            height={104}
            className="relative h-[104px] w-[104px] rounded-[24px] shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
          />
        </span>
        <span className="mt-3 text-caption text-content-muted">
          {SITE_NAME}
        </span>

        <h1 className="mt-9 text-center text-display font-medium leading-tight text-paper">
          Tu estantería,
          <br />
          en la pantalla de inicio
        </h1>
        <p className="mt-3.5 max-w-[34ch] text-center text-body leading-relaxed text-content-secondary">
          Cataloga los vinilos que tienes, apunta los que te faltan y mira lo
          que guarda la gente que colecciona como tú.
        </p>

        <div className="w-full">
          <InstallCTA url={`${SITE_URL}/instalar`} />
        </div>
      </div>
    </main>
  );
}
