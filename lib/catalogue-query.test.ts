/**
 * Pruebas de la lógica pura del buscador y del presupuesto del catálogo.
 *
 * El repo no tiene runner; esto usa el de Node y tsx, que ya están:
 *   npx tsx --test lib/catalogue-query.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  catalogueQueryKey,
  createQueryCache,
  looksLikeBarcode,
  retryDelayMs,
  shouldSearchCatalogue,
} from "./catalogue-query";
import {
  SOFT_LIMIT,
  __resetCatalogueBudget,
  catalogueFetch,
  catalogueRoom,
  catalogueWaitSeconds,
  parseRetryAfter,
} from "./discogs-budget";

test("la clave ignora mayúsculas y espacios de más", () => {
  assert.equal(catalogueQueryKey("  Fleetwood   Mac "), "fleetwood mac");
  assert.equal(catalogueQueryKey("fleetwood mac "), catalogueQueryKey("fleetwood mac"));
});

test("menos de tres letras no sale a la red, salvo un código de barras", () => {
  assert.equal(shouldSearchCatalogue("fl"), false);
  assert.equal(shouldSearchCatalogue("  fl  "), false);
  assert.equal(shouldSearchCatalogue("fle"), true);
  assert.equal(shouldSearchCatalogue("12345678"), true);
  assert.equal(shouldSearchCatalogue("0 75992 73122 6"), true);
  assert.equal(looksLikeBarcode("1234"), false);
  assert.equal(looksLikeBarcode("abc12345678"), false);
});

test("la caché devuelve lo reciente, caduca y echa al más viejo", () => {
  let t = 0;
  const c = createQueryCache<number>({ max: 2, ttlMs: 1000, now: () => t });
  c.set("a", 1);
  c.set("b", 2);
  assert.equal(c.get("a"), 1); // "a" pasa a ser el más reciente
  c.set("c", 3); // sale "b"
  assert.equal(c.get("b"), undefined);
  assert.equal(c.get("a"), 1);
  t = 2000;
  assert.equal(c.get("a"), undefined);
});

test("retryDelayMs: cuerpo, luego cabecera, luego 30 s; entre 1 s y 2 min", () => {
  assert.equal(retryDelayMs(12, "40"), 12_000);
  assert.equal(retryDelayMs(undefined, "40"), 40_000);
  assert.equal(retryDelayMs(undefined, null), 30_000);
  assert.equal(retryDelayMs(999, null), 120_000);
  assert.equal(retryDelayMs(0, null), 1_000);
});

test("parseRetryAfter entiende segundos y fechas", () => {
  assert.equal(parseRetryAfter("7"), 7);
  assert.equal(parseRetryAfter(null), 30);
  const now = Date.parse("2026-01-01T00:00:00Z");
  assert.equal(parseRetryAfter("Thu, 01 Jan 2026 00:00:20 GMT", now), 20);
});

test("un 429 del catálogo cierra la puerta a todos hasta que pase", async () => {
  __resetCatalogueBudget();
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return new Response("{}", { status: 429, headers: { "Retry-After": "15" } });
  }) as typeof fetch;
  try {
    const first = await catalogueFetch("https://example.test/x");
    assert.deepEqual(first, { kind: "rate_limited", retryAfter: 15 });
    const second = await catalogueFetch("https://example.test/y");
    assert.equal(second.kind, "rate_limited");
    assert.equal(calls, 1, "la segunda ni siquiera sale a la red");
    assert.ok(catalogueWaitSeconds() > 0);
    assert.equal(catalogueRoom(), 0);
  } finally {
    globalThis.fetch = realFetch;
    __resetCatalogueBudget();
  }
});

test("el tope blando para antes de las sesenta", async () => {
  __resetCatalogueBudget();
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json({ results: [] });
  }) as typeof fetch;
  try {
    for (let i = 0; i < SOFT_LIMIT + 5; i++) await catalogueFetch("https://example.test/z");
    assert.equal(calls, SOFT_LIMIT);
    assert.equal(catalogueRoom(), 0);
  } finally {
    globalThis.fetch = realFetch;
    __resetCatalogueBudget();
  }
});
