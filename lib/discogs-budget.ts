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

/* ------------------------------------------------------------------------ */
/*  Lo que le toca a cada persona                                            */
/* ------------------------------------------------------------------------ */

/**
 * El minuto del catálogo es de todos, y hasta aquí lo podía gastar uno solo.
 *
 * La cuenta de arriba es de la instancia: protege al catálogo de nosotros,
 * pero no a una persona de otra. Una sola dirección escribiendo muy deprisa (o
 * un script) dejaba el tope blando a cero y todos los demás leían «vuelve en
 * N segundos» sin haber buscado nada. Así que cada dirección tiene además su
 * propia ventana, con dos cuentas:
 *
 * - **Peticiones**: cuántas veces llama a cada ruta que pregunta al catálogo.
 *   Veinte por minuto es más de lo que nadie teclea buscando discos.
 * - **Consultas**: cuántas de las 45 de la instancia se lleva. Una búsqueda
 *   larga gasta hasta nueve, así que con solo la primera cuenta veinte
 *   búsquedas seguirían pudiendo con todo. Con 30 queda siempre un tercio
 *   del minuto para el resto.
 *
 * Lo que sale de la caché no cuenta: no le cuesta nada a nadie.
 */
export const CLIENT_REQUESTS_PER_MIN = 20;
export const CLIENT_CALLS_PER_MIN = 30;

export type SlidingLimiter = {
  /** segundos hasta que `key` pueda gastar `cost`; 0 si puede ya */
  wait(key: string, cost?: number, now?: number): number;
  /** cuánto le queda a `key` en la ventana */
  room(key: string, now?: number): number;
  /** apunta el gasto si cabe; devuelve 0 si se apuntó o los segundos de espera */
  take(key: string, cost?: number, now?: number): number;
  reset(): void;
};

/**
 * Ventana deslizante por clave, en memoria de la instancia.
 *
 * Cada clave guarda las marcas de tiempo de su último minuto. Para que una
 * instancia que ve pasar miles de direcciones no crezca sin fin, al pasar de
 * `maxKeys` se tiran primero las vacías y, si no basta, las más antiguas
 * (un Map recuerda el orden en que entraron).
 */
export function createSlidingLimiter(
  limit: number,
  windowMs = WINDOW_MS,
  maxKeys = 5000,
): SlidingLimiter {
  const hits = new Map<string, number[]>();

  const live = (key: string, now: number) => {
    const list = hits.get(key);
    if (!list) return [] as number[];
    while (list.length && now - list[0] >= windowMs) list.shift();
    if (list.length === 0) hits.delete(key);
    return list;
  };

  const wait = (key: string, cost = 1, now = Date.now()) => {
    const list = live(key, now);
    if (list.length + cost <= limit) return 0;
    // hay que esperar a que salgan las suficientes por la cola de la ventana
    const mustLeave = list.length + cost - limit;
    const at = list[Math.min(list.length, mustLeave) - 1];
    if (at === undefined) return Math.ceil(windowMs / 1000); // cost > limit
    return Math.max(1, Math.ceil((at + windowMs - now) / 1000));
  };

  const trim = (now: number) => {
    if (hits.size <= maxKeys) return;
    for (const key of Array.from(hits.keys())) {
      live(key, now);
      if (hits.size <= maxKeys) return;
    }
    for (const key of Array.from(hits.keys())) {
      if (hits.size <= maxKeys) return;
      hits.delete(key);
    }
  };

  return {
    wait,
    room(key, now = Date.now()) {
      return Math.max(0, limit - live(key, now).length);
    },
    take(key, cost = 1, now = Date.now()) {
      const w = wait(key, cost, now);
      if (w > 0) return w;
      const list = hits.get(key) ?? [];
      for (let i = 0; i < cost; i++) list.push(now);
      hits.set(key, list);
      trim(now);
      return 0;
    },
    reset() {
      hits.clear();
    },
  };
}

/* una ventana de peticiones por ruta: una búsqueda trae detrás la de las caras
   de los artistas, y no deberían comerse la una a la otra */
export type CatalogueRoute = "search" | "barcode" | "artist";
const clientRequests = new Map<CatalogueRoute, SlidingLimiter>();
const requestsOf = (route: CatalogueRoute) => {
  let l = clientRequests.get(route);
  if (!l) clientRequests.set(route, (l = createSlidingLimiter(CLIENT_REQUESTS_PER_MIN)));
  return l;
};
const clientCalls = createSlidingLimiter(CLIENT_CALLS_PER_MIN);

/**
 * Quién pregunta. Primero las cabeceras que pone la plataforma y el cliente no
 * puede escribir (`x-vercel-forwarded-for`, `x-real-ip`); `x-forwarded-for`
 * solo si no hay otra, porque su primera dirección la puede inventar quien
 * llama y con eso esquivaría su propio límite. En local no hay cabecera y
 * todo es una misma persona, que es exactamente lo que pasa en local.
 */
export function clientKey(headers: Pick<Headers, "get">): string {
  const first = (name: string) => headers.get(name)?.split(",")[0]?.trim();
  return (
    first("x-vercel-forwarded-for") ||
    first("x-real-ip") ||
    first("x-forwarded-for") ||
    "local"
  );
}

/**
 * La puerta de cada ruta que va a preguntar al catálogo: una petición más
 * para esta dirección. Devuelve los segundos de espera, o 0 si puede pasar.
 * Se llama después de mirar la caché, nunca antes.
 */
export function clientRequestWait(
  route: CatalogueRoute,
  key: string,
  now = Date.now(),
): number {
  return requestsOf(route).take(key, 1, now);
}

/** cuántas consultas al catálogo le quedan a esta dirección en el minuto */
export function clientCallRoom(key: string, now = Date.now()): number {
  return clientCalls.room(key, now);
}

/** segundos hasta que esta dirección pueda gastar `cost` consultas */
export function clientCallWait(key: string, cost = 1, now = Date.now()): number {
  return clientCalls.wait(key, cost, now);
}

/** apunta `cost` consultas a esta dirección (si no caben, no apunta nada) */
export function spendClientCalls(key: string, cost = 1, now = Date.now()): number {
  return clientCalls.take(key, cost, now);
}

/** solo para pruebas */
export function __resetCatalogueBudget() {
  sent.length = 0;
  blockedUntil = 0;
  clientRequests.clear();
  clientCalls.reset();
}
