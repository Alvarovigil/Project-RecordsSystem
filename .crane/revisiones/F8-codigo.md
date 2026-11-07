# F8 «Remate fino»: revisión de código y seguridad (Weaver)

Base: 1485553, más el diff sin commitear y `components/explore/ExploreFrame.tsx`.

Comprobado:
- **`tsc --noEmit`:** limpio.
- **`npm run lint`:** limpio.
- **`NEXT_DIST_DIR=.next-rv-code next build`:** compila, y `/explorar` sigue siendo estática (○).
- **`tsx --test lib/*.test.ts`:** 43 de 43.
- **Limpieza:** he borrado `.next-rv-code`, he quitado mi línea de `tsconfig.json` (el JSON sigue siendo válido) y he dejado `next-env.d.ts` como estaba.

## El guion en línea de `ExploreShell`

- **Seguridad.**
  - El servidor no mete nada que venga de una persona:
    - `canBeVisitor` es un booleano;
    - el nombre de la cookie sale de `NEXT_PUBLIC_SUPABASE_URL` al compilar y pasa por `JSON.stringify`;
    - `RECENTS_KEY` es una constante.
  - Nada de eso puede contener `</script>`.
  - En el cliente, lo único que lee de fuera es el `?q=` y las búsquedas recientes de `localStorage`. El `?q=` va a `input.value`, una propiedad, y las recientes van a `textContent`. Ninguna de las dos acaba en `innerHTML`.
  - Todo está dentro de `try`.
- **CSP.** Hoy no hay ninguna política: ni en `next.config` ni en cabeceras ni en un proxy. No hay impacto.
- **Hidratación.**
  - El armazón es el `fallback` de un `Suspense` que se pinta en el cliente, porque `useSearchParams` en una página estática obliga a hacerlo ahí.
  - React no hidrata ese `fallback`: lo descarta y monta `ExploreView`. Así que lo que el guion cambia (`data-q`, `data-visitor`, los `li` de recientes, `input.value`) no puede provocar un desajuste.
  - `ExploreView` lee el armazón en el inicializador de `useState` (`readShell`), antes de que React lo quite, y empieza con el mismo título.
  - En la navegación dentro de la app no hay `fallback`, `readShell` da `null` y se queda el comportamiento de antes.
- **La misma cookie que `lib/data`.**
  - Se mira el mismo nombre (`sb-${ref}-auth-token`) y la misma expresión, que acepta el token o uno de sus trozos (`.N`) pero no `-code-verifier`.
  - Si no hay cookie, se mira `localStorage`.
  - Con `FAKE_SESSION` no se marca como visitante, igual que la capa de datos.

## Escrituras en la dirección con capas abiertas

- **`gate({ buscar })` y `keepSearchInAddress`.**
  - Se ejecutan dentro de `leaveLayers`, así que el `replaceState` cae sobre la entrada base, cuando las capas ya han salido.
  - `entryHref()` se calcula después, así que el `next` de /entrar lleva ya `?buscar=`.
  - El `replaceState` conserva el estado de Next (`__NA`). El router no se entera, y no hace falta: lo siguiente es un `push` a /entrar, y al volver con «atrás» Next lee `location.href`, que ya trae `?buscar=`.
- **`ShelfApp` al leer `?buscar=`.**
  - También pasa por `leaveLayers`.
  - Usa `replaceState(null, …)` a propósito. He comprobado en Next 16.4.5 (`app-router.js:300-312`) que un estado sin `__NA` pasa por `copyNextJsInternalHistoryState`, que vuelve a poner `__NA` y el árbol, y por `applyUrlFromHistoryPushReplace`. El router se entera y `buscar` desaparece de `useSearchParams`. No hay bucle.
  - El buscador se abre después de que salgan las entradas y se apunta a sí mismo en el siguiente vaciado del coordinador. El orden es correcto.
- **El `next`.** Sigue pasando por `safeNext` en /entrar, en el callback y en `useSession`, así que un `next` manipulado no puede mandar a otro sitio.

