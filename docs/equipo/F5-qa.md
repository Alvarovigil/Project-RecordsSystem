# F5 — QA de estabilidad en móvil (Woodpecker)

Fecha: 2026-11-06. Sobre `main` (163b719).

Cómo se ha probado:
- Playwright (Chromium) emulando un móvil táctil a 375×812 y a 360×740.
- `localhost:3349` con `NEXT_PUBLIC_FAKE_SESSION=1`, con su propio `NEXT_DIST_DIR=.next-qa`, porque en `:3348` había otro servidor del equipo usando el mismo repo.
- https://rackr.club sin sesión y solo leyendo: landing, /demo, /explorar. No se ha escrito nada.
- En local, las respuestas del catálogo están simuladas con `page.route`, para no gastar el límite de Discogs del token de producción ni escribir en `data/vinilos.json`.
- Los scripts están en `/private/tmp/claude-501/qa5/` (t1…t23).

Al terminar se revirtieron `data/`, `tsconfig.json` (Next le añade `.next-qa`) y la portada de prueba. Ojo: `data/vinilos.json` lo comparte el otro servidor. Mientras yo probaba, alguien añadió Fleetwood Mac («Tusk», «1975 To 1987»), y con el `checkout` también se ha ido.

## Veredicto

**No es estable todavía en móvil.** Fallan tres cosas grandes:
1. Un solo fallo tira la app entera. Sin WebGL, la landing de producción enseña «Application error», y no hay ninguna pantalla de error propia.
2. El buscador gasta el límite del catálogo a quien escribe despacio.
3. Hay varias acciones que dicen que han ido bien y no han ido: «Deshacer» que vuelve a añadir, y «Guardado» que no se guarda.

Doble toque, memoria y desbordes laterales aguantan bien (ver al final).

---

## ROMPE

### 1. [P1] Sin WebGL, la app no existe: «Application error» en la landing de producción
- **Pasos:** Chromium con `--disable-webgl --disable-3d-apis` → abrir https://rackr.club/ y https://rackr.club/demo.
  Esto es lo que pasa en un móvil viejo, con la GPU en la lista negra, en el modo de bloqueo de iOS o tras perder el contexto por falta de memoria.
- **Qué pasa:** la página entera queda en «Application error: a client-side exception has occurred», en inglés y en blanco. En local, /coleccion queda vacía, sin barra de pestañas: `Error creating WebGL context` sin capturar. /explorar sí funciona.
- **Qué debería pasar:** detectar WebGL antes de montar el `<Canvas>`. Si no hay, o si se pierde el contexto (`webglcontextlost`), enseñar la cuadrícula (`CoverGrid`) en la colección y un fondo estático en la landing.
- **Dónde:** `components/VinylShelf3D.tsx:870` (`<Canvas>` sin comprobación ni `onCreated`), `components/mobile/MobileShelf.tsx:284`, `components/ShelfApp.tsx:47`, `components/Landing.tsx` (estante de fondo).

### 2. [P1] No hay `error.tsx` ni `global-error.tsx`: un componente que falla se lleva toda la app
- **Pasos:** en local, simular que `/api/discogs/specs` responde `{specs:{title:"x"}}` → abrir un disco → «Ficha técnica».
- **Qué pasa:** `Cannot read properties of undefined (reading 'join')` y el `body` se queda vacío. Desaparecen la ficha, el estante y la barra. En producción sería «Application error», como en el n.º 1. En la app instalada no hay barra del navegador, así que solo se sale cerrando la app.
- **Qué debería pasar:** `app/error.tsx` y `app/(app)/error.tsx` con «Algo ha fallado · Reintentar · Ir a tu colección», y `app/global-error.tsx` para el layout. Las tarjetas que dependen de la red (ficha técnica, «Quién más lo tiene», canciones) deberían ir dentro de su propio límite de error.
- **Dónde:** `app/` (solo existen `not-found.tsx` y `artista/[slug]/loading.tsx`). Lo que lo dispara aquí: `components/RecordSpecsCard.tsx:293` (`s.formats.join` sin comprobar).

