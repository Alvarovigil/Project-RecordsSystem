"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import { SkeletonRows } from "@/components/ui/Skeleton";
import type { ActivityEvent } from "@/lib/data/types";

/**
 * Lo que está pasando ahora mismo en las estanterías de los demás.
 *
 * Explorar empezaba por lo que el mundo entero está buscando — una lista de lo
 * más deseado del año, que es un dato de mercado y podría estar en cualquier
 * aplicación de discos. Esto empieza por gente: alguien acaba de meter un disco
 * en un rack, y ahí hay tres puertas en una sola línea — la persona, el disco y
 * el rack. Es la diferencia entre un catálogo y un sitio donde te encuentras
 * con las colecciones de otros.
 *
 * Tres líneas y no un muro: esto es el pulso, la prueba de que hay alguien más
 * aquí. Quien quiera el relato entero tiene la pantalla de Actividad, y el
 * enlace está al final.
 */
export default function PulseRail({ events }: { events: ActivityEvent[] | null }) {
  if (events !== null && events.length === 0) return null;
  if (events === null) return <SkeletonRows n={3} />;

  return (
    <ul className="divide-y divide-line">
      {events.slice(0, 4).map((e) => (
        <li key={e.id}>
          <Link
            href={
              e.list
                ? `/u/${e.list.ownerHandle}/${e.list.slug}`
                : `/u/${e.actor.username}`
            }
            className="pressable flex items-center gap-3 py-3 transition-colors hover:bg-fill-subtle"
          >
            {/* la portada delante: es lo único de la línea que se reconoce sin
                leer, y lo que hace que esto sea una estantería y no un registro */}
            {e.release?.cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={e.release.cover}
                alt=""
                loading="lazy"
                className="h-11 w-11 shrink-0 rounded-sm object-cover"
              />
            ) : (
              <Avatar
                name={e.actor.displayName}
                handle={e.actor.username}
                src={e.actor.avatarUrl}
                size="md"
              />
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sub text-paper">
                {e.release ? `${e.release.title} · ${e.release.artist}` : e.actor.displayName}
              </span>
              <span className="block truncate text-caption text-content-muted">
                {say(e)}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/**
 * La frase, en voz de estantería y no de base de datos.
 *
 * «Marta lo puso en Domingos largos» dice quién y dónde, que es por lo que
 * alguien pulsaría; «list_item_added» dice qué fila se ha escrito.
 */
function say(e: ActivityEvent) {
  const who = e.actor.displayName;
  if (e.list && e.release) return `${who} lo puso en ${e.list.title}`;
  if (e.list) return `${who} · ${e.list.title}`;
  if (e.target) return `${who} sigue a ${e.target.displayName}`;
  return who;
}
