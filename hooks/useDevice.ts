"use client";

import { useSyncExternalStore } from "react";

/**
 * What kind of machine is this, really.
 *
 * Not "how wide is the window" — that is the question that produces responsive
 * websites. The interface needs two independent facts: how much room there is
 * (which decides layout) and whether there is a precise pointer (which decides
 * whether hover is allowed to carry meaning at all). A 1024px tablet and a
 * 1024px browser window want different interfaces, and only the pointer tells
 * them apart.
 *
 * Read through useSyncExternalStore so it is one subscription for the whole
 * tree, and so the server and the first client paint agree: everything starts
 * as "desktop, fine pointer" and corrects on mount. Layout that must be right
 * before hydration belongs in a CSS media query, not here.
 */

export type DeviceClass = "phone" | "tablet" | "desktop";

export type Device = {
  device: DeviceClass;
  /** phone or tablet: the interface is driven by a finger */
  touch: boolean;
  /** hover means something and can carry an affordance */
  hover: boolean;
  isPhone: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  /** the app is running installed, without browser chrome around it */
  standalone: boolean;
  /**
   * Whether this is a real reading or the server's guess.
   *
   * Everything starts as "desktop, fine pointer" and corrects on mount, which
   * is fine for styling and dangerous for anything that *loads code*: a phone
   * would fetch the desktop tree on its first render and the phone tree on its
   * second. Anything that splits a bundle by device has to wait for this.
   */
  measured: boolean;
};

// Breakpoints chosen from the hardware, not from a framework's defaults: a
// phone in landscape is still a phone, so the pointer has the final word.
const PHONE_MAX = 767;
const TABLET_MAX = 1179;

const SERVER: Device = {
  device: "desktop",
  touch: false,
  hover: true,
  isPhone: false,
  isTablet: false,
  isDesktop: true,
  standalone: false,
  measured: false,
};

let snapshot: Device = SERVER;
const listeners = new Set<() => void>();

function measure(): Device {
  const w = window.innerWidth;
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  const hover = window.matchMedia("(hover: hover)").matches;
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS says it its own way, and only on the legacy navigator flag
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // A coarse pointer on a wide screen is a tablet; a fine pointer on a narrow
  // one is a small browser window, which is still a desktop interface.
  let device: DeviceClass;
  if (coarse) device = w <= PHONE_MAX ? "phone" : "tablet";
  else device = w <= PHONE_MAX ? "phone" : w <= TABLET_MAX ? "tablet" : "desktop";

  return {
    device,
    touch: coarse || device !== "desktop",
    hover: hover && !coarse,
    isPhone: device === "phone",
    isTablet: device === "tablet",
    isDesktop: device === "desktop",
    standalone,
    measured: true,
  };
}

function same(a: Device, b: Device) {
  return (
    a.device === b.device &&
    a.touch === b.touch &&
    a.hover === b.hover &&
    a.standalone === b.standalone &&
    a.measured === b.measured
  );
}

function subscribe(fn: () => void) {
  if (listeners.size === 0) {
    snapshot = measure();
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
  }
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0) {
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    }
  };
}

function onChange() {
  const next = measure();
  // an identical object would re-render every consumer on every resize frame
  if (same(next, snapshot)) return;
  snapshot = next;
  listeners.forEach((fn) => fn());
}

export function useDevice(): Device {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER);
}
