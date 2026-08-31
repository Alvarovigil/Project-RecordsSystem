"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SignInButton from "./SignInButton";
import EntryDoor from "./landing/EntryDoor";
import ShelfBackdrop from "./ShelfBackdrop";
import SoundGate from "./landing/SoundGate";
import AboutProject from "./landing/AboutProject";
import Reveal from "./landing/Reveal";
import AppDoor from "./landing/AppDoor";
import { ScreenClub, ScreenScan, ScreenWishlist } from "./landing/Screens";
import { useInstall } from "@/hooks/useInstall";

/**
 * The front door.
 *
 * Built like a record sleeve rather than a product page: the mark at the top,
 * the collection running full-bleed underneath, and the contents listed at the
 * foot of the first screen. Everything below is one chapter per idea, arriving
 * as you reach it.
 *
 * The shelf behind it all is the real carousel from the product, drifting and
 * inert — see ShelfBackdrop.
 */
export default function Landing() {
  const { ready, standalone } = useInstall();

  /**
   * Installed and signed out: the app's own first screen, not the pitch.
   *
   * The condition is `standalone`, never `!ready` — and that distinction is
   * the whole of it. This page is the public landing: it is server-rendered,
   * it is what a crawler and a first-time visitor receive, and holding it
   * blank until the client had measured would have shipped an empty document
   * to everyone to spare installed users a single frame. `ready` is false on
   * the server and true on the very first client render (the store measures
   * at import), so a home-screen launch swaps in the same commit — and the
   * only thing that would have been heavy about that frame, the WebGL shelf,
   * is a `ssr: false` dynamic import that has not begun to load yet.
   */
  if (ready && standalone) return <AppDoor />;

  return (
    <main className="relative bg-ink text-paper">
      <Backdrop />
      <StickyMark />
        {/**
       * The header is fixed with the mark it sits beside.
       *
       * Half a header that scrolls and half that does not is two headers.
       * The claim and the way in belong to the whole page, the same way the
       * wordmark does, so they stay in the corners while everything else
       * moves underneath. On a phone the mark is centred above them and this
       * row is what is left, so it starts below it.
       */}
      {/* Dimmed, not hidden, while the door is up: the corners keep saying
          what this is and where the way in is, without competing with the
          screen doing the introducing. */}
      {/**
       * Desktop only.
       *
       * On a phone the mark is centred at the top and there is no room beside
       * it for anything else — the claim printed through it and the sign-in
       * link sat on its shoulder. Both have somewhere better to be: the claim
       * is on the door, in the tab and on every shared card, and the way in is
       * the button in the middle of the screen that says Empezar gratis.
       */}
      <header
        className="landing-dims pointer-events-none fixed inset-x-0 top-0 z-[60] hidden items-start justify-between px-5 sm:flex sm:px-8"
        style={{ paddingTop: "calc(var(--safe-top) + 24px)" }}
      >
        {/* Not a link — the claim of the whole thing, held in the corner.
            Two sentences, and the full stop between them is doing the work:
            it makes the second half land as a separate promise rather than
            as a list of two nouns. */}
        <span className="max-w-[46vw] text-[11px] uppercase leading-tight tracking-[0.05em] text-paper/80 sm:max-w-none sm:text-[13px]">
          Your records. Your people.
        </span>

        <div className="pointer-events-auto">
          <SignInButton variant="quiet" />
        </div>
      </header>

      <SoundGate />
      <AboutProject />

      {/* ---------------------------------------------------------- screen 1 */}
      <section className="landing-hides relative z-10 flex min-h-[100svh] flex-col">
        {/**
         * On a phone this row held three things across 390 pixels: a two-line
         * claim, a 64px wordmark absolutely centred over the middle of it, and
         * a sign-in link — and they printed on top of each other. Stacked
         * instead: the mark first, in the middle, where a mark goes; the claim
         * under it; and signing in pinned to the corner on its own. From `sm`
         * up there is room for the row that was designed, and it comes back.
         */}
        {/* the contents of the record, at the foot of the sleeve */}
        {/* pb-28 on a phone: the now-playing bar and the "sobre el proyecto"
            link are both fixed to the bottom, and the index used to run
            straight underneath them. */}
        <div className="mt-auto px-5 pb-28 text-center sm:px-8 sm:pb-7">
          {/**
           * A door, not a caption.
           *
           * "Empieza por aquí" was a label pointing at four words that scroll
           * the page — an instruction about navigation on a screen whose job
           * is to get somebody in. This is the one place the landing asks for
           * anything, so it asks: a button, and the word that answers the
           * question everybody has about a thing like this before they answer
           * anything else.
           */}
          <EntryDoor variant="hero" />
          <ul className="mt-7 flex flex-col items-center leading-[0.92]">
            {INDEX.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="block text-[34px] uppercase tracking-[-0.01em] text-paper/85 transition hover:text-paper sm:text-[46px] md:text-[58px]"
                >
                  {c.word}
                </a>
              </li>
            ))}
          </ul>

          {/* the other door to Sobre el proyecto, for a screen with no spare
              corners — see AboutProject */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("rackr:about"))}
            className="mt-8 text-[11px] uppercase tracking-[0.05em] text-paper/60 transition hover:text-paper sm:hidden"
          >
            Sobre el proyecto
          </button>
        </div>
      </section>

      {/* ---------------------------------------------------------- the pillars */}
      <div className="landing-hides relative z-10 bg-ink">
        {/* what this is, before what it does: three verbs mean nothing until
            somebody says out loud what they are three verbs of */}
        <section
          id="el-club"
          className="scroll-mt-8 border-t border-paper/[0.07] px-5 py-24 sm:px-8 md:py-36"
        >
          <div className="mx-auto max-w-[1100px]">
            <Reveal>
              <p className="mono text-[10px] uppercase tracking-[0.24em] text-paper/35">
                El club
              </p>
              {/* the mark signs the section instead of naming it twice */}
              <h2 className="mt-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/logo.svg"
                  alt="Rackr Club"
                  className="h-[58px] w-auto sm:h-[76px] md:h-[92px]"
                />
              </h2>
              <p className="mt-7 max-w-[24ch] text-[26px] leading-[1.15] tracking-[-0.01em] text-paper sm:text-[34px] md:max-w-[26ch] md:text-[40px]">
                El sitio donde vive tu colección de vinilos.
              </p>
            </Reveal>

            <div className="mt-14 grid gap-10 md:grid-cols-2 md:gap-16">
              <Reveal delay={100}>
                <p className="max-w-[46ch] text-[17px] leading-relaxed text-paper/75 md:text-[19px]">
                  Un catálogo que no hay que teclear, una lista de deseos con
                  enlace y un club de gente con el mismo problema que tú. Eso es
                  todo, y da para bastante.
                </p>
                <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-paper/50">
                  Todo lo de aquí dentro sale de la misma idea: que una
                  colección es un objeto y no una biblioteca de streaming. Se
                  ordena a mano, se recorre funda a funda y se enseña entera.
                </p>
              </Reveal>

              <Reveal delay={180}>
                <p className="mono text-[10px] uppercase tracking-[0.2em] text-paper/35">
                  Lo que no es
                </p>
                <ul className="mt-5 max-w-[42ch] divide-y divide-paper/[0.08] border-y border-paper/[0.08]">
                  {NOT.map((n) => (
                    <li key={n} className="py-3 text-[14px] leading-relaxed text-paper/60">
                      {n}
                    </li>
                  ))}
                </ul>
                <p className="mt-6 max-w-[42ch] text-[15px] leading-relaxed text-paper/50">
                  Tu colección no es un muro que se mueve solo: si pasas dos
                  meses sin entrar, te espera exactamente igual de ordenada.
                </p>
              </Reveal>
            </div>

            <Reveal delay={240}>
              <p className="mono mt-16 text-[10px] uppercase tracking-[0.24em] text-paper/35">
                Y se resume en tres cosas
              </p>
            </Reveal>
          </div>
        </section>

        {/**
         * Each pillar: the claim across the full width, then the app beside
         * the detail.
         *
         * It used to be two columns of type and, sometimes, a row of small
         * covers at the end — five screens of argument about a product that
         * never appeared. A landing that only writes about a thing is asking
         * to be believed instead of looked at, which is the one thing a
         * landing cannot afford.
         *
         * The device is sticky on a desktop, so it holds while the specifics
         * scroll past it: the claim, the proof and the detail stay in the same
         * glance. On a phone it sits between the big line and the detail,
         * which is where the doubt appears.
         */}
        {PILLARS.map((p, i) => {
          const Screen = SCREENS[p.id];
          const flip = i % 2 === 1;
          return (
            <section
              key={p.id}
              id={p.id}
              className="scroll-mt-8 border-t border-paper/[0.07] px-5 py-24 sm:px-8 md:py-32"
            >
              <div className="mx-auto max-w-[1180px]">
                <Reveal>
                  <div className="flex items-baseline gap-4">
                    <span className="mono text-[10px] tracking-[0.24em] text-[#f83a23]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="mono text-[10px] uppercase tracking-[0.18em] text-paper/35">
                      {p.kicker}
                    </span>
                  </div>
                  <h2 className="mt-6 max-w-[15ch] text-[40px] uppercase leading-[0.92] tracking-[-0.015em] sm:text-[56px] md:text-[68px]">
                    {p.word}
                  </h2>
                  <p className="mt-7 max-w-[22ch] text-[26px] leading-[1.2] tracking-[-0.01em] text-paper sm:text-[32px] md:max-w-[24ch] md:text-[38px]">
                    {p.lead}
                  </p>
                </Reveal>

                <div
                  className={`mt-14 grid gap-12 md:mt-16 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-start md:gap-20 ${
                    flip ? "" : ""
                  }`}
                >
                  {/* The sticky element carries no transform of its own: the
                      reveal lives inside it. A translated ancestor is the
                      classic way a sticky column quietly stops sticking. */}
                  <div
                    className={`flex justify-center md:sticky md:top-[13vh] ${
                      flip ? "md:order-2" : ""
                    }`}
                  >
                    <Reveal delay={80}>
                      <Screen />
                    </Reveal>
                  </div>

                  <Reveal delay={140} className={flip ? "md:order-1" : ""}>
                    <p className="max-w-[46ch] text-[16px] leading-relaxed text-paper/70 md:text-[18px]">
                      {p.body}
                    </p>

                    {/* the specifics, so the big line above has something to
                        stand on. Three, never more: a fourth turns an argument
                        into a spec sheet. */}
                    <ul className="mt-10 max-w-[46ch] divide-y divide-paper/[0.08] border-y border-paper/[0.08]">
                      {p.points.map((pt) => (
                        <li key={pt.label} className="py-4">
                          <span className="mono block text-[10px] uppercase tracking-[0.16em] text-paper/35">
                            {pt.label}
                          </span>
                          <span className="mt-2 block text-[15px] leading-relaxed text-paper/80">
                            {pt.text}
                          </span>
                        </li>
                      ))}
                    </ul>

                    {/* the aside you would actually say out loud */}
                    <p className="mt-9 max-w-[42ch] border-l border-[#f83a23]/60 pl-5 text-[17px] leading-relaxed text-paper/90 md:text-[19px]">
                      {p.aside}
                    </p>
                  </Reveal>
                </div>
              </div>
            </section>
          );
        })}

        {/* ------------------------------------------------------- who it is for */}
        <section className="border-t border-paper/[0.07] px-5 py-28 sm:px-8 md:py-40">
          <Reveal className="mx-auto max-w-[900px] text-center">
            <p className="text-[26px] leading-[1.25] text-paper md:text-[38px]">
              Para quien ordena por sello, para quien ordena por lo que le
              apetece un martes y para quien lleva doce años sin prestar un
              disco.
            </p>
            <div className="mt-12">
              <EntryDoor variant="closing" />
            </div>
            <p className="mono mt-6 text-[10px] uppercase tracking-[0.2em] text-paper/25">
              Gratis · Sin anuncios · Cancela cuando quieras (no hay nada que cancelar)
            </p>
          </Reveal>
        </section>

        <footer className="border-t border-paper/[0.07] px-5 py-8 sm:px-8">
          <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 sm:flex-row">
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
              Rackr Club
            </span>
            <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
              Hecho por gente con demasiados discos
            </span>
          </div>
        </footer>
      </div>
    </main>
  );
}

