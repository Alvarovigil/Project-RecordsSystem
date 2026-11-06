/**
 * The one coordinator between the layers on screen and the browser's history.
 *
 * Every layer that covers the screen (a sheet, the record, the search, the
 * scanner) owns one history entry while it is open, so the system's «atrás»
 * closes it instead of leaving the screen. Each layer used to manage its own
 * entry, and that broke the moment two of them moved at once: `history.back()`
 * is asynchronous, so a sheet opened in the same tap that closed another got
 * the other one's popstate and closed itself; two layers closing in the same
 * commit left an entry behind; and a reload with a sheet open numbered the
 * next layer on top of a dead one.
 *
 * Here there is one owner, and it works from the real entry, not a counter:
 *
 * - **Numbering.** A layer's number is the layer of the entry under it plus
 *   one: `mine = layerOf(history.state) + 1`.
 * - **«Atrás».** A popstate lands on an entry; every layer whose number is
 *   above that entry's (`layerOf(e.state) < mine`) is closed, top first.
 * - **Closing by hand** (✕, drag, a button). Nothing moves at once: the layer
 *   lowers a floor and, a tick later, everything that closed in that commit
 *   goes back in one `history.go(floor - current)`.
 * - **Opening while that is in flight.** The new layer waits for the pending
 *   popstate before it pushes, and that popstate closes nobody.
 * - **Stale marks.** An entry carrying a layer with no layer open (a reload
 *   with the record open, a restored PWA) is cleaned with `replaceState`.
 * - **Next's own writes.** `router.replace` and `router.refresh` rewrite the
 *   current entry's state without our mark. While the path is the same the
 *   mark is put back before anything is computed from it; when the path or
 *   the query changed, a navigation happened and the open layers' entries are left
 *   behind it, so they are let go instead of being walked back into.
 *
 * Pure logic: the browser binding lives in `hooks/useBackToClose.ts`, and
 * `lib/layer-history.test.ts` drives it with a fake history.
 */

export const LAYER_KEY = "__rackrLayer";
/**
 * The address of the page under the layers, kept on a layer's entry only
 * while every entry between it and that page has the same address. A reload
 * can then walk back over its own dead entries knowing exactly where it
 * lands; without it (an old entry, a `router.replace` in between) the walk is
 * not safe and the mark is only cleaned.
 */
export const BASE_KEY = "__rackrBase";

function baseOf(state: unknown): string | null {
  const v = (state as Record<string, unknown> | null | undefined)?.[BASE_KEY];
  return typeof v === "string" ? v : null;
}

export function layerOf(state: unknown): number {
  const v = (state as Record<string, unknown> | null | undefined)?.[LAYER_KEY];
  return typeof v === "number" && v > 0 ? v : 0;
}

export interface HistoryPort {
  readonly state: unknown;
  pushState(data: unknown, unused: string): void;
  replaceState(data: unknown, unused: string): void;
  go(delta: number): void;
}

export interface LayerEnv {
  history: HistoryPort;
  /** the current pathname and query; a change means a navigation happened */
  path(): string;
  /** run after the current task (setTimeout 0 in the browser) */
  defer(fn: () => void): void;
  /** a timer that can be cancelled; the guard for a popstate that never comes */
  timer(fn: () => void, ms: number): () => void;
}

export interface LayerHandle {
  /** closed by hand: its entry has to come out of the history */
  close(): void;
}

type Layer = {
  onClose: () => void;
  mine: number | null;
  state: "pending" | "pushed" | "gone";
};

/** How long to wait for our own popstate before assuming it is not coming. */
const POP_GUARD_MS = 1000;

