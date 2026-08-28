"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SignInButton from "./SignInButton";
import ShelfBackdrop from "./ShelfBackdrop";
import SoundGate from "./landing/SoundGate";
import AboutProject from "./landing/AboutProject";
import Reveal from "./landing/Reveal";

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
          <Link
            href="/coleccion"
            // select-none: dragging across a white pill used to leave the
            // page's own selection colour — paper on paper — which looked
            // like the button was breaking rather than being highlighted
            className="pressable inline-flex h-9 select-none items-center rounded-full bg-paper px-4 text-[12px] font-medium uppercase tracking-[0.07em] text-ink transition-colors hover:bg-paper/85"
          >
            Empezar gratis
          </Link>
          <ul className="mt-7 flex flex-col items-center leading-[0.92]">
            {INDEX.map((c) => (
              <li key={c.id}>
                <a
                  href={`#${c.id}`}
                  className="group block text-[34px] uppercase tracking-[-0.01em] text-paper/85 transition hover:text-paper sm:text-[46px] md:text-[58px]"
                >
                  {/* EL CLⓊB. The U becomes a record when you point at it —
                      the one letter in the word that is already the right
                      shape. A joke that costs nothing and only ever appears to
                      somebody who was reaching for it anyway. */}
                  {c.id === "el-club" ? (
                    <>
                      El cl
                      <span className="relative inline-block">
                        <span className="transition-opacity duration-fast group-hover:opacity-0">
                          u
                        </span>
                        <span
                          aria-hidden
                          className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-fast group-hover:opacity-100"
                        >
                          {/* Sized and dropped to sit where the U sits: a
                              record on the baseline, not a full-height O
                              floating in the middle of a word. */}
                          <span className="block aspect-square w-[0.52em] translate-y-[0.08em] rounded-full border-[0.06em] border-current" />
                          <span className="absolute block aspect-square w-[0.08em] translate-y-[0.08em] rounded-full bg-current" />
                        </span>
                      </span>
                      b
                    </>
                  ) : (
                    c.word
                  )}
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
                Sobre nosotros
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
                  Un catálogo que no tienes que teclear, una lista de deseos que
                  se puede enseñar y un puñado de gente con el mismo problema
                  que tú. Eso es todo, y es bastante.
                </p>
                <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-paper/50">
                  Empezó por una pregunta tonta que se ha hecho cualquiera de
                  pie en una tienda, con un disco en la mano y sin cobertura:
                  «¿este ya lo tengo?». De ahí salió el escáner, y del escáner
                  salió lo demás.
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

        {PILLARS.map((p, i) => (
          <section
            key={p.id}
            id={p.id}
            className="scroll-mt-8 border-t border-paper/[0.07] px-5 py-24 sm:px-8 md:py-36"
          >
            <div className="mx-auto max-w-[1100px]">
              <div className="grid gap-10 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] md:gap-16">
                <Reveal>
                  <span className="mono text-[10px] tracking-[0.24em] text-[#f83a23]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <h2 className="mt-5 text-[40px] uppercase leading-[0.92] tracking-[-0.015em] sm:text-[56px] md:text-[64px]">
                    {p.word}
                  </h2>
                  <p className="mono mt-5 max-w-[26ch] text-[11px] uppercase leading-relaxed tracking-[0.14em] text-paper/35">
                    {p.kicker}
                  </p>
                </Reveal>

                <Reveal delay={110} className="md:pt-16">
                  <p className="text-[24px] leading-[1.3] text-paper md:text-[30px]">
                    {p.lead}
                  </p>
                  <p className="mt-6 max-w-[48ch] text-[15px] leading-relaxed text-paper/55">
                    {p.body}
                  </p>

                  {/* the specifics, so the big line above has something under it */}
                  <ul className="mt-10 max-w-[48ch] divide-y divide-paper/[0.08] border-y border-paper/[0.08]">
                    {p.points.map((pt) => (
                      <li key={pt.label} className="flex gap-5 py-3.5">
                        <span className="mono w-[92px] shrink-0 pt-1 text-[10px] uppercase tracking-[0.16em] text-paper/30">
                          {pt.label}
                        </span>
                        <span className="text-[14px] leading-relaxed text-paper/75">
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

              {p.covers && (
                <Reveal delay={220}>
                  <ul className="mt-14 flex gap-3 overflow-hidden md:justify-end">
                    {p.covers.map((src) => (
                      <li key={src} className="w-[92px] shrink-0 sm:w-[120px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt=""
                          loading="lazy"
                          className="aspect-square w-full object-cover shadow-[0_18px_44px_rgba(0,0,0,0.75)]"
                        />
                      </li>
                    ))}
                  </ul>
                </Reveal>
              )}
            </div>
          </section>
        ))}

        {/* ------------------------------------------------------- who it is for */}
        <section className="border-t border-paper/[0.07] px-5 py-28 sm:px-8 md:py-40">
          <Reveal className="mx-auto max-w-[900px] text-center">
            <p className="text-[26px] leading-[1.25] text-paper md:text-[38px]">
              Para quien ordena por sello, para quien ordena por lo que le
              apetece un martes y para quien lleva doce años sin prestar un
              disco.
            </p>
            <div className="mt-12 flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
              <SignInButton />
              <Link
                href="/demo"
                className="group mono flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-paper/45 transition hover:text-paper"
              >
                Ver una colección de ejemplo
                <span className="transition group-hover:translate-x-0.5">→</span>
              </Link>
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

const PILLARS = [
  {
    id: "colecciona",
    word: "Colecciona",
    kicker: "Tu colección, en un sitio y en tu orden",
    lead: "Escanea el código de barras y el disco ya está dentro.",
    body: "Entra con su portada, su ficha y un trozo que suena, sin que teclees el título ni lo busques en tres webs. Después lo colocas donde quieras: el turno de noche, los domingos largos, los que no pondrías con gente delante. Tu colección, con tu lógica rara.",
    points: [
      { label: "Escanear", text: "Apuntas con la cámara y sigue abierta: puedes vaciar una balda de una sentada." },
      { label: "Ordenar", text: "Listas propias y el orden que decidas. Nadie te reordena la colección por detrás." },
      { label: "Sonar", text: "Cada disco trae un adelanto. Una colección muda es un inventario." },
    ],
    aside: "Y sí: por fin vas a saber si ese disco ya lo tienes. Todos hemos comprado alguno dos veces; casi nadie lo cuenta.",
    covers: [
      "/covers/rosalia-lux-35578378.jpg",
      "/covers/tame-impala-currents-7252111.jpg",
      "/covers/noga-erez-the-vandalist-31803860.jpg",
      "/covers/fleetwood-mac-rumours-526351.jpg",
    ],
  },
  {
    id: "proyecta",
    word: "Proyecta",
    kicker: "Tu lista de deseos, aparte y con enlace",
    lead: "Una lista de deseos que se puede enseñar.",
    body: "Lo que persigues vive separado de lo que ya tienes: un disco está en una lista o en la otra, nunca en las dos. Y como tiene enlace propio, la compartes con quien nunca sabe qué regalarte. O la dejas caer en el grupo, sin decir nada. Cada uno con su método.",
    points: [
      { label: "Separado", text: "Deseos y colección no se mezclan, así que sabes qué te falta de verdad." },
      { label: "Compartible", text: "Un enlace y ya. Sin capturas de pantalla ni listas en las notas del móvil." },
      { label: "De un toque", text: "El día que cae en tus manos pasa a la colección, y la lista se queda limpia." },
    ],
    aside: "Es una carta a los Reyes con URL. Funciona en cumpleaños, en Navidad y en cualquier conversación que empiece por «no sé qué comprarte».",
    covers: [
      "/covers/bad-bunny-debi-tirar-mas-fotos-35474179.jpg",
      "/covers/cypress-hill-black-sunday-12387973.jpg",
      "/covers/elvis-presley-hits-in-red-10634709.jpg",
    ],
  },
  {
    id: "comparte",
    word: "Comparte",
    kicker: "Sigue a gente y llévate lo que veas",
    lead: "Los discos llevan a la gente.",
    body: "Desde cualquier vinilo ves en qué otras colecciones vive y quién lo tiene. Ahí empieza todo: sigues a quien tenga buen oído, ves lo que va metiendo y te lo llevas a tu lista. Tú publicas las tuyas y alguien hará lo mismo contigo.",
    points: [
      { label: "El puente", text: "Cada disco enseña las colecciones donde también está. Se llega a la gente por lo que guarda." },
      { label: "Seguir", text: "Personas y listas. Lo que añaden aparece en tus novedades, sin ordenar por popularidad." },
      { label: "Robar", text: "Ves una lista que te puede, la sigues y te llevas los discos a la tuya. Está permitido." },
    ],
    aside: "El mejor algoritmo de recomendación sigue siendo alguien con mejor gusto que tú. Aquí lo llamamos seguir a la gente.",
    covers: [
      "/covers/etta-james-at-last-5466884.jpg",
      "/covers/dire-straits-brothers-in-arms-2462721.jpg",
      "/covers/various-pulp-fiction-music-from-the-motion-picture-376354.jpg",
      "/covers/gorillaz-demon-days-36145336.jpg",
    ],
  },
];
