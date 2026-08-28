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

async function searchItunesPreview(artist: string, album: string): Promise<string | null> {
  try {
    const term = encodeURIComponent(`${artist} ${album}`);
    const url = `https://itunes.apple.com/search?term=${term}&entity=album&limit=3`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const target = norm(album);
    const match =
      (data.results ?? []).find((c: any) => norm(c.collectionName ?? "").includes(target)) ??
      data.results?.[0];
    if (!match?.collectionId) return null;
    const tracksRes = await fetch(
      `https://itunes.apple.com/lookup?id=${match.collectionId}&entity=song&limit=5`,
    );
    if (!tracksRes.ok) return null;
    const tracksData = await tracksRes.json();
    const songs = (tracksData.results ?? []).filter((r: any) => r.wrapperType === "track");
    return songs[0]?.previewUrl ?? null;
  } catch {
    return null;
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
  let coverPath: string | null = null;
  const imgUrl: string | undefined =
    release.images?.find((i: any) => i.type === "primary")?.uri ?? release.images?.[0]?.uri;
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
  let previewUrl = await searchItunesPreview(artist, title);
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
