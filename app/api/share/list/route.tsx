import { NextRequest } from "next/server";
import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * A rack, as a picture you can put in a story.
 *
 * Same argument as the record card: what travels between people is an image,
 * not a link to an app they have not installed. A list is harder to draw than
 * a record, though — there is no single object to photograph, so the covers
 * themselves are the picture. Four of them, in a grid, big enough that
 * somebody recognises one and asks about it.
 *
 * Everything is read server-side from public data: the list has to be public
 * to be drawn at all, which is the same rule the page it points at follows.
 */

export const runtime = "nodejs";
const size = { width: 1080, height: 1920 };

const INK = "#0a0a0a";
const PAPER = "#f5f3ef";

export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("user");
  const slug = req.nextUrl.searchParams.get("list");
  if (!username || !slug) return new Response("user and list required", { status: 400 });

  const supabase = getSupabaseServerClient();
  if (!supabase) return new Response("not available", { status: 503 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, username")
    .eq("username", username)
    .maybeSingle();
  if (!profile) return new Response("not found", { status: 404 });

  const { data: list } = await supabase
    .from("lists")
    .select("id, title, item_count, visibility")
    .eq("owner_id", profile.id)
    .eq("slug", slug)
    .maybeSingle();
  if (!list || list.visibility !== "public") return new Response("not found", { status: 404 });

  const { data: items } = await supabase
    .from("list_items")
    .select("releases(cover_url)")
    .eq("list_id", list.id)
    .limit(4);

  const origin = req.nextUrl.origin;
  const covers = (items ?? [])
    .map((i: any) => i.releases?.cover_url)
    .filter(Boolean)
    .map((c: string) => (c.startsWith("http") ? c : `${origin}${c}`));

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

        {/* The covers are the picture. A grid rather than a fanned stack: at
            this size overlapping sleeves hide exactly the thing somebody might
            recognise. */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            width: 900,
            gap: 0,
            boxShadow: "0 60px 120px rgba(0,0,0,0.65)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) =>
            covers[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={covers[i]}
                alt=""
                width={450}
                height={450}
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div key={i} style={{ width: 450, height: 450, background: "#141414", display: "flex" }} />
            ),
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
            {list.title}
          </span>
          <span style={{ fontSize: 40, opacity: 0.55, textAlign: "center" }}>
            un rack de {profile.display_name ?? `@${profile.username}`}
          </span>
          <span style={{ fontSize: 28, opacity: 0.35, letterSpacing: 2 }}>
            {list.item_count} {list.item_count === 1 ? "disco" : "discos"}
          </span>
        </div>

        <span style={{ fontSize: 30, opacity: 0.45, letterSpacing: 2 }}>
          rackr.club/u/{profile.username}
        </span>
      </div>
    ),
    size,
  );
}
