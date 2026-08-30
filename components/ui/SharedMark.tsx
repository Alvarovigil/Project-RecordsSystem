/**
 * The mark that says a list has two people in it.
 *
 * Two overlapping faces rather than a padlock or a badge with a word in it:
 * the fact worth showing at 14px is that there is more than one person here,
 * and a shape says that faster than "compartida" does. It sits where the lock
 * sits on the lists you cannot delete, so the same corner of a row always
 * answers the same question — what kind of list is this.
 */
export default function SharedMark({ title }: { title?: string }) {
  return (
    <span aria-label={title ?? "Rack compartido"} title={title} className="shrink-0">
      <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
        <circle cx="5.2" cy="5" r="2.1" stroke="currentColor" strokeWidth="1.1" />
        <path
          d="M1.5 11.4c0-1.9 1.6-2.9 3.7-2.9s3.7 1 3.7 2.9"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
        <path
          d="M9.4 3.2a2.1 2.1 0 0 1 0 3.6M10.4 8.8c1.3.3 2.1 1.2 2.1 2.6"
          stroke="currentColor"
          strokeWidth="1.1"
          strokeLinecap="round"
        />
      </svg>
    </span>
  );
}
