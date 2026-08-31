"use client";

import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { useSession } from "@/hooks/useSession";

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
export default function AppDoor() {
  const { available } = useSession();

  return (
    <main
      className="flex min-h-screen-d flex-col bg-surface px-7"
      style={{
        paddingTop: "calc(var(--safe-top) + 18px)",
        paddingBottom: "calc(var(--safe-bottom) + 22px)",
      }}
    >
      <div className="flex flex-1 flex-col items-center justify-center text-center">
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

        <h1 className="mt-8 text-title font-medium leading-tight text-paper">
          Ya está en tu casa
        </h1>
        <p className="mt-3 max-w-[30ch] text-body leading-relaxed text-content-secondary">
          {SITE_NAME} vive ahora en tu pantalla de inicio. Entra y tu estantería
          te sigue a cualquier sitio donde abras sesión.
        </p>
      </div>

      <div className="flex flex-col items-center gap-4">
        {available ? (
          <GoogleButton />
        ) : (
          <Link
            href="/coleccion"
            className="pressable flex h-12 w-full items-center justify-center rounded-full bg-paper text-body font-medium text-ink transition-colors hover:bg-paper/85"
          >
            Empezar
          </Link>
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
      onClick={signInWithGoogle}
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
