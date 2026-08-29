/**
 * The mark that says an account is who it says it is.
 *
 * Not a status symbol and not a rank: it exists because somebody looking at a
 * list signed "Rackr Club" has to be able to tell ours from an account with
 * the same name. That is the whole claim, and it is why it is granted by hand
 * from the panel and can never be granted by its own owner.
 *
 * Drawn rather than borrowed. Every platform's tick is that platform's tick,
 * and a blue Twitter check on a black vinyl app reads as a screenshot from
 * somewhere else. This is the product's own red — the colour it reserves for
 * what is live or true — with the seal shape doing the work the colour cannot
 * do on its own for anybody who does not see red.
 */
export default function Verified({
  size = 14,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label="Cuenta verificada"
      title="Cuenta verificada"
      className={`inline-flex shrink-0 align-middle ${className}`}
    >
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
        {/* the seal: twelve points, so it reads as a stamp at 14px rather than
            as a circle with something in it */}
        <path
          d="M8 0.9l1.6 1.2 2-0.2 0.7 1.9 1.8 0.9-0.4 2 1.2 1.6-1.2 1.6 0.4 2-1.8 0.9-0.7 1.9-2-0.2L8 15.1l-1.6-1.2-2 0.2-0.7-1.9-1.8-0.9 0.4-2L1.1 7.7l1.2-1.6-0.4-2 1.8-0.9 0.7-1.9 2 0.2z"
          fill="currentColor"
        />
        <path
          d="M5.2 8.1 L7 9.9 L10.9 6"
          stroke="var(--ink)"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
