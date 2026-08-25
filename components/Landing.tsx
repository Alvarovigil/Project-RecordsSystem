import Link from "next/link";
import SignInButton from "./SignInButton";

/**
 * The front door.
 *
 * The mark takes the middle of the screen and the product runs behind it: the
 * shelf, drifting past on its own. None of it is interactive — a visitor
 * shouldn't download the 3D engine to read a headline — but it is the real
 * artwork from the real catalogue, so the first thing you see is the thing
 * itself rather than a drawing of it.
 */
export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-paper">
      <Backdrop />

      <header className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-8">
        <span className="mono text-[10px] uppercase tracking-[0.24em] text-paper/30">
          Club de coleccionistas
        </span>
        <SignInButton variant="quiet" />
      </header>

      {/* the mark, centre stage */}
      <section className="relative z-10 mx-auto flex max-w-[780px] flex-col items-center px-6 pt-[13vh] text-center">
        <div className="rise-in relative">
          {/* the platter turns behind the wordmark, not around it */}
          <span
            aria-hidden
            className="platter pointer-events-none absolute left-1/2 top-1/2 -z-10 h-[340px] w-[340px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-[0.55] md:h-[440px] md:w-[440px]"
            style={{
              background:
                "repeating-radial-gradient(circle at center, rgba(245,243,238,0.05) 0 1px, transparent 1px 4px), radial-gradient(circle at center, #f83a23 0 5%, #14100f 5% 30%, #0d0c0b 70%, transparent 72%)",
            }}
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Rackr Club"
            className="h-[74px] w-auto drop-shadow-[0_10px_40px_rgba(0,0,0,0.9)] sm:h-[104px] md:h-[132px]"
          />
        </div>

        <p className="rise-in mt-8 max-w-[34ch] text-[17px] leading-relaxed text-paper/70 [animation-delay:120ms] md:text-[19px]">
          Los discos que tienes, ordenados como tú los ordenas. Y la gente que
          tiene los mismos.
        </p>

        <div className="rise-in mt-9 flex flex-col items-center gap-5 [animation-delay:220ms] sm:flex-row">
          <SignInButton />
          <Link
            href="/demo"
            className="group mono flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-paper/45 transition hover:text-paper"
          >
            Ver una colección de ejemplo
            <span className="transition group-hover:translate-x-0.5">→</span>
          </Link>
        </div>

        <p className="rise-in mono mt-5 text-[10px] uppercase tracking-[0.18em] text-paper/25 [animation-delay:300ms]">
          Sin registro · Suena de verdad
        </p>
      </section>

      {/* what it actually does, stated once each */}
      <section className="relative z-10 mx-auto mt-[16vh] max-w-[1000px] px-6">
        <ul className="grid grid-cols-1 gap-px bg-paper/[0.08] sm:grid-cols-3">
          {FEATURES.map((f, i) => (
            <li key={f.title} className="group bg-ink/95 px-6 py-8 backdrop-blur-sm">
              <span className="mono text-[10px] tracking-[0.2em] text-[#f83a23]">
                0{i + 1}
              </span>
              <h2 className="mt-4 text-[17px] leading-snug">{f.title}</h2>
              <p className="mt-2.5 text-[13px] leading-relaxed text-paper/55">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* the closing invitation, so the page doesn't end on a feature grid */}
      <section className="relative z-10 mx-auto mt-24 max-w-[780px] px-6 text-center">
        <p className="text-[22px] leading-snug text-paper/85 md:text-[26px]">
          Una estantería vale más cuando alguien más la mira.
        </p>
        <div className="mt-8 flex justify-center">
          <SignInButton />
        </div>
      </section>

      <footer className="relative z-10 mt-24 border-t border-paper/[0.07] px-8 py-8">
        <div className="mx-auto flex max-w-[1000px] flex-col items-center justify-between gap-3 sm:flex-row">
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
            Rackr Club
          </span>
          <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
            Hecho para coleccionistas
          </span>
        </div>
      </footer>
    </main>
  );
}

/**
 * Two rows of sleeves crossing in opposite directions, tilted like a shelf
 * seen from a stool. Decorative and inert: no hover, no clicks, no engine.
 */
function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 select-none">
      <div className="absolute inset-x-0 top-[6vh] flex flex-col gap-6 opacity-[0.38] blur-[1.5px]">
        <ShelfRow covers={ROW_A} className="shelf-drift" tilt={9} />
        <ShelfRow covers={ROW_B} className="shelf-drift-slow" tilt={-7} />
      </div>

      {/* the page has to stay readable on top of all that */}
      <div className="absolute inset-0 bg-gradient-to-b from-ink/70 via-ink/92 to-ink" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(10,10,10,0.75)_75%)]" />
      {/* a single warm ember behind the mark, the only colour on the page */}
      <div className="absolute left-1/2 top-[26vh] h-[420px] w-[620px] -translate-x-1/2 rounded-full bg-[#f83a23]/[0.07] blur-[130px]" />
      <Grain />
    </div>
  );
}

function ShelfRow({
  covers,
  className,
  tilt,
}: {
  covers: string[];
  className: string;
  tilt: number;
}) {
  return (
    <div
      className="overflow-hidden"
      style={{
        maskImage:
          "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
        WebkitMaskImage:
          "linear-gradient(to right, transparent, #000 12%, #000 88%, transparent)",
      }}
    >
      <div
        className={`flex w-max gap-3 ${className}`}
        style={{ transform: `rotate(${tilt / 6}deg)` }}
      >
        {/* the same covers twice: the loop is a translation of exactly half */}
        {[...covers, ...covers].map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading="lazy"
            className="h-[170px] w-[170px] shrink-0 object-cover shadow-[0_20px_50px_rgba(0,0,0,0.65)] md:h-[220px] md:w-[220px]"
            style={{ transform: `perspective(1200px) rotateY(${tilt}deg)` }}
          />
        ))}
      </div>
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

const ROW_A = [
  "/covers/tame-impala-currents-7252111.jpg",
  "/covers/fleetwood-mac-rumours-526351.jpg",
  "/covers/eagles-hotel-california-1571555.jpg",
  "/covers/rosalia-lux-35578378.jpg",
  "/covers/led-zeppelin-led-zeppelin-iv-1015465.jpg",
  "/covers/billie-eilish-hit-me-hard-and-soft-34773263.jpg",
  "/covers/dire-straits-brothers-in-arms-2462721.jpg",
  "/covers/gorillaz-demon-days-36145336.jpg",
];

const ROW_B = [
  "/covers/etta-james-at-last-5466884.jpg",
  "/covers/various-pulp-fiction-music-from-the-motion-picture-376354.jpg",
  "/covers/rosalia-motomami-23206178.jpg",
  "/covers/cypress-hill-black-sunday-12387973.jpg",
  "/covers/bad-bunny-debi-tirar-mas-fotos-35474179.jpg",
  "/covers/estopa-estopa-9267144.jpg",
  "/covers/hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571.jpg",
  "/covers/elton-john-diamonds-13731060.jpg",
];

const FEATURES = [
  {
    title: "Cataloga sin teclear",
    body: "Escanea el código de barras del vinilo y entra con su portada, su ficha y un adelanto de audio. Uno detrás de otro.",
  },
  {
    title: "Listas con criterio",
    body: "El turno de noche, los domingos largos, lo que te falta por comprar. Tu colección ordenada como la piensas.",
  },
  {
    title: "Y quién más lo tiene",
    body: "Cada disco es una puerta: mira en qué listas de otros aparece y entra en las colecciones donde vive.",
  },
];
