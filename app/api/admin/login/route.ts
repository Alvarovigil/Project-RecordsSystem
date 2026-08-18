import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, COOKIE_OPTIONS, issueToken, passwordMatches } from "@/lib/admin/auth";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const password = String(form.get("password") ?? "");

  if (!passwordMatches(password)) {
    return NextResponse.redirect(new URL("/admin/login?error=1", req.nextUrl.origin), 303);
  }
  const res = NextResponse.redirect(new URL("/admin", req.nextUrl.origin), 303);
  res.cookies.set(ADMIN_COOKIE, issueToken(), COOKIE_OPTIONS);
  return res;
}

/** Sign out: the form posts here with ?logout=1 */
export async function GET(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/admin/login", req.nextUrl.origin), 303);
  res.cookies.set(ADMIN_COOKIE, "", { ...COOKIE_OPTIONS, maxAge: 0 });
  return res;
}
