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

/**
 * Never nothing.
 *
 * A cover now comes from Apple where the album could be matched and from
 * Discogs otherwise — see the release route. That choice is made once, at
 * import, and stored; if the URL it picked ever stops answering, the record
 * would draw an empty square for the rest of its life.
 *
 * So the caller can pass the other one as `alt`, and this tries them in order.
 * It costs nothing when the first works, which is almost always, and it means
 * the only way to end up with no picture is for both hosts to be down at once
 * — at which point `coverFor` still draws the sleeve from the record's own
 * palette, and there is still no empty square.
 */
async function pull(url: string) {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": "RackrClub/1.0 +https://rackr.club" },
    });
    return r.ok ? r : null;
  } catch {
    return null;
  }
}

function permitted(raw: string | null): URL | null {
  if (!raw) return null;
  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return null;
  }
  const allowed =
    ALLOWED_HOSTS.includes(target.hostname) || MZSTATIC.test(target.hostname);
  return target.protocol === "https:" && allowed ? target : null;
}

export async function GET(req: NextRequest) {
  const target = permitted(req.nextUrl.searchParams.get("url"));
  if (!target) return new Response("bad url", { status: 400 });

  const alt = permitted(req.nextUrl.searchParams.get("alt"));

  const upstream = (await pull(target.toString())) ?? (alt ? await pull(alt.toString()) : null);
  if (!upstream) return new Response("upstream error", { status: 502 });

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
      // covers never change: cache hard, at the edge and in the browser
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