### 3. [P1] El buscador agota el límite del catálogo en una sola búsqueda
- **Pasos:** Colección → Buscar → teclear «radiohead in rainbows» a 380 ms por letra (un ritmo normal en móvil o en una persona mayor). Se contaron las llamadas con la API simulada.
- **Qué pasa:**
  - **21 peticiones** a `/api/discogs/search`, una por letra, empezando por «r». Cada una abre en el servidor entre 5 y 9 consultas a Discogs (`search/route.ts:136-163`, más el doble si hay tildes): unas **143 consultas para una sola búsqueda**, y Discogs deja 60 por minuto.
  - El cliente no cancela la petición anterior (no hay `AbortController`), así que el servidor las termina todas.
  - No hay mínimo de letras.
  - No hay reintento con espera cuando llega un 429.
  - El escáner tiene el mismo problema: con un 429, `byBarcode` devuelve `[]` y la tarjeta dice «no encontrado» aunque el disco sí esté (`barcode/route.ts:38`).
  - Escribiendo a 140 ms por letra sale una sola petición: el debounce solo protege a quien teclea deprisa.
- **Qué debería pasar:**
  - Mínimo 3 letras.
  - Debounce de 450–600 ms y búsqueda al pulsar Intro.
  - `AbortController` para la petición anterior.
  - Una caché en memoria por consulta en el cliente.
  - En el servidor, abrir menos consultas para textos de una palabra.
  - Ante un 429, un único reintento después de `Retry-After`.
  - En el escáner, distinguir 429 de «no está».
- **Dónde:** `hooks/useCatalogueSearch.ts:74-101`, `app/api/discogs/search/route.ts:136-166`, `app/api/discogs/barcode/route.ts:34-39`.

### 4. [P1] Una respuesta a medias por el límite se queda guardada en caché 30 días
- **Pasos:** sacado del código. Discogs corta a mitad de una búsqueda: algunas consultas devuelven filas y otras 429.
- **Qué pasa:** se guarda en `discogs_search_cache` siempre que `results.length > 0`, aunque `health.failed > 0`, y la caché vale 30 días (`:116`). Durante un mes, todo el que busque eso ve una lista incompleta sin aviso: la respuesta cacheada no lleva `degraded`.
- **Qué debería pasar:** guardar solo si `health.failed === 0`.
- **Dónde:** `app/api/discogs/search/route.ts:280`.

### 5. [P1] «Deshacer» después de añadir desde el buscador no deshace: vuelve a añadir
- **Pasos:** Colección (Mi Colección 43) → Buscar → «radiohead» → «+» en Kid A → «Deshacer» en el aviso → Cancelar.
- **Qué pasa:** Mi Colección marca **44**, y después de recargar sigue en 44. Kid A sigue en la biblioteca. Hay dos fallos que se suman:
  1. `const saved = search.savedIn[...]` se lee del estado anterior a la llamada, así que `wasNew` siempre es `false` y nunca se borra el disco nuevo (`MobileSearch.tsx:136`).
  2. El deshacer llama a `onRemoveFromList`, que en ShelfApp es `handleToggleVinyl`. Ese `idsOf` es del render anterior al guardado, no ve el disco dentro y lo **vuelve a añadir** (`ShelfApp.tsx:509-513`, `:837`).
- **Qué debería pasar:** volver a 43, y si el disco era nuevo, que salga también de la biblioteca. El deshacer tiene que quitar, no alternar: `lib.removeFromList`. Y tiene que usar lo que devuelve `addFromCatalogue`, no el estado.
- **Dónde:** `components/mobile/MobileSearch.tsx:128-146`, `components/ShelfApp.tsx:509-513` y `:837` (lo mismo pasa con `:1537`).

### 6. [P1] El aviso tapa el buscador, y «Cancelar» queda justo debajo de «Deshacer»
- **Pasos:** Buscar → «+» en un disco → tocar «Cancelar» en los 6 s siguientes.
- **Qué pasa:** `elementFromPoint` en el centro de «Cancelar» devuelve **el botón «Deshacer»**, y en el centro del campo de búsqueda, el texto del aviso. Quien quiere cerrar el buscador deshace lo que acaba de añadir, y por el n.º 5 en realidad lo duplica. En la ficha del disco, «Guardado en …» tapa ← y ⋮ durante 4,2 s.
- **Qué debería pasar:** en el buscador y en la ficha, el aviso va abajo, encima de la barra o del teclado, o no tapa la cabecera.
- **Dónde:** `components/ui/Toast.tsx:99` (`top: safe-top + 12px`), `LIFETIME_ACTION = 6000` (`:56`).

