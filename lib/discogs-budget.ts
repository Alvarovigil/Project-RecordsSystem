import { discogsHeaders } from "@/lib/discogs";

/**
 * Lo que queda del minuto con el catálogo, contado desde este proceso.
 *
 * El catálogo deja sesenta consultas por minuto para toda la aplicación. Antes
 * nadie las contaba: cada búsqueda abría su cascada y se enteraba del límite
 * cuando ya le estaban diciendo que no, y la siguiente persona volvía a chocar
 * con la misma pared un segundo después.
 *
 * Aquí se lleva la cuenta de dos cosas:
 *
 * - **Las consultas del último minuto**, para dejar de pedir antes de llegar
 *   al tope (se para en 45 y no en 60: este proceso no es el único que
 *   pregunta, y la importación de discos no pasa por aquí).
 * - **Un «vuelve en N segundos»**, que se pone cuando el catálogo responde 429
 *   y hace que todo lo demás conteste lo mismo sin gastar otra consulta.
 *
 * En Vercel cada instancia lleva su propia cuenta. No es exacto, pero ataja el
 * caso que duele de verdad: una persona escribiendo deprisa en un móvil, que
 * casi siempre cae en la misma instancia caliente.
 */

const WINDOW_MS = 60_000;
/** por debajo de las 60 reales: deja sitio a otras rutas y otras instancias */
export const SOFT_LIMIT = 45;
/** cuando el catálogo no dice cuánto esperar */
const DEFAULT_RETRY_S = 30;

const sent: number[] = [];
let blockedUntil = 0;

function prune(now: number) {
  while (sent.length && now - sent[0] >= WINDOW_MS) sent.shift();
}

/** segundos hasta poder volver a preguntar; 0 si se puede ya */
export function catalogueWaitSeconds(now = Date.now()): number {
  prune(now);
  if (blockedUntil > now) return Math.ceil((blockedUntil - now) / 1000);
  if (sent.length >= SOFT_LIMIT) {
    // hasta que la consulta más vieja salga de la ventana
    return Math.max(1, Math.ceil((sent[0] + WINDOW_MS - now) / 1000));
  }
  return 0;
}

/** cuántas consultas caben ahora mismo sin pasar del tope blando */
export function catalogueRoom(now = Date.now()): number {
  prune(now);
  if (blockedUntil > now) return 0;
  return Math.max(0, SOFT_LIMIT - sent.length);
}

/** Retry-After viene en segundos o como fecha; cualquier otra cosa, el valor por defecto */
export function parseRetryAfter(header: string | null, now = Date.now()): number {
  if (!header) return DEFAULT_RETRY_S;
  const n = Number(header);
  if (Number.isFinite(n) && n >= 0) return Math.min(120, Math.max(1, Math.ceil(n)));
  const at = Date.parse(header);
  if (Number.isFinite(at)) return Math.min(120, Math.max(1, Math.ceil((at - now) / 1000)));
  return DEFAULT_RETRY_S;
}

export type CatalogueFetch =
  | { kind: "ok"; data: unknown }
  | { kind: "rate_limited"; retryAfter: number }
  | { kind: "failed"; status?: number };

/**
 * Una consulta al catálogo que cuenta, y que no sale si ya se sabe la respuesta.
 *
 * - Si el proceso está en espera o sin sitio, ni siquiera llega a la red.
 * - Si el catálogo responde 429, se apunta la espera para todos.
 * - Si avisa de que le quedan pocas (cabecera de consultas restantes), se
 *   adelanta la espera antes de que llegue el 429.
 */
export async function catalogueFetch(
  url: URL | string,
  init: { signal?: AbortSignal; revalidate?: number } = {},
): Promise<CatalogueFetch> {
  const now = Date.now();
  const wait = catalogueWaitSeconds(now);
  if (wait > 0) return { kind: "rate_limited", retryAfter: wait };
  sent.push(now);
  try {
    const r = await fetch(url, {
      headers: discogsHeaders(),
      signal: init.signal,
      next: { revalidate: init.revalidate ?? 60 },
    });
    if (r.status === 429) {
      const retryAfter = parseRetryAfter(r.headers.get("retry-after"));
      blockedUntil = Math.max(blockedUntil, Date.now() + retryAfter * 1000);
      return { kind: "rate_limited", retryAfter };
    }
    const remaining = Number(r.headers.get("x-discogs-ratelimit-remaining"));
    if (Number.isFinite(remaining) && r.headers.has("x-discogs-ratelimit-remaining")) {
      // el catálogo cuenta de verdad; si va más justo que nosotros, manda él
      const used = Math.max(0, 60 - remaining);
      while (sent.length < Math.min(used, SOFT_LIMIT)) sent.push(now);
    }
    if (!r.ok) return { kind: "failed", status: r.status };
    return { kind: "ok", data: await r.json() };
  } catch {
    return { kind: "failed" };
  }
}

/** La respuesta que reciben las rutas cuando el catálogo pide esperar. */
export function rateLimitedResponse(retryAfter: number, extra: Record<string, unknown> = {}) {
  return Response.json(
    { error: "rate_limited", retryAfter, ...extra },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}

/** solo para pruebas */
export function __resetCatalogueBudget() {
  sent.length = 0;
  blockedUntil = 0;
}
