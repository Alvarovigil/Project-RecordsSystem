"use client";

import Link from "next/link";
import SharedMark from "@/components/ui/SharedMark";
import { rackCaption, type RackView } from "@/lib/rack";

/**
 * Un rack, en una línea. La única.
 *
 * Un rack aparece en seis sitios — la estantería, la hoja de guardar, el
 * buscador, la ficha de un disco, un perfil, el panel de colecciones — y hasta
 * ahora cada uno se había maquetado la suya: una con avatar y otra con
 * portada, una con la firma encima del número y otra al revés, una con tokens
 * y otra con `text-[14px] text-paper/90`. Seis maquetaciones del mismo objeto
 * son seis sitios donde arreglar la misma cosa, y el usuario acaba sin saber
 * si está mirando lo mismo.
 *
 * Así que hay dos formas de enseñar un rack y solo dos: {@link RackCard} en
 * grande, con su cajón, para cuando el rack es lo que se está ofreciendo — y
 * esta fila para cuando es una opción dentro de una lista. Con dos densidades,
 * porque una hoja de acciones y un resultado de búsqueda no piden el mismo
 * aire, pero nada más.
 *
 * `density`:
 * - `tile` — la fila con superficie propia, marca de 44px. La de las listas
 *   que son la pantalla: elegir rack, guardar en un rack.
 * - `compact` — sin superficie, separada por filete, marca de 36px. La de las
 *   listas que van dentro de otra cosa: resultados, la ficha de un disco.
 */
export default function RackRow({
  rack,
  density = "tile",
  showOwner = false,
  active = false,
  disabled = false,
  as,
  onClick,
  trailing,
  className = "",
}: {
  rack: RackView;
  density?: "tile" | "compact";
  /** de quién es, delante del número. Falso en tu propia estantería */
  showOwner?: boolean;
  /** el rack que se está viendo ahora mismo */
  active?: boolean;
  disabled?: boolean;
  /** fuerza el botón cuando el rack tiene destino pero aquí no se navega a él */
  as?: "button";
  /** en un enlace, lo que hay que hacer además de navegar — cerrar la hoja */
  onClick?: () => void;
  /** el control de la derecha: la flecha, el check, los tres puntos */
  trailing?: React.ReactNode;
  className?: string;
}) {
  const tile = density === "tile";

  const body = (
    <>
      <RackMark rack={rack} size={tile ? 44 : 36} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-body text-paper">{rack.title}</span>
          {rack.sharedWith && (
            <span className="shrink-0 text-content-faint">
              <SharedMark title={`Compartida con ${rack.sharedWith}`} />
            </span>
          )}
          {rack.locked && (
            <span aria-label="Rack predefinido" className="shrink-0 text-content-faint">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <rect x="2.5" y="5.5" width="7" height="5" rx="0.6" stroke="currentColor" />
                <path d="M4 5.5V4a2 2 0 1 1 4 0v1.5" stroke="currentColor" />
              </svg>
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-caption text-content-muted">
          {rackCaption(rack, { owner: showOwner })}
        </span>
      </span>
      {trailing ?? (rack.href && as !== "button" ? <Chevron /> : null)}
    </>
  );

  const shell = [
    "pressable flex w-full items-center gap-3 text-left",
    tile
      ? `rounded-md py-2.5 pl-3 pr-3 transition ${active ? "bg-fill-strong" : "bg-fill-subtle hover:bg-fill"}`
      : "py-3 transition hover:bg-fill-subtle",
    disabled ? "disabled:cursor-default" : "",
    className,
  ].join(" ");

  if (rack.href && as !== "button" && !disabled)
    return (
      <Link href={rack.href} onClick={onClick} className={shell}>
        {body}
      </Link>
    );

  return (
    <button onClick={onClick} disabled={disabled} className={shell}>
      {body}
    </button>
  );
}

/**
 * La marca de un rack: una caja con un disco dentro.
 *
 * Era la última portada, recortada en un cuadrado — que es la marca de un
 * disco, no la de un rack, y en una lista donde también hay discos las dos
 * cosas se leían igual. Un rack es una caja, y esta aplicación entera es un
 * dibujo de una caja: la misma que hay en Explorar y en la página de un rack,
 * a 40px y con un solo disco asomando.
 *
 * **Dibujada, no descargada.** La caja grande es un PNG de 155 kB — bien para
 * una tarjeta que ocupa media pantalla, absurdo para veinte miniaturas de
 * 40px, donde además se vería toda su textura reducida a barro. Aquí es un SVG
 * en línea: no pesa nada porque no es una petición, es nítida a cualquier
 * tamaño y hereda los colores del sistema. Lo único que viaja por la red es la
 * portada, que ya estaba descargada.
 */
export function RackMark({ rack, size = 44 }: { rack: RackView; size?: number }) {
  return (
    <span
      className="relative flex shrink-0 items-end justify-center overflow-hidden rounded-sm bg-fill-subtle"
      style={{ width: size, height: size }}
    >
      {rack.cover && (
        /* El disco, asomando por encima del panel frontal: 62% de ancho y con
           el pie metido dentro de la caja, que es lo que lo pone «dentro» y no
           «detrás». */
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={rack.cover}
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute aspect-square rounded-[1px] object-cover shadow-[0_3px_8px_rgba(0,0,0,0.65)]"
          style={{ width: "62%", left: "19%", top: "14%" }}
        />
      )}

      {/* La caja, anclada abajo y a sus propias proporciones. El panel frontal
          es opaco: por eso el pie del disco desaparece detrás de él. */}
      <svg
        viewBox="0 0 100 62"
        aria-hidden
        className="absolute inset-x-0 bottom-0 w-full"
        preserveAspectRatio="xMidYMax meet"
      >
        {/* el interior visible por encima del panel, un punto más oscuro */}
        <path d="M8 8 h84 v10 H8 Z" className="fill-ink/70" />
        {/* el cuerpo */}
        <rect
          x="7"
          y="16"
          width="86"
          height="40"
          rx="4"
          className="fill-fill-strong stroke-line-strong"
          strokeWidth="2"
        />
        {/* la ranura del asa: el único detalle que sobrevive a 40px */}
        <rect x="38" y="26" width="24" height="7" rx="3.5" className="fill-ink/60" />
        {/* los dos travesaños que hacen que se lea como caja y no como cajón */}
        <path
          d="M7 42 h86"
          className="stroke-line"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}

/** la flecha de «esto lleva a otro sitio», del mismo gris en todas partes */
export function Chevron() {
  return (
    <span aria-hidden className="shrink-0 text-content-faint">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path
          d="M5 2.5 L9.5 7 L5 11.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
