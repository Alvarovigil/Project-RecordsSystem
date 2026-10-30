/**
 * Where to send somebody after signing in, kept only if it is on this site.
 *
 * Checking the string is not enough: "//otro.com" and "/\otro.com" (also
 * percent-encoded, "/%5Cotro.com" once decoded by a query parser) both look
 * like paths and both leave. So the address is resolved the way a browser
 * will, against a placeholder origin, and kept only if it is still on that
 * origin — returned as path, query and hash, so the caller resolves it
 * against the real one. One function for the four places that take a `next`
 * (the auth callback, /entrar, the sign-in button and the door that reads
 * it), so no copy of the rule can drift into a weaker one.
 */
const BASE = "http://rackr.invalid";

export function safeNext(raw: string | null | undefined, fallback = "/coleccion"): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
