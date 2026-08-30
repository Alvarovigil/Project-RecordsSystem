import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const alt = "Perfil en Rackr";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A shared profile arrives with the person's name and what they've built. */
export default async function Image({ params }: { params: { username: string } }) {
  const supabase = getSupabaseServerClient();
  const { data: profile } = (await supabase
    ?.from("profiles")
    .select("id, display_name, bio")
    .eq("username", params.username)
    .maybeSingle()) ?? { data: null };

  const { count } = profile
    ? await supabase!
        .from("lists")
        .select("*", { count: "exact", head: true })
        .eq("owner_id", profile.id)
        .eq("visibility", "public")
    : { count: 0 };

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0a0a",
          color: "#f5f3ef",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <span style={{ fontSize: 22, letterSpacing: 6, textTransform: "uppercase", opacity: 0.45 }}>
          Rackr · perfil
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 72, lineHeight: 1.05, letterSpacing: -2 }}>
            {profile?.display_name ?? params.username}
          </span>
          <span style={{ fontSize: 30, opacity: 0.5 }}>@{params.username}</span>
          {profile?.bio ? (
            <span style={{ fontSize: 28, opacity: 0.55, maxWidth: 900 }}>
              {profile.bio.slice(0, 120)}
            </span>
          ) : null}
        </div>
        <span style={{ fontSize: 26, opacity: 0.45 }}>
          {count ?? 0} {count === 1 ? "rack público" : "racks públicos"}
        </span>
      </div>
    ),
    size,
  );
}