### 7. [P1] Dice «→ Mi Colección» o «Guardado en X» aunque no se haya guardado
- **Pasos:** probado con el almacenamiento lleno: `setItem` lanza `QuotaExceededError`, lo que pasa en Safari privado o con el disco lleno. Buscar → «+» en Amnesiac.
- **Qué pasa:** sale «Mock 999002 → Mi Colección · Deshacer», el contador se queda en 43 y la consola da `PAGEERROR: QuotaExceededError` sin capturar. Con Supabase, sacado del código, pasa lo mismo cuando falla la red o hay un 5xx: `act()` no tiene `catch`, y las llamadas son `void lib.saveToList(...)`, así que el aviso sale antes del resultado.
- **Qué debería pasar:** esperar al guardado, con estado «Guardando…» si tarda. Si falla: «No se ha guardado. Reintentar».
- **Dónde:** `hooks/useLibrary.ts:114-127` (`act`), `components/ShelfApp.tsx:470`, `:483`, `:495` y `:533` (`void lib.*`), `components/mobile/RecordSheet.tsx:737` y `:742`, `components/mobile/MobileSearch.tsx:137`.

### 8. [P1] Atrás con una hoja abierta te saca de la pantalla (sigue igual que en el n.º 3 de qa-movil)
- **Pasos:** Actividad → Colección → cuadrícula → tocar un disco (se abre la ficha) → atrás del sistema.
- **Qué pasa:** se pasa de `/coleccion` con la ficha abierta a `/actividad`. En Android, con la app instalada, si la primera pantalla es la colección, atrás cierra la app.
- **Qué debería pasar:** atrás cierra la hoja de arriba y nada más.
- **Dónde:** no hay `pushState` en ninguna hoja. Solo `TabBar.tsx:90` escucha `popstate`. Habría que añadir una entrada de historial al abrir en `components/ui/Sheet.tsx`, `RecordSheet`, `MobileSearch`, `BarcodeScanner` y `ShareSheet`.

### 9. [P1] Arranque en frío: pantalla negra, sin barra ni logo, varios segundos
- **Pasos:** https://rackr.club/demo en un contexto limpio, con 300 ms de latencia, 200 KB/s y la CPU 4 veces más lenta.
- **Qué pasa:** el `body` sigue sin texto hasta los **~4,5 s**: es negro puro, sin barra de pestañas ni pantalla de arranque. Sin limitar la red, en producción tarda ~1 s, y en local ~0,4 s. Después sale el arranque «RACKR CLUB», y el estante aparece atenuado hacia los 2,5 s.
- **Qué debería pasar:** que el servidor pinte desde el primer byte la marca o la pantalla de arranque y la barra, en vez de que todo dependa de chunks `ssr:false`.
- **Dónde:** `components/ShelfApp.tsx:48` (`BootScreen` es `dynamic(..., {ssr:false})`, así que no puede tapar el tiempo que tarda en llegar su propio chunk) y `:80` (`MobileShelf`), `app/(app)/demo/page.tsx` y `coleccion/page.tsx` (`<Suspense>` sin `fallback`).

### 10. [P1] Un rack vacío en la vista estante es una pantalla negra (sigue igual que en el n.º 2 de qa-movil)
- **Pasos:** Tus racks → Rack nuevo → nombre → Crear rack.
- **Qué pasa:** cabecera con «… 0», un fondo negro y nada más. La cuadrícula sí tiene un estado vacío.
- **Dónde:** `components/mobile/MobileShelf.tsx:282-284` monta `VinylShelf3D` sin mirar `vinilos.length`. El estado vacío solo está en `:568`.

### 11. [P1] «Guardar en → Lista de deseos» saca el disco de tu colección y de sus racks, sin avisar ni poder deshacer (sigue igual que en el n.º 1 de qa-movil)
- **Pasos:** cuadrícula → Currents («Guardado: En 1 rack») → Cambiar → «Lista de deseos».
- **Qué pasa:** sale «Guardado en Lista de deseos», sin deshacer y sin confirmar, y el disco pasa a «En deseos». La regla de la base de datos lo saca de todos los racks.
- **Dónde:** `components/mobile/RecordSheet.tsx:729-737` (el aviso genérico, y `acquiring` filtra la lista de deseos solo en un sentido) y `supabase/migrations/0021_coleccion.sql:119-126`.