export function createLayerHistory(env: LayerEnv) {
  const h = env.history;

  /** layers with an entry of their own, bottom first */
  let pushed: Layer[] = [];
  /** layers waiting to push, in opening order */
  let pending: Layer[] = [];
  /** the layer of the entry we are on, as far as we know */
  let cur = layerOf(h.state);
  let curPath = env.path();
  /** where the closes since the last flush want history to land */
  let floor: number | null = null;
  /** a `go()` of ours is in flight; its popstate belongs to us */
  let awaiting = false;
  let cancelGuard: (() => void) | null = null;
  let scheduled = false;
  /** navigations waiting for the layers' entries to come out first */
  let thens: (() => void)[] = [];

  const mark = (n: number) => {
    const base = { ...((h.state as object | null) ?? {}) } as Record<string, unknown>;
    if (n > 0) base[LAYER_KEY] = n;
    else {
      delete base[LAYER_KEY];
      delete base[BASE_KEY];
    }
    h.replaceState(base, "");
  };

  const schedule = () => {
    if (scheduled) return;
    scheduled = true;
    env.defer(flush);
  };

  /** bring `cur` in line with the real entry before computing anything from it */
  function reconcile() {
    const s = layerOf(h.state);
    const path = env.path();

    if (path !== curPath) {
      // A navigation: the open layers' entries are behind this page now.
      // Walking back into them would undo the navigation, so let them go.
      for (const l of pushed) {
        l.state = "gone";
        l.mine = null;
      }
      pushed = [];
      floor = null;
      curPath = path;
      cur = s;
    }

    if (pushed.length === 0 && floor === null) {
      // nothing open has an entry and nothing is on its way out: any mark
      // here is a leftover
      if (s > 0) mark(0);
      cur = 0;
      return;
    }

    if (s !== cur) {
      // Next rewrote the entry (router.replace / refresh) and dropped the mark
      if (s === 0 && cur > 0) mark(cur);
      else cur = s;
    }
  }

  function flush() {
    scheduled = false;
    if (awaiting) return;
    reconcile();

    if (floor !== null) {
      const target = floor;
      floor = null;
      if (target < cur) {
        // anything still open above the floor loses its entry: it pushes again
        const above = pushed.filter((l) => (l.mine ?? 0) > target);
        if (above.length) {
          pushed = pushed.filter((l) => (l.mine ?? 0) <= target);
          for (const l of above) {
            l.state = "pending";
            l.mine = null;
          }
          pending = [...above, ...pending];
        }
        awaiting = true;
        cancelGuard = env.timer(() => {
          // the popstate never came; read where we are and carry on
          cancelGuard = null;
          awaiting = false;
          cur = layerOf(h.state);
          curPath = env.path();
          schedule();
        }, POP_GUARD_MS);
        h.go(target - cur);
        return;
      }
    }

    if (thens.length) {
      const run = thens;
      thens = [];
      for (const fn of run) fn();
    }

    while (pending.length) {
      const l = pending.shift()!;
      const below = h.state;
      const mine = layerOf(below) + 1;
      // the chain down to the page holds only if the entry below is the page
      // itself or carries an intact chain to this same address
      const here = env.path();
      const chain = layerOf(below) === 0 || baseOf(below) === here ? here : null;
      const next: Record<string, unknown> = {
        ...((below as object | null) ?? {}),
        [LAYER_KEY]: mine,
      };
      if (chain) next[BASE_KEY] = chain;
      else delete next[BASE_KEY];
      h.pushState(next, "");
      l.mine = mine;
      l.state = "pushed";
      pushed.push(l);
      cur = mine;
    }
  }

  return {
    /** a layer opened; it pushes its entry on the next flush */
    open(onClose: () => void): LayerHandle {
      const layer: Layer = { onClose, mine: null, state: "pending" };
      pending.push(layer);
      schedule();
      return {
        close() {
          if (layer.state === "pending") {
            pending = pending.filter((l) => l !== layer);
            layer.state = "gone";
            return;
          }
          if (layer.state !== "pushed") return;
          layer.state = "gone";
          pushed = pushed.filter((l) => l !== layer);
          const below = (layer.mine ?? 1) - 1;
          floor = floor === null ? below : Math.min(floor, below);
          schedule();
        },
      };
    },

    /**
     * Leaving the screen from inside a layer (a link to a profile, an
     * artist). Every layer's entry comes out first and the navigation runs
     * once history has landed, so the new page is pushed on the page that
     * was under the layers and «atrás» from it comes straight back.
     */
    leave(navigate: () => void) {
      for (const l of pending) l.state = "gone";
      pending = [];
      if (pushed.length) {
        const base = Math.min(...pushed.map((l) => l.mine ?? 1)) - 1;
        floor = floor === null ? base : Math.min(floor, base);
        for (const l of pushed) l.state = "gone";
        // keep their numbers so the flush knows how far to go; nothing is open
        pushed = [];
      }
      thens.push(navigate);
      schedule();
    },

    /** the window's popstate */
    pop(state: unknown) {
      const landed = layerOf(state);
      curPath = env.path();
      cur = landed;
      if (awaiting) {
        // ours: it closes nobody, and whatever was waiting can go now
        awaiting = false;
        cancelGuard?.();
        cancelGuard = null;
        schedule();
        return;
      }
      const closing = pushed.filter((l) => landed < (l.mine ?? 0)).reverse();
      if (!closing.length) return;
      pushed = pushed.filter((l) => !closing.includes(l));
      for (const l of closing) l.state = "gone";
      for (const l of closing) l.onClose();
    },

    /**
     * Something on screen owns history right now: a layer open or waiting to
     * push, or a walk back still in flight. A link that navigates in that
     * state has to go through `leave`, or the walk back swallows it.
     */
    busy(): boolean {
      return pushed.length > 0 || pending.length > 0 || awaiting || floor !== null || scheduled;
    },

    /**
     * On mount: a mark with nothing open is a leftover from before a reload.
     *
     * The entries under it are dead too — the same page, once per layer — and
     * cost one «atrás» each. When the entry vouches that all of them have
     * this address (`BASE_KEY`), history walks back over them in one `go()`
     * and lands on the page itself; the popstate is ours and closes nobody.
     * Otherwise there is no way to know where `go()` would land, so the mark
     * is only cleaned and the dead entries stay.
     */
    settle() {
      if (awaiting || pushed.length || pending.length) return;
      const stale = layerOf(h.state);
      const path = env.path();
      if (stale > 0 && baseOf(h.state) === path) {
        cur = stale;
        curPath = path;
        awaiting = true;
        cancelGuard = env.timer(() => {
          cancelGuard = null;
          awaiting = false;
          cur = layerOf(h.state);
          curPath = env.path();
          schedule();
        }, POP_GUARD_MS);
        h.go(-stale);
        return;
      }
      if (stale > 0) mark(0);
      cur = 0;
      curPath = path;
    },
  };
}

export type LayerHistory = ReturnType<typeof createLayerHistory>;
