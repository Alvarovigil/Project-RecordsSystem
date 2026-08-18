import { NextRequest } from "next/server";

/**
 * Streams a Discogs cover through our own origin.
 *
 * On a read-only filesystem (Vercel) we can't keep a local copy, and Discogs
 * blocks hotlinking from other sites — so the image has to come from here.
 */
const ALLOWED_HOSTS = ["i.discogs.com", "img.discogs.com", "st.discogs.com"];

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("url");
  if (!raw) return new Response("missing url", { status: 400 });

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.includes(target.hostname)) {
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
