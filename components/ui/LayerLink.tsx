"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, MouseEvent } from "react";
import { layersBusy, leaveLayers } from "@/hooks/useBackToClose";

/**
 * A link that leaves the screen from inside a layer (a sheet, the search).
 *
 * A plain `<Link onClick={onClose}>` raced the layer's own way out: the
 * layer walked its history entry back while Next pushed the new page, and if
 * the two landed close together the navigation was lost. Here the layers'
 * entries come out first and the page is pushed after, so «atrás» from it
 * comes straight back to the screen the layer was on.
 *
 * `onNavigate` closes the layer itself (it is the old `onClick={onClose}`).
 * A click with a modifier (new tab, new window) is left to the browser, and
 * with no layer open it is an ordinary `Link`: that is what lets the shared
 * rows (people, racks, lists) use it everywhere without knowing where they
 * are drawn.
 */
export default function LayerLink({
  href,
  onNavigate,
  onClick,
  ...rest
}: ComponentProps<typeof Link> & { href: string; onNavigate?: () => void }) {
  const router = useRouter();
  return (
    <Link
      href={href}
      {...rest}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        if (!layersBusy()) return onNavigate?.();
        e.preventDefault();
        leaveLayers(() => router.push(href));
        onNavigate?.();
      }}
    />
  );
}
