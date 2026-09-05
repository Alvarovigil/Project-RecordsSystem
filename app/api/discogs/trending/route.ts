import { NextRequest } from "next/server";
import { DISCOGS_UA } from "@/lib/discogs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * What the world is chasing, and what somebody like you might want.
 *
 * Explorar had the club and nothing else: the racks people here have made and
 * the people who made them. That is the right heart for it and it is thin for
 * a young club — on a quiet week there is very little to look at.
 *
 * Discogs has the missing half, and not as a vanity metric. Every release
 * carries how many people **have** it and how many **want** it, filled in by
 * millions of collectors over twenty years, and the search endpoint will sort
 * by either. `want` descending is the closest thing this world has to a
 * genuine chart: it is not plays, it is not a label's marketing, it is how
 * many people have written a record down as something they are still looking
 * for. That is exactly the question this app is about.
 *
 * Two shapes, one query each:
 *
 * - **`year`** — the most wanted vinyl pressed this year. A chart of the
 *   present, which is what "en tendencia" has to mean or it is just a
 *   canon.
 * - **`genre`** — the most wanted of all time in one genre, for the "you
 *   might like" rail. Personal because the genre comes from the shelf of
 *   whoever is asking, not from a guess about them.
 *
 * Cached for six hours in the table the search already uses. Discogs allows
 * sixty requests a minute for this whole application; a rail that refetched
 * per visitor would spend the budget on something that changes daily at most.
 */
const token = () => process.env.DISCOGS_TOKEN;

const FRESH_MS = 6 * 3600 * 1000;

type Row = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  thumb?: string;
  cover_image?: string;
  format?: string[];
  community?: { want?: number; have?: number };
};

export async function GET(req: NextRequest) {
  if (!token()) return Response.json({ results: [] });

  const genre = req.nextUrl.searchParams.get("genre")?.trim() || null;
  const year = new Date().getFullYear();
  const key = genre ? `wanted:genre:${genre.toLowerCase()}` : `wanted:year:${year}`;

  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data } = await sb
      .from("discogs_search_cache")
      .select("results, created_at")
      .eq("query", key)
      .maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < FRESH_MS) {
      return Response.json({ results: data.results, cached: true });
    }
  }

  const url = new URL("https://api.discogs.com/database/search");
  url.searchParams.set("type", "release");
  url.searchParams.set("format", "Vinyl");
  url.searchParams.set("sort", "want");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("per_page", "30");
  if (genre) url.searchParams.set("genre", genre);
  else url.searchParams.set("year", String(year));

  let rows: Row[] = [];
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": DISCOGS_UA, Authorization: `Discogs token=${token()}` },
      next: { revalidate: 3600 },
    });
    if (r.ok) rows = (await r.json()).results ?? [];
  } catch {
    return Response.json({ results: [] });
  }

  const clean = (s: string) => s.replace(/\s\(\d+\)/g, "");
  const seen = new Set<string>();
  const results = rows
    /**
     * One entry per record, not per pressing.
     *
     * A chart sorted by want is otherwise four copies of the same album at the
     * top — the original, the repress, the picture disc and the box — which
     * looks like a bug and hides four other records.
     */
    .filter((r) => {
      const k = clean(r.title ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, 18)
    .map((r) => ({
      id: r.id,
      title: clean(r.title ?? ""),
      year: r.year,
      country: r.country,
      thumb: r.thumb,
      cover_image: r.cover_image,
      format: r.format,
      want: r.community?.want ?? 0,
      have: r.community?.have ?? 0,
    }));

  if (sb) {
    void sb
      .from("discogs_search_cache")
      .upsert({ query: key, results }, { onConflict: "query" })
      .then(
        () => {},
        () => {},
      );
  }

  return Response.json({ results });
}
