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
 * The name that fits under an icon.
 *
 * iOS gives a home-screen label about eleven characters before it truncates,
 * and "Rackr Club" is ten — it fits, but only just, and a name that might
 * become "Rackr Cl…" on a wide font is not a name. The full one goes wherever
 * there is room: the install dialogue, the tab, the cards people share. This
 * one goes under the icon, where it is the app's face and has to be certain.
 */
export const SITE_SHORT_NAME = "Rackr";

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
