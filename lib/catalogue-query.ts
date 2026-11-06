/**
 * Cuándo el buscador pregunta al catálogo, y cuándo no hace falta.
 *
 * Lógica pura, sin React ni red, para que se pueda probar sola
 * (`npx tsx --test lib/catalogue-query.test.ts`) y para que el hook se quede
 * en lo suyo: cuándo, no qué.
 */

/** lo que se espera tras la última tecla antes de preguntar */
export const CATALOGUE_DEBOUNCE_MS = 500;
/** menos letras que esto no se buscan en el catálogo (sí en tu estantería) */
export const CATALOGUE_MIN_CHARS = 3;

/**
 * La forma canónica de lo que se ha escrito.
 *
 * «Fleetwood mac » y «fleetwood  Mac» son la misma pregunta: la misma clave
 * en la caché y, sobre todo, el mismo valor para el efecto que busca, así que
 * pulsar espacio o cambiar una mayúscula no dispara otra búsqueda.
 */
export function catalogueQueryKey(q: string): string {
  return q.trim().replace(/\s+/g, " ").toLowerCase();
}

/** Un código de barras escrito a mano: solo cifras (con espacios o guiones), 8 o más. */
export function looksLikeBarcode(q: string): boolean {
  const compact = q.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(compact);
}

/** Si una consulta merece salir a la red. */
export function shouldSearchCatalogue(q: string): boolean {
  const key = catalogueQueryKey(q);
  if (!key) return false;
  if (looksLikeBarcode(key)) return true;
  return key.length >= CATALOGUE_MIN_CHARS;
}

/**
 * Una caché pequeña en memoria: las últimas N consultas, durante unos minutos.
 *
 * Borrar una letra y volver a escribirla, o ir y volver entre el buscador y la
 * ficha, no debería costar otra consulta. Se guarda solo lo que vino entero;
 * eso lo decide quien llama.
 */
export function createQueryCache<T>({
  max = 50,
  ttlMs = 5 * 60_000,
  now = () => Date.now(),
}: { max?: number; ttlMs?: number; now?: () => number } = {}) {
  const map = new Map<string, { value: T; at: number }>();
  return {
    get(key: string): T | undefined {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (now() - hit.at > ttlMs) {
        map.delete(key);
        return undefined;
      }
      // al final: lo usado hace poco es lo último en salir
      map.delete(key);
      map.set(key, hit);
      return hit.value;
    },
    set(key: string, value: T) {
      map.delete(key);
      map.set(key, { value, at: now() });
      while (map.size > max) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        map.delete(oldest);
      }
    },
    get size() {
      return map.size;
    },
    clear() {
      map.clear();
    },
  };
}

/**
 * Cuánto esperar tras un 429, en milisegundos.
 *
 * Primero el cuerpo (`retryAfter`, en segundos), luego la cabecera
 * Retry-After, y si no viene ninguno, 30 s. Entre 1 s y 2 min.
 */
export function retryDelayMs(bodyRetryAfter: unknown, header: string | null): number {
  const fromBody = typeof bodyRetryAfter === "number" ? bodyRetryAfter : NaN;
  const fromHeader = header != null ? Number(header) : NaN;
  const s = Number.isFinite(fromBody) ? fromBody : Number.isFinite(fromHeader) ? fromHeader : 30;
  return Math.min(120, Math.max(1, s)) * 1000;
}