/**
 * The shelf as wallpaper, dissolving upward into black so the sleeves stay
 * whole where nothing is written and disappear where the reading starts.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 select-none">
      <div className="landing-blur absolute inset-0">
        <ShelfBackdrop />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-ink from-[14%] via-ink/55 via-[52%] to-transparent" />
      <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-ink/80 to-transparent" />
      {/* There was a red bloom behind the wordmark here — the accent colour,
          at 6%, blurred across 620px. The accent earns its keep by being rare
          and by meaning something: it marks what is live or unread. Spent as
          atmosphere behind a logo it stops being a signal and starts being a
          tint, and it warmed the whole page off the near-black everything else
          is built on. */}
      <Grain />
    </div>
  );
}

/** Paper grain: the difference between "dark theme" and a room at night. */
/**
 * The wordmark, pinned to the window and shrinking as you go.
 *
 * A landing that scrolls past its own name loses the only thing every section
 * has in common. Keeping it fixed makes the mark the constant the page is hung
 * from — but at hero size it would sit on top of the writing, so it gives up
 * height as you leave the top: full size while you are still looking at the
 * cover, a signature by the time you are reading.
 *
 * Driven by scroll position rather than by a CSS animation because the size
 * has to be a function of where the page IS, not of how long something has
 * been running — you can arrive halfway down with a fragment link, or bounce
 * back up on a trackpad, and both have to land on the right size. Height and a
 * transform only, read once per frame.
 */
