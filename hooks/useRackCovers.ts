"use client";

import { useEffect, useState } from "react";
import { useRepository } from "@/hooks/useRepository";
import type { ListWithRecord } from "@/lib/data/types";

/**
 * Las portadas que van dentro de la caja de cada rack.
 *
 * La miniatura de un rack dibuja un cajón con un disco asomando, y el disco
 * sale de aquí. Sin esto la caja aparece vacía — que es exactamente lo que un
 * rack con quince discos no es — y una lista de racks vuelve a ser una lista
 * de cuadrados grises iguales.
 *
 * Una sola consulta para todos los racks de la pantalla, y solo cuando cambia
 * el conjunto: la clave es qué racks son, no el array que los trae.
 */
export function useRackCovers(lists: Pick<ListWithRecord, "id">[] | null | undefined) {
  const repo = useRepository();
  const [covers, setCovers] = useState<Record<string, string[]>>({});
  const key = (lists ?? []).map((l) => l.id).join(",");

  useEffect(() => {
    if (!key) return;
    let alive = true;
    repo
      .coversOfLists(key.split(","))
      .then((c) => alive && setCovers((prev) => ({ ...prev, ...c })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key, repo]);

  return covers;
}
