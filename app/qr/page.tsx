import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/site";

export const metadata = {
  title: "Rackr Club · QR",
  description: "Enséñale esto a alguien y lo tendrá en su móvil.",
  // A card meant to be held up in a bar, not indexed: it is one QR and a URL,
  // and a search result for it would be a dead end for whoever clicked it.
  robots: { index: false, follow: false },
};

/**
 * The card you hold up.
 *
 * One screen, no scroll, nothing to press. It exists for a single moment —
 * pointing your phone at somebody else's camera across a table — and every
 * decision serves that.
 *
 * **The code is a sleeve.** Everything in this product that matters is a
 * square you can hold: a cover, a crate, a card. So the QR is printed on one,
 * leaning a few degrees the way a record leans when somebody props it up,
 * with a hairline of cardboard along its edge. It is the same object language
 * as the shelf, doing a job the shelf cannot do.
 *
 * **White, and big.** A camera reading a screen through glare needs every bit
 * of contrast there is, and the quiet zone around a code is part of the code
 * rather than padding around it — cropped, half the readers refuse it.
 *
 * **No 3D backdrop.** The landing can afford to load a renderer behind its
 * copy; this cannot. It has to be on screen the instant it is asked for,
 * because somebody is already holding their phone up. The atmosphere is two
 * gradients and the grain the rest of the product uses.
 */
export default function QrPage() {
  return (
    <main className="relative flex h-screen-d w-full flex-col items-center justify-center overflow-hidden bg-ink px-6">
      {/* the room: a pool of light behind the card, and the same grain that
          sits over every other surface here */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/[0.05] blur-[120px]"
      />
      <span aria-hidden className="grain absolute inset-0" />

      <div className="appear relative flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt={SITE_NAME}
          className="h-[34px] w-auto mix-blend-difference sm:h-[42px]"
        />
        <p className="mt-2.5 text-[10px] uppercase tracking-[0.24em] text-paper/45 sm:text-[11px]">
          {SITE_TAGLINE}
        </p>

        {/* the sleeve */}
        <div className="relative mt-10 -rotate-[2.5deg]">
          <span
            aria-hidden
            className="absolute inset-x-[2px] top-full h-[4px] rounded-b-[2px] bg-paper/30"
          />
          <div className="rounded-[4px] bg-paper p-5 shadow-[0_40px_90px_rgba(0,0,0,0.75)] sm:p-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/qr-instalar.svg"
              alt="Código QR que lleva a rackr.club/instalar"
              className="h-[56vw] max-h-[300px] w-[56vw] max-w-[300px]"
            />
            <p className="mono mt-4 text-center text-[9px] uppercase tracking-[0.2em] text-ink/45">
              Escanea y lo tienes
            </p>
          </div>
        </div>
      </div>

      {/* the address, where a catalogue number would be */}
      <p className="mono absolute inset-x-0 bottom-8 text-center text-[11px] uppercase tracking-[0.16em] text-paper/35">
        {SITE_URL.replace(/^https?:\/\//, "")}/instalar
      </p>
    </main>
  );
}
