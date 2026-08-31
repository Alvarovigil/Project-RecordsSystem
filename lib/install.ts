/**
 * Where this page is running, and whether it can install itself.
 *
 * An external store rather than a hook's `useEffect`, for one reason that
 * decides whether any of this works: **`beforeinstallprompt` fires once, very
 * early, and is never replayed.** A component that starts listening when it
 * mounts has already missed it — which is why the install button could only
 * live on a page that happened to mount fast enough, and why the landing could
 * not have one at all. Listening at module scope catches the event whenever it
 * arrives and holds it until something asks.
 *
 * The rest is the reading the install screen used to do privately, moved here so
 * the landing, the install page and the app door cannot disagree about what
 * kind of device this is.
 */

export type Platform =
  /** iPhone or iPad: no page can ever install itself, by Apple's decision */
  | "ios"
  /** Android with a browser that may or may not fire the prompt */
  | "android"
  /** a webview inside another app, where installing is impossible */
  | "in-app"
  | "desktop";

export type InstallState = {
  /** false until the client has measured; nothing should commit before it */
  ready: boolean;
  /** running from the home screen, with no browser chrome */
  standalone: boolean;
  platform: Platform;
  /** a one-tap install is genuinely available right now */
  canPrompt: boolean;
};

const SERVER: InstallState = {
  ready: false,
  standalone: false,
  platform: "desktop",
  canPrompt: false,
};

type Deferred = Event & { prompt: () => Promise<void> };

let deferred: Deferred | null = null;
let snapshot: InstallState = SERVER;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((fn) => fn());

function platformOf(ua: string): Platform {
  // The webviews worth naming. Instagram and Facebook stamp themselves into
  // the UA; WhatsApp's Android webview says "wv". Missing one only means
  // somebody sees the generic instructions, which is the safe direction.
  if (/Instagram|FBAN|FBAV|Line\/|Twitter|; wv\)/.test(ua)) return "in-app";
  // iPadOS lies and says Macintosh; the touch points give it away
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1))
    return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}

/**
 * Installed, and nothing else.
 *
 * This used to accept `fullscreen` and `minimal-ui` as well, on the theory
 * that they are all "no browser chrome". They are not the same question.
 * `display-mode: fullscreen` matches a perfectly ordinary tab whose window is
 * in fullscreen — F11, or a Mac browser filling the screen — so anybody
 * reading rackr.club that way was told they had installed the app and handed
 * the sign-in door instead of the landing. The one honest signal is
 * `standalone`, plus the legacy flag iOS uses to say the same thing.
 */
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function read(): InstallState {
  return {
    ready: true,
    standalone: isStandalone(),
    platform: platformOf(navigator.userAgent),
    canPrompt: deferred !== null,
  };
}

/**
 * Publish the reading onto <html>, so CSS can act on it.
 *
 * The landing has to offer the right door in the *server's* HTML — a page
 * that waits for JavaScript to decide what its main button says either ships
 * an invisible button or shows the wrong label for as long as the phone takes
 * to hydrate. A media query answers "is this a finger?" before a single line
 * of our code runs; these attributes are only for the two things a media
 * query cannot know, and they arrive in time to correct it.
 */
function publish(state: InstallState) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.toggleAttribute("data-standalone", state.standalone);
  root.toggleAttribute("data-no-install", state.platform === "in-app" || state.platform === "desktop");
}

function refresh() {
  const next = read();
  publish(next);
  if (
    next.ready === snapshot.ready &&
    next.standalone === snapshot.standalone &&
    next.platform === snapshot.platform &&
    next.canPrompt === snapshot.canPrompt
  ) {
    return;
  }
  snapshot = next;
  emit();
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    // stop the browser's own mini-infobar; we own this moment
    e.preventDefault();
    deferred = e as Deferred;
    refresh();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    refresh();
  });
  // display-mode changes the instant the app is launched installed
  const dm = window.matchMedia("(display-mode: standalone)");
  dm.addEventListener?.("change", refresh);
  refresh();
}

export function subscribeInstall(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const getInstallSnapshot = () => snapshot;
export const getInstallServerSnapshot = () => SERVER;

/**
 * Fire the browser's install prompt. Resolves to whether it was actually
 * shown — false means there was nothing to show, which is the caller's cue to
 * fall back to instructions rather than to leave a dead button.
 */
export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  try {
    await deferred.prompt();
    return true;
  } catch {
    return false;
  } finally {
    // the event is single-use: a second prompt() throws
    deferred = null;
    refresh();
  }
}
