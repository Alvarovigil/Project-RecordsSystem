import { writeFile } from "node:fs/promises";

// Deezer preview URLs are signed and expire within hours, so they can't be
// stored. We download the 30s mp3 locally instead (same pattern as covers).
// Deezer's catalogue covers releases iTunes misses (e.g. recent Rosalía).

const norm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

const similar = (a: string, b: string) => {
  const x = norm(a);
  const y = norm(b);
  return !!x && !!y && (x.includes(y) || y.includes(x));
};

/**
 * Find a 30s preview on Deezer and download it to `destFile`.
 * Returns true on success. Matches on album title (and artist, unless the
 * release is a "Various Artists" compilation) so cover/tribute versions that
 * share a track or album name are rejected.
 */
export async function downloadDeezerPreview(
  artist: string,
  album: string,
  destFile: string,
): Promise<boolean> {
  try {
    const q = encodeURIComponent(`${artist} ${album}`);
    const res = await fetch(`https://api.deezer.com/search?q=${q}&limit=25`);
    if (!res.ok) return false;
    const tracks: any[] = ((await res.json()).data ?? []).filter((t: any) => t.preview);
    if (!tracks.length) return false;

    const isVarious = /^various/i.test(artist);
    const best =
      tracks.find(
        (t) =>
          similar(album, t.album?.title ?? "") &&
          (isVarious || similar(artist, t.artist?.name ?? "")),
      ) ?? (isVarious ? tracks.find((t) => similar(album, t.album?.title ?? "")) : undefined);

    if (!best?.preview) return false;

    const mp3 = await fetch(best.preview);
    if (!mp3.ok) return false;
    await writeFile(destFile, Buffer.from(await mp3.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}
