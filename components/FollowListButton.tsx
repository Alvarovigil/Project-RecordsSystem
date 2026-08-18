"use client";

import { useEffect, useState } from "react";
import { useRepository } from "@/hooks/useRepository";
import { useSession } from "@/hooks/useSession";

/**
 * Following a list is the lightest possible commitment: it lands in your side
 * panel, kept apart from your own, and you can drop it from there.
 */
export default function FollowListButton({ listId }: { listId: string }) {
  const repo = useRepository();
  const { user, available } = useSession();
  const [following, setFollowing] = useState<boolean | null>(null);

  useEffect(() => {
    if (available && !user) {
      setFollowing(false);
      return;
    }
    repo
      .following()
      .then(({ lists }) => setFollowing(lists.includes(listId)))
      .catch(() => setFollowing(false));
  }, [repo, listId, user, available]);

  if (available && !user) return null;

  const toggle = async () => {
    const next = !following;
    setFollowing(next);
    try {
      if (next) await repo.follow("list", listId);
      else await repo.unfollow("list", listId);
    } catch {
      setFollowing(!next); // put it back if the server said no
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={following === null}
      className={`shrink-0 px-5 py-2 text-[13px] transition ${
        following
          ? "border border-paper/25 text-paper/60 hover:border-paper/50 hover:text-paper"
          : "bg-paper text-ink hover:bg-paper/85"
      }`}
    >
      {following ? "Siguiendo" : "Seguir lista"}
    </button>
  );
}
