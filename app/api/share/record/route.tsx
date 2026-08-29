import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { Vinyl } from "@/lib/types";

/**
 * A record, as a picture you can put in a story.
 *
 * Sharing a link to a collection app is asking somebody to tap through to a
 * page they have no account on. A 9:16 image is the thing that actually
 * travels: it works inside Instagram and WhatsApp without leaving them, it
 * survives being screenshotted, and the address at the bottom does the job the
 * link was there to do.
 *
 * Rendered on the server rather than drawn in a canvas on the phone. The card
 * has to look identical everywhere it lands — that is the whole point of it
 * being ours — and a phone canvas gives you whichever font the device happens
 * to have and whatever it decides about pixel ratios.
 *
 * The record is read from our own catalogue by slug, never from the query
 * string. Taking a title and an artist as parameters would be building a
 * machine that prints Rackr-branded cards saying anything at all.
 */

export const runtime = "nodejs";
/** Stories are 1080×1920 everywhere: Instagram, TikTok, WhatsApp. */
const size = { width: 1080, height: 1920 };

const INK = "#0a0a0a";
const PAPER = "#f5f3ef";

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return new Response("slug required", { status: 400 });

  const supabase = getSupabaseServerClient();
  let release = supabase
    ? (
        await supabase
          .from("releases")
          .select("title, artist, year, label, cover_url")
          .eq("slug", slug)
          .maybeSingle()
      ).data
    : null;

  // Without Supabase this is a laptop running on the local catalogue file —
  // the same fallback every other route here keeps.
  if (!release) {
    try {
      const list: Vinyl[] = JSON.parse(
        await readFile(resolve(process.cwd(), "data/vinilos.json"), "utf8"),
      );
      const v = list.find((x) => x.id === slug);
      if (v) release = { title: v.title, artist: v.artist, year: v.year, label: v.label, cover_url: v.cover };
    } catch {}
  }

  if (!release) return new Response("not found", { status: 404 });

  // relative paths live on our own origin; the renderer needs a whole URL
  const origin = req.nextUrl.origin;
  const cover = release.cover_url
    ? release.cover_url.startsWith("http")
      ? release.cover_url
      : `${origin}${release.cover_url}`
    : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "space-between",
          background: INK,
          color: PAPER,
          padding: "120px 90px 100px",
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ fontSize: 26, letterSpacing: 10, textTransform: "uppercase", opacity: 0.4 }}>
          Rackr Club
        </span>

        {/* The sleeve, with the record half out of it — the one drawing that
            says "vinyl" without a word. Everything else on this card is type. */}
        <div style={{ display: "flex", position: "relative", alignItems: "center" }}>
          <div
            style={{
              position: "absolute",
              left: 300,
              width: 620,
              height: 620,
              borderRadius: 310,
              background: "#171717",
              display: "flex",
            }}
          />
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cover}
              alt=""
              width={760}
              height={760}
              style={{ objectFit: "cover", boxShadow: "0 60px 120px rgba(0,0,0,0.65)" }}
            />
          ) : (
            <div style={{ width: 760, height: 760, background: "#141414", display: "flex" }} />
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <span
            style={{
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: -2,
              textAlign: "center",
              maxWidth: 880,
            }}
          >
            {release.title}
          </span>
          <span style={{ fontSize: 44, opacity: 0.6, textAlign: "center" }}>{release.artist}</span>
          <span style={{ fontSize: 28, opacity: 0.35, letterSpacing: 2 }}>
            {[release.year || null, release.label || null].filter(Boolean).join("  ·  ")}
          </span>
        </div>

        <span style={{ fontSize: 30, opacity: 0.45, letterSpacing: 2 }}>rackr.club</span>
      </div>
    ),
    size,
  );
}
