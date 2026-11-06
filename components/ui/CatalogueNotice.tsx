"use client";

/**
 * When the catalogue could not answer properly, and it is not your fault.
 *
 * Searching a record fans out into a dozen queries against Discogs, which
 * allows sixty a minute for everyone using Rackr at once. When it starts
 * refusing them the honest answer is "we could not ask" — but what the screen
 * showed was an empty list, which reads as "that record does not exist". A
 * person then concludes the catalogue is thin and stops looking, and nothing
 * in the interface ever corrects them.
 *
 * So it says two things, in plain words: what is missing, and that waiting a
 * few seconds fixes it. No quotas, no limits per minute, no «beta» — none of
 * that tells the person what to do next.
 *
 * Quiet on purpose. A red alert over a search box makes people think they did
 * something wrong; this is the register of a note in a margin.
 */
export default function CatalogueNotice({
  degraded,
  compact = false,
  empty = false,
  onRetry,
}: {
  degraded: "rate-limit" | "down" | "partial" | null;
  compact?: boolean;
  /** no ha llegado ninguna fila: no se puede decir «menos de lo normal» */
  empty?: boolean;
  /** vuelve a preguntar la misma frase */
  onRetry?: () => void;
}) {
  if (!degraded) return null;

  const text =
    degraded === "down"
      ? "No hemos podido consultar el catálogo. Lo que ves es lo que ya tienes en tu colección."
      : degraded === "rate-limit" && empty
        ? "El catálogo va lento ahora mismo. Prueba en unos segundos."
        : "El catálogo va lento: faltan resultados. Prueba en unos segundos.";

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 rounded-lg bg-fill-subtle text-content-muted ${
        compact ? "px-3 py-2.5" : "px-4 py-3"
      }`}
    >
      <span aria-hidden className="mt-[3px] shrink-0 text-content-faint">
        <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5.6" stroke="currentColor" strokeWidth="1.2" />
          <path d="M7 4v3.6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <circle cx="7" cy="9.9" r="0.75" fill="currentColor" />
        </svg>
      </span>
      <div className="min-w-0">
        <p className="text-sub leading-snug">
          {text}
        </p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="pressable hit mt-2 text-sub font-medium text-paper underline underline-offset-4"
          >
            Reintentar
          </button>
        )}
      </div>
    </div>
  );
}
