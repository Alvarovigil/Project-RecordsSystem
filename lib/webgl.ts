"use client";

/**
 * Whether this browser can draw the shelf at all.
 *
 * The 3D shelf is the product's signature and also the one thing in it that
 * a browser is allowed to refuse: an old phone, a GPU on the blocklist, iOS in
 * lockdown mode, or a context the system took back because it needed the
 * memory. Mounting a `<Canvas>` without asking first is how a missing feature
 * became «Application error» on the landing.
 *
 * Asked once per launch and remembered, because creating a context to find
 * out costs a context — and once one has been lost in this session, the next
 * one is not to be trusted either: a phone that ran out of memory for
 * textures will run out again the moment the shelf is mounted.
 */

let verdict: boolean | null = null;

export function hasWebGL(): boolean {
  if (verdict !== null) return verdict;
  if (typeof window === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    const gl =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null);
    verdict = Boolean(gl);
    // hand the probe's context straight back: browsers cap how many can be
    // alive at once, and this one was never going to draw anything
    gl?.getExtension("WEBGL_lose_context")?.loseContext();
  } catch {
    verdict = false;
  }
  return verdict;
}

/** The context was taken away mid-session: stop offering 3D until reload. */
export function markWebGLLost() {
  verdict = false;
}
