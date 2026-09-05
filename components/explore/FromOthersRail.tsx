"use client";

import { useEffect, useState } from "react";
import { useRepository } from "@/hooks/useRepository";
import { SkeletonCovers } from "@/components/ui/Skeleton";
import { coverFor } from "@/lib/cover";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";

export type Find = {
  vinyl: Vinyl;
  /** de qué rack ha salido, y de quién: es la mitad del hallazgo */
  from: ListWithRecord;
};

/**
 * Lo que hay en las estanterías de otros y no está en la tuya.
 *
 * Esta es la pantalla entera de Rackr en una fila. Las listas de tendencias
 * dicen qué está buscando el mundo, que es un dato de mercado y podría estar
 * en cualquier aplicación; esto dice **qué tiene esta gente que tú no**, que es
 * la pregunta que da origen al proyecto y la única que no se puede responder
 * en ningún otro sitio.
 *
 * Y no es un descubrimiento anónimo: cada portada trae puesto de dónde sale.
 * Un disco suelto es una recomendación; un disco con «del rack Domingos largos,
 * de Marta» es una puerta — se entra por el disco y se acaba en la colección de
 * alguien, que es exactamente el recorrido que esta aplicación existe para
 * provocar.
 *
 * **El coste está acotado.** Se miran los seis primeros racks destacados, que
 * ya están en pantalla, y se piden sus discos una vez. Nada de recorrer la
 * comunidad entera para llenar un carril.
 */
export default function FromOthersRail({
  lists,
  ownedIds,
  onOpen,
}: {
  /** los racks que ya se están enseñando arriba; de ahí sale todo esto */
  lists: ListWithRecord[];
  /** lo que ya tienes, para no ofrecértelo */
  ownedIds: Set<string>;
  onOpen: (find: Find) => void;
}) {
  const repo = useRepository();
  const [finds, setFinds] = useState<Find[] | null>(null);

  const key = lists.slice(0, 6).map((l) => l.id).join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    const chosen = lists.slice(0, 6);

    Promise.all(
      chosen.map((l) =>
        repo
          .releasesOfList(l.id)
          .then((rs) => rs.map((vinyl) => ({ vinyl, from: l })))
          .catch(() => [] as Find[]),
      ),
    )
      .then((all) => {
        if (!alive) return;
        /**
         * Uno por disco, y repartidos entre racks.
         *
         * Intercalando en vez de concatenando: seis discos seguidos del mismo
         * rack son un rack, no un descubrimiento, y quien pase por delante
         * verá a una sola persona. Se toma el primero de cada uno, luego el
         * segundo, y así — el carril acaba siendo un corte transversal de la
         * comunidad en vez de la lista de alguien.
         */
        const seen = new Set<string>();
        const out: Find[] = [];
        const depth = Math.max(...all.map((a) => a.length), 0);
        for (let i = 0; i < depth && out.length < 24; i++) {
          for (const bucket of all) {
            const f = bucket[i];
            if (!f || seen.has(f.vinyl.id) || ownedIds.has(f.vinyl.id)) continue;
            seen.add(f.vinyl.id);
            out.push(f);
            if (out.length >= 24) break;
          }
        }
        setFinds(out);
      })
      .catch(() => alive && setFinds([]));

    return () => {
      alive = false;
    };
    // `lists` cambia de identidad en cada render del padre; lo que importa es
    // qué racks son, y eso es la clave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, repo, ownedIds]);

  if (finds !== null && finds.length === 0) return null;

  if (finds === null)
    return <SkeletonCovers n={6} cols="grid-cols-3 sm:grid-cols-6" gap="gap-4" />;

  return (
    <ul className="rail rail-page mt-4 flex gap-3.5 pb-2">
      {finds.map((f) => (
        <li key={f.vinyl.id} className="w-[142px] shrink-0 snap-start sm:w-[164px]">
          <button onClick={() => onOpen(f)} className="pressable block w-full text-left">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverFor(f.vinyl)}
              alt=""
              loading="lazy"
              className="aspect-square w-full rounded-[3px] object-cover"
            />
            <span className="mt-2.5 block truncate text-sub font-medium text-paper">
              {f.vinyl.title}
            </span>
            <span className="block truncate text-caption text-content-muted">
              {f.vinyl.artist}
            </span>
            {/* de dónde sale, que es lo que lo convierte en una puerta */}
            <span className="mt-1 block truncate text-caption text-content-faint">
              en {f.from.title} · {f.from.owner.displayName}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
