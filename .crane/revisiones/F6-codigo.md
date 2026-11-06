# F6 «Remate»: revisión de código y seguridad (Weaver)

Base: 631613d, más el diff sin commitear y los archivos nuevos.

Comprobado:
- **`tsc --noEmit`:** limpio.
- **`npx next lint`:** sale con código 0, sin errores y con 6 avisos de `exhaustive-deps`. Los he mirado uno a uno y son falsos positivos:
  - `lib.lists` y `lib.idsOf` frente a `lib`;
  - `vinilos.length`, que sobra;
  - `repo`, que sobra.
- **`NEXT_DIST_DIR=.next-rv-code next build`:** compila y ahora pasa también el lint. Después he borrado `.next-rv-code` y he quitado solo mi línea de `tsconfig.json`.
- **`tsx --test lib/*.test.ts`:** 43 de 43.
- **`npm audit --omit=dev`:** 6 vulnerabilidades (1 crítica, 3 altas, 2 moderadas). Son **las mismas 6** que da el lockfile de 631613d. Lo he comprobado auditando el `package.json` y el `package-lock.json` de ese commit. `eslint` y `eslint-config-next` son dependencias de desarrollo y no añaden nada a producción.
- **Recarga y `go(-n)`:** lo he probado en Chromium con una página de prueba. Después de recargar, `go(-n)` hacia las entradas de antes de la recarga se queda en el mismo documento: llega un `popstate` y no se recarga la página. Así que limpiar las capas al montar no provoca una segunda recarga.

Lo que ensambla bien:
- **Limitador por IP.**
  - Hay una puerta por ruta (20 peticiones por minuto) y un tope común de consultas al catálogo (30 por minuto).
  - Se aplica después de mirar la caché.
  - La espera devuelta se acota.
  - Se limita a 5000 claves, así que la memoria no crece sin fin.
  - Las tres rutas, y también `artist-known-server`, gastan del mismo presupuesto.
- **`/artista`.**
  - Solo se pregunta al catálogo con un slug limpio (`isPlainSlug`). Eso impide meter `%` o `_` en el `ilike`.
  - Tiene un `AbortSignal.timeout(3000)`.
  - Ante cualquier duda contesta «doubt», no 404.
  - Solo guarda en caché veredictos firmes.
- **`revertOptimistic`.** Deshace solo su propio cambio, que era la mejora que quedó abierta en F5, y tiene su test.
- **`layer-history` con `__rackrBase`.** Solo encadena entradas de la misma ruta y solo retrocede hasta una base que coincide con la ruta actual. Tiene tests.
- **Explorar y `?q=`.** Usa `replaceState` y respeta `layersBusy()`, así que no choca con el coordinador.
- **`ShelfLoading` e `isColdStartOn`.** En el servidor la respuesta es `true`, y en la hidratación en frío también: no hay desajuste.
- **El contador de `data-sheet-open` y el CSS `body[data-sheet-open]`** encajan.
- **Ids de rack `col-${uuid}`.** Mantienen el prefijo del que depende `isRealId`.
- **Secretos.** No hay ninguno nuevo en el cliente. `.eslintrc.json` y `next.config` están limpios.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- **`lib/discogs-budget.ts`, `clientKey`.**
  - Se fía de `x-forwarded-for`. En Vercel lo reescribe la plataforma, pero fuera de Vercel cualquiera lo falsifica y se salta el límite. Conviene priorizar `x-vercel-forwarded-for` o `x-real-ip`, y documentar que el límite supone Vercel.
  - Con CGNAT, que es lo normal en los móviles en España, muchas personas comparten IP y por tanto los 30 por minuto. Hay que vigilar si salen 429 legítimos en los registros.
