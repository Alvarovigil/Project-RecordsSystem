"use client";

import { useState } from "react";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import { useInstall } from "@/hooks/useInstall";
import { promptInstall } from "@/lib/install";
import PhonePreview from "./PhonePreview";
import {
  BrowserBar,
  HomeScreenDrop,
  ShareGlyph,
  SheetRow,
  Step,
} from "./Steps";

/**
 * The install screen, built like an app listing rather than like a page.
 *
 * It was a centred column: a headline, a paragraph, and whichever block of
 * instructions applied, all stacked and all the same weight. That reads as a
 * page about installing. An app listing has a shape people already know —
 * identity at the top, the button immediately under it, a picture of the
 * thing, then the details for whoever is still deciding — and following it
 * means nobody has to work out what this screen is before using it.
 *
 * So: left-aligned header with the icon at home-screen size, one button, one
 * photograph of the product, then the steps as **numbered cards with the
 * things they name drawn inside them**, then the argument last.
 *
 * **Why the situation decides everything.** There is no single install button
 * on the web. Chromium fires `beforeinstallprompt`, which is the only way a
 * page can install itself; WebKit has said it never will, on the grounds that
 * a permissive prompt would be abused the way notification prompts were, and
 * that on iOS any page can already be added from the share sheet. So this
 * screen has to be five screens, and showing the wrong one is worse than
 * showing nothing: instructions for a menu that is not there, or a button that
 * does nothing. Nothing renders until the reading is in.
 */

type Situation =
  | "installed"
  | "promptable"
  | "ios"
  | "in-app"
  | "desktop"
  | "android-other";

export default function InstallScreen({ url }: { url: string }) {
  const { ready, standalone, platform, canPrompt } = useInstall();
  const [copied, setCopied] = useState(false);

  const situation: Situation | null = !ready
    ? null
    : standalone
      ? "installed"
      : platform === "in-app"
        ? "in-app"
        : canPrompt
          ? "promptable"
          : platform === "ios"
            ? "ios"
            : platform === "android"
              ? "android-other"
              : "desktop";

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: SITE_NAME, url });
        return;
      } catch {
        return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2400);
    } catch {
      /* the address bar still has it */
    }
  };

  return (
    <main className="min-h-screen-d bg-surface">
      <div className="mx-auto w-full max-w-[520px] px-6 pb-20 pt-10 sm:px-8">
        <AppHeader />

        {/* Held until we know which case this is, at a fixed height so the page
            does not jump when it arrives. A button that says "Instalar" for a
            second and then turns into instructions has already told somebody
            the wrong thing. */}
        <div className="mt-7 min-h-[92px]">
          {situation === null ? null : situation === "installed" ? (
            <Action
              label="Abrir mi colección"
              href="/coleccion"
              note="Ya la tienes instalada. La próxima vez, ábrela desde tu pantalla de inicio."
            />
          ) : situation === "promptable" ? (
            <Action
              label={`Instalar ${SITE_NAME}`}
              onClick={() => void promptInstall()}
              note="Un toque. Se añade a tu pantalla de inicio y se abre sin barra de navegador."
            />
          ) : situation === "in-app" ? (
            <Action
              label={copied ? "Enlace copiado" : "Copiar el enlace"}
              onClick={share}
              variant="secondary"
              note="Estás dentro del navegador de otra app y desde aquí no se puede instalar nada. Toca ⋯ y elige «Abrir en Safari» o «Abrir en Chrome»."
            />
          ) : situation === "desktop" ? (
            <Action
              label={copied ? "Enlace copiado" : "Mandarme el enlace al móvil"}
              onClick={share}
              variant="secondary"
              note="Rackr se instala en el teléfono, que es donde lo vas a usar en una tienda. En el escritorio funciona igual desde el navegador."
              extra={
                <Link
                  href="/coleccion"
                  className="text-sub text-content-muted underline-offset-4 transition hover:text-paper hover:underline"
                >
                  Entrar sin instalar
                </Link>
              }
            />
          ) : (
            /* ios y android-other: la acción son los pasos de abajo */
            <p className="text-sub leading-relaxed text-content-muted">
              {platform === "ios"
                ? "En el iPhone ninguna web puede instalarse sola: lo decidió Apple y vale para todos los navegadores. Son dos toques y hacen exactamente lo mismo."
                : "Tu navegador no ofrece el botón de instalar, pero lo tiene en su menú. Son dos toques."}
            </p>
          )}
        </div>

        {situation !== null && situation !== "installed" && (
          <div className="mt-12">
            <PhonePreview />
          </div>
        )}

        {(situation === "ios" || situation === "android-other") && (
          <section className="mt-14">
            <h2 className="text-caption uppercase tracking-label text-content-muted">
              Cómo se instala
            </h2>
            <ol className="mt-4 space-y-2.5">
              {situation === "ios" ? (
                <>
                  <Step
                    n={1}
                    title={
                      <>
                        Toca <ShareGlyph /> <b className="font-medium">Compartir</b>
                      </>
                    }
                    detail="Está en la barra de tu navegador. En Safari abajo, en Chrome arriba."
                  >
                    <BrowserBar />
                  </Step>
                  <Step
                    n={2}
                    title="Baja y elige esta fila"
                    detail="Está bastante abajo, después de las opciones de compartir."
                  >
                    <SheetRow />
                  </Step>
                  <Step n={3} title="Toca «Añadir», arriba a la derecha" detail="Y ya está en tu pantalla de inicio.">
                    <HomeScreenDrop />
                  </Step>
                </>
              ) : (
                <>
                  <Step
                    n={1}
                    title="Abre el menú ⋮ de tu navegador"
                    detail="Arriba a la derecha, junto a la barra de direcciones."
                  />
                  <Step
                    n={2}
                    title="Elige «Instalar aplicación»"
                    detail="En algunos navegadores se llama «Añadir a pantalla de inicio». Es lo mismo."
                  >
                    <HomeScreenDrop />
                  </Step>
                </>
              )}
            </ol>
          </section>
        )}

        {/**
         * Why, after how.
         *
         * Somebody who got here already pressed a button that said Instalar —
         * arguing before answering would be selling to a customer holding a
         * receipt. It stays for the person who tapped out of curiosity, and
         * every reason is a thing that happens rather than a value: the case
         * for an installed web app is entirely made of seconds.
         */}
        <section className="mt-14 border-t border-line pt-9">
          <h2 className="text-caption uppercase tracking-label text-content-muted">
            Por qué en la pantalla de inicio
          </h2>
          <ul className="mt-5 space-y-5">
            <Reason
              title="La cámara, a un toque"
              body="Estás en una tienda con una funda en la mano. Desde el icono son dos segundos; desde una pestaña son buscar el navegador, buscar la pestaña y esperar."
            />
            <Reason
              title="Sin barra de navegador"
              body="La pantalla entera es estantería: una fila más de fundas y portadas que llegan hasta el borde."
            />
            <Reason
              title="Se abre donde lo dejaste"
              body="Con la sesión puesta y en el rack que estabas mirando. Nada que volver a encontrar."
            />
          </ul>
          <p className="mt-8 text-caption leading-relaxed text-content-faint">
            No es una descarga ni pasa por ninguna tienda: la web se guarda como
            app. Ocupa lo que una foto y se quita como cualquier otro icono.
          </p>
        </section>
      </div>
    </main>
  );
}

