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

    /**
     * A real layout invalidation, not a scroll.
     *
     * The first version of this scrolled the document by a pixel and back —
     * which does nothing at all on a document that has nothing to scroll, and
     * that was precisely the situation the bug appears in. This makes the page
     * briefly taller than the screen, forces the browser to lay it out, scrolls
     * into that pixel and puts everything back. It is the same sequence of
     * events as walking into Explorar, which is what fixed it by hand.
     *
     * The CSS in globals.css keeps a pixel of overflow permanently, so this is
     * now the belt to that pair of braces: it covers the moment before the
     * stylesheet has been applied, and the resume path, where the window has
     * been measured while nobody was looking.
     */
    const nudge = () => {
      const el = document.documentElement;
      const before = el.style.minHeight;
      el.style.minHeight = "calc(100dvh + 2px)";
      // reading a layout property is what makes the change take effect now
      void el.offsetHeight;
      window.scrollTo(0, 1);
      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
        el.style.minHeight = before;
      });
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
