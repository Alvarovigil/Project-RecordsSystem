"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A sleeve that arrives instead of popping.
 *
 * Every grid in this app used to gate itself on the first handful of images
 * and reveal all of them together, so one slow cover held up the whole screen
 * and the wait was as long as the worst of them. Each cover now fades into its
 * own placeholder: something is on screen immediately, the layout never moves,
 * and a slow sleeve is a slow sleeve rather than a slow app.
 *
 * The placeholder is the skeleton surface, so a loading grid and a half-loaded
 * grid are made of the same material — which is what stops the second one from
 * reading as a mistake.
 *
 * `eager` is for what is already on screen. Everything else is lazy and gets
 * `decode="async"`, so decoding a jpeg never lands in the middle of a scroll.
 */
export default function Cover({
  src,
  alt = "",
  className = "",
  eager = false,
}: {
  src: string;
  alt?: string;
  className?: string;
  eager?: boolean;
}) {
  const ref = useRef<HTMLImageElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    setShown(false);
    // an image restored from cache can be complete before React attaches the
    // handler, and then it would never fade in at all
    const img = ref.current;
    if (img?.complete && img.naturalWidth > 0) setShown(true);
  }, [src]);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      <span
        aria-hidden
        className={`skeleton absolute inset-0 transition-opacity duration-300 ${
          shown ? "opacity-0" : "opacity-100"
        }`}
      />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={ref}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        onLoad={() => setShown(true)}
        onError={() => setShown(true)}
        className={`cover-in ${shown ? "is-in" : ""} relative h-full w-full object-cover`}
      />
    </span>
  );
}