- **`lib/artist-known-server.ts` y `likePatternForSlug`.** El slug no tiene longitud máxima. Uno con cien guiones genera un `ilike` con cien `%` sobre `releases` en cada visita, y cada slug desconocido ocupa una fila en `discogs_search_cache`. Debería quedar así: si pasa de 80 caracteres o de 8 palabras, «doubt» sin preguntar.
- **`components/ui/Sheet.tsx`, `useKeyboardInset()`.** Está activo en todas las hojas, también en las cerradas. `RecordSheet` y las demás montan varias, y cada una escucha `resize` y `scroll` del `visualViewport` y redibuja. Debería quedar `useKeyboardInset(open)`.
- **`npm audit`, problema anterior a esta fase pero real.**
  - `next@14.2.35` tiene avisos críticos sin arreglo en la rama 14 (Image Optimizer, RSC, Server Actions).
  - En Vercel buena parte no aplica, porque la optimización de imágenes es de la plataforma.
  - Aun así hay que planificar el salto de versión de Next como fase propia, no como un `audit fix --force`.
  - `source-map-js` y `nanoid` se arreglan con `npm audit fix` sin romper nada.
- **Avisos de lint.** Hay 6 de `exhaustive-deps`, y si nadie los atiende la build se acostumbra a ignorarlos. Para quitarlos:
  - desestructurar `const { lists, idsOf } = lib` en `ShelfApp` y en `ArtistView`;
  - quitar `vinilos.length` de `VinylShelf3D:718` y `repo` de `useLibrary:94`;
  - envolver `owned` en `useMemo` en `ArtistView:215`.
- **`tsconfig.json`.** Tiene las líneas `.next-rv-qa/ux/art` de los otros revisores en el árbol de trabajo. Que no se cuelen en el commit de F6.
- **Comprobaciones en Safari.**
  - Que `go(-n)` tras recargar se quede en el mismo documento: en Chromium es así, en Safari no lo he podido mirar.
  - Que el `--line-focus` global no pise los anillos propios en Safari de iOS: `:where()` debería bastar.

DICE: Remate limpio: limitador sólido, lint en la build y Next sin vulnerabilidades nuevas. Aprobado; acotad el slug y planificad el salto de versión de Next.

---

## Ronda 2

Comprobado otra vez:
- `tsc --noEmit`: limpio.
- `next lint`: «No ESLint warnings or errors». Los 6 avisos han desaparecido.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila. Después he borrado `.next-rv-code` y he quitado solo mi línea de `tsconfig.json`.
- `tsx --test lib/*.test.ts`: 43 de 43.

Las mejoras de la ronda 1 están todas:
- **Slug acotado.** Con más de 80 caracteres o más de 8 palabras devuelve «doubt» antes de consultar la base o el catálogo.
- **`clientKey`.** Mira primero `x-vercel-forwarded-for`, después `x-real-ip` y por último `x-forwarded-for`. Tiene tests, incluido el caso de un XFF falsificado.
- **`useKeyboardInset(open)`.**
- **Lint**, sin avisos.

Lo que más pediste mirar, la capa de datos que ahora lanza error:
- **`popularLists` y `suggestedProfiles`** solo tienen un sitio que las llama en toda la app: `ExploreView.tsx:273`, que pasa por `Promise.allSettled` más un `.catch`.
  - Si fallan los racks, se ve el estado de error con «Reintentar».
  - Si solo fallan las personas, el apartado de personas sale vacío y los racks se ven igual.
- **`lib/data/index.ts`** solo se las pasa a `remote`.
- **`local.ts`** no cambia.
- **Servidor.** Ningún componente de servidor ni ninguna ruta las llama. No se rompe nada.

Del resto del delta:
- **Escuchas y temporizadores.** El `ResizeObserver` de `MobileShelf` se desconecta. El `requestAnimationFrame` de `Sheet` al hacer `scrollIntoView` se cancela. El reintento de portadas en `Avatar`/`Cover` limpia su temporizador al desmontarse, y comparte `COVER_RETRY_MS` con el 3D.
- **Tokens.** Las opacidades nuevas de Tailwind y `--tap-lg`, `--t-chrome`, `--chrome-*` y `--page-pad` son tokens declarados. No he encontrado valores sueltos nuevos.
- **`not-found.tsx` de artista.** Está en su sitio.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- En la lista de opacidades (12, 38, 72, 78, 88, 92) hay seis pasos. Antes de que crezca más, conviene juntarlos en tres o cuatro niveles con nombre.
- Sigue abierto de la ronda 1:
  - planificar el salto de Next, que lleva avisos críticos sin arreglo en la rama 14;
  - `npm audit fix` para `source-map-js` y `nanoid`;
  - Safari: `go(-n)` tras recargar y el anillo de foco.
