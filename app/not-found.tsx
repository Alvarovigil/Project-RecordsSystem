import Link from "next/link";
import data from "@/data/vinilos.json";
import NotFoundTrain from "@/components/NotFoundTrain";

export const metadata = { title: "No encontrado" };

/**
 * Somewhere to go from a dead link, instead of a browser error page.
 *
 * A 404 is the one screen nobody designs and everybody sees. This one is made
 * of the same material as the rest — a train of sleeves crossing the screen
 * and bouncing off the edges, which is the old screensaver everybody has
 * watched waiting for a corner hit, and the right joke for a page that has
 * nowhere to be.
 *
 * The type sits over it and the way out sits under that. However good the
 * animation is, somebody arrived here by accident: the two links are the
 * point, and they are the only things on the page that can be pressed.
 */

/** Ten covers off the demo shelf: files that are already on disk. */
const COVERS = (data as { cover?: string }[])
  .map((v) => v.cover)
  .filter((c): c is string => Boolean(c?.startsWith("/covers/")))
  .slice(0, 10);

export default function NotFound() {
  return (
    <main className="relative flex min-h-screen-d flex-col items-center justify-center overflow-hidden bg-ink px-6 text-center text-paper">
      <NotFoundTrain covers={COVERS} />

      {/* the sleeves pass behind the words, not over them */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(10,10,10,0.6)_0%,rgba(10,10,10,0.2)_52%,rgba(10,10,10,0)_100%)]"
      />

      <div className="relative flex flex-col items-center">
        <h1 className="text-[22vw] font-medium leading-[0.82] tracking-[-0.04em] text-paper sm:text-[16vw] md:text-[180px]">
          404
        </h1>
        <p className="mt-5 max-w-[26ch] text-body leading-snug text-content-secondary sm:text-[17px]">
          Este disco no está en la colección.
        </p>
        <p className="mt-1.5 max-w-[34ch] text-sub text-content-muted">
          La página que buscas no existe, o su dueño la ha hecho privada.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/coleccion"
            className="pressable rounded-full bg-paper px-5 py-2.5 text-sub font-medium text-ink transition-colors hover:bg-paper/85"
          >
            Ir a mi colección
          </Link>
          <Link
            href="/explorar"
            className="pressable rounded-full border border-line-strong px-5 py-2.5 text-sub text-paper transition-colors hover:border-line-focus"
          >
            Explorar
          </Link>
        </div>
      </div>
    </main>
  );
}
