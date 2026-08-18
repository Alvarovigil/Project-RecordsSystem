import type { MetadataRoute } from "next";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { SITE_URL } from "@/lib/site";

export const revalidate = 3600;

/** The landing, plus every public profile and list. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base: MetadataRoute.Sitemap = [
    { url: SITE_URL, priority: 1 },
    { url: `${SITE_URL}/explorar`, priority: 0.6 },
  ];

  const supabase = getSupabaseServerClient();
  if (!supabase) return base;

  const [{ data: profiles }, { data: lists }] = await Promise.all([
    supabase.from("profiles").select("username").limit(1000),
    supabase
      .from("lists")
      .select("slug, updated_at, profiles!inner(username)")
      .eq("visibility", "public")
      .limit(2000),
  ]);

  return [
    ...base,
    ...((profiles ?? []) as any[]).map((p) => ({
      url: `${SITE_URL}/u/${p.username}`,
      priority: 0.7,
    })),
    ...((lists ?? []) as any[]).map((l) => ({
      url: `${SITE_URL}/u/${l.profiles.username}/${l.slug}`,
      lastModified: l.updated_at,
      priority: 0.5,
    })),
  ];
}
