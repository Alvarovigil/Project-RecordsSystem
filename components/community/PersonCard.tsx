"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "./FollowButton";
import { useImagesReady } from "@/hooks/useImagesReady";
import { Mark } from "@/components/ui/Loading";
import type { SuggestedProfile } from "@/lib/data/types";

/**
 * A collector, as a shelf rather than as a face.
 *
 * The row this replaces was an avatar, a name and a handle — the same row a
 * follower list has, and it answered the wrong question. Nobody decides to
 * follow a stranger because of their initials: they decide because of what is
 * on their shelf. So the card is their records, three deep and bled to the
 * edges, with the person laid over the bottom of it.
 *
 * **3:4 on purpose.** A square would be a fourth cover and the eye would read
 * the whole thing as artwork; taller than wide is a person-shaped object, and
 * it lets four fit across a phone's rail with the fourth cut, which is what
 * says the rail keeps going.
 *
 * **The reason is part of the card.** "5 discos en común" is why this person
 * is on your screen and not somebody else, and a suggestion that cannot say
 * why is an advert. The order of preference is the same as the ranking's:
 * what you share, then who you both know, then the size of their audience —
 * and only one line, because three would be a dossier.
 */
export default function PersonCard({ profile }: { profile: SuggestedProfile }) {
  const covers = profile.covers.slice(0, 3);
  const ready = useImagesReady(covers);

  const reason =
    profile.shared > 0
      ? `${profile.shared} ${profile.shared === 1 ? "disco" : "discos"} en común`
      : profile.mutuals > 0
        ? `Le sigue ${profile.mutuals === 1 ? "alguien" : `${profile.mutuals} personas`} que sigues`
        : profile.followers > 0
          ? `${profile.followers} ${profile.followers === 1 ? "seguidor" : "seguidores"}`
          : profile.bio || "Nuevo por aquí";

  return (
    <div className="group/card relative aspect-[3/4] w-full overflow-hidden rounded-lg bg-surface-raised ring-1 ring-inset ring-paper/[0.06]">
      {/**
       * The three they chose, or the three they last added, or the mark.
       *
       * The empty state is a state, not a failure: somebody who has not picked
       * their three yet gets the badge on grey rather than a pretend shelf.
       * Fabricating a stack for them would make the card lie about the one
       * thing it is for — what this person wants you to see.
       */}
      {covers.length === 0 ? (
        <span
          aria-label="Todavía no ha elegido sus tres discos"
          className="absolute inset-0 flex items-center justify-center bg-fill-subtle"
        >
          <span className="text-paper/25">
            <Mark size={44} />
          </span>
        </span>
      ) : (
      <span
        aria-hidden
        className={`absolute inset-0 transition-opacity duration-base ease-out ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        {covers.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading="lazy"
            className="absolute aspect-square w-[54%] rounded-[3px] object-cover shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
            style={{
              // A stack, not a crop: small enough that the card's own edge is
              // still visible around it, offset the way sleeves sit when you
              // pull three half out of a crate.
              left: `${11 + i * 12}%`,
              top: `${9 + i * 8}%`,
              transform: `rotate(${(i - 1) * 4}deg)`,
              zIndex: i,
            }}
          />
        ))}
      </span>
      )}

      {/* the floor the type stands on: without it a name over a bright sleeve
          is unreadable exactly when the sleeve is worth looking at */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink via-ink/85 to-transparent"
      />

      <div className="absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-3">
        <Link href={`/u/${profile.username}`} className="group pressable min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <Avatar
              name={profile.displayName}
              handle={profile.username}
              src={profile.avatarUrl}
              size="xs"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sub font-medium text-paper">
                {profile.displayName}
              </span>
              <span className="block truncate text-caption text-content-muted">{reason}</span>
            </span>
          </span>
        </Link>

        <FollowButton
          icon
          profileId={profile.id}
          displayName={profile.displayName}
          size="sm"
        />
      </div>
    </div>
  );
}
