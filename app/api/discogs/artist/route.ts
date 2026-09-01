import { NextRequest } from "next/server";
import { DISCOGS_UA } from "@/lib/discogs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * One artist, identified rather than matched.
 *
 * The artist page used to ask the catalogue for the *name* and print whatever
 * came back, which is how somebody looking for Rosalía got a 1970s Spanish
 * singer's ninety-two singles mixed into her discography. They are different
 * people who happen to share a word, and Discogs knows that perfectly well:
 * it has artist ids, and every release names the artist it belongs to by id.
 *
 * So the name is never the key. The order of preference is:
 *
 * 1. **A release you already own.** Its id resolves to exactly one artist —
 *    no guessing, no ranking, no famous-person heuristic. If the shelf has a
 *    record by this artist, this is the path taken and it cannot be wrong.
 * 2. **An artist search**, for somebody whose records you do not have yet. An
 *    exact name match beats a partial one; beyond that it is Discogs's own
 *    relevance, which is the best available signal.
 *
 * Two upstream calls, cached for a month against the artist's id.
 */
const token = () => process.env.DISCOGS_TOKEN;

type Row = {
  id: number;
  title: string;
  year?: number;
  type?: string;
  role?: string;
  format?: string;
  thumb?: string;
  main_release?: number;
  artist?: string;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s*\(\d+\)\s*$/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function discogs(path: string) {
  const r = await fetch(`https://api.discogs.com${path}`, {
    headers: { "User-Agent": DISCOGS_UA, Authorization: `Discogs token=${token()}` },
    next: { revalidate: 3600 },
  });
  if (!r.ok) return null;
  return r.json();
}

/** the id of the artist credited on a record the shelf already holds */
async function artistOfRelease(releaseId: string) {
  const d = await discogs(`/releases/${encodeURIComponent(releaseId)}`);
  const a = d?.artists?.[0];
  return a?.id ? { id: Number(a.id), name: String(a.name) } : null;
}

async function artistByName(name: string) {
  const d = await discogs(
    `/database/search?type=artist&per_page=10&q=${encodeURIComponent(name)}`,
  );
  const rows: { id: number; title: string; thumb?: string }[] = d?.results ?? [];
  if (rows.length === 0) return null;
  const want = norm(name);
  const exact = rows.find((r) => norm(r.title) === want);
  const pick = exact ?? rows[0];
  return { id: Number(pick.id), name: String(pick.title) };
}

export async function GET(req: NextRequest) {
  if (!token()) return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });

  const q = req.nextUrl.searchParams.get("q")?.trim();
  const fromRelease = req.nextUrl.searchParams.get("release")?.trim();
  const givenId = req.nextUrl.searchParams.get("id")?.trim();
  if (!q && !fromRelease && !givenId) return Response.json({ error: "q required" }, { status: 400 });

  /**
   * Cache-only mode, for the search box.
   *
   * A row in a list that updates on every keystroke cannot afford two upstream
   * calls per artist against a budget of sixty a minute for the whole
   * application. With `peek=1` this answers from what has already been looked
   * up and otherwise says nothing — so a portrait appears next to an artist
   * anybody has opened before, and nobody pays for one who has not.
   */
  const peek = req.nextUrl.searchParams.get("peek") === "1";
  const sbPeek = peek ? getSupabaseAdminClient() : null;
  if (peek) {
    if (!sbPeek) return Response.json({ artist: null, releases: [] });
    let id = givenId ? Number(givenId) : null;
    if (!id && fromRelease) {
      const { data } = await sbPeek
        .from("discogs_search_cache")
        .select("results")
        .eq("query", `artist:rel:${fromRelease}`)
        .maybeSingle();
      id = (data?.results as { id?: number } | null)?.id ?? null;
    }
    if (!id) return Response.json({ artist: null, releases: [] });
    const { data } = await sbPeek
      .from("discogs_search_cache")
      .select("results")
      .eq("query", `artist:${id}`)
      .maybeSingle();
    return Response.json(data?.results ?? { artist: null, releases: [] });
  }

  let ident: { id: number; name: string } | null = null;
  if (givenId) ident = { id: Number(givenId), name: q ?? "" };
  if (!ident && fromRelease) ident = await artistOfRelease(fromRelease);
  if (!ident && q) ident = await artistByName(q);
  if (!ident) return Response.json({ artist: null, releases: [] });

  const sb = getSupabaseAdminClient();
  const key = `artist:${ident.id}`;
  if (sb) {
    const { data } = await sb
      .from("discogs_search_cache")
      .select("results, created_at")
      .eq("query", key)
      .maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < 30 * 864e5) {
      return Response.json({ ...data.results, cached: true });
    }
  }

  const [profile, discography] = await Promise.all([
    discogs(`/artists/${ident.id}`),
    discogs(`/artists/${ident.id}/releases?sort=year&sort_order=desc&per_page=100`),
  ]);

  /**
   * Their records, not everything their name is printed on.
   *
   * `role: "Main"` drops the compilations they appear on once, the remixes
   * they did for other people and the tracks they feature on — all of which
   * are real credits and none of which anybody means by "an artist's records".
   * Masters come before releases where both exist, because a master is the
   * album and a release is one of its forty pressings.
   */
  const rows: Row[] = discography?.releases ?? [];
  const seen = new Set<string>();
  const releases = rows
    .filter((r) => (r.role ?? "Main") === "Main")
    /**
     * Records, not files.
     *
     * A modern artist's Discogs page is mostly digital singles — "3×File,
     * AAC" — which are not things anybody puts on a shelf. Anything that says
     * File, CD or Cassette and does not also say vinyl is dropped; a master
     * has no format at all and is kept, because a master is the album rather
     * than one of its pressings.
     */
    .filter((r) => {
      const f = String(r.format ?? "");
      if (!f) return true;
      // no word boundary before the noun: Discogs writes "3xFile" and
      // "2xCD", and `\bFile` does not match the first of those
      const digital = /(File|CDr|CD|Cassette|DVD|Blu-ray)/i.test(f);
      const vinyl = /(Vinyl|\bLP\b|\bEP\b|7"|10"|12")/i.test(f);
      return vinyl || !digital;
    })
    .filter((r) => {
      const key = norm(String(r.title));
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r) => ({
      // a master's own id is not a release id; the page needs the one that can
      // actually be imported
      id: r.type === "master" && r.main_release ? Number(r.main_release) : Number(r.id),
      title: String(r.title),
      year: r.year,
      format: r.format ? String(r.format).split(",")[0].trim() || undefined : undefined,
      thumb: r.thumb,
    }))
    .slice(0, 60);

  /**
   * Through our own origin, like every other Discogs image.
   *
   * `i.discogs.com` refuses to serve to another site, so a raw uri here would
   * be a broken portrait on every artist page. `/api/cover` already exists for
   * exactly this and already caches hard — see its Cache-Control, and the
   * service worker, which keeps these off the network entirely after the first
   * look.
   */
  const raw =
    (profile?.images ?? []).find((i: { type?: string }) => i.type === "primary")?.uri ??
    profile?.images?.[0]?.uri ??
    null;
  const image = raw ? `/api/cover?url=${encodeURIComponent(raw)}` : null;

  const payload = {
    artist: {
      id: ident.id,
      // Discogs disambiguates with a bracketed number; nobody's name has one
      name: String(profile?.name ?? ident.name).replace(/\s*\(\d+\)\s*$/, ""),
      image,
      profile: typeof profile?.profile === "string" ? profile.profile.slice(0, 600) : null,
      url: profile?.uri ?? null,
    },
    releases,
  };

  if (sb && fromRelease) {
    // the pointer the peek reads: this record belongs to this artist
    void sb
      .from("discogs_search_cache")
      .upsert(
        { query: `artist:rel:${fromRelease}`, results: { id: ident.id } },
        { onConflict: "query" },
      )
      .then(
        () => {},
        () => {},
      );
  }

  if (sb) {
    void sb
      .from("discogs_search_cache")
      .upsert({ query: key, results: payload }, { onConflict: "query" })
      .then(
        () => {},
        () => {},
      );
  }

  return Response.json(payload);
}