### 12. El escáner abre la cámara sin sesión (en producción, desde /demo)
- **Pasos:** https://rackr.club/demo sin sesión → Buscar → «Escanear el código».
- **Qué pasa:** `getUserMedia` se llama una vez y el visor se pone a escanear. El portero solo actúa al pulsar «Añadir N» (`BarcodeScanner.tsx:364`), y entonces lleva a /entrar y se pierde todo lo escaneado.
- **Qué debería pasar:** `gate()` al abrir, antes de pedir la cámara.
- **Dónde:** `components/BarcodeScanner.tsx:229-236` (efecto de la cámara) y el botón que abre el escáner en `MobileSearch`.

### 13. /demo se abre escribiendo la dirección
- **Pasos:** https://rackr.club/demo sin sesión.
- **Qué pasa:** responde 200 y enseña «Mi Colección 40», la estantería de ejemplo como si fuera tuya, con el buscador y el escáner (n.º 12). Es `robots: noindex`, pero se puede enlazar.
- **Dónde:** `app/(app)/demo/page.tsx`. O se redirige a `/explorar`, o se pone un aviso claro de «colección de ejemplo».

---

## MOLESTA

14. **`next` pierde la búsqueda.**
    - Pasos (producción): /explorar → buscar «radiohead kid a» → «Guardar» → `/entrar?next=%2Fexplorar`. Al volver atrás, el campo está vacío.
    - La búsqueda vive en el estado del componente, no en la URL.
    - Dónde: `components/ExploreView.tsx` y `components/mobile/MobileSearch.tsx` (no escriben `?q=`). `hooks/useSession.ts:entryHref` ya copiaría `search` si estuviera.
15. **El aviso de «Gira el teléfono» no sale nunca.** Hay dos fallos:
    - `.rotate-lock { display:none }` (`app/globals.css:890`) va después de la media query de `:876`, tiene la misma especificidad y la anula: medido, `display: none` con la media query activa.
    - En un móvil de 812 px a lo largo, al girarlo, `useDevice` lo trata como tableta (`hooks/useDevice.ts:76`, puntero grueso y más de 767 px), así que `RotateLock` ni se monta (`AppShell.tsx:54`) y sale la interfaz de escritorio, con la barra arriba.
    - En horizontal no se rompe nada: girar y volver conserva la búsqueda y la ficha.
16. **Sin conexión, Explorar se queda con el esqueleto para siempre.**
    - Producción, con el service worker activo: se ve el esqueleto gris sin fin, sin «Sin conexión» ni «Reintentar». No hay ni un `navigator.onLine` en todo el repo.
    - En local (sin service worker), ir a otra pestaña sin red da la página de error de Chrome.
    - `public/sw.js:132` no tiene una página de respaldo para cuando no hay red.
17. **El teclado puede tapar el botón de las hojas en Android** (sacado del código).
    - Las hojas van pegadas abajo con alturas en `dvh` (`components/ui/Sheet.tsx:207` y `:215`), y no se maneja `visualViewport`.
    - Con el comportamiento por defecto de Chrome en Android (`resizes-visual`), «Crear rack» (y=680 de 740) queda debajo del teclado.
    - Para arreglarlo: `interactiveWidget: "resizes-content"` en `viewport` (`app/layout.tsx:83`), o subir la hoja según `visualViewport`.