function StickyMark() {
  const [t, setT] = useState(0);
  /**
   * Small while the door is up.
   *
   * Behind the gate the page is out of focus and the screen belongs to the
   * introduction. A wordmark at hero size up there would be a second, sharper
   * title over a blurred one — so it goes to its scrolled size and waits, and
   * grows into place when you come in.
   */
  const [gated, setGated] = useState(false);
  useEffect(() => {
    const read = () => setGated(document.documentElement.dataset.landing === "gate");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-landing"] });
    return () => mo.disconnect();
  }, []);

  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      // over the first 40% of a screen: by the time the hero is leaving, the
      // mark has finished shrinking and stops competing with the text
      const span = window.innerHeight * 0.4;
      setT(Math.min(1, Math.max(0, window.scrollY / span)));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // eased so most of the shrink happens early and the last stretch settles
  const e = gated ? 1 : t * t * (3 - 2 * t);
  return (
    <div
      aria-hidden
      /**
       * No opacity on this wrapper, ever.
       *
       * The mark inverts against what is behind it — white over the page's
       * black, black over the white of a button passing underneath. Difference
       * blending only does that at full strength: at 92% the subtraction is
       * partial and both states come out grey, which is the muddle it was in.
       * Dimming for the gate is done on this same class in CSS, where it is a
       * deliberate, temporary state rather than a permanent tax.
       */
      className="landing-dims pointer-events-none fixed left-1/2 z-[60] -translate-x-1/2"
      /**
       * Below the notch, not under it.
       *
       * Installed to a home screen this page runs edge to edge — that is the
       * point of viewport-fit=cover and the translucent status bar — so a mark
       * pinned to `top: 16px` ends up behind the dynamic island. The safe-area
       * inset is zero in a browser tab and the height of the island in the
       * installed app, which is exactly the difference that needs measuring.
       */
      style={{ top: "calc(var(--safe-top) + 16px)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {/**
       * Inverted against whatever it is over.
       *
       * `difference` subtracts what is underneath, so the mark is white on the
       * black of the page and turns into the negative of a sleeve as one
       * passes behind it — which is the one moment this page has where the
       * artwork and the name are the same object. It also solves the problem
       * the drop shadow was solving badly: a white wordmark over a pale cover
       * used to disappear, and now it cannot, because it is defined by
       * contrast rather than by lying on top.
       */}
      <img
        src="/logo.svg"
        alt="Rackr Club"
        className="w-auto mix-blend-difference transition-[height] duration-slow ease-out"
        style={{ height: `calc(var(--mark-max) - (var(--mark-max) - var(--mark-min)) * ${e})` }}
      />
    </div>
  );
}

function Grain() {
  return (
    <div
      className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
      }}
    />
  );
}

