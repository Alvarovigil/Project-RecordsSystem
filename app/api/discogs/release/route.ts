import { NextRequest } from "next/server";
import { writeFile, mkdir, readFile, access } from "node:fs/promises";
import { resolve } from "node:path";
import type { Vinyl } from "@/lib/types";
import { downloadDeezerPreview } from "@/lib/preview";
import { DISCOGS_UA } from "@/lib/discogs";

/**
 * Read at request time, never at module scope.
 *
 * `const TOKEN = process.env.DISCOGS_TOKEN` runs once, when the module is first
 * loaded — and whatever it saw then is what this route believes forever. On
 * Vercel that captured an undefined, and every Discogs call in production
 * failed with "DISCOGS_TOKEN missing": no search, no barcode, no way to add a
 * record at all. A function call costs nothing and cannot go stale.
 */
const token = () => process.env.DISCOGS_TOKEN;

const DATA_PATH = resolve(process.cwd(), "data/vinilos.json");
const COVERS_DIR = resolve(process.cwd(), "public/covers");
const PREVIEWS_DIR = resolve(process.cwd(), "public/previews");

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

async function fileExists(p: string) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * The album on iTunes: a preview, and the cover the label actually published.
 *
 * The artwork is the reason this returns two things now. Discogs images are
 * photographs of somebody's own sleeve — that is the point of the archive, and
 * it is why they are often shot on a kitchen table, at an angle, with the
 * shrink-wrap still on and a window reflected in it. Fine as a record of an
 * object; poor as the thing this app draws at full width on a phone.
 *
 * Apple's is the press artwork: square, straight, high resolution, and the
 * same picture the album has everywhere else. So it is preferred where it can
 * be trusted, and Discogs remains the fallback.
 *
 * **Trusted means matched, not merely returned.** The preview can afford
 * `results[0]` — a wrong thirty seconds is an annoyance. A wrong cover is a
 * different record on your shelf, so the artwork only travels when the album
 * name and the artist both survive normalisation.
 */
async function searchItunesAlbum(
  artist: string,
  album: string,
): Promise<{ preview: string | null; artwork: string | null }> {
  const empty = { preview: null, artwork: null };
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    // ten rather than three: Apple ranks singles above albums often enough
    // that the record you actually asked for can sit fourth
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=10`;
    const r = await fetch(url);
    if (!r.ok) return empty;
    const data = await r.json();
    const norm = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "");
    const target = norm(album);
    const wantArtist = norm(artist);

    const results = data.results ?? [];
    const loose =
      results.find((c: any) => norm(c.collectionName ?? "").includes(target)) ?? results[0];
    if (!loose?.collectionId) return empty;

    /**
     * The stricter test, for the picture only — and exactness first.
     *
     * "Rumours" comes back alongside "Rumours (Live)" and "Rumours (Super
     * Deluxe Edition)", and a contains-test would take whichever Apple
     * happened to rank first. A deluxe edition's artwork is usually the same
     * picture and sometimes is not, so the plain name wins when there is one.
     */
    const artistOk = (c: any) => {
      const by = norm(c.artistName ?? "");
      return by.includes(wantArtist) || wantArtist.includes(by);
    };
    const strict =
      results.find((c: any) => norm(c.collectionName ?? "") === target && artistOk(c)) ??
      results.find((c: any) => {
        const name = norm(c.collectionName ?? "");
        return (name.includes(target) || target.includes(name)) && artistOk(c);
      });

    /**
     * 100×100 is what the search returns and it is a thumbnail. The size lives
     * in the filename, so asking for a bigger one is a string replacement —
     * undocumented, stable for a decade, and the difference between a cover
     * that survives a phone screen and one that does not.
     */
    const artwork: string | null = strict?.artworkUrl100
      ? String(strict.artworkUrl100).replace(/\/\d+x\d+bb\./, "/1000x1000bb.")
      : null;

    const tracksRes = await fetch(
      `https://itunes.apple.com/lookup?id=${loose.collectionId}&entity=song&limit=5`,
    );
    if (!tracksRes.ok) return { preview: null, artwork };
    const tracksData = await tracksRes.json();
    const songs = (tracksData.results ?? []).filter((r: any) => r.wrapperType === "track");
    return { preview: songs[0]?.previewUrl ?? null, artwork };
  } catch {
    return empty;
  }
}

