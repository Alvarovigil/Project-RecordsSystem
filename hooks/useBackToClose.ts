"use client";

import { useEffect, useRef } from "react";
import { createLayerHistory, type LayerHistory } from "@/lib/layer-history";

/**
 * The system's «atrás» closes what is on top, not the screen under it.
 *
 * On Android the back gesture is the main way out of anything, and on an
 * installed app it was leaving the screen — or closing the app — with a record
 * sheet open on top. An app answers back by closing the sheet, so every layer
 * that covers the screen keeps one entry in the history while it is open.
 *
 * The entries are not managed here, layer by layer: two layers moving in the
 * same tap (close the menu, open the confirmation) raced each other. One
 * coordinator for the whole app owns them — see `lib/layer-history.ts` for
 * how it numbers, closes, batches and cleans up.
 */

let coordinator: LayerHistory | null = null;

function layers(): LayerHistory {
  if (coordinator) return coordinator;
  const c = createLayerHistory({
    history: window.history,
    // with the query: a router.replace that only changes `?lista=` is still a
    // new place, and walking back over it would undo it
    path: () => window.location.pathname + window.location.search,
    defer: (fn) => {
      setTimeout(fn, 0);
    },
    timer: (fn, ms) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    },
  });
  window.addEventListener("popstate", (e) => c.pop(e.state));
  coordinator = c;
  return c;
}

export function useBackToClose(open: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const layer = layers().open(() => closeRef.current());
    return () => layer.close();
  }, [open]);
}

/**
 * Leaving the screen from inside a layer: the layers' entries come out
 * first and `navigate` runs once history has landed on the page under them,
 * so «atrás» from the new page comes straight back to it.
 */
export function leaveLayers(navigate: () => void) {
  if (typeof window === "undefined") return navigate();
  layers().leave(navigate);
}

/** A layer is open, or its entry is still on its way out. */
export function layersBusy(): boolean {
  return typeof window !== "undefined" && layers().busy();
}

/** On mount of the app: a layer mark with nothing open is a leftover. */
export function settleLayers() {
  if (typeof window === "undefined") return;
  layers().settle();
}
