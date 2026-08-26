import Link from "next/link";
import SignInButton from "./SignInButton";
import ShelfBackdrop from "./ShelfBackdrop";
import SoundGate from "./landing/SoundGate";
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
      <SoundGate />

      {/* ---------------------------------------------------------- screen 1 */}
      <section className="landing-hides relative z-10 flex min-h-[100svh] flex-col">
        <header className="flex items-start justify-between px-5 py-6 sm:px-8">
          <Link
            href="/demo"
            className="text-[13px] uppercase tracking-[0.04em] text-paper transition hover:text-paper/60 sm:text-[15px]"
          >
            Ver una colección
          </Link>

          {/* the mark, centred over everything, sized to be looked at */}
          <div className="pointer-events-none absolute left-1/2 top-5 -translate-x-1/2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logo.svg"
              alt="Rackr Club"
              className="h-[64px] w-auto drop-shadow-[0_8px_36px_rgba(0,0,0,0.95)] sm:h-[92px] md:h-[120px]"
            />
          </div>

          <SignInButton variant="quiet" />
        </header>

        {/* the contents of the record, at the foot of the sleeve */}
        <div className="mt-auto px-5 pb-24 text-center sm:px-8">
          <p className="mono text-[10px] uppercase tracking-[0.3em] text-paper/50">
            Esto va de tres cosas
          </p>
          <ul className="mt-6 flex flex-col items-center leading-[0.92]">
            {PILLARS.map((c) => (
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
        </div>
      </section>

      {/* ---------------------------------------------------------- the pillars */}
      <div className="landing-hides relative z-10 bg-ink">
        {/* what this is, before what it does: three verbs mean nothing until
            somebody says out loud what they are three verbs of */}
        <section className="scroll-mt-8 border-t border-paper/[0.07] px-5 py-24 sm:px-8 md:py-36">
          <div className="mx-auto max-w-[1100px]">
            <Reveal>
              <p className="mono text-[10px] uppercase tracking-[0.24em] text-paper/35">
                Qué es esto
              </p>
              <h2 className="mt-7 max-w-[19ch] text-[34px] leading-[1.08] tracking-[-0.015em] sm:text-[46px] md:text-[58px]">
                Rackr Club es el sitio donde vive tu colección de vinilos.
              </h2>
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
                  Tu estantería no es un muro que se mueve solo: si pasas dos
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
      <div className="absolute left-1/2 top-[8vh] h-[380px] w-[620px] -translate-x-1/2 rounded-full bg-[#f83a23]/[0.06] blur-[130px]" />
      <Grain />
    </div>
  );
}

/** Paper grain: the difference between "dark theme" and a room at night. */
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

const NOT = [
  "No es una tienda: aquí no se compra ni se vende nada.",
  "No es una app de notas con portadas bonitas.",
  "No hay anuncios ni recomendaciones automáticas.",
  "No hay que puntuar los discos del uno al diez.",
];

const PILLARS = [
  {
    id: "coleccion",
    word: "Colecciona",
    kicker: "Tu colección, en un sitio y en tu orden",
    lead: "Escanea el código de barras y el disco ya está dentro.",
    body: "Entra con su portada, su ficha y un trozo que suena, sin que teclees el título ni lo busques en tres webs. Después lo colocas donde quieras: el turno de noche, los domingos largos, los que no pondrías con gente delante. Tu colección, con tu lógica rara.",
    points: [
      { label: "Escanear", text: "Apuntas con la cámara y sigue abierta: puedes vaciar una balda de una sentada." },
      { label: "Ordenar", text: "Listas propias y el orden que decidas. Nadie te reordena la estantería por detrás." },
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
    id: "deseos",
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
    id: "comunidad",
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
