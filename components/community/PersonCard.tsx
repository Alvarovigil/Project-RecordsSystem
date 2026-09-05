"use client";

import Link from "next/link";
import Avatar from "@/components/ui/Avatar";
import FollowButton from "./FollowButton";
import { useImagesReady } from "@/hooks/useImagesReady";
import Verified from "@/components/ui/Verified";
import type { SuggestedProfile } from "@/lib/data/types";

/** The sleeve that stands for a record nobody has chosen yet. */
const EMPTY_SLEEVE = "/sleeve-vacio.jpg";

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
  const ready = useImagesReady(covers.length ? covers : [EMPTY_SLEEVE]);

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
       * The three they chose, or the three they last added, or a record that
       * does not exist.
       *
       * The empty state used to be the badge on grey — a hole where a shelf
       * should be. But this card is a stack of sleeves, and the honest empty
       * state of a stack of sleeves is one sleeve with nothing in it: the
       * phantom pressing, in the product's own colour, sitting exactly where
       * a real one would. It reads as "this person has not chosen yet" rather
       * than as "something failed to load", which is what an icon on grey
       * always reads as.
       */}
      <span
        aria-hidden
        className={`absolute inset-0 transition-opacity duration-base ease-out ${
          ready ? "opacity-100" : "opacity-0"
        }`}
      >
        {(covers.length ? covers : [EMPTY_SLEEVE]).map((src, i, all) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading="lazy"
            className="absolute aspect-square w-[54%] rounded-[3px] object-cover shadow-[0_12px_32px_rgba(0,0,0,0.6)]"
            style={{
              /**
               * The stack centres itself on however many there are.
               *
               * One record, two or three are all real answers — somebody who
               * has chosen two has chosen two — so the offsets are measured
               * from the middle of the card outwards instead of from a fixed
               * left edge. Padding a short stack with something they did not
               * pick would be the card inventing part of an introduction.
               */
              left: `${23 - (all.length - 1) * 6 + i * 12}%`,
              top: `${13 - (all.length - 1) * 4 + i * 8}%`,
              // A single sleeve would land at exactly zero degrees, which is
              // the one angle no record ever sits at when somebody leaves it
              // leaning somewhere. Straight reads as placed by a machine.
              transform: `rotate(${all.length === 1 ? -3.5 : (i - (all.length - 1) / 2) * 4}deg)`,
              zIndex: i,
            }}
          />
        ))}
      </span>

      {/* the floor the type stands on: without it a name over a bright sleeve
          is unreadable exactly when the sleeve is worth looking at */}
      <span
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[58%] bg-gradient-to-t from-ink via-ink/85 to-transparent"
      />

      {/**
       * Toda la tarjeta entra al perfil.
       *
       * El enlace estaba solo en el nombre, así que la mitad de la tarjeta —
       * las tres fundas, que son la razón por la que alguien se fija en ella —
       * no hacía nada al pulsarla. Una tarjeta que se ve entera como un objeto
       * y responde solo en una esquina se siente rota antes de que nadie sepa
       * decir por qué.
       *
       * El enlace es una capa sobre la tarjeta y el botón de seguir va por
       * encima de ella: así el destino es uno solo, sin anidar un botón dentro
       * de un enlace, que no es HTML válido y en el móvil se lleva el gesto la
       * mitad de las veces.
       */}
      <Link
        href={`/u/${profile.username}`}
        aria-label={`Ver el perfil de ${profile.displayName}`}
        className="absolute inset-0 z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-line-focus"
      />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end gap-2.5 p-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <Avatar
              name={profile.displayName}
              handle={profile.username}
              src={profile.avatarUrl}
              size="xs"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-sub font-medium text-paper">
                  {profile.displayName}
                </span>
                {profile.verified && (
                  <span className="text-accent">
                    <Verified size={12} />
                  </span>
                )}
              </span>
              <span className="block truncate text-caption text-content-muted">{reason}</span>
            </span>
          </span>
        </span>

        <span className="pointer-events-auto relative z-20">
        <FollowButton
          icon
          profileId={profile.id}
          displayName={profile.displayName}
          size="sm"
          />
        </span>
      </div>
    </div>
  );
}