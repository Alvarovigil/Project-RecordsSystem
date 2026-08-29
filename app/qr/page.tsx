import ShelfBackdrop from "@/components/ShelfBackdrop";
import SoundGate from "@/components/landing/SoundGate";
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
 * The same room as the landing — the real shelf drifting behind, the same door
 * you press to come in, the same record playing underneath — around one object
 * that the landing does not have: a code somebody else can point a camera at.
 *
 * The 3D backdrop is affordable here for one reason: the door. Behind it the
 * page is out of focus and nobody is scanning anything yet, so the renderer
 * has the length of somebody reading one sentence to arrive. Without the gate
 * this would have to be two gradients, because a card you hold up has to be on
 * screen the instant it is asked for.
 *
 * **Built for the phone first**, because that is the only device this screen
 * is ever used on. The code is sized against the viewport's width so it fills
 * a phone and stops growing on a laptop; the address sits above the player
 * rather than under it; and nothing on the page can be pressed by accident
 * while it is being held out at arm's length.
 */
export default function QrPage() {
  return (
    <main className="relative flex h-screen-d w-full flex-col items-center justify-center overflow-hidden bg-ink px-6">
      <ShelfBackdrop />

      {/* The shelf is atmosphere here, not the subject: dark at the edges and
          darker in the middle, so a bright cover drifting past can never sit
          behind the code and cost it contrast. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_46%,rgba(10,10,10,0.86)_0%,rgba(10,10,10,0.94)_46%,#0a0a0a_100%)]"
      />
      <span aria-hidden className="grain pointer-events-none absolute inset-0" />

      <SoundGate
        title="Enséñale esto a quien tengas delante."
        body="Escanea el código y Rackr Club se le instala en el móvil."
        cta="Ver el código"
      />

      {/* landing-hides: behind the door this waits, like everything else on
          the landing does */}
      <div className="landing-hides relative flex flex-col items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.svg"
          alt={SITE_NAME}
          className="h-[32px] w-auto mix-blend-difference sm:h-[40px]"
        />
        <p className="mt-2.5 text-[10px] uppercase tracking-[0.24em] text-paper/50 sm:text-[11px]">
          {SITE_TAGLINE}
        </p>

        <div className="mt-8 rounded-[18px] bg-paper p-4 shadow-[0_40px_100px_rgba(0,0,0,0.8)] sm:mt-9 sm:p-6">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/qr-instalar.svg"
            alt="Código QR que lleva a rackr.club/instalar"
            className="h-[58vw] max-h-[280px] w-[58vw] max-w-[280px]"
          />
          <p className="mono mt-3.5 text-center text-[9px] uppercase tracking-[0.2em] text-ink/45">
            Escanea y lo tienes
          </p>
        </div>

        {/* Above the player, not under it. The address is the fallback for
            somebody who would rather type than scan, and a fallback hidden
            behind a now-playing bar is not one. */}
        <p className="mono mt-7 text-center text-[11px] uppercase tracking-[0.16em] text-paper/40">
          {SITE_URL.replace(/^https?:\/\//, "")}/instalar
        </p>
      </div>
    </main>
  );
}
