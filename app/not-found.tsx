import Link from "next/link";

export const metadata = { title: "No encontrado" };

/** Somewhere to go from a dead link, instead of a browser error page. */
export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-ink px-6 text-center text-paper">
      <span className="mono text-[10px] uppercase tracking-[0.24em] text-paper/35">
        Error 404
      </span>
      <h1 className="max-w-[24ch] text-[28px] leading-tight">
        Este disco no está en la colección
      </h1>
      <p className="max-w-[42ch] text-[14px] text-paper/45">
        La página que buscas no existe, o su dueño la ha hecho privada.
      </p>
      <div className="mt-2 flex items-center gap-5">
        <Link
          href="/coleccion"
          className="bg-paper px-5 py-2 text-[13px] text-ink transition hover:bg-paper/85"
        >
          Ir al inicio
        </Link>
        <Link
          href="/explorar"
          className="mono text-[10px] uppercase tracking-[0.18em] text-paper/45 underline-offset-4 transition hover:text-paper hover:underline"
        >
          Explorar →
        </Link>
      </div>
    </main>
  );
}
