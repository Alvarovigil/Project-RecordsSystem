"use client";

import { useEffect, useState } from "react";

import { coverFor } from "@/lib/cover";

/**
 * A person, at four sizes and never at a fifth.
 *
 * The fallback is initials on a tinted ground, and the tint is derived from the
 * handle — so the same person is the same colour everywhere in the app, and a
 * list of people without photos is still scannable. A single grey circle for
 * everyone turns a followers list into a wall of nothing.
 */

/**
 * `xxs` exists for badges pinned to the corner of something else. At 22px the
 * smallest size was 60% of a 36px cover — not a mark on it, a second picture
 * competing with it.
 */
const SIZES = { xxs: 16, xs: 22, sm: 30, md: 40, lg: 64, xl: 88 } as const;
export type AvatarSize = keyof typeof SIZES;

/** Deterministic hue from the handle: identity, not decoration. */
function hueOf(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export default function Avatar({
  name,
  handle,
  src,
  size = "md",
  ring = false,
  interactive = false,
}: {
  name: string;
  handle?: string;
  src?: string | null;
  size?: AvatarSize;
  /** marks "there is something new here" — stories-style, used sparingly */
  ring?: boolean;
  /**
   * The avatar leads somewhere, so it should answer a pointer.
   *
   * A face is not a button and nothing about it invites a click; without some
   * response people simply do not try. Set by whatever wraps it in a link.
   */
  interactive?: boolean;
}) {
  const px = SIZES[size];
  const seed = handle || name || "?";
  const hue = hueOf(seed);
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      aria-hidden
      style={{
        width: px,
        height: px,
        // low saturation and low lightness: it must read as a placeholder on a
        // near-black ground, not as a sticker
        background: src ? undefined : `hsl(${hue} 24% 26%)`,
        color: `hsl(${hue} 45% 84%)`,
        fontSize: Math.max(9, Math.round(px * 0.34)),
        boxShadow: ring ? "0 0 0 2px var(--surface), 0 0 0 3.5px var(--accent)" : undefined,
      }}
      className={`inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full font-medium leading-none ${
        interactive
          ? "transition duration-fast group-hover:brightness-110 group-hover:ring-2 group-hover:ring-paper/25"
          : ""
      }`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        initials || "?"
      )}
    </span>
  );
}

/**
 * The record equivalent: a sleeve that never collapses while it loads.
 *
 * The placeholder is the skeleton surface rather than a flat fill, so a grid
 * that is half-loaded is made of the same material as a grid that is still
 * loading — which is what stops the second one from reading as a mistake. And
 * `eager` exists because the covers already on screen should not be lazy:
 * lazy-loading what is in the viewport is a round trip added on purpose.
 */
export function Cover({
  vinyl,
  src,
  alt = "",
  className = "",
  eager = false,
}: {
  vinyl?: Parameters<typeof coverFor>[0];
  src?: string | null;
  alt?: string;
  className?: string;
  /** for the first screenful: skip the lazy round trip */
  eager?: boolean;
}) {
  const url = src ?? (vinyl ? coverFor(vinyl) : null);
  const [shown, setShown] = useState(false);

  // a new src is a new picture: the old one must not stay faded in over it
  useEffect(() => setShown(false), [url]);

  return (
    <span className={`relative block aspect-square w-full overflow-hidden ${className}`}>
      <span
        aria-hidden
        className={`skeleton absolute inset-0 transition-opacity duration-300 ${
          shown ? "opacity-0" : "opacity-100"
        }`}
      />
      {url && (
        // A cover that snaps in at full opacity the instant its bytes land is
        // the flicker you see scrolling any image list on the web. The square
        // underneath is already the right shape and the right colour, so the
        // picture only has to arrive into it.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setShown(true)}
          onError={() => setShown(true)}
          // cached images can be complete before React ever attaches onLoad
          ref={(el) => {
            if (el?.complete && el.naturalWidth > 0) setShown(true);
          }}
          className={`relative h-full w-full object-cover transition-opacity duration-base ease-out ${
            shown ? "opacity-100" : "opacity-0"
          }`}
        />
      )}
    </span>
  );
}