/**
 * Identity first, the way an app listing does it: the icon at the size it will
 * sit on the home screen, the name beside it, and what it is in one line.
 * Showing somebody the object they are about to acquire does more than any
 * sentence about installing.
 */
function AppHeader() {
  return (
    <header className="flex items-center gap-4">
      <span className="relative shrink-0">
        <span
          aria-hidden
          className="absolute inset-x-2 bottom-1 h-6 rounded-full bg-accent/25 blur-2xl"
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/icon-512.png"
          alt=""
          width={72}
          height={72}
          className="relative h-[72px] w-[72px] rounded-[17px] shadow-[0_14px_34px_rgba(0,0,0,0.5)]"
        />
      </span>
      <span className="min-w-0">
        <h1 className="text-heading font-medium leading-tight text-paper">{SITE_NAME}</h1>
        <p className="mt-1 text-sub leading-snug text-content-secondary">
          Tu colección de vinilos, en la pantalla de inicio
        </p>
        <p className="mt-2 text-caption text-content-faint">
          Gratis · Sin tienda · Sin cuenta para empezar
        </p>
      </span>
    </header>
  );
}

function Action({
  label,
  note,
  href,
  onClick,
  variant = "primary",
  extra,
}: {
  label: string;
  note: string;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  extra?: React.ReactNode;
}) {
  const cls = `pressable flex h-12 w-full select-none items-center justify-center rounded-full text-body font-medium transition-colors ${
    variant === "primary"
      ? "bg-paper text-ink hover:bg-paper/85"
      : "border border-line-strong text-paper hover:border-line-focus hover:bg-fill-subtle"
  }`;

  return (
    <div>
      {href ? (
        <Link href={href} className={cls}>
          {label}
        </Link>
      ) : (
        <button onClick={onClick} className={cls}>
          {label}
        </button>
      )}
      <p className="mt-3 text-sub leading-relaxed text-content-muted">{note}</p>
      {extra && <div className="mt-3">{extra}</div>}
    </div>
  );
}

function Reason({ title, body }: { title: string; body: string }) {
  return (
    <li className="flex gap-4">
      {/* A rule rather than an icon. Three invented glyphs for three abstract
          ideas is decoration pretending to be information — and the eye reads
          the title first either way. */}
      <span aria-hidden className="mt-2.5 h-px w-5 shrink-0 bg-line-strong" />
      <span className="min-w-0">
        <span className="block text-body font-medium text-paper">{title}</span>
        <span className="mt-1 block text-sub leading-relaxed text-content-muted">{body}</span>
      </span>
    </li>
  );
}
