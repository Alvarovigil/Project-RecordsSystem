import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Admin access: one shared password, checked on the server.
 *
 * The cookie carries a signed stamp rather than the password itself, so a
 * stolen cookie can't be replayed once the password changes, and nothing
 * secret is ever readable from the browser.
 */
export const ADMIN_COOKIE = "rackr_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8; // a working session, then back to the door

function secret() {
  return process.env.ADMIN_PASSWORD ?? "";
}

export function adminConfigured() {
  return secret().length >= 8;
}

function sign(issuedAt: number) {
  return createHmac("sha256", secret()).update(String(issuedAt)).digest("hex");
}

export function issueToken() {
  const issuedAt = Date.now();
  return `${issuedAt}.${sign(issuedAt)}`;
}

export function verifyToken(token: string | undefined): boolean {
  if (!token || !adminConfigured()) return false;
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return false;
  if (Date.now() - Number(issuedAt) > MAX_AGE_SECONDS * 1000) return false;
  const expected = sign(Number(issuedAt));
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function passwordMatches(candidate: string) {
  const expected = secret();
  if (!expected) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** True when the current request carries a valid admin password session. */
export function isAdminRequest() {
  return verifyToken(cookies().get(ADMIN_COOKIE)?.value);
}

/**
 * The account that owns the panel.
 *
 * A handle rather than a uuid so it can be set without looking anything up,
 * and read at request time rather than at module load — the same lesson the
 * Discogs token taught in production, where a value captured once was captured
 * as undefined and stayed that way.
 */
export function adminUsername() {
  return (process.env.ADMIN_USERNAME ?? "rackrclub").toLowerCase();
}

/**
 * Admin access, by session or by password.
 *
 * Being signed in as the project's own account is the requirement — asking
 * that person for a second password protects nothing, because anyone holding
 * that session can already do everything the panel does, one screen at a time.
 * The password door stays for the case the session cannot cover: getting in
 * when the account itself is locked out, or from a machine that is not signed
 * in.
 *
 * The check is a server-side read of the session's own profile. It cannot be
 * spoofed from the browser: the username comes from the database, keyed by the
 * user id in a cookie Supabase signs, and a profile's username is unique.
 */
export async function isAdmin() {
  if (isAdminRequest()) return true;
  const sb = getSupabaseServerClient();
  if (!sb) return false;
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return false;
  const { data } = await sb
    .from("profiles")
    .select("username")
    .eq("id", auth.user.id)
    .maybeSingle();
  return String(data?.username ?? "").toLowerCase() === adminUsername();
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
