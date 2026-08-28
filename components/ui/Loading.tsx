/**
 * Waiting, in the product's own mark.
 *
 * Every loading state in here used to be the word "Cargando…", a pulsing dot
 * or a sliding bar — three different answers to one question, none of which
 * belong to anything. This is the badge, small and centred, with the globe
 * turning: one thing that says both "a moment" and whose moment it is.
 *
 * The rotation is faked the way it has been faked since the first spinning
 * globe: the meridian's horizontal radius sweeps from full width to nothing
 * and out the other side, which the eye reads as a sphere turning. Cheaper
 * than a real rotation — one composited transform, no repaint — and it keeps
 * the outline perfectly still, so what moves is the thing inside rather than
 * the whole picture wobbling.
 *
 * Never a full-screen white flash and never a layout jump: it sits in the dark
 * the app already is, at the size of a caption, and leaves when the content
 * arrives.
 */
export default function Loading({
  size = 44,
  label = "Cargando",
}: {
  size?: number;
  /** what is being waited for, for anyone listening rather than looking */
  label?: string;
}) {
  return (
    <span role="status" aria-label={label} className="inline-flex">
      <svg
        width={size}
        height={(size * 256) / 531}
        viewBox="0 0 531 256"
        fill="none"
        aria-hidden
        className="text-paper/70"
      >
        <rect
          x="7.31"
          y="7.31"
          width="515.89"
          height="241.37"
          rx="120.69"
          stroke="currentColor"
          strokeWidth="14.63"
        />
        {/* the globe */}
        <path
          d="M133.029 43.6855C86.4651 43.6855 48.7142 81.4365 48.7142 128C48.7142 174.563 86.4651 212.314 133.029 212.314C179.592 212.314 217.343 174.563 217.343 128C217.343 81.4365 179.592 43.6855 133.029 43.6855Z"
          stroke="currentColor"
          strokeWidth="12.97"
          strokeMiterlimit="10"
        />
        <path
          d="M76.8165 71.7891C92.3174 82.7945 111.831 89.3572 133.027 89.3572C154.224 89.3572 173.737 82.7945 189.238 71.7891M189.238 184.211C173.737 173.205 154.224 166.643 133.027 166.643C111.831 166.643 92.3174 173.205 76.8165 184.211"
          stroke="currentColor"
          strokeWidth="12.97"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M133.029 43.6855V212.314M217.343 128H48.7142"
          stroke="currentColor"
          strokeWidth="12.97"
          strokeMiterlimit="10"
        />
        {/* the turning meridian: scaled about the globe's own centre */}
        <path
          className="loader-meridian"
          d="M133.027 43.6855C109.488 43.6855 87.3558 81.4365 87.3558 128C87.3558 174.563 109.488 212.314 133.027 212.314C156.567 212.314 178.699 174.563 178.699 128C178.699 81.4365 156.567 43.6855 133.027 43.6855Z"
          stroke="currentColor"
          strokeWidth="12.97"
          strokeMiterlimit="10"
        />
        {/* the mark */}
        <path
          d="M253.221 209.934C253.696 209.776 254.171 209.697 254.647 209.697C258.292 208.587 261.699 206.606 264.869 203.754C267.88 200.743 270.494 195.671 272.713 188.54L309.559 68.2566C310.985 63.5023 311.619 59.6988 311.461 56.8463C311.302 53.8352 310.589 51.6166 309.321 50.1903C308.053 48.764 306.31 47.7339 304.091 47.1L303.141 46.8623L304.329 43.2966H342.126L297.673 188.54C296.247 193.136 295.534 196.86 295.534 199.713C295.692 202.565 296.326 204.784 297.435 206.369C298.545 207.795 300.13 208.825 302.19 209.459C302.824 209.617 303.378 209.776 303.854 209.934L302.665 213.5H252.27L253.221 209.934ZM323.584 131.251L348.306 129.587L357.577 191.63C358.37 197.494 359.558 201.773 361.143 204.467C362.728 207.161 364.788 208.904 367.323 209.697L367.561 209.934L366.373 213.5H335.707L323.584 131.251ZM314.789 126.972H329.527C336.5 126.972 342.601 124.04 347.831 118.177C353.061 112.154 357.498 103.042 361.143 90.8394C364.471 79.7461 365.58 70.2375 364.471 62.3137C363.362 54.2314 359.241 50.1903 352.11 50.1903H331.904L330.002 43.2966H361.856C369.146 43.2966 375.089 45.2775 379.685 49.2394C384.28 53.2013 387.212 58.748 388.48 65.8794C389.748 73.0108 389.114 81.0931 386.578 90.1263C383.884 99.7933 379.843 108.034 374.455 114.849C369.067 121.505 362.965 126.417 356.151 129.587C349.336 132.598 342.284 133.945 334.994 133.628L334.281 134.103H308.133L314.789 126.972ZM401.9 119.127C403.168 114.849 403.881 111.283 404.04 108.43C404.357 105.578 404.119 103.438 403.327 102.012C402.693 100.427 401.425 99.3179 399.523 98.684C399.206 98.367 398.731 98.2086 398.097 98.2086L399.286 94.8806H432.803L396.433 213.5H372.662L401.9 119.127ZM408.794 167.859C415.45 148.366 421.948 132.915 428.287 121.505C434.784 109.936 441.044 102.091 447.066 97.9708C453.247 93.692 459.427 92.5034 465.608 94.4051L454.911 118.414H453.484C449.522 115.879 444.847 116.513 439.459 120.316C434.071 123.961 428.207 131.568 421.868 143.137C415.688 154.705 409.507 170.632 403.327 190.917L408.794 167.859Z"
          fill="currentColor"
        />
      </svg>
    </span>
  );
}

/**
 * The same thing, holding a screen on its own.
 *
 * Centred in the dark with nothing else in it — no spinner, no "cargando", no
 * skeleton pretending to be content that has not arrived. A screen that is
 * waiting should look like it is waiting.
 */
export function LoadingScreen({ label = "Cargando" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] w-full items-center justify-center">
      <Loading size={52} label={label} />
    </div>
  );
}
