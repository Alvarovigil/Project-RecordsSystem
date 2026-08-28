/**
 * How this app introduces itself to Discogs.
 *
 * Their terms ask for a User-Agent that identifies the application and points
 * at it, and they throttle or block clients that send something generic. Ours
 * said `VinilosApp/0.1 +local` — a name the product stopped using, a version
 * that never moved, and a claim to be running on someone's laptop while
 * serving production traffic. Three of the four routes said that; the fourth
 * said something else entirely.
 *
 * It matters beyond tidiness: the day we ask Discogs for a higher rate limit,
 * this string is the first thing they will look at.
 */
export const DISCOGS_UA = "Rackr/1.0 +https://rackr.club";

/** Read at request time — a module-scope capture goes stale on Vercel. */
export const discogsToken = () => process.env.DISCOGS_TOKEN;

export const discogsHeaders = () => ({
  "User-Agent": DISCOGS_UA,
  Authorization: `Discogs token=${discogsToken()}`,
});
