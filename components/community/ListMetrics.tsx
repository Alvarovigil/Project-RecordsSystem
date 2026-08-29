"use client";

import { useLikes, useSaves } from "@/hooks/useListFlags";
import { useToast } from "@/components/ui/Toast";

/**
 * Las dos cifras de una lista: cuánta gente la guarda y cuánta le dio al
 * corazón.
 *
 * Se enseñan siempre juntas porque por separado engañan. Las guardadas son el
 * número serio — alguien le hizo sitio en su estantería y la va a ver cada día
 * — pero son pocas incluso en una lista muy buena, así que solas parecen un
 * fracaso. Los me gusta son baratos y por eso son muchos, y solos convierten
 * cualquier lista con una portada bonita en un éxito. Juntas se leen como lo
 * que son: cuánta gente pasó por delante, y cuánta se quedó.
 *
 * El corazón se pulsa aquí mismo, en la tarjeta, sin abrir la lista. Es la
 * única forma de que el gesto barato sea de verdad barato — si hay que entrar
 * para darlo, deja de medir a quien pasaba por delante.
 */

const fmt = (n: number) =>
  // 1.2k antes que 1247: en una línea de dos cifras juntas, el número exacto
  // no dice nada que el redondeado no diga, y se come el sitio del otro
  n >= 1000 ? `${(n / 1000).toFixed(n < 10000 ? 1 : 0).replace(".", ",").replace(",0", "")}k` : `${n}`;

export function LikeButton({
  listId,
  count,
  size = "sm",
}: {
  listId: string;
  /** lo que dice el backend; el botón le suma tu gesto mientras viaja */
  count: number;
  size?: "sm" | "md";
}) {
  const { has, delta, toggle } = useLikes();
  const toast = useToast();
  const liked = has(listId);
  const shown = Math.max(0, count + delta(listId));

  const press = async (e: React.MouseEvent) => {
    // vive dentro de un <Link> en la tarjeta: sin esto, dar me gusta te saca
    // de la página que estabas mirando
    e.preventDefault();
    e.stopPropagation();
    try {
      await toggle(listId);
    } catch (err) {
      const why = err instanceof Error && err.message ? ` (${err.message})` : "";
      toast.show(`No se pudo guardar tu me gusta.${why}`, { tone: "error" });
    }
  };

  const px = size === "md" ? 16 : 13;

  return (
    <button
      onClick={press}
      aria-pressed={liked}
      aria-label={liked ? "Quitar me gusta" : "Me gusta"}
      className={`pressable -my-1 -ml-1 flex items-center gap-1.5 rounded-full px-1 py-1 transition-colors ${
        liked ? "text-[#ff6b57]" : "text-content-muted hover:text-paper"
      }`}
    >
      <Heart size={px} filled={liked} />
      <span className={`tabular-nums ${size === "md" ? "text-sub" : "text-caption"}`}>
        {fmt(shown)}
      </span>
    </button>
  );
}

/** El corazón, y el único sitio del que sale. */
export function Heart({ size = 13, filled = false }: { size?: number; filled?: boolean }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      // el latido: crece al llenarse y vuelve. Dura poco a propósito — un
      // corazón que rebota medio segundo convierte catorce me gusta seguidos
      // en una pista de baile
      className={`shrink-0 transition-transform duration-200 ${filled ? "scale-110" : "scale-100"}`}
    >
      <path
        d="M8 13.5S1.9 9.9 1.9 5.9A3.3 3.3 0 0 1 8 4.2a3.3 3.3 0 0 1 6.1 1.7c0 4-6.1 7.6-6.1 7.6Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Guardadas: el número que no se pulsa, porque guardar se decide dentro — pero
 * que sí se mueve. Si acabas de pulsar "Guardar" en la cabecera, el contador
 * que hay al lado tiene que subir en ese momento; enterarse en la siguiente
 * carga es la clase de detalle que hace dudar de si el botón hizo algo.
 */
export function SaveCount({
  n,
  listId,
  size = "sm",
}: {
  n: number;
  listId: string;
  size?: "sm" | "md";
}) {
  const { delta } = useSaves();
  const shown = Math.max(0, n + delta(listId));
  return (
    <span
      className={`flex items-center gap-1.5 text-content-muted ${
        size === "md" ? "text-sub" : "text-caption"
      }`}
      title={`${shown} ${shown === 1 ? "persona la tiene guardada" : "personas la tienen guardada"}`}
    >
      <svg
        width={size === "md" ? 15 : 12}
        height={size === "md" ? 15 : 12}
        viewBox="0 0 16 16"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        className="shrink-0"
      >
        {/* un marcador, no una estantería: es la forma que todo el mundo lee
            como "me lo quedo" sin leyenda debajo */}
        <path d="M4 2.6h8v11l-4-2.9-4 2.9v-11Z" strokeLinejoin="round" />
      </svg>
      <span className="tabular-nums">{fmt(shown)}</span>
    </span>
  );
}

/** Las dos, en una línea, en el orden en que se leen. */
export default function ListMetrics({
  listId,
  saves,
  likes,
  size = "sm",
}: {
  listId: string;
  saves: number;
  likes: number;
  size?: "sm" | "md";
}) {
  return (
    <span className="flex items-center gap-3">
      <LikeButton listId={listId} count={likes} size={size} />
      <SaveCount n={saves} listId={listId} size={size} />
    </span>
  );
}
