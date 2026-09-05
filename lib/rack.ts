import type { Collection } from "@/lib/collections";
import type { ListWithRecord } from "@/lib/data/types";
import { listTitleFor } from "@/lib/list-title";

/**
 * Un rack, visto desde fuera.
 *
 * La aplicación guarda un rack de tres maneras distintas según de dónde venga:
 * `Collection` en la biblioteca local, `List` en la base de datos, y el objeto
 * recortado que devuelve el buscador. Ninguna de las tres es lo que una fila
 * necesita pintar, así que cada pantalla se hacía la suya — y por eso el mismo
 * rack tenía cinco caras distintas según dónde lo miraras.
 *
 * Esto es la cara. Se calcula una vez, en el borde donde entran los datos, y a
 * partir de ahí todo lo que enseña un rack — la fila, la tarjeta grande, el
 * título de una pantalla — habla este idioma y solo este.
 */
export type RackView = {
  id: string;
  title: string;
  /** la última portada que entró, o nada: la marca decide qué hacer sin ella */
  cover: string | null;
  owner: {
    username: string;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  count: number;
  /** adónde lleva; sin él la fila es un botón y no un enlace */
  href?: string;
  /** «viendo ahora», «Vacío»: lo que este sitio concreto añade a la firma */
  note?: string;
  /** compartida con otra persona: se dice en la firma, no con una insignia */
  sharedWith?: string;
  /** la colección y los deseos no se pueden borrar ni renombrar */
  locked?: boolean;
};

/** «5 discos», «1 disco», en el único sitio donde se escribe. */
export function records(n: number) {
  return `${n} ${n === 1 ? "disco" : "discos"}`;
}

/**
 * La firma de un rack: de quién es, y cuánto hay dentro.
 *
 * En ese orden y nunca al revés. El número es contabilidad; el nombre es la
 * razón por la que ese rack está en la pantalla — y en cuanto empiezan a
 * convivir racks de otra gente con los tuyos, es lo único que distingue las
 * estanterías que has montado tú.
 */
export function rackCaption(rack: RackView, opts: { owner?: boolean } = {}) {
  const parts: string[] = [];
  if (opts.owner && rack.owner) parts.push(`de ${rack.owner.displayName}`);
  if (rack.sharedWith) parts.push(`de ${rack.sharedWith} y tú`);
  parts.push(rack.count === 0 ? "Vacío" : records(rack.count));
  if (rack.note) parts.push(rack.note);
  return parts.join(" · ");
}

/** Un rack de la biblioteca local. La portada es la última que entró. */
export function rackOfCollection(
  c: Collection,
  coverOf?: (vinylId: string) => string | null | undefined,
  extra: Partial<RackView> = {},
): RackView {
  return {
    id: c.id,
    title: c.name,
    cover: coverOf ? (c.vinylIds.map(coverOf).filter(Boolean).pop() ?? null) : null,
    owner: null,
    count: c.vinylIds.length,
    sharedWith: c.sharedBy?.displayName,
    ...extra,
  };
}

/** Un rack de la comunidad, con su autor delante. */
export function rackOfList(
  l: Pick<ListWithRecord, "id" | "title" | "slug" | "kind" | "itemCount"> & {
    owner: ListWithRecord["owner"];
  },
  cover: string | null = null,
  mine = false,
  extra: Partial<RackView> = {},
): RackView {
  return {
    id: l.id,
    title: listTitleFor(l, mine),
    cover,
    owner: l.owner,
    count: l.itemCount,
    href: `/u/${l.owner.username}/${l.slug}`,
    ...extra,
  };
}
