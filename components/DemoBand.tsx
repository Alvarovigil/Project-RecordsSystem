import Link from "next/link";

/**
 * «Colección de ejemplo», siempre a la vista en el teléfono.
 *
 * /demo ya no tiene enlaces dentro de la app (F4), pero se abre escribiendo la
 * dirección o desde un enlace viejo, y enseñaba «Mi Colección 40» como si fuera
 * tuya. F4 decidió que puede quedarse con una banda visible; esta es la banda.
 *
 * Se pinta en el servidor, desde el primer byte, y no tapa nada: ocupa la franja
 * de arriba y empuja `--safe-top` lo que mide, así que todas las cabeceras que ya
 * respetan la zona segura bajan con ella sin tocarlas una a una. En el
 * ordenador manda el aviso que ya tenía la estantería (DemoNotice).
 */
/* La altura sale del token (--band-h, en rem): con la letra al 130 % la banda
   crece con ella y el texto cabe en dos líneas en vez de cortarse. */
const BAND_H = "var(--band-h)";
const PHONE = "(max-width: 767px), (pointer: coarse)";

export default function DemoBand() {
  return (
    <>
      <style>{`
        .demo-band { display: none; }
        @media ${PHONE} {
          :root { --safe-top: calc(env(safe-area-inset-top, 0px) + ${BAND_H}); }
          .demo-band { display: flex; }
        }
      `}</style>
      <aside
        aria-label="Colección de ejemplo"
        /* de cristal, como las demás barras de arriba en el teléfono: se lee
           igual sin un corte recto encima de la estantería */
        className="demo-band fixed inset-x-0 top-0 z-[95] items-center justify-center gap-3 border-b border-line bg-ink/70 px-4 text-caption leading-tight text-content-secondary backdrop-blur-xl"
        style={{
          paddingTop: "env(safe-area-inset-top, 0px)",
          height: `calc(env(safe-area-inset-top, 0px) + ${BAND_H})`,
        }}
      >
        <span className="line-clamp-2 min-w-0">Colección de ejemplo: no se guarda nada</span>
        <Link
          href="/entrar?next=%2Fcoleccion"
          className="pressable hit flex shrink-0 items-center font-medium text-content underline underline-offset-4"
        >
          Entrar
        </Link>
      </aside>
    </>
  );
}
