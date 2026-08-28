"use client";

import { useEffect, useState } from "react";

/**
 * Where "back" actually goes.
 *
 * A list can be reached from four places — a profile, Explorar, Actividad, or
 * a record's "quién más lo tiene" — and a back link that always names the
 * owner sends three of those four people somewhere they have never been. It is
 * the same bug as a breadcrumb on a page with no hierarchy: it describes the
 * shape of the data instead of the shape of the visit.
 *
 * So it reads the referrer, and only trusts it when it is one of this app's
 * own screens on this same origin. Anything else — arriving from a shared
 * link, from a search engine, from nothing at all — falls back to the caller's
 * default, which is the one destination that is always true.
 *
 * `document.referrer` rather than history.length: the second only says that
 * there is something behind you, not what it is, and "atrás" to a page you
 * cannot name is exactly the guess this exists to avoid.
 */
export type BackTo = { href: string; label: string };

const KNOWN: { test: RegExp; label: string; href?: string }[] = [
  { test: /^\/explorar/, label: "Explorar" },
  { test: /^\/actividad/, label: "Actividad" },
  { test: /^\/coleccion/, label: "Mi colección" },
  { test: /^\/feed/, label: "Actividad", href: "/actividad" },
  // a profile: the handle IS in the URL, so it can name the person it goes
  // back to rather than describing the kind of page
  { test: /^\/u\/[^/]+$/, label: "" },
];

/**
 * Returns null when it cannot tell, rather than a guess.
 *
 * The caller knows the one destination that is always true for its own page —
 * the owner's profile, for a list — and it usually only knows it once the data
 * has arrived. Handing the fallback in at mount would freeze whatever was
 * known then, which for a page that fetches is "nothing".
 */
export function useBackTo(): BackTo | null {
  const [back, setBack] = useState<BackTo | null>(null);

  useEffect(() => {
    const ref = document.referrer;
    if (!ref) return;
    let url: URL;
    try {
      url = new URL(ref);
    } catch {
      return;
    }
    // never leave the app on a "back": a referrer from another site is a place
    // this link has no business sending anyone
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname) return;

    const hit = KNOWN.find((k) => k.test.test(url.pathname));
    if (!hit) return;
    const handle = url.pathname.match(/^\/u\/([^/]+)$/)?.[1];
    setBack({
      href: hit.href ?? url.pathname + url.search,
      label: hit.label || (handle ? `@${handle}` : "Atrás"),
    });
  }, []);

  return back;
}
