/*
 * Rackr's service worker.
 *
 * Deliberately small. A worker that precaches the whole application is a
 * worker that serves last week's build to somebody who reloaded to get the
 * fix — the failure mode is invisible, it survives a hard refresh, and it is
 * the reason most sites that add one end up regretting it. This one caches
 * only what cannot go stale by definition, and asks the network first for
 * everything else.
 *
 * What it buys, in order of how much it matters here:
 *
 * 1. **A cold launch that is not a download.** Opening the app from the home
 *    screen re-fetched every script every time. Next's static assets are
 *    content-hashed — a changed file is a changed URL — so they can be served
 *    from cache immediately and forever, safely.
 * 2. **Sleeves that stay put.** Cover art never changes and there is a lot of
 *    it; on a phone it was the bulk of the bytes on every screen.
 * 3. **A real installation on Android.** Chrome will not fire the install
 *    prompt, and will not build a WebAPK, without a worker that answers fetch.
 *    Without one, "add to home screen" makes a bookmark that opens in a
 *    browser — which quietly broke the entire installed-app flow on Android.
 * 4. **Something on screen with no signal.** A navigation that fails falls
 *    back to the last page this device saw rather than the dinosaur.
 */

const VERSION = "v1";
const SHELL = `rackr-shell-${VERSION}`;   // hashed build assets
const MEDIA = `rackr-media-${VERSION}`;   // cover art
const PAGES = `rackr-pages-${VERSION}`;   // last-seen documents, for offline

/** cover art is capped, oldest out first: a big collection is a lot of jpegs */
const MEDIA_MAX = 400;

/**
 * Build assets are capped too.
 *
 * Hashed filenames mean a deploy never overwrites an entry, it adds new ones —
 * so without a ceiling this cache grows by the size of the app on every
 * release and never shrinks. The old entries are harmless and useless: nothing
 * requests them again.
 */
const SHELL_MAX = 120;

self.addEventListener("install", (event) => {
  // nothing is precached on purpose — see the note above
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("rackr-") && !k.endsWith(VERSION))
          .map((k) => caches.delete(k)),
      );
      await self.clients.claim();
    })(),
  );
});

/** the page can ask for the new worker to take over without a second reload */
self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

async function trim(cacheName, max) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= max) return;
  await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

/** immutable by construction: hashed filename, or an image that never changes */
async function cacheFirst(request, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res && res.status === 200 && res.type !== "opaque") {
    cache.put(request, res.clone());
    if (max) trim(cacheName, max);
  }
  return res;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const res = await fetch(request);
    if (res && res.status === 200) cache.put(request, res.clone());
    return res;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never the API. Everything under /api is either somebody's live data or a
  // metered call to Discogs, and both are wrong to answer from a cupboard.
  // The one exception is the cover proxy, which is images.
  if (url.pathname.startsWith("/api/") && url.pathname !== "/api/cover") return;

  // Never authentication: a cached redirect in an OAuth exchange is a session
  // that cannot be established and cannot be debugged.
  if (url.pathname.startsWith("/auth/")) return;

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(cacheFirst(request, SHELL, SHELL_MAX));
    return;
  }

  if (
    url.pathname === "/api/cover" ||
    url.pathname.startsWith("/covers/") ||
    /\.(?:png|jpe?g|webp|avif|svg|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, MEDIA, MEDIA_MAX));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGES));
  }
});
