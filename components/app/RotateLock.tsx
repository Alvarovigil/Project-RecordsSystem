"use client";

/**
 * Portrait, and only portrait.
 *
 * The manifest asks for it and Android obeys. iOS ignores manifest orientation
 * outright and gives a web app no way to lock it — `screen.orientation.lock()`
 * is not implemented there at all. So the honest option is not to prevent the
 * rotation but to refuse the layout: everything this app is made of assumes a
 * tall screen, and a phone on its side gets a sentence instead of a shelf
 * squeezed into a letterbox.
 *
 * The whole thing is CSS — see `.rotate-lock` — so it costs nothing and never
 * appears on anything but a phone held sideways. Turning the phone back is the
 * only control it needs; adding a "continuar así" button would be offering a
 * layout that does not exist.
 */
export default function RotateLock() {
  return (
    <div className="rotate-lock" role="alert">
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" aria-hidden className="text-content-muted">
        <rect x="7.5" y="2.5" width="9" height="19" rx="2.2" stroke="currentColor" strokeWidth="1.4" />
        <path d="M10.8 18.6h2.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        <path
          d="M20 9.4a8.6 8.6 0 0 1 .4 2.6M4 14.6A8.6 8.6 0 0 1 3.6 12"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      <p className="text-body text-paper">Gira el teléfono</p>
      <p className="max-w-[28ch] text-sub leading-relaxed text-content-muted">
        Rackr está pensada en vertical: la estantería se recorre con el pulgar,
        de arriba abajo.
      </p>
    </div>
  );
}
