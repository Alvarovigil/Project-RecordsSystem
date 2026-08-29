import { SITE_URL } from "@/lib/site";

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
 * One screen, no scroll, nothing to press. It exists to be pointed at another
 * person's camera across a table, so every decision is about that moment: the
 * code is the biggest thing on it, it sits on white because a phone camera
 * reading a dark screen through glare needs all the contrast it can get, and
 * the address is printed underneath for the person who would rather type it
 * than hold their phone up.
 *
 * No install button, no explanation, no way in. Whoever scans it lands on
 * /instalar, which is the screen that does the explaining — this one only has
 * to be readable from a metre away in bad light.
 */
export default function QrPage() {
  return (
    <main className="flex h-screen-d w-full flex-col items-center justify-center overflow-hidden bg-ink px-6">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.svg" alt="Rackr Club" className="h-[38px] w-auto sm:h-[46px]" />

      <p className="mt-3 text-[11px] uppercase tracking-[0.22em] text-paper/45 sm:text-[12px]">
        Escanea y lo tienes
      </p>

      {/* The quiet zone is part of the code, not padding around it: a QR with
          its margin cropped is a QR that half the readers refuse. */}
      <div className="mt-9 rounded-[20px] bg-paper p-5 shadow-[0_30px_80px_rgba(0,0,0,0.6)] sm:p-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/qr-instalar.svg"
          alt="Código QR que lleva a rackr.club/instalar"
          className="h-[54vw] max-h-[300px] w-[54vw] max-w-[300px]"
        />
      </div>

      <p className="mono mt-7 text-[12px] uppercase tracking-[0.14em] text-paper/40">
        {SITE_URL.replace(/^https?:\/\//, "")}/instalar
      </p>
    </main>
  );
}
