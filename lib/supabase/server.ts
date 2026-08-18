import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Server client bound to the request cookies (route handlers, RSC). */
export function getSupabaseServerClient() {
  if (!isSupabaseConfigured) return null;
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set({ name, value, ...options }));
        } catch {
          // Server Components can't write cookies; the session is refreshed by
          // the route handlers instead, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Elevated client for catalogue writes (importing a release from Discogs).
 * Never import this from client code — it bypasses RLS by design.
 */
export function getSupabaseAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!isSupabaseConfigured || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
