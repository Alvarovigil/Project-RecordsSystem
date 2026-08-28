"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Button from "@/components/ui/Button";

/**
 * The page you send someone when you want them to end up with Rackr on their
 * home screen.
 *
 * Installing a web app is a different act on every platform and only one of
 * them lets a page do it for you, so this screen's whole job is to work out
 * which of four situations the visitor is in and say the one thing that is
 * true there. Anything less specific — "añádelo a tu pantalla de inicio" over
 * a generic button — is how a share link turns into a dead end for everyone
 * except the person who wrote it.
 *
 * 1. **Already installed.** The page is running standalone. There is nothing
 *    to install and saying so is the useful answer.
 * 2. **A browser that can install.** Chrome and Edge fire
 *    `beforeinstallprompt`. That event is the only chance to install
 *    programmatically and it is not replayed, so it is caught the moment it
 *    arrives and kept.
 * 3. **iOS.** Safari has no such event and never will; it has to be Compartir
 *    → Añadir a inicio, spelled out, because nobody discovers that menu on
 *    purpose.
 * 4. **An in-app browser.** This is the case that actually matters, because a
 *    link shared on WhatsApp or Instagram opens inside their own browser,
 *    where installing is impossible and no amount of instructions helps. The
 *    only honest move is to say so and tell them to open it in the real one.
 */

type Deferred = Event & { prompt: () => Promise<void> };

type Situation = "installed" | "promptable" | "ios" | "in-app" | "desktop" | "android-other";

export default function InstallCTA({ url }: { url: string }) {
  const [deferred, setDeferred] = useState<Deferred | null>(null);
  const [situation, setSituation] = useState<Situation | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS says it its own way, and only on Safari
      (navigator as unknown as { standalone?: boolean }).standalone === true;

    // The webviews worth naming. Instagram and Facebook stamp themselves into
    // the UA; WhatsApp's Android webview says "wv". Missing one only means
    // someone sees the generic instructions, which is the safe direction.
    const inApp = /Instagram|FBAN|FBAV|Line\/|Twitter|; wv\)/.test(ua);
    const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);

    setSituation(
      standalone ? "installed" : inApp ? "in-app" : ios ? "ios" : android ? "android-other" : "desktop",
    );

    const onPrompt = (e: Event) => {
      // Chrome asks first and only once. Keeping the event is what lets the
      // button below be a real install rather than a set of instructions.
      e.preventDefault();
      setDeferred(e as Deferred);
      setSituation((s) => (s === "installed" || s === "in-app" ? s : "promptable"));
    };
    const onInstalled = () => setSituation("installed");

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Rackr", url });
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
    <div className="mt-10">
      {/* Held until we know which of the four this is. A button that says
          "Instalar" for a second and then turns into instructions has already
          told someone the wrong thing. */}
      {situation === null ? (
        <div className="h-12" aria-hidden />
      ) : situation === "installed" ? (
        <Panel
          title="Ya la tienes instalada"
          body="Estás dentro de la app. Ábrela desde tu pantalla de inicio la próxima vez."
        >
          <Button variant="primary" href="/coleccion">
            Ir a mi colección
          </Button>
        </Panel>
      ) : situation === "in-app" ? (
        <Panel
          title="Ábrelo en tu navegador"
          body="Estás dentro del navegador de otra aplicación, y desde aquí no se puede instalar nada. Toca los tres puntos de arriba y elige «Abrir en Safari» o «Abrir en Chrome»."
        >
          <Button variant="secondary" onClick={share}>
            {copied ? "Enlace copiado" : "Copiar el enlace"}
          </Button>
        </Panel>
      ) : situation === "promptable" ? (
        <Panel
          title="Instálala en un toque"
          body="Se añade a tu pantalla de inicio y se abre a pantalla completa, sin barra de navegador."
        >
          <Button
            variant="primary"
            onClick={() => {
              void deferred?.prompt();
            }}
          >
            Instalar Rackr
          </Button>
        </Panel>
      ) : situation === "ios" ? (
        <Panel
          title="Añádela a tu pantalla de inicio"
          body="Safari no deja que una web se instale sola, así que son dos toques:"
        >
          <ol className="mt-1 space-y-3">
            <Step n={1}>
              Toca <Share /> <b className="text-paper">Compartir</b>, abajo en la barra de Safari.
            </Step>
            <Step n={2}>
              Baja y elige <b className="text-paper">Añadir a pantalla de inicio</b>.
            </Step>
          </ol>
        </Panel>
      ) : situation === "android-other" ? (
        <Panel
          title="Añádela a tu pantalla de inicio"
          body="En el menú ⋮ de tu navegador, elige «Instalar aplicación» o «Añadir a pantalla de inicio»."
        />
      ) : (
        <Panel
          title="Ábrelo en el móvil"
          body="Rackr se instala como una app en el teléfono. Mándate el enlace y ábrelo allí — o sigue aquí, que en el escritorio funciona igual."
        >
          <div className="flex flex-wrap gap-2.5">
            <Button variant="secondary" onClick={share}>
              {copied ? "Enlace copiado" : "Copiar el enlace"}
            </Button>
            <Button variant="ghost" href="/coleccion">
              Entrar sin instalar
            </Button>
          </div>
        </Panel>
      )}

      <p className="mt-8 text-sub leading-relaxed text-content-muted">
        No hay tienda de aplicaciones, ni descarga, ni cuenta obligatoria para mirar.{" "}
        <Link href="/explorar" className="text-paper underline underline-offset-4">
          Curiosea antes
        </Link>{" "}
        si lo prefieres.
      </p>
    </div>
  );
}

function Panel({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="border border-line bg-fill-subtle/40 px-5 py-6 sm:px-6">
      <p className="text-heading font-medium text-paper">{title}</p>
      <p className="mt-2 max-w-[46ch] text-sub leading-relaxed text-content-muted">{body}</p>
      {children && <div className="mt-5">{children}</div>}
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-baseline gap-3 text-sub leading-relaxed text-content-secondary">
      <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-line text-caption text-content-muted">
        {n}
      </span>
      <span>{children}</span>
    </li>
  );
}

/** iOS's own share glyph, because "el icono de compartir" is not an instruction. */
function Share() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 14 14"
      fill="none"
      aria-label="compartir"
      className="inline -translate-y-[1px]"
    >
      <path
        d="M7 9.2V1.6M7 1.6 4.6 4.1M7 1.6l2.4 2.5M2.7 7.6v4.8h8.6V7.6"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
