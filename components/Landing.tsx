import Link from "next/link";
import SignInButton from "./SignInButton";

/**
 * What someone sees before they have an account.
 *
 * It says what this is, shows the shelf as a still image rather than the live
 * 3D scene (a visitor shouldn't download the engine to read a headline), and
 * offers exactly two doors: sign in, or look around without an account.
 */
export default function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-ink text-paper">
      {/* the collection, blurred back into a backdrop */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-x-0 bottom-0 top-[42%] opacity-40 blur-[2px]">
          <div className="flex h-full items-end justify-center gap-1 px-4">
            {COVERS.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={src}
                src={src}
                alt=""
                className="h-[52%] w-[9%] min-w-[70px] object-cover"
                style={{
                  transform: `perspective(900px) rotateY(${(i - 5) * 7}deg) translateY(${
                    Math.abs(i - 5) * 6
                  }px)`,
                }}
              />
            ))}
          </div>
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-ink/85 to-ink/95" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-8 py-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.svg" alt="RackrClub" className="h-5 w-auto opacity-80" />
        <SignInButton variant="quiet" />
      </header>

      <section className="relative z-10 mx-auto flex max-w-[760px] flex-col items-center px-6 pt-[14vh] text-center">
        <p className="mono text-[10px] uppercase tracking-[0.28em] text-paper/40">
          Tu colección de vinilos
        </p>
        <h1 className="mt-5 text-[44px] font-medium leading-[1.05] tracking-tight md:text-[60px]">
          Los discos que tienes,
          <br />
          y quién más los tiene
        </h1>
        <p className="mt-6 max-w-[46ch] text-[15px] leading-relaxed text-paper/55">
          Cataloga tu colección, ordénala en listas y escúchala. Cada disco es
          una puerta: mira en qué listas de otros aparece y descubre lo que
          guardan.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row">
          <SignInButton />
          <Link
            href="/demo"
            className="mono text-[10px] uppercase tracking-[0.2em] text-paper/45 underline-offset-4 transition hover:text-paper hover:underline"
          >
            Ver sin cuenta →
          </Link>
        </div>

        <ul className="mt-20 grid w-full grid-cols-1 gap-px bg-paper/[0.07] text-left sm:grid-cols-3">
          {FEATURES.map((f) => (
            <li key={f.title} className="bg-ink px-5 py-6">
              <h2 className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">
                {f.title}
              </h2>
              <p className="mt-2 text-[13px] leading-relaxed text-paper/60">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <footer className="relative z-10 mt-24 px-8 py-8 text-center">
        <p className="mono text-[10px] uppercase tracking-[0.2em] text-paper/25">
          Rackr · hecho para coleccionistas
        </p>
      </footer>
    </main>
  );
}

const COVERS = [
  "/covers/tame-impala-currents-7252111.jpg",
  "/covers/fleetwood-mac-rumours-526351.jpg",
  "/covers/eagles-hotel-california-1571555.jpg",
  "/covers/rosalia-lux-35578378.jpg",
  "/covers/led-zeppelin-led-zeppelin-iv-1015465.jpg",
  "/covers/billie-eilish-hit-me-hard-and-soft-34773263.jpg",
  "/covers/dire-straits-brothers-in-arms-2462721.jpg",
  "/covers/gorillaz-demon-days-36145336.jpg",
  "/covers/cypress-hill-black-sunday-12387973.jpg",
  "/covers/bad-bunny-debi-tirar-mas-fotos-35474179.jpg",
  "/covers/estopa-estopa-9267144.jpg",
];

const FEATURES = [
  {
    title: "Tu estantería",
    body: "Añade discos desde Discogs con su portada, su ficha y un adelanto de audio. Ordénalos como quieras.",
  },
  {
    title: "Listas",
    body: "Agrupa por lo que sea: sesiones de domingo, rarezas de mercadillo, lo que te falta por comprar.",
  },
  {
    title: "Comunidad",
    body: "Sigue a otras personas y sus listas. Desde cualquier disco llegas a las colecciones donde vive.",
  },
];