export async function POST(req: NextRequest) {
  if (!token()) {
    return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });
  }
  const { releaseId, isMaster } = await req.json();
  if (!releaseId) return Response.json({ error: "releaseId required" }, { status: 400 });

  const call = (path: string) =>
    fetch(`https://api.discogs.com/${path}`, {
      headers: { "User-Agent": DISCOGS_UA, Authorization: `Discogs token=${token()}` },
    });

  /**
   * A master id is not a release id, and Discogs will happily serve you a
   * different record under the same number.
   *
   * The search deliberately returns masters — they are the canonical entry for
   * an album, above its forty pressings — and flags them with `isMaster`. This
   * route used to ignore the flag and ask /releases/{id} regardless, so asking
   * for the master of "Rumours Live" returned Ferrante & Teicher's "Midnight
   * Cowboy": a valid record, a plausible-looking import, and the wrong one.
   * Silent, because nothing in the chain had any way to notice.
   *
   * A master resolves to its `main_release`, which is the pressing Discogs
   * considers definitive — and the one someone searching by album name meant.
   */
  let id = releaseId;
  if (isMaster) {
    const m = await call(`masters/${releaseId}`);
    if (!m.ok) return Response.json({ error: `discogs master ${m.status}` }, { status: m.status });
    const master = await m.json();
    id = master.main_release ?? releaseId;
  }

  const r = await call(`releases/${id}`);
  if (!r.ok) return Response.json({ error: `discogs ${r.status}` }, { status: r.status });
  const release = await r.json();

  // build a Vinyl entry — strip Discogs' (N) disambiguators
  const cleanName = (s: string) => s.replace(/\s\(\d+\)/g, "").trim();
  const artist = cleanName(release.artists?.[0]?.name ?? "Unknown");
  const title = cleanName(release.title ?? "Untitled");
  const slug = `${slugify(artist)}-${slugify(title)}-${id}`;

  // Vercel's filesystem is read-only: there we serve the artwork through our
  // own image proxy instead of keeping a copy on disk.
  const canWriteToDisk = !process.env.VERCEL;

  if (canWriteToDisk) await mkdir(COVERS_DIR, { recursive: true });

  /**
   * The album is looked up before the cover is chosen, because it holds one.
   *
   * It was already being called for the preview; the artwork was sitting in
   * the same response and being thrown away. Asking once and using both is the
   * cheapest improvement available here — no extra request, and the match has
   * already been established by the thing we came for.
   */
  const itunes = await searchItunesAlbum(artist, title);

  let coverPath: string | null = null;
  const discogsImg: string | undefined =
    release.images?.find((i: any) => i.type === "primary")?.uri ?? release.images?.[0]?.uri;
  /**
   * Apple's press artwork wins when there is any.
   *
   * A Discogs image is a photograph of one person's copy — angled, lit by a
   * kitchen window, sometimes still in its shrink-wrap. That is exactly right
   * for an archive of pressings and wrong for the picture this app draws at
   * full width on a phone. Where the two disagree the cost is that a sleeve
   * with genuinely different art — an obi strip, a colour variant, a regional
   * cover — shows the digital release's picture instead. That is the trade,
   * and it is one line to reverse if it ever stops being worth it.
   */
  const imgUrl: string | undefined = itunes.artwork ?? discogsImg;
  if (imgUrl && !canWriteToDisk) {
    coverPath = `/api/cover?url=${encodeURIComponent(imgUrl)}`;
  } else if (imgUrl) {
    try {
      const imgRes = await fetch(imgUrl, { headers: { "User-Agent": DISCOGS_UA } });
      if (imgRes.ok) {
        const ext = imgUrl.match(/\.(jpe?g|png|webp)(\?|$)/i)?.[1]?.toLowerCase() ?? "jpg";
        const filename = `${slug}.${ext === "jpeg" ? "jpg" : ext}`;
        const dest = resolve(COVERS_DIR, filename);
        const buf = Buffer.from(await imgRes.arrayBuffer());
        await writeFile(dest, buf);
        coverPath = `/covers/${filename}`;
      }
    } catch {}
  }

  // preview: iTunes first, then Deezer (downloaded locally — its URLs expire)
  let previewUrl = itunes.preview;
  if (!previewUrl && canWriteToDisk) {
    await mkdir(PREVIEWS_DIR, { recursive: true });
    const dest = resolve(PREVIEWS_DIR, `${slug}.mp3`);
    if (await downloadDeezerPreview(artist, title, dest)) {
      previewUrl = `/previews/${slug}.mp3`;
    }
  }

  const vinyl: Vinyl = {
    id: slug,
    title,
    artist,
    year: release.year ?? 0,
    genre: (release.genres ?? [])[0] ?? "",
    label: release.labels?.[0]?.name ?? "",
    country: release.country ?? "",
    palette: ["#888", "#666", "#444", "#222", "#000"],
    discogsId: id,
    cover: coverPath,
    previewUrl,
    tracklist: (release.tracklist ?? []).map((t: any) => ({
      position: t.position || "",
      title: t.title || "",
      duration: t.duration || "",
    })),
  };

  // The local catalogue file is a development convenience; in production the
  // record is stored in Supabase by the caller.
  if (canWriteToDisk) try {
    const raw = await readFile(DATA_PATH, "utf8");
    const list: Vinyl[] = JSON.parse(raw);
    if (!list.some((v) => v.id === vinyl.id)) {
      list.push(vinyl);
      await writeFile(DATA_PATH, JSON.stringify(list, null, 2) + "\n");
    }
  } catch {}

  return Response.json({ vinyl });
}
