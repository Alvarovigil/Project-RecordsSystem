import { NextRequest } from "next/server";

/**
 * Streams an iTunes 30s preview through our own origin.
 *
 * Apple serves these files as `audio/x-m4p` (the old DRM-protected iTunes
 * type), which browsers refuse to decode — the <audio> element errors out and
 * nothing is heard. The bytes are a plain AAC/MP4 stream, so we only need to
 * re-label the response as `audio/mp4`. Range requests are passed through so
 * seeking still works.
 */
const ALLOWED_HOSTS = [
  "audio-ssl.itunes.apple.com",
  "audio-ssl.mzstatic.com",
  "cdn-preview-a.dzcdn.net",
];

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

  const range = req.headers.get("range");
  const upstream = await fetch(target.toString(), {
    headers: range ? { Range: range } : {},
    cache: "no-store",
  });
  if (!upstream.ok && upstream.status !== 206) {
    return new Response("upstream error", { status: 502 });
  }

  const headers = new Headers();
  headers.set("Content-Type", "audio/mp4");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Cache-Control", "public, max-age=86400");
  for (const h of ["content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new Response(upstream.body, { status: upstream.status, headers });
}
