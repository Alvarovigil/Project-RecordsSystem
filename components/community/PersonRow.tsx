"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton, { FollowsYouBadge } from "./FollowButton";
import type { Profile } from "@/lib/data/types";

/**
 * A person, in a list of people.
 *
 * The same row in search results, followers, "quién colecciona esto" and
 * suggestions — because a person should not look like four different things
 * depending on where you met them, and because the follow button then behaves
 * identically everywhere without anyone re-deciding.
 *
 * The whole row is the link and the button sits on top of it. On a phone that
 * is the difference between a 44px target and a 12px one: you aim at the name,
 * you get the profile.
 */
export default function PersonRow({
  profile,
  subtitle,
  action = true,
  compact = false,
}: {
  profile: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl"> & { bio?: string };
  /** overrides the handle line — "añadió 4 discos", "vía Sonido de sótano" */
  subtitle?: React.ReactNode;
  action?: boolean;
  compact?: boolean;
}) {
  return (
    <div className="relative flex items-center gap-3">
      {/* the group is the link, not the row: the follow button sits in the same
          row and hovering it should not light up a face it does not lead to */}
      <Link
        href={`/u/${profile.username}`}
        className="group pressable flex min-w-0 flex-1 items-center gap-3 py-2.5"
      >
        <Avatar
          name={profile.displayName}
          handle={profile.username}
          src={profile.avatarUrl}
          size={compact ? "sm" : "md"}
          interactive
        />
        <span className="min-w-0 flex-1">
          {/* The name gets the line to itself.
              "Te sigue" used to sit beside it as a chip, and on a phone there
              is not room for a name, a chip and a button: the chip wrapped to
              two lines and the name truncated to make space for it. It belongs
              on the second line anyway — it is a fact about the relationship,
              like the handle, not part of who they are. */}
          <span className="block truncate text-body font-medium text-paper">
            {profile.displayName}
          </span>
          <span className="mt-0.5 flex items-center gap-1.5 text-sub text-content-muted">
            <span className="truncate">{subtitle ?? `@${profile.username}`}</span>
            <FollowsYouBadge profileId={profile.id} />
          </span>
        </span>
      </Link>
      {action && (
        <div className="relative z-10 shrink-0">
          <FollowButton icon profileId={profile.id} displayName={profile.displayName} size="sm" />
        </div>
      )}
    </div>
  );
}
