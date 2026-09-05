"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
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
 * La marca cuadrada de un rack: la última portada que entró.
 *
 * Y si no hay ninguna, la cara de quien lo hizo antes que un hueco gris —
 * un rack vacío de alguien sigue siendo de alguien. Sin portada y sin dueño no
 * queda nada que decir, así que queda el hueco, que al menos mantiene la fila
 * alineada con las de al lado.
 */
export function RackMark({ rack, size = 44 }: { rack: RackView; size?: number }) {
  return (
    <span
      className="flex shrink-0 overflow-hidden rounded-sm bg-fill"
      style={{ width: size, height: size }}
    >
      {rack.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={rack.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : rack.owner ? (
        <Avatar
          name={rack.owner.displayName}
          handle={rack.owner.username}
          src={rack.owner.avatarUrl}
          size="md"
        />
      ) : null}
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
