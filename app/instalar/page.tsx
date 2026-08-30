import InstallCTA from "@/components/InstallCTA";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Instalar Rackr Club",
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
          Tu colección,
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

        {/**
         * Why, after how.
         *
         * The instructions come first because somebody who arrived here is
         * already sold — a friend sent them, or they pressed a button on the
         * landing that said "Instalar". Arguing before answering would be
         * selling to a customer holding a receipt.
         *
         * But it still has to be here, underneath, for the person who tapped
         * out of curiosity and is deciding whether this is worth two taps.
         * And every reason is a thing that happens, not a value: the pitch for
         * an installed web app is entirely made of seconds.
         */}
        <div className="mt-16 w-full border-t border-line pt-10">
          <p className="text-center text-caption uppercase tracking-label text-content-muted">
            Por qué en la pantalla de inicio
          </p>
          <ul className="mt-7 space-y-6">
            <Reason
              title="La cámara, a un toque"
              body="Estás en una tienda con una funda en la mano. Desde el icono son dos segundos; desde una pestaña son buscar el navegador, buscar la pestaña y esperar."
            />
            <Reason
              title="Sin barra de navegador"
              body="La pantalla entera es estantería. En un móvil eso es una fila más de fundas y una portada que llega hasta el borde."
            />
            <Reason
              title="Se abre donde lo dejaste"
              body="Con la sesión puesta y en el rack que estabas mirando. Nada que volver a encontrar."
            />
          </ul>
          <p className="mx-auto mt-9 max-w-[36ch] text-center text-caption leading-relaxed text-content-faint">
            No es una descarga ni pasa por ninguna tienda: la web se guarda como
            app. Ocupa lo que ocupa una foto y se quita como cualquier icono.
          </p>
        </div>
      </div>
    </main>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      {/* A rule rather than an icon. Three invented glyphs for three abstract
          ideas is decoration pretending to be information — and the eye reads
          the title first either way. */}
      <span aria-hidden className="mt-2 h-px w-6 shrink-0 bg-line-strong" />
      <span className="min-w-0">
        <span className="block text-body font-medium text-paper">{title}</span>
        <span className="mt-1.5 block text-sub leading-relaxed text-content-muted">
          {body}
        </span>
      </span>
    </li>
  );
}
