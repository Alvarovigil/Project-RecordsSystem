import { NextRequest } from "next/server";

/**
 * Streams a Discogs cover through our own origin.
 *
 * On a read-only filesystem (Vercel) we can't keep a local copy, and Discogs
 * blocks hotlinking from other sites — so the image has to come from here.
 */
const ALLOWED_HOSTS = ["i.discogs.com", "img.discogs.com", "st.discogs.com"];

/**
 * Apple's artwork host, which is five numbered mirrors rather than one name.
 *
 * Album covers now come from iTunes where they can be matched — see the
 * release route — and they arrive from whichever of is1…is5 Apple happens to
 * hand out. They are not hotlink-protected the way Discogs is, but they come
 * through here anyway: it is what gives them the same year-long cache, the
 * same service-worker entry, and — the part that matters — the same origin, so
 * a canvas can read their pixels for the colours this app lights its screens
 * with.
 */
const MZSTATIC = /^is\d+-ssl\.mzstatic\.com$/;

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  const allowed =
    ALLOWED_HOSTS.includes(target.hostname) || MZSTATIC.test(target.hostname);
  if (target.protocol !== "https:" || !allowed) {
    return new Response("host not allowed", { status: 403 });
  }

  const upstream = await fetch(target.toString(), {
    headers: { "User-Agent": "RackrClub/1.0 +https://rackr.club" },
  });
  if (!upstream.ok) return new Response("upstream error", { status: 502 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // covers never change: cache hard, at the edge and in the browser
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
