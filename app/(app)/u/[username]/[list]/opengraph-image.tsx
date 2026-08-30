import { ImageResponse } from "next/og";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const alt = "Un rack en Rackr";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** A shared list arrives with its name, its size and whose it is. */
export default async function Image({
  params,
}: {
  params: { username: string; list: string };
}) {
  const supabase = getSupabaseServerClient();
  const { data: profile } = (await supabase
    ?.from("profiles")
    .select("id, display_name")
    .eq("username", params.username)
    .maybeSingle()) ?? { data: null };

  const { data: list } = profile
    ? await supabase!
        .from("lists")
        .select("title, description, item_count")
        .eq("owner_id", profile.id)
        .eq("slug", params.list)
        .maybeSingle()
    : { data: null };

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
          Rackr · lista
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <span style={{ fontSize: 72, lineHeight: 1.05, letterSpacing: -2 }}>
            {list?.title ?? params.list}
          </span>
          {list?.description ? (
            <span style={{ fontSize: 28, opacity: 0.55, maxWidth: 900 }}>
              {list.description.slice(0, 140)}
            </span>
          ) : null}
        </div>
        <span style={{ fontSize: 26, opacity: 0.45 }}>
          {list?.item_count ?? 0} discos · {profile?.display_name ?? params.username}
        </span>
      </div>
    ),
    size,
  );
}
