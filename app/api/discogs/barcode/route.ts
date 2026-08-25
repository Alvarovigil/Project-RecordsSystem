import { NextRequest } from "next/server";

const TOKEN = process.env.DISCOGS_TOKEN;
const UA = "VinilosApp/0.1 +local";

type DiscogsResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string | string[];
  genre?: string | string[];
  cover_image?: string;
  thumb?: string;
  format?: string[];
  community?: { want?: number; have?: number };
};

async function byBarcode(code: string) {
  const url = new URL("https://api.discogs.com/database/search");
  url.searchParams.set("barcode", code);
  url.searchParams.set("type", "release");
  url.searchParams.set("per_page", "50");
  const r = await fetch(url, {
    headers: { "User-Agent": UA, Authorization: `Discogs token=${TOKEN}` },
    next: { revalidate: 3600 },
  });
  if (!r.ok) return [] as DiscogsResult[];
  const data = await r.json();
  return (data.results ?? []) as DiscogsResult[];
}

/**
 * The same physical sleeve can be printed as EAN-13, UPC-A (12 digits) or with
 * the barcode spaced out on Discogs. Scanners hand us the bare digits, so we
 * ask for every shape the number could have been catalogued under.
 */
function variants(raw: string) {
  const digits = raw.replace(/\D/g, "");
  const out = new Set<string>([raw, digits]);
  if (digits.length === 13 && digits.startsWith("0")) out.add(digits.slice(1));
  if (digits.length === 12) out.add(`0${digits}`);
  return Array.from(out).filter(Boolean);
}

export async function GET(req: NextRequest) {
  if (!TOKEN) {
    return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });
  }
  const code = req.nextUrl.searchParams.get("code")?.trim();
  if (!code) return Response.json({ error: "code required" }, { status: 400 });

  const found = (await Promise.all(variants(code).map(byBarcode))).flat();
  const byId = new Map(found.map((r) => [r.id, r]));

  const isVinyl = (r: DiscogsResult) =>
    (r.format ?? []).some((f) => /vinyl|lp|7"|10"|12"/i.test(f));

  // A barcode identifies one pressing, but Discogs often lists the box set, the
  // reissue and the CD under the same number. Vinyl first, then the pressing
  // most people own — that is almost always the one in your hands.
  const ranked = Array.from(byId.values()).sort((a, b) => {
    const fmt = Number(isVinyl(b)) - Number(isVinyl(a));
    if (fmt !== 0) return fmt;
    return (b.community?.have ?? 0) - (a.community?.have ?? 0);
  });

  const cleanTitle = (s: string) => s.replace(/\s\(\d+\)/g, "");
  const results = ranked.slice(0, 8).map((r) => ({
    id: r.id,
    title: cleanTitle(r.title ?? ""),
    year: r.year,
    country: r.country,
    label: Array.isArray(r.label) ? r.label[0] : r.label,
    genre: Array.isArray(r.genre) ? r.genre[0] : r.genre,
    cover_image: r.cover_image,
    thumb: r.thumb,
    format: r.format,
  }));

  return Response.json({ code, results, match: results[0] ?? null });
}
