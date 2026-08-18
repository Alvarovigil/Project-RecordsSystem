import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

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

/** True when the current request carries a valid admin session. */
export function isAdminRequest() {
  return verifyToken(cookies().get(ADMIN_COOKIE)?.value);
}

export const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};
