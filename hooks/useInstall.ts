"use client";

import { useSyncExternalStore } from "react";
import {
  getInstallServerSnapshot,
  getInstallSnapshot,
  subscribeInstall,
  type InstallState,
} from "@/lib/install";

/**
 * One subscription to the install store for the whole tree.
 *
 * Everything starts as "not ready" and corrects on mount, exactly like
 * `useDevice`. Anything that would change what a button *does* must wait for
 * `ready` — a control that says "Instalar" for one frame and then turns into
 * "Entrar" has already told somebody the wrong thing.
 */
export function useInstall(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallSnapshot, getInstallServerSnapshot);
}
