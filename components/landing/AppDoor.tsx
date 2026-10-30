"use client";

import Link from "next/link";
import { IN_APP_NOTE, SITE_NAME } from "@/lib/site";
import { nextFromEntry, useSession } from "@/hooks/useSession";

/**
 * What the app shows the first time it is opened from the home screen.
 *
 * It must not be the landing. The landing exists to explain the product to
 * somebody who arrived by accident — five screens of argument, a drifting 3D
 * shelf, "sobre el proyecto". A person tapping an icon they installed ten
 * seconds ago has already been convinced; showing them the sales pitch inside
 * the thing they bought is the web leaking into the app.
 *
 * So this is one screen with one decision on it, shaped like the first launch
 * of an application rather than like a page: the mark, one sentence about what
 * signing in buys, and the button.
 *
 * **Why sign-in is asked here and not before.** On the landing it would be a
 * toll — an account for a thing you have not seen. Here it is the first
 * feature: this device now has a shelf, and an account is what makes it the
 * same shelf as the one on your laptop. The way past it stays open, quietly,
 * because a collection that lives on this phone alone is a legitimate way to
 * use Rackr and a wall would be a worse product than a door.
 */
export default function AppDoor({
  title = "Ya está en tu casa",
  body = `${SITE_NAME} vive ahora en tu pantalla de inicio. Entra y tu estantería te sigue en el móvil y en el ordenador.`,
  browse = false,
}: {
  title?: string;
  body?: string;
  /**
   * A quiet way to look first. Off on the installed first launch (see below);
   * on at /entrar, where somebody tapped Colección or Perfil from inside the
   * app without an account and has every right to go back to looking.
   */
  browse?: boolean;
} = {}) {
  const { available } = useSession();

  return (
    <main
      className="flex min-h-screen-d flex-col items-center justify-center bg-surface px-7"
      style={{
        paddingTop: "calc(var(--safe-top) + 18px)",
        paddingBottom: "calc(var(--safe-bottom) + 22px)",
      }}
    >
      {/**
       * One block, centred — not a message floating in the middle with the
       * button nailed to the floor.
       *
       * That was the shape a phone screen usually wants: content up here,
       * the commitment down where the thumb is. It is the wrong shape for a
       * screen with four lines on it, because on a tall phone it opens as a
       * logo, a paragraph, and then a hand's width of nothing — and the one
       * thing you are meant to do is somewhere past the bottom of what the eye
       * takes in. A first launch has to answer "what do I press" inside the
       * first look.
       */}
      <div className="flex w-full max-w-[340px] flex-col items-center text-center">
        <span className="relative block">
          <span
            aria-hidden
            className="absolute inset-x-4 bottom-3 h-10 rounded-full bg-accent/25 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt=""
            width={84}
            height={84}
            className="relative h-[84px] w-[84px] rounded-[20px] shadow-[0_18px_44px_rgba(0,0,0,0.55)]"
          />
        </span>

        <h1 className="mt-8 text-title font-medium leading-tight text-paper">{title}</h1>
        <p className="mt-3 text-body leading-relaxed text-content-secondary">{body}</p>

        <div className="mt-9 w-full">
          {available ? (
            /* Inside Instagram or WhatsApp, Google refuses to sign in (see
               EntryDoor): the button would lead to an error page, so the way
               in is the way out. Both are in the HTML and the data-in-app
               flag picks, like the landing's doors — no frame with the wrong
               button while the page works out where it is. */
            <>
              <span className="hide-in-app block">
                <GoogleButton />
              </span>
              <p
                style={{ "--door-display": "block" } as React.CSSProperties}
                className="door-webview text-sub leading-relaxed text-content-secondary"
              >
                {IN_APP_NOTE}
              </p>
            </>
          ) : (
            <Link
              href="/coleccion"
              className="pressable flex h-12 w-full items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
            >
              Empezar
            </Link>
          )}
        </div>
        {browse && (
          <>
            <Link
              href="/explorar"
              className="hide-in-app pressable mt-3 flex h-12 w-full items-center justify-center rounded-full text-body text-content-secondary transition-colors hover:text-paper"
            >
              Mirar sin cuenta
            </Link>
            {/* Inside another app's browser this is the only thing that can be
                done here, so it takes the paper pill the Google button would
                have had — the same treatment as on the landing. A quiet link
                as the one action on a screen reads as no action at all. */}
            <Link
              href="/explorar"
              style={{ "--door-display": "flex" } as React.CSSProperties}
              className="door-webview pressable mt-5 h-12 w-full items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
            >
              Mirar sin cuenta
            </Link>
          </>
        )}
        {/* There was a "mirar antes de entrar" here, into the local backend.
            It has gone with the demo: an app whose front door offers a way
            past itself is teaching people that the door is optional, and the
            thing behind that one was a shelf that lived on this phone alone
            and quietly diverged from the account they would open later. */}
      </div>
    </main>
  );
}

function GoogleButton() {
  const { signInWithGoogle } = useSession();
  return (
    <button
      // back to where the person was when something sent them here
      onClick={() => void signInWithGoogle(nextFromEntry() ?? undefined)}
      className="pressable flex h-12 w-full items-center justify-center gap-3 rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
    >
      <GoogleMark />
      Entrar con Google
    </button>
  );
}

function GoogleMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 18 18" aria-hidden>
      <path fill="#4285F4" d="M17.6 9.2c0-.6-.1-1.2-.2-1.8H9v3.4h4.8a4.1 4.1 0 0 1-1.8 2.7v2.2h2.9c1.7-1.6 2.7-3.9 2.7-6.5z" />
      <path fill="#34A853" d="M9 18c2.4 0 4.5-.8 6-2.2l-2.9-2.2c-.8.5-1.8.9-3.1.9-2.4 0-4.4-1.6-5.1-3.8H.9v2.3A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.9 10.7a5.4 5.4 0 0 1 0-3.4V5H.9a9 9 0 0 0 0 8l3-2.3z" />
      <path fill="#EA4335" d="M9 3.6c1.3 0 2.5.5 3.4 1.3l2.6-2.6A9 9 0 0 0 .9 5l3 2.3C4.6 5.2 6.6 3.6 9 3.6z" />
    </svg>
  );
}
