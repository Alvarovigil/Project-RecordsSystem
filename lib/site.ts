/**
 * Where this site lives.
 *
 * Metadata needs absolute URLs, and hardcoding a domain means every shared
 * link points at whatever deployment existed the day it was written.
 */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

export const SITE_NAME = "Rackr";
export const SITE_TAGLINE = "Los discos que tienes, y quién más los tiene";
export const SITE_DESCRIPTION =
  "Cataloga tu colección de vinilos, ordénala en listas y escúchala. Cada disco es una puerta: mira en qué listas de otras personas aparece.";
