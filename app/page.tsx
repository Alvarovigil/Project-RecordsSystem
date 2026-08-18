import { redirect } from "next/navigation";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Landing from "@/components/Landing";

export const dynamic = "force-dynamic";

/**
 * The door. Signed in you go straight to your shelf; signed out you get the
 * landing — and nothing of the 3D engine is even downloaded, because the app
 * lives on its own route with its own bundle.
 */
export default async function Home() {
  if (!isSupabaseConfigured) redirect("/estanteria");

  const supabase = getSupabaseServerClient();
  const { data } = (await supabase?.auth.getUser()) ?? { data: { user: null } };
  if (data.user) redirect("/estanteria");

  return <Landing />;
}
