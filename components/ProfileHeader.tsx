"use client";

import { useEffect, useState } from "react";
import { getRepository } from "@/lib/data";
import { useSession } from "@/hooks/useSession";

/** Follow / unfollow, kept client-side so the profile page stays static. */
export default function FollowButton({ profileId }: { profileId: string }) {
  const { user } = useSession();
  const [following, setFollowing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!user) return;
    getRepository()
      .following()
      .then(({ profiles }) => {
        setFollowing(profiles.includes(profileId));
        setReady(true);
      })
      .catch(() => setReady(true));
  }, [user, profileId]);

  if (!user || user.id === profileId) return null;

  const toggle = async () => {
    const repo = getRepository();
    setFollowing((v) => !v);
    try {
      if (following) await repo.unfollow("profile", profileId);
      else await repo.follow("profile", profileId);
    } catch {
      setFollowing((v) => !v); // put it back if the server said no
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={!ready}
      className={`shrink-0 px-4 py-2 text-[12px] transition ${
        following
          ? "border border-paper/25 text-paper/60 hover:border-paper/50 hover:text-paper"
          : "bg-paper text-ink hover:bg-paper/85"
      }`}
    >
      {following ? "Siguiendo" : "Seguir"}
    </button>
  );
}
