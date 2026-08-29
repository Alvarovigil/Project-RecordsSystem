import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/admin/auth";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * The panel's write side. Deliberately small: hide, suspend, delete, and
 * nothing that silently rewrites someone's collection.
 *
 * Two rules govern everything here.
 *
 * **Suspending is not deleting.** Almost every reason to act on an account —
 * a report, a suspicion, a dispute — is provisional, and the only tool used to
 * be a permanent one. A suspension locks the account out and leaves everything
 * standing; you can undo it tomorrow when it turns out you were wrong.
 *
 * **Deleting asks you to type the handle.** It cascades to the profile, every
 * list, every saved record and the whole follow graph, and none of it comes
 * back. A button you can hit by accident is the wrong shape for that, so the
 * server refuses unless the confirmation matches the username exactly. The
 * check lives here rather than in the browser because that is where it cannot
 * be skipped.
 */
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin), 303);
  }
  const sb = getSupabaseAdminClient();
  if (!sb) return new Response("service key missing", { status: 500 });

  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const listId = String(form.get("listId") ?? "");
  const userId = String(form.get("userId") ?? "");
  const confirm = String(form.get("confirm") ?? "").trim();

  const back = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin), 303);

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
    case "verify-user":
    case "unverify-user": {
      /**
       * Granted and taken back by hand, from here and nowhere else.
       *
       * The column has no write policy at all, so this route — which enters
       * with the service key — is the only thing in the system that can set
       * it. An account cannot verify itself, which is the entire point of a
       * verification.
       */
      await sb
        .from("profiles")
        .update({ verified: action === "verify-user" })
        .eq("id", userId);
      return back(`/admin/u/${userId}?done=${action === "verify-user" ? "verificado" : "sin-verificar"}`);
    }

    case "suspend-user": {
      // a hundred years is Supabase's idiom for "until someone lifts it"
      await sb.auth.admin.updateUserById(userId, { ban_duration: "876000h" });
      return back(`/admin/u/${userId}?done=suspendido`);
    }

    case "unsuspend-user": {
      await sb.auth.admin.updateUserById(userId, { ban_duration: "none" });
      return back(`/admin/u/${userId}?done=reactivado`);
    }

    case "delete-user": {
      // The handle typed in the form has to match the one on the account. The
      // point is not security — an admin could delete anyone anyway — it is
      // that you cannot do it while thinking about something else.
      const { data } = await sb
        .from("profiles")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      if (!data || confirm.toLowerCase() !== String(data.username).toLowerCase()) {
        return back(`/admin/u/${userId}?error=confirmacion`);
      }
      // removing the auth user cascades to profile, lists and follows
      await sb.auth.admin.deleteUser(userId);
      return back("/admin?done=usuario-eliminado");
    }
    default:
      return new Response("unknown action", { status: 400 });
  }

  return back(req.headers.get("referer") ?? "/admin");
}
