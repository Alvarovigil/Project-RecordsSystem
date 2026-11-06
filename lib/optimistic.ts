/**
 * Deshacer un cambio optimista sin deshacer los de al lado.
 *
 * `useLibrary` cambia la estantería antes de que la escritura conteste y, si
 * falla, la devuelve a como estaba. Antes «como estaba» era la foto entera de
 * antes del cambio, y eso pisaba cualquier otra escritura que hubiera salido
 * mientras tanto: añades A, añades B, falla A… y B desaparece de la pantalla
 * aunque se haya guardado.
 *
 * Aquí se calcula qué cambió *esta* escritura (de `before` a `next`) y se
 * aplica el inverso sobre lo que hay *ahora* (`current`), que puede llevar
 * encima otros cambios. Lo que no tocó, no se toca.
 *
 * Lógica pura, sin React, para poder probarla (lib/optimistic.test.ts).
 */

type WithId = { id: string };

export type OptimisticState<R extends WithId, L extends WithId> = {
  releases: R[];
  lists: L[];
  items: Record<string, string[]>;
};

/** una lista de filas con id: quita lo que añadió el cambio, devuelve lo que quitó */
function revertRows<T extends WithId>(current: T[], before: T[], next: T[]): T[] {
  const beforeById = new Map(before.map((r) => [r.id, r]));
  const nextById = new Map(next.map((r) => [r.id, r]));
  let out = current;

  // lo que el cambio añadió se va (por id: una relectura entre medias trae
  // objetos nuevos para las mismas filas)
  const added = new Set(next.filter((r) => !beforeById.has(r.id)).map((r) => r.id));
  if (added.size) out = out.filter((r) => !added.has(r.id));

  // lo que el cambio modificó vuelve a su versión, si sigue siendo la suya
  out = out.map((r) => {
    const was = beforeById.get(r.id);
    const now = nextById.get(r.id);
    return was && now && now !== was && r === now ? was : r;
  });

  // lo que el cambio quitó vuelve a su sitio, si no ha vuelto ya por otro lado
  const have = new Set(out.map((r) => r.id));
  for (const [i, r] of before.entries()) {
    if (nextById.has(r.id) || have.has(r.id)) continue;
    out = [...out.slice(0, i), r, ...out.slice(i)];
    have.add(r.id);
  }
  return out;
}

/** los ids de una lista: el mismo inverso, por posición */
function revertIds(current: string[], before: string[], next: string[]): string[] {
  const was = new Set(before);
  const now = new Set(next);
  let out = current.filter((id) => was.has(id) || !now.has(id));
  const have = new Set(out);
  for (const [i, id] of before.entries()) {
    if (now.has(id) || have.has(id)) continue;
    out = [...out.slice(0, i), id, ...out.slice(i)];
    have.add(id);
  }
  return out;
}

export function revertOptimistic<R extends WithId, L extends WithId>(
  current: OptimisticState<R, L>,
  before: OptimisticState<R, L>,
  next: OptimisticState<R, L>,
): OptimisticState<R, L> {
  const releases =
    next.releases === before.releases
      ? current.releases
      : revertRows(current.releases, before.releases, next.releases);
  const lists =
    next.lists === before.lists ? current.lists : revertRows(current.lists, before.lists, next.lists);

  let items = current.items;
  if (next.items !== before.items) {
    items = { ...current.items };
    const keys = new Set([...Object.keys(before.items), ...Object.keys(next.items)]);
    for (const k of keys) {
      const b = before.items[k] ?? [];
      const n = next.items[k] ?? [];
      if (b === n) continue;
      const reverted = revertIds(current.items[k] ?? [], b, n);
      if (reverted.length === 0 && !(k in before.items) && !(k in current.items)) continue;
      items[k] = reverted;
    }
  }
  return { releases, lists, items };
}
