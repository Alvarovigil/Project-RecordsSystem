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
 * So it says three things, in this order: the search is incomplete, it is a
 * limit rather than a fault of theirs, and it is being worked on. The last one
 * is not decoration — "beta" is the difference between a product that is
 * unfinished and a product that is broken, and only one of those is worth
 * coming back to.
 *
 * Quiet on purpose. A red alert over a search box makes people think they did
 * something wrong; this is the register of a note in a margin.
 */
export default function CatalogueNotice({
  degraded,
  compact = false,
}: {
  degraded: "rate-limit" | "down" | "partial" | null;
  compact?: boolean;
}) {
  if (!degraded) return null;

  const text =
    degraded === "rate-limit"
      ? "El catálogo está devolviendo menos resultados de lo normal: hemos llegado al límite de consultas de Discogs. Vuelve a intentarlo en un minuto."
      : degraded === "down"
        ? "No hemos podido consultar el catálogo de Discogs. Lo que ves es lo que ya tienes en tu colección."
        : "Faltan resultados: el catálogo ha respondido a medias.";

  return (
    <div
      role="status"
      className={`flex items-start gap-2.5 border border-line bg-fill-subtle/40 text-content-muted ${
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
      <p className="min-w-0 text-sub leading-snug">
        {text}{" "}
        <span className="text-content-faint">
          La búsqueda en el catálogo está en beta y seguimos trabajando en ella.
        </span>
      </p>
    </div>
  );
}
