import type { List, ListWithRecord } from "@/lib/data/types";

/**
 * What to call a list when it is not yours.
 *
 * Everyone's collection is created with the same name — "Mi Colección" — which
 * is right on your own shelf and a small lie on anyone else's: the "mi" refers
 * to a person who is not you. Read on someone's profile it is worse than
 * ambiguous, because two lists on the same screen can both claim it.
 *
 * So a primary collection is renamed for visitors, and only for visitors: the
 * owner's data is untouched, and they still see their own words. Custom lists
 * keep their titles exactly as written — those are authored, and rewriting
 * somebody's title would be a different and much ruder kind of help.
 */
export function listTitleFor(
  list: Pick<List, "title" | "kind"> & { owner?: ListWithRecord["owner"] },
  mine: boolean,
): string {
  if (mine || list.kind !== "collection") return list.title;
  const who = list.owner?.displayName;
  return who ? `Colección de ${who}` : "Colección";
}
