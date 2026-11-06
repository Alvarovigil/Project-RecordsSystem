"use client";

import Link from "next/link";
import SignInButton from "@/components/SignInButton";
import { useSession } from "@/hooks/useSession";
import { IN_APP_NOTE } from "@/lib/site";

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
 * button until hydration or a button that says "Entrar gratis" for a second
 * on a phone and then changes its mind. `pointer: coarse` knows the answer
 * before our code loads; `lib/install` only has to correct the two cases a
 * media query cannot see — already installed, and inside somebody else's
 * webview, where sending a person to install is a dead end.
 */
export default function EntryDoor({ variant }: { variant: "hero" | "closing" }) {
  const { available, signInWithGoogle } = useSession();

  if (variant === "hero") {
    return (
      <>
        {/* On a phone: install first, but never install-or-nothing. Before,
            this was the only button, and a browser tab with no app had no way
            in at all — the sign-in lives in the desktop bar.
            In sentence case, like the buttons at /entrar: the same two
            actions read the same way on both sides of the door, and small
            spaced capitals are a label's voice, not a button's. */}
        <span
          style={{ "--door-display": "inline-flex" } as React.CSSProperties}
          className="door-touch items-center gap-2"
        >
          <Link
            href="/instalar"
            className="pressable inline-flex h-11 select-none items-center rounded-full bg-paper px-5 text-[15px] font-medium text-ink transition-colors hover:bg-paper/85"
          >
            Instalar la app
          </Link>
          {available && (
            <button
              onClick={signInWithGoogle}
              className="pressable inline-flex h-11 select-none items-center rounded-full border border-paper/60 px-5 text-[15px] font-medium text-paper transition-colors hover:border-paper"
            >
              Entrar
            </button>
          )}
        </span>
        {/**
         * On a desktop, "Entrar gratis" IS signing in.
         *
         * It used to walk straight into the app on the local backend — a shelf
         * that lived in that browser and quietly diverged from the account the
         * same person would open later. With the demo gone there is nothing
         * behind that door worth entering without a name on it, so the first
         * button and the way in are the same button. It says Entrar, the one
         * verb the rest of the product uses for this — "Empezar" promised
         * something other than the Google screen it opens — and "gratis"
         * answers the question everybody has before pressing it.
         */}
        <button
          onClick={available ? signInWithGoogle : undefined}
          style={{ "--door-display": "inline-flex" } as React.CSSProperties}
          // select-none: dragging across a white pill used to leave the page's
          // own selection colour — paper on paper — which looked like the
          // button was breaking rather than being highlighted
          className="door-pointer pressable h-9 select-none items-center rounded-full bg-paper px-4 text-[14px] font-medium text-ink transition-colors hover:bg-paper/85"
        >
          Entrar gratis
        </button>
        <WebviewDoor />
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
        <p className="max-w-[34ch] text-center text-[13px] leading-relaxed text-paper/50">
          Se guarda en tu pantalla de inicio y se abre como una app. Sin tienda y
          sin descarga.
        </p>
        <div className="flex flex-col items-center gap-1">
          <SignInButton variant="text" />
          <Link
            href="/explorar"
            className="pressable inline-flex min-h-[44px] items-center px-3 text-[13px] text-paper/60 underline-offset-4 transition hover:text-paper hover:underline"
          >
            Mirar sin cuenta
          </Link>
        </div>
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
      <WebviewDoor />
    </>
  );
}

/**
 * The door for a link opened inside Instagram, WhatsApp or Facebook.
 *
 * Both other doors end in Google, and Google refuses to sign in from another
 * app's browser — the person taps "Entrar", gets an error page in English, and
 * concludes Rackr is broken. So here the landing says the one thing that works
 * (get out to the real browser, in the one sentence /entrar and /instalar
 * use too — IN_APP_NOTE) and keeps the
 * way to look, which needs no account and works anywhere. Shown only by CSS,
 * from the data-in-app flag lib/install sets, like the other two.
 */
function WebviewDoor() {
  return (
    <div
      style={{ "--door-display": "flex" } as React.CSSProperties}
      className="door-webview flex-col items-center gap-3"
    >
      {/* On its own ground: it sits over the moving shelf, and a sentence
          that has to be read and followed needs to win over whatever sleeve
          is passing behind it. */}
      <p className="max-w-[36ch] rounded-lg bg-[rgb(var(--ink-rgb)/0.6)] px-4 py-2.5 text-center text-sub leading-relaxed text-paper/90 backdrop-blur-md">
        {IN_APP_NOTE}
      </p>
      <Link
        href="/explorar"
        className="pressable inline-flex h-11 select-none items-center rounded-full bg-paper px-5 text-[15px] font-medium text-ink transition-colors hover:bg-paper/85"
      >
        Mirar sin cuenta
      </Link>
    </div>
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
