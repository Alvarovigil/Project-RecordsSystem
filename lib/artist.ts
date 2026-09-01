import type { Vinyl } from "./types";

/**
 * The artist, which this app has never had as a thing.
 *
 * A record carries `artist` as a string and nothing else — there is no artist
 * table, no id, no page. That was fine while a collection was a pile of
 * sleeves, and stops being fine the moment somebody wants the obvious thing:
 * to tap a name and see what else of theirs they own, and what they are
 * missing.
 *
 * So an artist here is **derived**, not stored: it is whatever a name groups
 * together. That has one real consequence, and it is worth stating plainly —
 * two spellings are two artists. Discogs is fairly disciplined about this and
 * the app takes its names from Discogs, so in practice it holds; a record
 * typed in by hand as "Fleetwood mac" would sit on its own. The alternative —
 * an artist table with ids, merges and aliases — is a much larger thing to
 * maintain and buys nothing until somebody actually has the problem.
 */

/**
 * Discogs disambiguates repeated names with a bracketed number — "Nirvana (2)"
 * — which is a database detail, not part of anybody's name.
 */
export function cleanArtist(name: string): string {
  return name
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function artistSlug(name: string): string {
  return (
    cleanArtist(name)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "artista"
  );
}

export type ArtistGroup = {
  name: string;
  slug: string;
  records: Vinyl[];
};

/** every artist in a library, biggest first, then alphabetical */
export function groupByArtist(vinilos: Vinyl[]): ArtistGroup[] {
  const by = new Map<string, ArtistGroup>();
  for (const v of vinilos) {
    const name = cleanArtist(v.artist);
    if (!name) continue;
    const slug = artistSlug(name);
    const g = by.get(slug) ?? { name, slug, records: [] };
    g.records.push(v);
    by.set(slug, g);
  }
  return Array.from(by.values()).sort(
    (a, b) => b.records.length - a.records.length || a.name.localeCompare(b.name),
  );
}

export function findArtist(vinilos: Vinyl[], slug: string): ArtistGroup | null {
  return groupByArtist(vinilos).find((g) => g.slug === slug) ?? null;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/**
 * Artists worth offering for a query.
 *
 * A name that *starts* with what you typed comes before one that merely
 * contains it: typing "roy" should offer Roy Orbison before Rosalía, and the
 * substring rule alone gets that backwards often enough to be annoying.
 */
export function matchArtists(vinilos: Vinyl[], query: string, limit = 4): ArtistGroup[] {
  const q = norm(query);
  if (q.length < 2) return [];
  return groupByArtist(vinilos)
    .filter((g) => norm(g.name).includes(q))
    .sort((a, b) => {
      const sa = norm(a.name).startsWith(q) ? 0 : 1;
      const sb = norm(b.name).startsWith(q) ? 0 : 1;
      return sa - sb || b.records.length - a.records.length;
    })
    .slice(0, limit);
}

/**
 * The artist half of a Discogs row.
 *
 * Their titles are "Artist - Album", which is a display string rather than
 * structured data — so this splits on the first " - " and gives up gracefully
 * when there isn't one, because an album with a dash in its own title is a
 * worse thing to get wrong than a missing artist row.
 */
export function artistFromCatalogueTitle(title: string): string | null {
  const i = title.indexOf(" - ");
  if (i <= 0) return null;
  const name = cleanArtist(title.slice(0, i));
  return name.length >= 2 ? name : null;
}
