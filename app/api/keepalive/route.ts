import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

/**
 * Keeps the database awake.
 *
 * On Supabase's free plan a project that goes a week without requests is
 * paused, and it does not wake up by itself: rackr.club stays down until
 * somebody restores it by hand from the dashboard. With a handful of people
 * using it, a quiet week is entirely possible. Vercel calls this once a day
 * (vercel.json) and the smallest real query is enough to count as activity.
 *
 * Anonymous and read-only on purpose: it asks for one public id and nothing
 * else, so there is nothing here worth protecting with a secret.
 */
export async function GET() {
  if (!isSupabaseConfigured) return NextResponse.json({ ok: false, reason: "sin_configurar" });
  const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error } = await sb.from("profiles").select("id").limit(1);
  return NextResponse.json({ ok: !error }, { status: error ? 503 : 200 });
}
