/**
 * La sesión guardada, sin red: lo que comparten lib/data y el armazón de Explorar.
 *   npx tsx --test lib/auth-cookie.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { authTokenName, storedSessionIn } from "./auth-cookie";

const NAME = "sb-abcdef-auth-token";

test("el nombre sale del subdominio del proyecto", () => {
  assert.equal(authTokenName("https://abcdef.supabase.co"), NAME);
  assert.equal(authTokenName(""), null);
  assert.equal(authTokenName("no es una url"), null);
});

test("la cookie entera o cualquiera de sus trozos es sesión", () => {
  assert.equal(storedSessionIn(NAME, `a=1; ${NAME}=base64-xyz; b=2`, null), true);
  assert.equal(storedSessionIn(NAME, `${NAME}.0=aaa; ${NAME}.1=bbb`, null), true);
  assert.equal(storedSessionIn(NAME, `${NAME}.12=zz`, null), true);
});

test("el verificador del PKCE no es sesión, ni la de otro proyecto", () => {
  assert.equal(storedSessionIn(NAME, `${NAME}-code-verifier=abc`, null), false);
  assert.equal(storedSessionIn(NAME, "sb-otro-auth-token=abc", null), false);
  assert.equal(storedSessionIn(NAME, "", null), false);
});

test("localStorage cuenta cuando no hay cookie", () => {
  assert.equal(storedSessionIn(NAME, "", '{"access_token":"x"}'), true);
  assert.equal(storedSessionIn(NAME, "", ""), false);
});

test("sobrevive a convertirse en texto (así va dentro del <script>)", () => {
  const again = new Function(`return (${storedSessionIn.toString()})`)() as typeof storedSessionIn;
  assert.equal(again(NAME, `${NAME}.0=x`, null), true);
  assert.equal(again(NAME, `${NAME}-code-verifier=x`, null), false);
});
