"use client";

import { useEffect } from "react";

/**
 * Registers the worker, once, after the page is usable.
 *
 * Deferred to `load` on purpose: registration competes with the very first
 * paint for the main thread, and a worker that arrives a second late costs
 * nothing — it is for the *next* visit.
 *
 * An updated worker takes over as soon as it is ready rather than waiting for
 * every tab to close. Combined with the worker's own rule of never caching
 * documents or the API, that means a deploy reaches people on their next
 * navigation instead of whenever they happen to quit the app.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          reg.addEventListener("updatefound", () => {
            const next = reg.installing;
            if (!next) return;
            next.addEventListener("statechange", () => {
              if (next.state === "installed" && navigator.serviceWorker.controller) {
                next.postMessage("skip-waiting");
              }
            });
          });
        })
        .catch(() => {
          /* a browser that refuses it simply goes without */
        });
    };

    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