/** the first screen doubles as the table of contents */
const INDEX = [
  { id: "el-club", word: "El club" },
  { id: "colecciona", word: "Colecciona" },
  { id: "proyecta", word: "Proyecta" },
  { id: "comparte", word: "Comparte" },
];

const NOT = [
  "No es una tienda: aquí no se compra ni se vende nada.",
  "No es una app de notas con portadas bonitas.",
  "No hay anuncios ni recomendaciones automáticas.",
  "No hay que puntuar los discos del uno al diez.",
];

/**
 * Three pillars, and each one is an argument rather than a feature list.
 *
 * The order is the order somebody actually meets the product: the question
 * that stops you in a shop, the thing you are still looking for, and the
 * people who have it. Every pillar carries one line you would say out loud,
 * three specifics under it so the big line has something to stand on, and a
 * screen of the real app beside it — because a landing that only writes about
 * a product is asking to be believed rather than looked at.
 */
/** which moment of the app argues for which pillar */
const SCREENS: Record<string, (p: { scale?: number }) => JSX.Element> = {
  colecciona: ScreenScan,
  proyecta: ScreenWishlist,
  comparte: ScreenClub,
};

const PILLARS = [
  {
    id: "colecciona",
    word: "Colecciona",
    kicker: "Del código de barras a tu estantería",
    lead: "«¿Este ya lo tengo?», respondido en dos segundos.",
    body:
      "Es la pregunta que te para de pie en una tienda, y hasta ahora se contestaba de memoria o no se contestaba. Apuntas al código de la contraportada y aparece el disco que tienes en la mano: su año, su país, su sello y su número de catálogo. No el álbum en abstracto — esa prensa.",
    points: [
      {
        label: "Escanear",
        text: "Uno, o la estantería entera de una sentada. Nada se guarda hasta que tú lo dices.",
      },
      {
        label: "La prensa",
        text: "Formato, sello, catálogo y lo que hay grabado en el surco de salida.",
      },
      {
        label: "Tu orden",
        text: "Por sello, por año o a mano. Nadie te reordena la colección por detrás.",
      },
    ],
    aside:
      "Escanear para mirar vale tanto como escanear para quedárselo. Por eso leer un disco y guardarlo son dos botones distintos.",
  },
  {
    id: "proyecta",
    word: "Proyecta",
    kicker: "Lo que persigues, encima",
    lead: "Una lista de deseos que se puede enseñar.",
    body:
      "Lo que buscas vive aparte de lo que ya tienes: un disco está en una o en la otra, nunca en las dos. Lo llevas encima cuando sales de caza, y el día que cae uno, un toque y cambia de sitio.",
    points: [
      {
        label: "Ya lo tengo",
        text: "Un tic sobre la portada y pasa a tu colección. Con deshacer, por si el tic fue el dedo.",
      },
      {
        label: "Con enlace",
        text: "Se manda entera, en vez de una captura de pantalla la semana de tu cumpleaños.",
      },
      {
        label: "Sin repetir",
        text: "La app sabe lo que tienes, así que sabe lo que te falta.",
      },
    ],
    aside: "Nadie ha comprado nunca dos veces el mismo disco a propósito.",
  },
  {
    id: "comparte",
    word: "Comparte",
    kicker: "Los discos llevan a la gente",
    lead: "Tu colección es la puerta a las demás.",
    body:
      "Desde cualquier disco ves quién más lo tiene y en qué racks vive. Sigues a alguien porque tiene buen oído, ves lo que va metiendo y te llevas cosas a tu estantería. Lo que pasa en una tienda cuando miras qué lleva en la mano el de al lado.",
    points: [
      {
        label: "Racks",
        text: "Agrupa por sello, por género o por un viaje. Cada uno con su propio enlace.",
      },
      {
        label: "Quién lo tiene",
        text: "Primero los que sigues, después el resto del club.",
      },
      {
        label: "Sin algoritmo",
        text: "Lo que añaden aparece tal cual, por orden de llegada. Nadie decide por ti qué merece verse.",
      },
    ],
    aside: "Aquí no se compite por tener más. Se cotillea, que es otra cosa.",
  },
];
