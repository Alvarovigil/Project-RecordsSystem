"use client";

import { useCallback, useEffect, useState } from "react";
import { useRepository } from "./useRepository";
import type { Notification } from "@/lib/data/types";

/**
 * What is waiting for you.
 *
 * Kept apart from the feed on purpose. The feed is ambient — you dip into it
 * and it is fine to miss things. This is addressed to you personally, and one
 * of these can be a question you have to answer, so it gets its own count, its
 * own read state, and a dot that only clears when you have actually looked.
 */
export function useNotifications() {
  const repo = useRepository();
  const [items, setItems] = useState<Notification[] | null>(null);

  const load = useCallback(() => {
    repo
      .notifications()
      .then(setItems)
      .catch(() => setItems([]));
  }, [repo]);

  useEffect(load, [load]);

  const markRead = useCallback(async () => {
    // optimistic: the dot must go out the instant you open the screen, or you
    // spend the whole visit wondering whether it registered
    setItems((prev) => prev?.map((n) => ({ ...n, read: true })) ?? prev);
    await repo.markNotificationsRead();
  }, [repo]);

  const respond = useCallback(
    async (id: string, accept: boolean) => {
      setItems((prev) =>
        prev?.map((n) => (n.id === id ? { ...n, actionable: false, read: true } : n)) ?? prev,
      );
      await repo.respondToInvite(id, accept);
      load();
    },
    [repo, load],
  );

  return {
    items,
    loading: items === null,
    unread: (items ?? []).filter((n) => !n.read).length,
    pending: (items ?? []).filter((n) => n.actionable).length,
    markRead,
    respond,
    reload: load,
  };
}

/**
 * Just the number, for the tab bar.
 *
 * Separate so the bar — mounted on every screen — never pulls the whole list.
 * It polls nothing: the count refreshes when the app regains focus, which is
 * when a change could plausibly have happened while you were away.
 */
export function useUnreadCount() {
  const repo = useRepository();
  const [n, setN] = useState(0);

  useEffect(() => {
    let alive = true;
    const read = () =>
      repo
        .notifications()
        .then((all) => alive && setN(all.filter((x) => !x.read).length))
        .catch(() => {});
    read();
    window.addEventListener("focus", read);
    return () => {
      alive = false;
      window.removeEventListener("focus", read);
    };
  }, [repo]);

  return n;
}
