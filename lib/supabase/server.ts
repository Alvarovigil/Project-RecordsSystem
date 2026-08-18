import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Server client bound to the request cookies (route handlers, RSC). */
export function getSupabaseServerClient() {
  if (!isSupabaseConfigured) return null;
  const store = cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: (name) => store.get(name)?.value,
      set: (name, value, options) => {
        try {
          store.set({ name, value, ...options });
        } catch {
          // called from a Server Component: the middleware refreshes instead
        }
      },
      remove: (name, options) => {
        try {
          store.set({ name, value: "", ...options });
        } catch {}
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
  return createServerClient(SUPABASE_URL, key, {
    cookies: { get: () => undefined, set: () => {}, remove: () => {} },
  });
}
