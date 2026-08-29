"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { previousPath } from "@/lib/nav-history";

/**
 * Where "back" actually goes.
 *
 * A list can be reached from four places — a profile, Explorar, Actividad, or
 * a record's "quién más lo tiene" — and a back link that always names the
 * owner sends three of those four people somewhere they have never been. It is
 * the same bug as a breadcrumb on a page with no hierarchy: it describes the
 * shape of the data instead of the shape of the visit.
 *
 * It reads the trail the shell keeps (lib/nav-history) rather than
 * `document.referrer`: a Next.js navigation never leaves the document, so the
 * referrer is frozen at whatever loaded the tab. Built on it, this named the
 * right place exactly once — on a cold load — and lied for the rest of the
 * session.
 *
 * When the previous screen is not one this knows how to name, it returns null
 * and the caller falls back to the one destination that is always true for its
 * own page. Never history.back(): that only says there is something behind
 * you, not what it is, and "atrás" to a page you cannot name is precisely the
 * guess this exists to avoid.
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
  const here = usePathname();

  useEffect(() => {
    const from = previousPath(here);
    if (!from) return;
    const path = from.split("?")[0];
    const hit = KNOWN.find((k) => k.test.test(path));
    if (!hit) return;
    const handle = path.match(/^\/u\/([^/]+)$/)?.[1];
    setBack({
      href: hit.href ?? from,
      label: hit.label || (handle ? `@${handle}` : "Atrás"),
    });
  }, [here]);

  return back;
}