## `PageFade`

- `arrived` arranca con `isColdStartOn(path)`.
  - En el servidor vale `true`, y en la hidratación en frío también: `entry` es la ruta en la que se abrió el documento y `moved` todavía es falso. No hay desajuste.
  - En la navegación por pestañas vale `false` y se mantiene la animación.
  - Afecta a todas las pantallas por igual, pero solo quita la animación de entrada en frío, que era la que pintaba negro.
- `ShelfApp` decide el arranque en frío con `isColdStartOn(usePathname())`. Al navegar, usa la ruta que se está pintando y no `location`, que todavía no ha cambiado: es más correcto que antes.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- **CSP.** El día que se añada una política, este guion necesitará un hash o un nonce. Como `/explorar` es estática y el guion solo cambia al compilar, el hash es estable. Hay que dejarlo apuntado junto a los otros guiones en línea del layout.
- **Dos copias de la lógica de la cookie.** `ExploreFrame.tsx` y `lib/data/index.ts:26` tienen cada una la suya. Hoy coinciden, pero si una cambia (por ejemplo, otro sufijo de `@supabase/ssr`), el armazón dirá «visitante» a quien tiene sesión. Conviene sacar el nombre y la expresión a una constante compartida y añadir un test.
- **`keepSearchInAddress`.** Escribe con el estado de Next, así que el router no ve `?buscar=` hasta que se navega. Hoy es correcto porque siempre va seguido de un `push`. Si algún día se llama sin navegar después, `useSearchParams` se quedaría atrás. Merece un comentario en la propia función.
- **Datos en la URL.** La frase buscada viaja en la URL hasta /entrar, y de ahí a los registros y al `Referer`. Es el nombre de un disco, no un dato sensible, pero conviene saberlo.
- **Probar en un dispositivo.** No había servidor de desarrollo, así que no lo he visto en un navegador. Falta comprobar en un móvil lento:
  - que el armazón de Explorar no salta al pasar a `ExploreView` (con sesión, sin sesión y con `?q=`);
  - que la vuelta de /entrar a /demo reabre el buscador con la frase.

DICE: El guion no mete nada de nadie, no puede desajustar la hidratación y lee la misma cookie. Aprobado; un test que ate las dos copias de la cookie.

---

## Ronda 2

Comprobado:
- `tsc --noEmit`: limpio.
- `npm run lint`: limpio.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila.
- `tsx --test lib/*.test.ts`: **48 de 48**, 5 de ellos de `auth-cookie`.
- Limpieza: he borrado `.next-rv-code`, he quitado mi línea de `tsconfig.json` (y la coma que quedó colgando al ser la última entrada; el JSON es válido) y he dejado `next-env.d.ts` igual que en HEAD.

**La función insertada como texto (`storedSessionIn.toString()`)**, comprobada sobre lo que sale del build y no sobre el código fuente:
- He sacado el guion en línea de `.next-rv-code/server/app/explorar.html`, que es la página ya renderizada por adelantado. La función llega minificada y sigue siendo autónoma: `function h(a,b,c){let d=RegExp("^"+a+"(\\.\\d+)?="),e=…;for(let a=0;…)…return!!c}`.
  - No hay ningún helper ni import externo.
  - El `let a` del bucle tapa al parámetro `a`, pero `d` ya se había construido con él antes, así que el resultado es correcto.
- `node --check` sobre el guion extraído: la sintaxis es válida.
- He ejecutado ese mismo guion en Chromium, sobre la página compilada, con la cookie real del proyecto (`sb-bokrdlsqnwfqijpsiytn-auth-token`):

| Caso | Resultado |
|---|---|
| Sin nada | visitante |
| Solo `…-code-verifier` | visitante (no cuenta como sesión) |
| Cookie partida (`.0`) | con sesión |
| Cookie entera | con sesión |
| Solo `localStorage` | con sesión |
| Recientes con `a<b>` | se pintan como texto, no como HTML |

