"use client";

import { useEffect, useState } from "react";

/**
 * Whether a set of images has finished decoding — so a grid can arrive as one
 * thing instead of assembling itself in front of you.
 *
 * A dozen `<img>` tags each fading in when they happen to be ready produces a
 * flicker of pops in no particular order. It is the single clearest tell that
 * you are looking at a web page rather than at an app: an app has a screen and
 * then shows it, and every native list view works this way because the system
 * decodes off the main thread and hands you the finished thing.
 *
 * Two rules make it safe:
 *
 * - **A deadline.** One slow cover must never hold a screen hostage, so after
 *   `timeout` the grid shows regardless. Waiting forever for completeness is
 *   how a loading state becomes a bug.
 * - **Cached images resolve immediately.** `decode()` on an image already in
 *   the browser cache settles in the same frame, so going back to a screen you
 *   have seen shows it instantly rather than replaying the fade.
 *
 * Returns true when everything is ready, when the deadline passes, or when
 * there was nothing to wait for.
 */
export function useImagesReady(urls: (string | null | undefined)[], timeout = 700): boolean {
  // the identity of the set, not the array, so a re-render with the same
  // covers does not restart the wait
  const key = urls.filter(Boolean).join("|");
  const [ready, setReady] = useState(() => key.length === 0);

  useEffect(() => {
    /**
     * No "have I seen this key before" guard.
     *
     * There was one, and it was the bug: the effect wrote the key to a ref and
     * returned early if it saw it again. React runs an effect, cleans it up
     * and runs it a second time on mount — so the second run found its own key
     * already recorded, returned before starting the wait, and left `ready`
     * false with nothing on the way to flip it. Every crate on a profile
     * stayed at opacity zero, images fully decoded, invisible.
     *
     * The dependency array already does the job the ref was doing: the effect
     * only re-runs when the set of images actually changes. Running twice for
     * the same key costs one redundant decode of images the browser has
     * already cached; leaving a screen blank costs the screen.
     */
    const list = key ? key.split("|") : [];
    if (list.length === 0) {
      setReady(true);
      return;
    }

    let alive = true;
    setReady(false);

    const done = () => alive && setReady(true);
    const deadline = setTimeout(done, timeout);

    void Promise.all(
      list.map(
        (src) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.src = src;
            // decode() resolves once the bitmap is ready to paint; onload only
            // promises the bytes arrived, which is one frame too early and is
            // exactly where the flicker comes from
            img.decode().then(
              () => resolve(),
              () => resolve(), // a broken cover is not a reason to stall
            );
          }),
      ),
    ).then(() => {
      clearTimeout(deadline);
      done();
    });

    return () => {
      alive = false;
      clearTimeout(deadline);
    };
  }, [key, timeout]);

  return ready;
}
