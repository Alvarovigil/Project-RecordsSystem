"use client";

import Link from "next/link";
import SignInButton from "@/components/SignInButton";

/**
 * The one place the landing asks for anything — and what it asks for depends
 * on the machine.
 *
 * On a phone in a browser the answer is **not** "sign in". Rackr is a shelf
 * you reach for in a shop with a sleeve in your hand: through a browser tab
 * that means finding Safari, finding the tab, waiting for the address bar to
 * collapse, and doing it again tomorrow. Installed it is one icon and a
 * camera. Asking for a Google account first gets the order wrong — it takes
 * the commitment before giving the thing, and it leaves people using the worse
 * version of the app forever because nothing ever suggested the better one.
 *
 * So the phone door is "Instálala", and signing in happens *inside*, where it
 * buys something visible: your shelf on every device.
 *
 * **Both doors are in the HTML, and CSS picks.** This is a server-rendered
 * marketing page, so deciding in JavaScript would mean either an invisible
 * button until hydration or a button that says "Empezar gratis" for a second
 * on a phone and then changes its mind. `pointer: coarse` knows the answer
 * before our code loads; `lib/install` only has to correct the two cases a
 * media query cannot see — already installed, and inside somebody else's
 * webview, where sending a person to install is a dead end.
 */
export default function EntryDoor({ variant }: { variant: "hero" | "closing" }) {
  if (variant === "hero") {
    return (
      <>
        <Link
          href="/instalar"
          style={{ "--door-display": "inline-flex" } as React.CSSProperties}
          className="door-touch pressable h-9 select-none items-center rounded-full bg-paper px-4 text-[12px] font-medium uppercase tracking-[0.07em] text-ink transition-colors hover:bg-paper/85"
        >
          Instalar la app
        </Link>
        <Link
          href="/coleccion"
          style={{ "--door-display": "inline-flex" } as React.CSSProperties}
          // select-none: dragging across a white pill used to leave the page's
          // own selection colour — paper on paper — which looked like the
          // button was breaking rather than being highlighted
          className="door-pointer pressable h-9 select-none items-center rounded-full bg-paper px-4 text-[12px] font-medium uppercase tracking-[0.07em] text-ink transition-colors hover:bg-paper/85"
        >
          Empezar gratis
        </Link>
      </>
    );
  }

  return (
    <>
      <div
        style={{ "--door-display": "flex" } as React.CSSProperties}
        className="door-touch flex-col items-center gap-4"
      >
        <Link
          href="/instalar"
          className="pressable inline-flex h-12 select-none items-center gap-2.5 rounded-full bg-paper px-7 text-[15px] font-medium text-ink transition-colors hover:bg-paper/85"
        >
          <HomeScreen />
          Instalar la app
        </Link>
        <p className="max-w-[34ch] text-center text-[13px] leading-relaxed text-paper/45">
          Se guarda en tu pantalla de inicio y se abre como una app. Sin tienda,
          sin descarga y sin cuenta todavía.
        </p>
        <Link
          href="/coleccion"
          className="text-[12px] uppercase tracking-[0.05em] text-paper/35 underline-offset-4 transition hover:text-paper hover:underline"
        >
          Prefiero mirar en el navegador
        </Link>
      </div>

      {/* No demo link any more. It pointed at a sample collection that no
          longer exists, and a landing that offers a way to look without
          entering spends its one closing moment on the option nobody
          converts from. */}
      <div
        style={{ "--door-display": "flex" } as React.CSSProperties}
        className="door-pointer flex-col items-center gap-5 sm:flex-row sm:justify-center"
      >
        <SignInButton />
      </div>
    </>
  );
}

/** a phone with something on its home screen — the thing being offered */
function HomeScreen() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="3.4" y="1.2" width="9.2" height="13.6" rx="2" stroke="currentColor" strokeWidth="1.3" />
      <rect x="6.1" y="4.6" width="3.8" height="3.8" rx="1.2" fill="currentColor" />
    </svg>
  );
}
