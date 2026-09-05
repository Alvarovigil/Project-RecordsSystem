import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Thirty seconds of every track, so a tracklist can be listened to.
 *
 * A record here has exactly one preview — the first song of the album, found
 * once at import — which is enough to answer "what does this sound like" and
 * nothing at all for a tracklist. Reading a list of titles you cannot press is
 * the most database-like thing left on the record screen.
 *
 * Apple has a preview for every track and hands them over in one lookup by
 * album, with no key and no authentication. The match is by title, normalised:
 * a vinyl pressing and a digital release agree on the songs and disagree on
 * everything around them — punctuation, "(Remastered 2011)", the side the
 * track sits on — so anything that is not a letter or a digit is thrown away
 * before comparing.
 *
 * Cached against the release id: this is one upstream call per record ever,
 * shared by everybody who opens it.
 */
const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // "Song (Remastered)" and "Song - Live Version" are the same song here
    .replace(/\s*[([].*?[)\]]\s*/g, " ")
    .replace(/[^a-z0-9]/g, "");

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const album = req.nextUrl.searchParams.get("album")?.trim();
  if (!artist || !album) return Response.json({ tracks: {} });

  const key = `tracks:${id ?? norm(`${artist}${album}`)}`;
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data } = await sb
      .from("discogs_search_cache")
      .select("results")
      .eq("query", key)
      .maybeSingle();
    if (data) return Response.json({ tracks: data.results, cached: true });
  }

  const tracks: Record<string, string> = {};
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const r = await fetch(
      `https://itunes.apple.com/search?term=${term}&entity=album&limit=10`,
    );
    if (!r.ok) return Response.json({ tracks });
    const found = (await r.json()).results ?? [];

    const target = norm(album);
    const wantArtist = norm(artist);
    const pick =
      found.find(
        (c: { collectionName?: string; artistName?: string }) =>
          norm(c.collectionName ?? "") === target &&
          norm(c.artistName ?? "").includes(wantArtist),
      ) ??
      found.find((c: { collectionName?: string }) =>
        norm(c.collectionName ?? "").includes(target),
      );
    if (!pick?.collectionId) return Response.json({ tracks });

    const songsRes = await fetch(
      `https://itunes.apple.com/lookup?id=${pick.collectionId}&entity=song&limit=200`,
    );
    if (!songsRes.ok) return Response.json({ tracks });
    const songs = ((await songsRes.json()).results ?? []).filter(
      (r: { wrapperType?: string }) => r.wrapperType === "track",
    );
    for (const s of songs) {
      if (s.trackName && s.previewUrl) tracks[norm(s.trackName)] = s.previewUrl;
    }
  } catch {
    return Response.json({ tracks });
  }

  if (sb && Object.keys(tracks).length > 0) {
    void sb
      .from("discogs_search_cache")
      .upsert({ query: key, results: tracks }, { onConflict: "query" })
      .then(
        () => {},
        () => {},
      );
  }

  return Response.json({ tracks });
}
