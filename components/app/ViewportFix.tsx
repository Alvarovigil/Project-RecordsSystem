"use client";

import { useEffect } from "react";

/**
 * Making iOS admit how tall the window is.
 *
 * An installed window on iOS sometimes lays out at launch against a viewport
 * shorter than the screen, and what shows under the tab bar is a band of
 * ground colour that looks like the app ended early. The tell that this is
 * what it is: *any* interaction that makes Safari recompute the viewport fixes
 * it — opening the search screen, which mounts a full-screen layer and raises
 * the keyboard, snaps the layout into place and it stays right for the rest of
 * the session.
 *
 * There is no property to set and no event to wait for; the documented
 * behaviour is simply wrong at that moment. So this does what the interaction
 * did: it forces a recalculation, twice, a beat apart — once as soon as the
 * page is interactive and once after the launch animation has finished, since
 * the wrong measurement is sometimes taken during it.
 *
 * A one-pixel scroll and back is the cheapest thing that reliably triggers it
 * and is invisible: the shelf is a fixed layer with its own scrollers, so the
 * document itself has nowhere to go.
 *
 * It also runs on resume. A standalone app that has been in the background for
 * a day comes back through the same path as a launch, and reported the same
 * short viewport when it did.
 *
 * Scoped to installed windows: in a browser tab this bug does not exist, and
 * nudging the scroll of a page somebody is reading would be its own bug.
 */
export default function ViewportFix() {
  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (!standalone) return;

    const nudge = () => {
      const y = window.scrollY;
      window.scrollTo(0, y + 1);
      window.scrollTo(0, y);
      // some builds only re-measure on an actual resize event
      window.dispatchEvent(new Event("resize"));
    };

    const first = requestAnimationFrame(nudge);
    const second = setTimeout(nudge, 600);

    const onVisible = () => {
      if (document.visibilityState === "visible") nudge();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("pageshow", nudge);

    return () => {
      cancelAnimationFrame(first);
      clearTimeout(second);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("pageshow", nudge);
    };
  }, []);

  return null;
}
