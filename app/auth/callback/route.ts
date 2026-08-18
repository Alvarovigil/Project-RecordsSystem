import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * Where Google sends you back.
 *
 * The cookie adapters are bound to THIS response on purpose: the session
 * cookies have to travel with the redirect, and writing them to the ambient
 * store is what silently loses them.
 */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/inicio";
  const fail = (reason: string) =>
    NextResponse.redirect(
      new URL(`/?auth=error&reason=${encodeURIComponent(reason)}`, req.nextUrl.origin),
    );

  if (!isSupabaseConfigured) return fail("sin_configurar");
  if (!code) return fail("sin_codigo");

  const response = NextResponse.redirect(new URL(next, req.nextUrl.origin));

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) =>
        list.forEach(({ name, value, options }) =>
          response.cookies.set({ name, value, ...options }),
        ),
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return fail(error.message);

  return response;
}
