"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import { SITE_NAME } from "@/lib/site";

/**
 * The page you send someone when you want them to end up with Rackr on their
 * home screen.
 *
 * **Why there is no single button on iPhone, and why there never will be.**
 * Chromium fires `beforeinstallprompt`, which is the one and only way a page
 * can install itself, and this screen uses it where it exists. WebKit does not
 * implement it and has said it will not: the request is WONTFIX in their
 * tracker, on the grounds that a permissive prompt would be abused the way
 * notification prompts were, and that on iOS any page can already be added
 * from the share menu without meeting anyone's criteria. `navigator.share()`
 * does not help either — that opens *our* share sheet, and "Añadir a pantalla
 * de inicio" only exists in Safari's own.
 *
 * So the second-best thing is done properly: show the icon they are about to
 * get, and name the exact words they are looking for. Nobody discovers that
 * menu on purpose.
 *
 * The four situations that are not iOS:
 *
 * 1. **Already installed** — running standalone. Nothing to install, and
 *    saying so is the useful answer.
 * 2. **Promptable** — Chrome/Edge. The event is caught the moment it arrives
 *    (it is never replayed) and kept behind a real one-tap button.
 * 3. **A desktop** — offers to send the link to a phone rather than pretend.
 * 4. **An in-app browser** — the case that decides whether any of this works,
 *    because a link shared on WhatsApp or Instagram opens in their own webview
 *    where installing is impossible and instructions do not help.
 */

type Deferred = Event & { prompt: () => Promise<void> };

type Situation =
  "installed" | "promptable" | "ios" | "in-app" | "desktop" | "android-other";

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
    const ios =
      /iPhone|iPad|iPod/.test(ua) ||
      (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    const android = /Android/.test(ua);

    setSituation(
      standalone
        ? "installed"
        : inApp
          ? "in-app"
          : ios
            ? "ios"
            : android
              ? "android-other"
              : "desktop",
    );

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as Deferred);
      setSituation((s) =>
        s === "installed" || s === "in-app" ? s : "promptable",
      );
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
    <>
      {/* Held until we know which case this is. A button that says "Instalar"
          for a second and then turns into instructions has already told
          somebody the wrong thing. */}
      <div className="mt-10 min-h-[168px]">
        {situation === null ? null : situation === "installed" ? (
          <Centered
            title="Ya la tienes"
            body="Estás dentro de la app. La próxima vez ábrela desde tu pantalla de inicio."
          >
            <Button variant="primary" href="/coleccion">
              Ir a mi colección
            </Button>
          </Centered>
        ) : situation === "in-app" ? (
          <Centered
            title="Ábrelo en tu navegador"
            body="Estás dentro del navegador de otra aplicación, y desde aquí no se puede instalar nada. Toca ⋯ arriba y elige «Abrir en Safari» o «Abrir en Chrome»."
          >
            <Button variant="secondary" onClick={share}>
              {copied ? "Enlace copiado" : "Copiar el enlace"}
            </Button>
          </Centered>
        ) : situation === "promptable" ? (
          <Centered
            title="Instálala en un toque"
            body="Se añade a tu pantalla de inicio y se abre a pantalla completa, sin barra de navegador."
          >
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                void deferred?.prompt();
              }}
            >
              Instalar Rackr Club
            </Button>
          </Centered>
        ) : situation === "ios" ? (
          <IosSteps />
        ) : situation === "android-other" ? (
          <Centered
            title="Añádela a tu pantalla de inicio"
            body="Abre el menú ⋮ de tu navegador y elige «Instalar aplicación» o «Añadir a pantalla de inicio»."
          />
        ) : (
          <Centered
            title="Ábrelo en el móvil"
            body="Rackr Club se instala como una app en el teléfono. Mándate el enlace y ábrelo allí — o entra aquí, que en el escritorio funciona igual."
          >
            <div className="flex flex-wrap justify-center gap-2.5">
              <Button variant="secondary" onClick={share}>
                {copied ? "Enlace copiado" : "Copiar el enlace"}
              </Button>
              <Button variant="ghost" href="/coleccion">
                Entrar sin instalar
              </Button>
            </div>
          </Centered>
        )}
      </div>
    </>
  );
}

function Centered({
  title,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="text-center">
      <p className="text-heading font-medium text-paper">{title}</p>
      <p className="mx-auto mt-2 max-w-[38ch] text-sub leading-relaxed text-content-muted">
        {body}
      </p>
      {children && <div className="mt-6 flex justify-center">{children}</div>}
    </div>
  );
}

/**
 * The two taps, drawn rather than described.
 *
 * The second step is a row in a menu, so it shows the row: the same words and
 * the same glyph the sheet uses, which turns "look for it" into "recognise
 * it".
 */
function IosSteps() {
  return (
    <div>
      <p className="text-center text-heading font-medium text-paper">
        Dos toques y la tienes
      </p>
      <p className="mx-auto mt-2 max-w-[40ch] text-center text-sub leading-relaxed text-content-muted">
        En el iPhone ninguna web puede instalarse sola: lo decidió Apple y vale
        para todos los navegadores. Estos son los dos toques que hacen lo mismo.
      </p>

      <ol className="mx-auto mt-7 max-w-[380px] space-y-3">
        <li className="flex items-center gap-3.5 border border-line bg-fill-subtle/40 px-4 py-3.5">
          <Num>1</Num>
          <span className="min-w-0 flex-1 text-sub leading-snug text-content-secondary">
            {/* Not "Safari's bottom bar": in Chrome on the same phone the
                same button is at the top, and naming the wrong corner is worse
                than naming none — it sends someone looking where it is not. */}
            Toca <Share /> <b className="text-paper">Compartir</b>, en la barra
            de tu navegador.
          </span>
        </li>

        <li className="border border-line bg-fill-subtle/40 px-4 py-3.5">
          <div className="flex items-center gap-3.5">
            <Num>2</Num>
            <span className="min-w-0 flex-1 text-sub leading-snug text-content-secondary">
              Baja y elige esta fila:
            </span>
          </div>
          {/* the row as it looks in the sheet, so it is recognised and not hunted */}
          <div className="mt-3 flex items-center gap-3 rounded-[10px] bg-paper px-3.5 py-2.5">
            <span className="flex-1 text-[15px] font-medium text-ink">
              Añadir a pantalla de inicio
            </span>
            <svg
              width="17"
              height="17"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden
            >
              <rect
                x="1.4"
                y="1.4"
                width="15.2"
                height="15.2"
                rx="4"
                stroke="#0a0a0a"
                strokeWidth="1.3"
              />
              <path
                d="M9 5.4v7.2M5.4 9h7.2"
                stroke="#0a0a0a"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </li>
      </ol>
    </div>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return (
    <span className="mono flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-caption text-content-muted">
      {children}
    </span>
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
