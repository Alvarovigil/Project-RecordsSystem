"use client";

import { Mark } from "@/components/ui/Loading";
import { SITE_NAME } from "@/lib/site";
import { isColdStartOn } from "@/lib/launch";

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
 *
 * Painted from the server's HTML (no `ssr: false`, no lazy chunk) and used as
 * the route's `loading.tsx` too, so the first frame of the collection is
 * always this and never black. It sits under the tab bar rather than over
 * it: the bar is already there from the server, and a way out that appears,
 * vanishes and reappears is the app assembling in public again.
 */
export default function BootScreen({ leaving = false }: { leaving?: boolean }) {
  return (
    <div
      role="status"
      aria-label="Cargando la colección"
      aria-hidden={leaving}
      className={`fixed inset-0 z-[45] flex flex-col items-center justify-center gap-5 bg-ink transition-[opacity,filter] duration-700 ease-out ${
        leaving ? "pointer-events-none opacity-0 blur-md" : "opacity-100 blur-0"
      }`}
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <Mark size={52} spinning />
      <p className="label text-content-faint">{SITE_NAME}</p>
    </div>
  );
}

/**
 * What a route of the shelf shows while it loads: the opening screen on a
 * cold start, and on a navigation nothing but the shelf's own ground.
 *
 * As the route's `loading.tsx` the opening screen came up on every first visit
 * from another tab — the mark and the name for a third of a second, a launch
 * screen in the middle of a running app. Moving inside the app, the screen
 * that is coming is a dark room with covers in it, so the wait is that dark
 * room, empty for a moment, and the sleeves arrive into it as they always do.
 */
export function ShelfLoading({ path }: { path: string }) {
  if (isColdStartOn(path)) return <BootScreen />;
  return (
    <div aria-busy="true" className="fixed inset-0 bg-ink">
      <span className="sr-only">Cargando la colección</span>
    </div>
  );
}
