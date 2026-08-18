import { NextRequest, NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * The panel's write side. Deliberately small: hide, delete, and nothing that
 * silently rewrites someone's collection.
 */
export async function POST(req: NextRequest) {
  if (!isAdminRequest()) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin), 303);
  }
  const sb = getSupabaseAdminClient();
  if (!sb) return new Response("service key missing", { status: 500 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const listId = String(form.get("listId") ?? "");
  const userId = String(form.get("userId") ?? "");

  switch (action) {
    case "hide-list":
      await sb.from("lists").update({ visibility: "private" }).eq("id", listId);
      break;
    case "publish-list":
      await sb.from("lists").update({ visibility: "public" }).eq("id", listId);
      break;
    case "delete-list":
      await sb.from("lists").delete().eq("id", listId);
      break;
    case "delete-user":
      // removing the auth user cascades to profile, lists and follows
      await sb.auth.admin.deleteUser(userId);
      return NextResponse.redirect(new URL("/admin", req.nextUrl.origin), 303);
    default:
      return new Response("unknown action", { status: 400 });
  }

  const back = req.headers.get("referer") ?? "/admin";
  return NextResponse.redirect(new URL(back, req.nextUrl.origin), 303);
}
