import { NextRequest } from "next/server";
import { discogsHeaders, discogsToken } from "@/lib/discogs";
import type { RecordSpecs } from "@/lib/types";

/**
 * The technical sheet of one pressing.
 *
 * Everything here exists in Discogs already and almost none of it is in our
 * catalogue: we keep the eight fields the shelf needs to draw a record, not
 * the forty a collector uses to tell two copies of the same album apart.
 * Copying all of them into `releases` would mean a migration, a backfill for
 * every record already imported, and a second copy of somebody else's database
 * going stale in ours. Asking on demand costs one request the first time
 * somebody opens the card, and nothing after that.
 *
 * Cached for a day at the fetch layer, which is the part that matters: Discogs
 * allows sixty calls a minute for the whole application, and a pressing's
 * catalogue number does not change. Only the market figures do, and being a
 * few hours stale about how many people own a record is not a problem anyone
 * has.
 */

export const revalidate = 86400;

/** Drop Discogs' "(2)" disambiguators — they are database bookkeeping. */
const clean = (s: string) => s.replace(/\s\(\d+\)/g, "").trim();

/**
 * The credits worth printing.
 *
 * A release can carry a hundred `extraartists`, most of them the second
 * assistant engineer. These are the roles that change what the object *is* or
 * how it sounds — who cut the lacquer is a genuine argument between two
 * pressings — and they are the ones shops put on the shelf talker.
 */
const ROLES = [
  { match: /lacquer cut|mastered|remaster/i, label: "Masterizado" },
  { match: /produce/i, label: "Producción" },
  { match: /mixed/i, label: "Mezcla" },
  { match: /recorded|engineer/i, label: "Grabación" },
  { match: /artwork|design|illustration|photography|sleeve/i, label: "Diseño" },
];

/**
 * The notes, minus the small print.
 *
 * Discogs' notes field is where the useful sentence — recorded at Criteria,
 * gatefold with a printed inner sleeve, some copies include a poster — sits
 * buried in copyright lines, publisher addresses and label boilerplate that
 * are on the sleeve because a lawyer required them, not because anyone reads
 * them. Dropping those lines is the difference between a paragraph worth
 * opening the card for and eight lines of a Warner address in Los Angeles.
 */
/**
 * Discogs writes its notes in its own markup: `[a1876358]` for an artist,
 * `[l123]` for a label, `[url=…]` around links. It renders on their site and
 * arrives here as raw ids in the middle of a sentence — "extra special thanks
 * to [a1876358]" — which looks like our bug, not theirs.
 */
const REF = "\u0000";

const demarkup = (s: string) =>
  s
    .replace(/\[url=[^\]]*\]|\[\/url\]/gi, "")
    // an artist reference we cannot resolve to a name carries no information
    // — the line it is in gets dropped below rather than printed with a hole
    .replace(/\[[almr]=?\d+\]/gi, REF)
    .replace(/\[[^\]]{0,40}\]/g, "")
    .replace(/[ \t]{2,}/g, " ");

function notes(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const kept = demarkup(raw)
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .filter((l) => !l.includes(REF))
    .filter((l) => !/^[℗©(]|^A Division of|Music Corp|\(ASCAP\)|\(BMI\)|All rights reserved/i.test(l))
    .slice(0, 4);
  const text = kept.join("\n");
  if (!text) return null;
  // cut on a line, never mid-word: a paragraph that ends in "Ga…" reads as a
  // bug rather than as an abbreviation
  return text.length > 320 ? `${kept.slice(0, 2).join("\n")}…` : text;
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  if (!discogsToken()) return Response.json({ error: "sin-token" }, { status: 503 });

  let release: any;
  try {
    const r = await fetch(`https://api.discogs.com/releases/${id}`, {
      headers: discogsHeaders(),
      next: { revalidate },
    });
    // 429 travels as itself, so the card can say it is a rate limit rather
    // than inventing a generic failure — the notice the product already shows
    // for anything Discogs refuses.
    if (!r.ok) return Response.json({ error: `discogs-${r.status}` }, { status: r.status });
    release = await r.json();
  } catch {
    return Response.json({ error: "red" }, { status: 502 });
  }

  const identifier = (type: RegExp) =>
    (release.identifiers ?? []).find((i: any) => type.test(i.type ?? ""));

  const label = release.labels?.[0];

  /**
   * The format line, written the way a shop writes it.
   *
   * Discogs splits it into a name, a quantity, a free-text note and a list of
   * descriptions — "Vinyl", "2", "180 g", ["LP", "Album", "Reissue"] — and
   * every record store in the world prints that back as one line. Rebuilding
   * it here rather than in the component keeps the card free of somebody
   * else's data shape.
   */
  const formats: string[] = (release.formats ?? []).map((f: any) => {
    const qty = Number(f.qty) > 1 ? `${f.qty}× ` : "";
    const parts = [...(f.descriptions ?? []), f.text].filter(Boolean);
    return `${qty}${f.name}${parts.length ? `, ${parts.join(", ")}` : ""}`;
  });

  const credits = ROLES.map(({ match, label: role }) => {
    const names = (release.extraartists ?? [])
      .filter((a: any) => match.test(a.role ?? ""))
      .map((a: any) => clean(a.name ?? ""))
      .filter(Boolean);
    // the same person credited twice under two spellings of one role is
    // noise, not information
    return { role, names: Array.from(new Set(names)).slice(0, 3) as string[] };
  }).filter((c) => c.names.length > 0);

  const specs: RecordSpecs = {
    label: label?.name ? clean(label.name) : null,
    catno: label?.catno || null,
    formats,
    country: release.country ?? null,
    released: release.released_formatted || release.released || null,
    genres: release.genres ?? [],
    styles: release.styles ?? [],
    pressedBy:
      (release.companies ?? [])
        .filter((c: any) => /pressed by|manufactured by/i.test(c.entity_type_name ?? ""))
        .map((c: any) => clean(c.name))[0] ?? null,
    barcode: identifier(/barcode/i)?.value ?? null,
    matrix: identifier(/matrix/i)?.value ?? null,
    credits,
    notes: notes(release.notes),
    have: release.community?.have ?? null,
    want: release.community?.want ?? null,
    rating: release.community?.rating?.average ?? null,
    ratingCount: release.community?.rating?.count ?? null,
    lowestPrice: typeof release.lowest_price === "number" ? release.lowest_price : null,
    forSale: release.num_for_sale ?? null,
    url: release.uri ?? `https://www.discogs.com/release/${id}`,
  };

  return Response.json({ specs });
}
