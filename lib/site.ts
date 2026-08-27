/**
 * Where this site lives.
 *
 * Metadata needs absolute URLs, and hardcoding a domain means every shared
 * link points at whatever deployment existed the day it was written.
 */
const LOCAL = "http://localhost:3000";

/**
 * An environment variable that was typed into a web form.
 *
 * `??` was wrong here: it only falls back on null and undefined, and the way
 * these actually go missing is a key added in a dashboard with the value left
 * blank. That produced `new URL("")` and took the whole build down with
 * `TypeError: Invalid URL` — a message that names neither the variable nor the
 * file. An empty string is an absent value; treat it as one.
 */
const env = (value: string | undefined) => {
  const clean = value?.trim();
  return clean ? clean : undefined;
};

/**
 * Whatever we end up with has to survive `new URL()`, because the caller is
 * page metadata and a bad value there fails the build rather than the page.
 * A wrong-but-valid origin costs a wrong canonical link; an invalid one costs
 * the deploy.
 */
const usable = (candidate: string | undefined) => {
  if (!candidate) return undefined;
  try {
    return new URL(candidate).origin;
  } catch {
    return undefined;
  }
};

const host = (value: string | undefined) => {
  const clean = env(value);
  return clean ? `https://${clean}` : undefined;
};

export const SITE_URL =
  usable(env(process.env.NEXT_PUBLIC_SITE_URL)) ??
  // Vercel sets these itself, so a preview deploy links to itself rather than
  // to production or to localhost
  usable(host(process.env.VERCEL_PROJECT_PRODUCTION_URL)) ??
  usable(host(process.env.VERCEL_URL)) ??
  LOCAL;

export const SITE_NAME = "Rackr";
export const SITE_TAGLINE = "Tu vida en discos";
export const SITE_DESCRIPTION =
  "Cataloga los vinilos que tienes, apunta los que te faltan y mira lo que guardan los demás. Sin anuncios y sin recomendaciones automáticas.";
