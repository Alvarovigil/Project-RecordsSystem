import { artistSlug, cleanArtist } from "./artist";

/**
 * ¿Existe este artista? Las piezas puras de la respuesta.
 *
 * `/artista/<lo que sea>` enseñaba siempre una página: el nombre salía del
 * propio enlace y el catálogo se buscaba por texto, así que una dirección
 * inventada daba un artista inventado — con el retrato y los discos de quien
 * más se pareciera. La página da ahora 404 cuando ni el catálogo ni la base
 * conocen a nadie con ese nombre, y solo entonces: ante un límite, un fallo o
 * una duda, se enseña como siempre. Una página de más es un fallo pequeño;
 * un 404 a un artista que existe, no.
 *
 * Lo que pregunta a la red está en lib/artist-known-server.ts.
 */

export type ArtistVerdict = "known" | "unknown" | "doubt";

/** un slug con la forma que producen nuestros enlaces */
export function isPlainSlug(slug: string): boolean {
  return /^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug);
}

/** el nombre que se le pregunta al catálogo: el slug con espacios */
export function nameFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").trim();
}

/**
 * Un patrón `ilike` que encuentra en la base los nombres que podrían dar este
 * slug, para luego quedarse solo con los que lo dan de verdad.
 *
 * El slug pierde tildes, signos y el «&» (que pasa a «and»), así que cada
 * letra que puede llevar tilde va como comodín de una letra y cada guion como
 * comodín libre. Pide de más a propósito: el filtro exacto es `artistSlug`.
 */
export function likePatternForSlug(slug: string): string | null {
  if (!isPlainSlug(slug)) return null;
  const tokens = slug.split("-").map((t) => (t === "and" ? "" : t.replace(/[aeiouycnsz]/g, "_")));
  const body = tokens.filter(Boolean).join("%");
  if (!body) return null;
  // al final, sitio para la coletilla «(2)» con la que el catálogo distingue
  return `${body}%`;
}

/** de los nombres que trajo la base, ¿alguno es este artista? */
export function someNameMatches(names: string[], slug: string): boolean {
  return names.some((n) => artistSlug(cleanArtist(n)) === slug);
}

/**
 * Lo que dice una búsqueda de artistas en el catálogo.
 *
 * - Uno con el mismo slug: existe.
 * - Ninguno parecido (ni empieza igual ni lo contiene): no existe.
 * - Algo parecido pero no igual: duda, y la duda enseña la página.
 */
export function verdictFromCatalogue(titles: string[], slug: string): ArtistVerdict {
  const slugs = titles.map((t) => artistSlug(cleanArtist(t))).filter(Boolean);
  if (slugs.includes(slug)) return "known";
  const near = slugs.some(
    (s) => s.startsWith(`${slug}-`) || slug.startsWith(`${s}-`) || s.includes(slug),
  );
  return near ? "doubt" : "unknown";
}

/** cuánto vale lo guardado: un sí, un mes; un no, un día (puede entrar mañana) */
export function knownCacheFresh(known: boolean, createdAt: string, now = Date.now()): boolean {
  const age = now - new Date(createdAt).getTime();
  if (!Number.isFinite(age) || age < 0) return false;
  return age < (known ? 30 : 1) * 864e5;
}
