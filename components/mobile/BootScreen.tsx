"use client";

import { Mark } from "@/components/ui/Loading";
import { SITE_NAME } from "@/lib/site";

/**
 * The first screen of the session, held until the app is actually ready.
 *
 * A phone opening from the home screen is judged in the first second, and
 * what it was doing with that second was building itself in public: the
 * skeleton grid, then a header, then sleeves arriving one at a time, then the
 * 3D stack folding up over the top of them. Every stage of that was honest and
 * the sum of it looked like a web page assembling.
 *
 * So the app builds behind this instead. It covers the screen while the
 * library is read, the fonts load and the first covers decode, and lifts in
 * one movement onto a shelf that is already finished.
 *
 * It is deliberately not a spinner on black: the mark, the name, and the
 * ground the app is about to be — so that lifting it is a dissolve rather than
 * a cut to a different screen.
 *
 * Once per launch, never on navigation. Coming back to the collection from
 * Explorar must never show this; that is what made the old desktop loader feel
 * like page loads, and it is why the flag that tracks it lives outside React.
 */
export default function BootScreen({ leaving }: { leaving: boolean }) {
  return (
    <div
      aria-hidden={leaving}
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center gap-5 bg-ink transition-[opacity,filter] duration-700 ease-out ${
        leaving ? "pointer-events-none opacity-0 blur-md" : "opacity-100 blur-0"
      }`}
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <Mark size={52} spinning />
      <p className="text-caption uppercase tracking-label text-content-faint">{SITE_NAME}</p>
    </div>
  );
}