- Que las líneas `.next-rv-*` de otros revisores en `tsconfig.json` no entren en el commit.

DICE: Lint a cero, slug acotado y la capa que lanza tiene un solo sitio que la llama, y bien protegido. Aprobado; lo que queda es el salto de Next.

---

## Ronda 3

Comprobado otra vez:
- `tsc --noEmit`: limpio.
- `next lint`: sin avisos ni errores.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila. Después he borrado `.next-rv-code` y he quitado solo mi línea de `tsconfig.json`.
- `tsx --test lib/*.test.ts`: 43 de 43.
- He comprobado en Chromium los dos casos dudosos de la comprobación al montar:
  - una portada de paleta (SVG con solo `viewBox`) da `naturalWidth` 150, no 0, así que no se toma por rota;
  - una imagen `loading="lazy"` que todavía no se ha pedido tiene `complete` en `false`, así que no se marca como fallida.

`RetryImg` y `useImgRetry` (68 usos):
- **Fugas.** Hay un solo temporizador por imagen. Se limpia al cambiar `src`, al programar otro intento y al desmontar. No añade escuchas propias. El reintento propio de `Avatar` ha desaparecido: ya no hay dos reintentos, y el 3D sigue con el suyo, que comparte `COVER_RETRY_MS`.
- **Hidratación.** El servidor y el primer render del cliente salen iguales: `broken=false`, `key=0` y el mismo `src`. Un error que llega antes de hidratar lo detecta el efecto de montaje, con `complete && naturalWidth === 0`. Si ese error también llega a `onError`, la doble llamada a `fail()` reinicia el mismo temporizador y no pasa nada.
- **Camino feliz.** Si la imagen carga a la primera:
  - nada cambia de tamaño: `visibility:hidden` solo se aplica cuando falla, y aun entonces conserva la caja;
  - no hay peticiones de más: `key` se queda en 0 y no se crea ningún elemento nuevo.
- **`next/image`.** No se usa en ningún sitio, así que no hay conflicto con el reintento ni con el optimizador.
- **Semántica de los manejadores.**
  - `onLoad` y los demás llegan intactos con `...rest`. Si se cae al `fallback` en texto, también se aplican a esa imagen.
  - `onError` cambia de significado a propósito: ahora es «se ha rendido» y no «falló una vez». Llega al agotar los intentos, unos 6,5 s después.
  - El único que lo usa es `Avatar`/`Cover`, para `setShown(true)`. Ahí encaja: durante los reintentos se ve el cuadrado de debajo, y después se carga la portada de paleta con su `onLoad`.
- **`MarqueeText`.** El hueco se lee con `getComputedStyle` y en `rem`, así que respeta el tamaño de letra del sistema.
- **Tokens.** `--badge`, `--badge-inset` y `--chrome-pad-tight` están declarados. No hay valores sueltos nuevos.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- `components/ui/RetryImg.tsx`, en el efecto de montaje: hay que comprobarlo en Safari de iOS. Si WebKit diera `naturalWidth` 0 a un SVG con solo `viewBox`, las portadas de paleta se ocultarían y acabarían en el `fallback`. Para cubrirlo barato, saltarse la comprobación cuando `src` empieza por `data:`.
- Documentar en la cabecera de `RetryImg` que `onError` significa «agotado». Alguien que lo use para cambiar de imagen al momento esperará 6,5 s sin saberlo.
- La imagen del `fallback` en texto no tiene manejador de error. Hoy siempre es un data-URI y no puede fallar, pero si alguien pasa una URL remota volvería el icono roto. Se puede proteger con un `onError` que pinte la superficie neutra.
- Siguen abiertas de rondas anteriores:
  - el salto de versión de Next;
  - `npm audit fix` para `source-map-js` y `nanoid`;
  - juntar las opacidades;
  - Safari: `go(-n)` tras recargar y el anillo de foco.

DICE: RetryImg reintenta sin fugas, sin saltos y sin pedir dos veces lo que carga bien. Aprobado; falta mirar las portadas SVG en Safari.
