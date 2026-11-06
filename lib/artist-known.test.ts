/**
 * ¿Hay alguien detrás de /artista/<slug>? Las piezas puras.
 *   npx tsx --test lib/artist-known.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isPlainSlug,
  knownCacheFresh,
  likePatternForSlug,
  someNameMatches,
  verdictFromCatalogue,
} from "./artist-known";

test("solo los slugs con la forma de nuestros enlaces", () => {
  assert.ok(isPlainSlug("fleetwood-mac"));
  assert.ok(isPlainSlug("u2"));
  assert.ok(!isPlainSlug("Fleetwood Mac"));
  assert.ok(!isPlainSlug("-raro-"));
  assert.ok(!isPlainSlug("a%25b"));
});

test("el patrón encuentra el nombre con tildes, signos y «&»", () => {
  const like = (pattern: string, s: string) => {
    const re = new RegExp(
      `^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*").replace(/_/g, ".")}$`,
      "i",
    );
    return re.test(s);
  };
  assert.ok(like(likePatternForSlug("rosalia")!, "Rosalía"));
  assert.ok(like(likePatternForSlug("simon-and-garfunkel")!, "Simon & Garfunkel"));
  assert.ok(like(likePatternForSlug("nirvana")!, "Nirvana (2)"));
  assert.ok(like(likePatternForSlug("sigur-ros")!, "Sigur Rós"));
  assert.equal(likePatternForSlug("No Vale"), null);
});

test("de lo que trae la base, solo vale el mismo slug", () => {
  assert.ok(someNameMatches(["Rosalía", "Rosa León"], "rosalia"));
  assert.ok(someNameMatches(["Nirvana (2)"], "nirvana"));
  assert.ok(!someNameMatches(["Rosalinda"], "rosalia"));
});

test("el catálogo: igual existe, nada parecido no, parecido es duda", () => {
  assert.equal(verdictFromCatalogue(["Rosalía", "Rosalía (2)"], "rosalia"), "known");
  assert.equal(verdictFromCatalogue([], "qwzxv-plokm"), "unknown");
  assert.equal(verdictFromCatalogue(["Rosa León", "Rosana"], "qwzxv"), "unknown");
  assert.equal(verdictFromCatalogue(["The Fleetwoods"], "fleetwood"), "doubt");
});

test("un sí dura un mes; un no, un día", () => {
  const now = Date.parse("2026-11-06T12:00:00Z");
  const hours = (h: number) => new Date(now - h * 3600e3).toISOString();
  assert.ok(knownCacheFresh(true, hours(24 * 20), now));
  assert.ok(!knownCacheFresh(true, hours(24 * 31), now));
  assert.ok(knownCacheFresh(false, hours(12), now));
  assert.ok(!knownCacheFresh(false, hours(25), now));
  assert.ok(!knownCacheFresh(false, "basura", now));
});
