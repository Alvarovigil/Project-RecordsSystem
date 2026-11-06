/**
 * Lo que le toca a cada persona del minuto del catálogo.
 *   npx tsx --test lib/discogs-budget.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLIENT_CALLS_PER_MIN,
  CLIENT_REQUESTS_PER_MIN,
  __resetCatalogueBudget,
  clientCallRoom,
  clientCallWait,
  clientKey,
  clientRequestWait,
  createSlidingLimiter,
  spendClientCalls,
} from "./discogs-budget";

const T0 = 1_000_000;

test("la ventana deja pasar hasta el límite y luego dice cuánto esperar", () => {
  const l = createSlidingLimiter(3, 60_000);
  assert.equal(l.take("a", 1, T0), 0);
  assert.equal(l.take("a", 1, T0 + 10_000), 0);
  assert.equal(l.take("a", 1, T0 + 20_000), 0);
  // la cuarta espera a que salga la primera: 60 s después de T0
  assert.equal(l.take("a", 1, T0 + 30_000), 30);
  assert.equal(l.room("a", T0 + 30_000), 0);
  // y es deslizante: en cuanto sale la primera, cabe una
  assert.equal(l.take("a", 1, T0 + 60_000), 0);
  assert.equal(l.take("a", 1, T0 + 60_001), 10);
});

test("una dirección no gasta la ventana de otra", () => {
  const l = createSlidingLimiter(2, 60_000);
  l.take("a", 1, T0);
  l.take("a", 1, T0);
  assert.ok(l.take("a", 1, T0) > 0);
  assert.equal(l.take("b", 1, T0), 0);
  assert.equal(l.room("b", T0), 1);
});

test("un gasto de varias espera a que salgan las que hacen falta", () => {
  const l = createSlidingLimiter(5, 60_000);
  for (let i = 0; i < 5; i++) l.take("a", 1, T0 + i * 1000);
  // necesita 3 huecos: espera a que salga la tercera (T0 + 2 s)
  assert.equal(l.wait("a", 3, T0 + 10_000), 52);
  // si no cabe, no se apunta nada
  assert.ok(l.take("a", 3, T0 + 10_000) > 0);
  assert.equal(l.room("a", T0 + 10_000), 0);
  assert.equal(l.room("a", T0 + 62_000), 3);
});

test("con demasiadas direcciones se olvidan primero las viejas", () => {
  const l = createSlidingLimiter(1, 60_000, 3);
  for (const k of ["a", "b", "c", "d"]) l.take(k, 1, T0);
  // «a» era la más antigua y ya no está: vuelve a tener sitio
  assert.equal(l.room("a", T0), 1);
  assert.equal(l.room("d", T0), 0);
});

test("la dirección sale de x-forwarded-for, la primera de la lista", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  assert.equal(clientKey(h({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })), "203.0.113.7");
  // la de la plataforma manda sobre la que puede escribir el cliente
  assert.equal(
    clientKey(h({ "x-forwarded-for": "6.6.6.6", "x-vercel-forwarded-for": "203.0.113.9" })),
    "203.0.113.9",
  );
  assert.equal(clientKey(h({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "198.51.100.3" })), "198.51.100.3");
  assert.equal(clientKey(h({ "x-real-ip": "198.51.100.2" })), "198.51.100.2");
  assert.equal(clientKey(h({})), "local");
});

test("veinte búsquedas por minuto y por ruta; la siguiente, 429", () => {
  __resetCatalogueBudget();
  for (let i = 0; i < CLIENT_REQUESTS_PER_MIN; i++)
    assert.equal(clientRequestWait("search", "1.1.1.1", T0 + i * 100), 0);
  assert.ok(clientRequestWait("search", "1.1.1.1", T0 + 5000) > 0);
  // otra persona, y otra ruta de la misma persona, siguen pudiendo
  assert.equal(clientRequestWait("search", "2.2.2.2", T0 + 5000), 0);
  assert.equal(clientRequestWait("artist", "1.1.1.1", T0 + 5000), 0);
  __resetCatalogueBudget();
});

test("nadie se lleva todo el minuto de la instancia", () => {
  __resetCatalogueBudget();
  assert.equal(clientCallRoom("1.1.1.1", T0), CLIENT_CALLS_PER_MIN);
  assert.equal(spendClientCalls("1.1.1.1", CLIENT_CALLS_PER_MIN - 1, T0), 0);
  assert.equal(clientCallWait("1.1.1.1", 1, T0), 0);
  assert.ok(clientCallWait("1.1.1.1", 2, T0) > 0);
  assert.equal(clientCallRoom("2.2.2.2", T0), CLIENT_CALLS_PER_MIN);
  __resetCatalogueBudget();
});
