"use client";

import { useCallback, useEffect, useState } from "react";
import { useRepository } from "./useRepository";
import type { Relationship } from "@/lib/data/types";

/**
 * Following someone, with the two things every implementation gets wrong.
 *
 * One: it is optimistic. A follow that waits for a round trip before changing
 * the button makes people press it twice, and the second press unfollows.
 * The state flips first and rolls back only if the write actually failed.
 *
 * Two: it knows whether they follow you. That single fact turns a stranger's
 * profile into a decision, and it has to arrive with the button rather than
 * after it — otherwise the row visibly rearranges under the thumb aiming at it.
 */
export function useRelationship(profileId: string | undefined) {
  const repo = useRepository();
  const [rel, setRel] = useState<Relationship | null>(null);

  const load = useCallback(() => {
    if (!profileId) return;
    repo
      .relationship(profileId)
      .then(setRel)
      .catch(() => setRel({ following: false, followsYou: false, isYou: false }));
  }, [repo, profileId]);

  useEffect(load, [load]);

  const toggle = useCallback(async () => {
    if (!profileId || !rel || rel.isYou) return;
    const next = !rel.following;
    setRel({ ...rel, following: next });
    try {
      if (next) await repo.follow("profile", profileId);
      else await repo.unfollow("profile", profileId);
    } catch {
      setRel({ ...rel, following: !next });
      throw new Error("no se pudo guardar");
    }
  }, [repo, profileId, rel]);

  return { rel, loading: rel === null, toggle, reload: load };
}