- El nombre se mete en la expresión regular sin escapar. Es seguro: sale del hostname de Supabase, que solo lleva `[a-z0-9-]`, y lo fija el build, no una persona.
- El guion de Explorar y `lib/data` comparten ahora la función y el nombre: ya no pueden contestar distinto.

**Del resto del delta:**
- **`ExploreView`.**
  - El plazo de 8 s cuenta desde el principio de la espera (`waitingSince`).
  - Las dos ramas limpian `slow` y el temporizador de 220 ms al desmontar o cambiar de consulta.
  - Volver a pedir los datos ya no borra el error, y `library` ha salido de las dependencias.
  - No quedan fugas.
- **`.hit-x` y `.hit-y`, `<label class="hit-y">` y `min-h-8`.** Son CSS y tokens, sin riesgo de código.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- `lib/auth-cookie.ts`: dejar un test que haga `new Function("return " + storedSessionIn.toString())()` y lo llame. Así, si alguien le añade un import o una ayuda, el test lo detecta antes que producción. Hoy solo lo protege el comentario de cabecera.
- Siguen abiertas de la ronda 1: el hash para una futura CSP, el comentario en `keepSearchInAddress` y la prueba en un móvil lento.

DICE: La función inyectada sale minificada, autónoma y acierta en los cinco casos de cookie en el navegador. Aprobado; un test que la evalúe como texto.

---

## Ronda 3

Comprobado:
- `tsc --noEmit`: limpio.
- `npm run lint`: limpio.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila.
- `tsx --test lib/*.test.ts`: 48 de 48.
- Limpieza: he borrado `.next-rv-code`, he quitado mis dos líneas de `tsconfig.json` (el JSON es válido) y he dejado `next-env.d.ts` igual que en HEAD.

**`searchProfiles` y `searchLists` ahora lanzan error.**
- Solo tienen dos sitios que las llaman en toda la app; `lib/data/index.ts` solo reenvía.
  - **`useCatalogueSearch.ts:280`:** la llamada va dentro de `try/catch/finally`, y en el `catch` se pone `peopleFailed`. El `cancelled` evita escribir el estado si la búsqueda ya no es la actual. El temporizador de 250 ms se limpia en la limpieza del efecto. `retryPeople` solo sube un contador.
  - **`ExploreView.tsx:413`:** usa `Promise.all(...).catch(...)`, que vacía los racks y las personas solo si `alive`, y después llama a `fail()`. La limpieza del efecto quita el temporizador de 220 ms y el de 8 s.
- Los dos que leen `peopleFailed` (`MobileSearch` y `SearchOverlay`) separan el fallo del «no hay nada».
- No queda ninguna promesa sin capturar, y ningún sitio que las llame se rompe.

**`WantedRail` con `onRows`.** Tiene su `.catch` y respeta `alive`.

**`Closing`, la transición de cierre de sección.**
- Usa `AnimatePresence initial={false}`, así que no hay animación al montar.
- La salida es de 200 ms. Con movimiento reducido (`useReducedMotion`) es de 0 ms: la sección desaparece sin animación de altura.
- Framer Motion se encarga de cancelar la animación al desmontar. No hay temporizadores propios.
- `[overflow-y:clip]` evita que el contenido se salga mientras se encoge.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- **`components/explore/WantedRail.tsx:68`.** Si la carga falla, el `catch` vacía las filas pero no llama a `onRows(0)`. Si antes había cargado bien (por ejemplo, con otro género), `wantedRows` en `ExploreView` se queda con el número viejo. Entonces la portada cree que tiene contenido y no enseña el estado vacío o de fallo. Arreglo: `.catch(() => { if (!alive) return; setRows([]); onRows?.(0); })`.
- Siguen abiertas: el test que evalúe `storedSessionIn` como texto, el hash para una futura CSP y la prueba en un móvil lento.

DICE: Cada lanzamiento tiene quien lo recoja y la transición se limpia sola y respeta el movimiento reducido. Aprobado; que WantedRail avise también cuando falla.
