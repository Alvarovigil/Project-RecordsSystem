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

export const SITE_NAME = "Rackr Club";

/**
 * The name under the icon.
 *
 * The same one, deliberately. iOS truncates a home-screen label at around
 * eleven characters and "Rackr Club" is ten, so it fits — with nothing to
 * spare, which is the risk taken here on purpose: an icon that says something
 * different from the app it opens is a worse problem than an ellipsis on an
 * unusually wide font. It stays a separate constant because it is a separate
 * decision, and the day a longer name arrives this is where it gets shortened.
 */
export const SITE_SHORT_NAME = "Rackr Club";

/**
 * In English, on purpose, and the only line in the product that is.
 *
 * It rides next to the name wherever the name appears — the tab, the shared
 * card, the search result — so it works as part of the mark rather than as a
 * sentence: "Rackr Club — Your records. Your people." The interface stays in
 * Spanish because that is who uses it; a strapline is signage, not copy.
 */
export const SITE_TAGLINE = "Your records. Your people.";
export const SITE_DESCRIPTION =
  "Tu colección de vinilos, más allá de la estantería. Organiza, descubre y comparte tu colección con el club.";
