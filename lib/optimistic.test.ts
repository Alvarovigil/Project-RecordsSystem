/**
 * La vuelta atrás de un cambio optimista deshace solo lo suyo.
 *   npx tsx --test lib/optimistic.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { revertOptimistic, type OptimisticState } from "./optimistic";

type R = { id: string; title?: string };
type L = { id: string };
type S = OptimisticState<R, L>;

const base: S = {
  releases: [{ id: "r1" }],
  lists: [{ id: "col" }, { id: "wish" }, { id: "rack" }],
  items: { col: ["r1"], wish: [], rack: [] },
};

/** lo que hace saveToList, en pequeño */
const addTo = (s: S, rel: R, list: string): S => ({
  ...s,
  releases: s.releases.some((r) => r.id === rel.id) ? s.releases : [...s.releases, rel],
  items: { ...s.items, [list]: [...(s.items[list] ?? []), rel.id] },
});

test("sin nada en medio, vuelve exactamente a lo de antes", () => {
  const next = addTo(base, { id: "a" }, "col");
  assert.deepEqual(revertOptimistic(next, base, next), base);
});

test("falla A con B en vuelo: B se queda en pantalla", () => {
  const afterA = addTo(base, { id: "a" }, "col");
  const afterB = addTo(afterA, { id: "b" }, "rack");
  const back = revertOptimistic(afterB, base, afterA);
  assert.deepEqual(back.releases.map((r) => r.id), ["r1", "b"]);
  assert.deepEqual(back.items.col, ["r1"]);
  assert.deepEqual(back.items.rack, ["b"]);
});

test("un borrado que falla devuelve el disco a su sitio, sin tocar lo demás", () => {
  const del = (s: S, id: string): S => ({
    ...s,
    releases: s.releases.filter((r) => r.id !== id),
    items: Object.fromEntries(Object.entries(s.items).map(([k, ids]) => [k, ids.filter((x) => x !== id)])),
  });
  const two = addTo(base, { id: "r2" }, "col");
  const afterDel = del(two, "r1");
  const afterOther = addTo(afterDel, { id: "c" }, "wish");
  const back = revertOptimistic(afterOther, two, afterDel);
  assert.deepEqual(back.releases.map((r) => r.id), ["r1", "r2", "c"]);
  assert.deepEqual(back.items.col, ["r1", "r2"]);
  assert.deepEqual(back.items.wish, ["c"]);
});

test("pasar de deseos a colección y fallar lo devuelve a deseos", () => {
  const wished: S = { ...base, items: { col: ["r1"], wish: ["x"], rack: [] }, releases: [...base.releases, { id: "x" }] };
  const moved: S = { ...wished, items: { ...wished.items, col: ["r1", "x"], wish: [] } };
  const back = revertOptimistic(moved, wished, moved);
  assert.deepEqual(back.items, wished.items);
});

test("si otra escritura ya devolvió lo quitado, no se duplica", () => {
  const removed: S = { ...base, items: { ...base.items, col: [] } };
  const readded: S = { ...removed, items: { ...removed.items, col: ["r1"] } };
  const back = revertOptimistic(readded, base, removed);
  assert.deepEqual(back.items.col, ["r1"]);
});

test("una lista que el cambio no tocó conserva su identidad", () => {
  const next = addTo(base, { id: "a" }, "col");
  const back = revertOptimistic(next, base, next);
  assert.equal(back.lists, next.lists);
});