18. **Una portada que falla una vez no vuelve hasta recargar.** `loadTextureCached` guarda también la promesa rechazada (`components/VinylShelf3D.tsx:56-71`). Con mala cobertura, el estante se queda con el color plano para toda la sesión. Hay que borrarla de `TEXTURE_CACHE` en `onerror`.
19. **Nombres de rack sin límite.** Se aceptan 107 caracteres con emojis, sin `maxLength`. La cabecera los pasa en marquesina y no hay desborde lateral. El perfil sí tiene límites (40/24/160). Para un rack, `maxLength={60}` (`components/mobile/NewRackSheet.tsx:111`).
20. **El id de un rack nuevo sigue siendo `col-${Date.now()}`** (`lib/collections.ts:144`). Hoy, dos toques seguidos crean un solo rack, pero dos creaciones en el mismo milisegundo chocan, como en el n.º 14 de qa-movil.
21. **El bloqueo del scroll con hojas apiladas funciona de casualidad.** Al cerrar la hoja de arriba la marca sigue puesta (comprobado), pero solo porque la de debajo vuelve a ejecutar su efecto al re-renderizar (`onClose` cambia en cada render). Cada hoja la sigue borrando sin contar las que quedan (`components/ui/Sheet.tsx:86-89`): un contador lo dejaría seguro.
22. **Peticiones duplicadas al escribir:** además de la búsqueda, cada consulta de 2 o más letras pide `/api/discogs/artist?photos=` (`hooks/useCatalogueSearch.ts:242`). Gasta el mismo límite del n.º 3.

## COSMÉTICO

23. **Código muerto de SoundGate:**
    - `entered` empieza en `true` y nunca cambia (`components/landing/SoundGate.tsx:100`).
    - Quedan sin uso: `armed` y su retraso de 900 ms (`:106` y `:172-187`), `enter()` (`:287`), todo el JSX de la puerta (`:413-478`) y las props `title`, `body` y `cta` (`:74-88`). `app/qr/page.tsx:46-50` las sigue pasando sin efecto.
    - Las reglas `[data-landing="gate"]` de `app/globals.css:288-340` y `:704` no se aplican nunca.
    - Está en git: se puede borrar.
24. **/artista/<cualquier cosa> responde 200** con un artista inventado («Zzzz Nadie · Todavía no tienes ninguno suyo»). Debería ser 404 cuando el catálogo no lo conoce.
25. **Las portadas de la cuadrícula siguen sin nombre accesible:** `button:has(img)` sin `aria-label`, igual que en el n.º 21 de qa-movil.
26. En «Quién más lo tiene» se sigue cortando el dueño («de Álvaro Rodv · 7 discos»).

---

## Pendientes conocidos: estado

| Pendiente | Estado | Punto |
|---|---|---|
| `/demo` se abre entrando directo | **Sigue** (producción, 200) | 13 |
| Escáner sin sesión | **Sigue**: abre la cámara | 12 |
| `next` pierde la búsqueda | **Sigue** (producción) | 14 |
| «Deshacer» después de añadir | **Roto**: vuelve a añadir | 5 |
| Estantería negra al cargar | **Sigue**: 0,4 s en local, ~4,5 s en 3G con CPU 4× | 9 |
| El aviso tapa el buscador | **Sigue**, y además «Cancelar» = «Deshacer» | 6 |
| Límite del catálogo | **Sí**: 21 peticiones / ~143 consultas por búsqueda, sin abortar, sin reintentar; la respuesta parcial va a la caché | 3, 4 |
| Código muerto de SoundGate | **Sigue** | 23 |

## Lo que funciona

- **Doble toque en «+» del buscador:** un solo POST a `/api/discogs/release`.
- **Doble toque en «Crear rack»:** un solo rack.
- **Doble toque en una fila de «Guardar en»:** se guarda una vez («En 2 racks»).
- **Memoria:** 12 idas y vueltas Colección ↔ Explorar, el heap se queda en 98 MB después del GC, siempre 1 canvas y ningún aviso de contexto perdido. R3F libera la escena.
- **Errores del servidor del catálogo:**
  - Release 500 → «No se pudo añadir ese disco».
  - Búsqueda 502 con HTML → «No hemos podido consultar el catálogo…».
  - Nada se queda colgado.
- **Datos locales corruptos** (`vinilos.releases.v1` y el snapshot, con basura): no tumban la app.
- **Sin desborde lateral** a 360 en /explorar, /actividad, /ajustes, /u/rackrclub, /artista/rosalia, /demo, /instalar y la 404, ni en horizontal.
- **404 propia** en `/no-existe` y en `/u/nadie-xyz`.
- **Actividad** ya enseña la invitación de Marta, que antes no aparecía.
- **Rotar con el buscador o la ficha abiertos:** al volver, siguen ahí.

DICE: Sin WebGL, rackr.club enseña «Application error»; y «Deshacer» en el buscador vuelve a añadir el disco en vez de quitarlo.
