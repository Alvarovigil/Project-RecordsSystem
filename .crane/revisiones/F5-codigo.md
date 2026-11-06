# F5 — Revisión de código y seguridad (Weaver)

Base: 163b719 + todo lo que está sin commitear. Comprobado:

- `npx tsc --noEmit`: limpio.
- `NEXT_DIST_DIR=.next-rv-code npx next build`: compila sin errores ni avisos. He borrado `.next-rv-code` y he quitado de `tsconfig.json` solo mi línea. Las de `rv-ux`, `rv-qa` y `rv-art` siguen ahí, porque son de los otros revisores.
- `npx tsx --test lib/catalogue-query.test.ts`: 7 de 7 en verde.
- `useBackToClose`: lo he copiado tal cual en una página de prueba y lo he ejecutado en Chromium. Los fallos de abajo están reproducidos allí, no deducidos.

Lo que ensambla bien:
- **Backend:** `catalogueFetch` lo usan `search` y `barcode`, con el 429 y el 503 en JSON. El hook lee bien `retryAfter` y lo acota igual que el servidor.
- **Frontend B:** `useLibrary` con `act` optimista y vuelta atrás, y las escrituras de Supabase que ahora lanzan error. Todos los que llaman (`ShelfApp`, `MobileSearch`, `RecordSheet`, `BarcodeScanner`) esperan el `boolean` antes de decir «Añadido». El contrato `onUndoAdd`/`restoreRecord` encaja en las cuatro piezas.
- **Frontend A:** `SafeShelf` con `ErrorBoundary`, `webglcontextlost` con `once` y `preventDefault`, y `onUnavailable`, que pasa a la cuadrícula.
- **Hidratación:** `AppShell` pinta las dos barras con `measured=false` en el servidor y en la hidratación, porque `useSyncExternalStore` usa la foto del servidor. `BootScreen` sale del servidor sin nada que dependa del cliente. No veo desajustes.
- **Secretos:** no hay ninguno en el cliente ni en el repositorio. `DISCOGS_TOKEN` solo se lee en el servidor, y `.claude/launch.json` no lleva nada sensible.
- **`retryAfter`:** sale solo del catálogo, se acota entre 1 y 120 en el servidor y otra vez en el cliente, y los `NaN` o `Infinity` caen al valor por defecto.
- **Caché:** solo escribe el servidor y solo guarda respuestas completas. Las claves `v3:` y `artist:v3:` no pueden chocar entre sí.

VEREDICTO: BLOQUEADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- `hooks/useBackToClose.ts:52-66`. **Cerrar una hoja y abrir otra en el mismo toque hace que la nueva se cierre sola.** Lo he reproducido. El cierre a mano llama a `history.back()`, que es asíncrono. La hoja nueva hace `pushState` en `setTimeout(0)`, antes de que llegue esa vuelta atrás. Después llega el `popstate` con la capa de abajo, y el `onPop` de la nueva lo toma como suyo (`1 < 2`) y la cierra.
  - Dónde pasa: en el menú ⋮ de `RecordSheet.tsx:672-716`, que es `setMenuOpen(false)` más `setPickingCover`, `setToWishlist` o `setDeleting`. Con eso, **«Pasar a deseos» con confirmación, «Borrar» y «Cambiar portada» se abren y se cierran en el acto.** Pasa igual en las hojas que se encadenan dentro del escáner.
  - Cómo debería quedar: un único coordinador en el módulo. Los cierres a mano no llaman a `back()` en el momento: apuntan el suelo (`floor = min(floor, mine-1)`) y lo vacían en un solo paso, `history.go(floor - layerOf(history.state))`. Mientras esa vuelta atrás está pendiente, una capa nueva espera a que llegue el `popstate` antes de hacer `pushState`, y ese `popstate` no cierra a nadie.
- `hooks/useBackToClose.ts:28, 55, 61-65`. **Quedan entradas basura en el historial y, después, «atrás» deja de cerrar la hoja.** Lo he reproducido.
  - Primer caso: dos capas que se cierran en el mismo commit. Es el escáner abierto desde la estantería (`MobileSearch.tsx:508-512`, con `autoScan`), que cierra el escáner y el buscador a la vez. La hoja de arriba hace `back()`, y la de abajo todavía ve `state` en la capa 2. Como `2 !== 1`, no hace nada y deja su entrada.
  - Segundo caso: `depth` es un contador que no mira el historial de verdad. Después de un caso así, o de recargar la página con una hoja abierta, la entrada actual ya lleva `__rackrLayer: 1`. La siguiente hoja también recibe `mine=1`, y al pulsar «atrás» `1 >= 1` no la cierra: hacen falta dos «atrás». **Es justo el flujo del escáner, que es la prioridad n.º 1.**
  - Cómo debería quedar:
    - anclar la capa a la entrada real: `mine = layerOf(history.state) + 1`;
    - cerrar cuando `layerOf(e.state) < mine`;
    - al limpiar, comparar con `>= mine`, no con `===`, usando el coordinador de arriba, que retrocede todo lo que haga falta de una vez.
- `components/mobile/MobileSearch.tsx:315-317` y `components/mobile/RecordSheet.tsx:302-303, 329-330`. **Riesgo de deshacer la navegación.** Los `<Link onClick={onClose}>` que hay dentro de una capa disparan `history.back()` en la limpieza mientras Next hace `pushState` a la ruta nueva.
  - En Chromium, si el `pushState` llega en menos de unos 5 ms después del `back()`, la navegación se pierde y se vuelve a `/coleccion`, que además recibe el `popstate` y hace `ACTION_RESTORE`. Con la ruta precargada, la transición puede caer en esa ventana.
  - No lo he reproducido dentro de la app, pero sí el comportamiento del navegador del que depende.
  - Cómo debería quedar: un enlace que sale de una capa navega con `router.replace(href)`, que sustituye la entrada de la propia capa, y marca la capa como cerrada sin hacer `back()`. Si se prefiere una red de seguridad, que el `back()` aplazado solo salga cuando `history.state` siga siendo de la capa.

MEJORA:
- `app/api/discogs/artist/route.ts:50-57` no pasa por `catalogueFetch`. Las caras de artista (una por búsqueda) y `artistOfRelease`/`artistByName` gastan cuota del catálogo sin contarla, y un 429 suyo no activa `blockedUntil`. La cabecera de consultas restantes lo compensa a medias. Debería usar `catalogueFetch`, igual que `search` y `barcode`.
- `/api/discogs/search` es pública y sin límite por cliente. Antes, una sola persona con un script agotaba el catálogo. Ahora agota el tope blando de la instancia, y todo el mundo recibe 429 durante un minuto. Haría falta un límite por IP (por ejemplo 20 por minuto) antes del presupuesto global.
- `hooks/useLibrary.ts:186-207`: la vuelta atrás restaura `before` entero. Si hay dos escrituras en vuelo y falla la primera, también se borra el cambio optimista de la segunda hasta la siguiente relectura. Para que no pase, la vuelta atrás debería deshacer solo su propio cambio (la inversa del `optimistic`), o encadenar las escrituras en una cola.
- `components/ShelfApp.tsx:138-140`: `isColdEntry()` en el inicializador de `useState` también se ejecuta en el servidor, y deja `bootedThisLaunch = true` en el módulo del servidor. Hoy no hace daño, pero conviene protegerlo con `typeof window`.
- `components/ShelfApp.tsx:771-781`: el comentario dice que el `BootScreen` de antes de medir es «el mismo elemento» que conserva la rama del teléfono. No lo es: el Fragment y la rama son posiciones distintas, así que se remonta y la marca vuelve a empezar el giro. O se pone en una posición común, o se corrige el comentario.
- `hooks/useCatalogueSearch.ts:207-212`: un fallo de red no reinicia `rateLimited` ni `retryInMs`, así que puede quedar «espera N s» encima de un «sin conexión».
- `components/ui/Toast.tsx`: el proveedor no limpia `timers` al desmontarse. Es la raíz y casi nunca se desmonta, pero el `useEffect` de limpieza cuesta una línea.
- Si el router llama a `router.replace` o `router.refresh` con una hoja abierta, `HistoryUpdater` de Next reescribe el `state` sin `__rackrLayer`, y la entrada se queda huérfana al cerrar. Hay que comprobar los `replace` de `useSearchParams` en `ShelfApp` cuando se rehaga el coordinador.
- Tokens:
  - casi todo lo nuevo pasa por los tokens: `text-caption`, `text-sub`, `--tap`, `--tabbar-h`;
  - estos usan valores sueltos y deberían ir a token:
    - `min-h-[44px] min-w-[44px]` en `Toast.tsx:226` debería ser `min-h-tap min-w-tap`, que ya existen;
    - `BAND_H = "36px"`, con el «Entrar» a `min-h-[36px]` (por debajo de `--tap`) en `DemoBand.tsx:15,38`, debería ser un token y llevar `.hit`;
    - el `/16` de `Avatar.tsx` presupone una raíz de 16 px;
  - estos están justificados: `w-[76px]` en `RecordSheet` y el `+12px` del Toast.
- No hay ESLint. Hay comentarios `eslint-disable-next-line @next/next/no-img-element` para un linter que no existe, y `react-hooks/exhaustive-deps` habría avisado de varias dependencias de este diff. Propongo `eslint-config-next` con `react-hooks` y `next lint` en la build.
- `useBackToClose` necesita una prueba: un test del coordinador con un `history` falso (abrir, cerrar y abrir en el mismo tick; dos cierres a la vez; recarga), como el de `catalogue-query`. Es lógica pura y los tres fallos de arriba habrían salido ahí.

DICE: Todo ensambla y compila; solo falla «atrás»: cierra la hoja que acabas de abrir y deja entradas basura. Coordinador único y lo apruebo.

---

## Ronda 2

Comprobado otra vez sobre 163b719 con todo lo de la ronda 2:
- `tsc --noEmit`: limpio.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila sin errores. He borrado `.next-rv-code` y he quitado otra vez solo mi línea de `tsconfig.json`.
- `tsx --test lib/*.test.ts`: 21 de 21. Son los 14 de `layer-history` y los 7 de `catalogue-query`.

Los tres bloqueos están resueltos. He leído el coordinador (`lib/layer-history.ts`) entero, caso por caso, contra los fallos de la ronda 1:
- **Cerrar una hoja y abrir otra en el mismo toque.** El cierre baja el suelo y la apertura queda pendiente. El vaciado hace `go(-1)` con `awaiting`, y la hoja nueva solo hace su `pushState` cuando llega ese `popstate`, que ya no cierra a nadie. Lo cubre su test.
- **Dos cierres en el mismo commit (escáner → buscador).** Se juntan en un solo `go(-2)`. Al recargar, o con una marca que se ha quedado colgada, `settle` desde `AppShell` y `reconcile` al abrir la limpian con `replaceState`. La numeración sale de `layerOf(history.state)+1` y no de un contador. Lo cubren sus tests.
- **Enlaces que salen de una capa.**
  - `LayerLink` y `leaveLayers` primero sacan las entradas de las capas y navegan cuando el historial ya ha llegado, así que la carrera entre `back()` y `push` ya no puede darse.
  - Está aplicado en `MobileSearch`, en `RecordSheet` y en `RackRow` con `leavesLayer`.
  - Con Cmd, Ctrl o Mayúsculas, el clic se deja al navegador.
  - Una navegación con capas abiertas suelta esas capas en vez de volver a entrar en ellas.
- **`router.replace` o `router.refresh` con una hoja abierta.** Se vuelve a poner la marca si la ruta no ha cambiado. Lo cubren dos tests.
- **Mejoras de la ronda 1 que ya están:**
  - la ruta de artista pasa por `catalogueFetch`;
  - `isColdEntry` está protegido en el servidor;
  - un fallo de red reinicia `rateLimited`;
  - el Toast limpia sus timers al desmontarse y usa `min-h-tap`;
  - `--danger` es un token con canales, y Tailwind ya lo usa.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- `lib/layer-history.ts`, `reconcile`: una navegación se detecta solo por `pathname`. Un `router.push` que cambie solo la query con una hoja abierta (por ejemplo, las dos puertas de `TabBar`) se toma como un `replace`, y la entrada nueva recibe la marca de vuelta. Al cerrar a mano, `go(-1)` desharía esa navegación. Hay dos salidas: comparar `pathname + search` y tratar como `replace` solo los cambios que vengan de `router.replace`, o lanzar esas navegaciones con `leaveLayers`.
- `hooks/useSession.ts:160`: `gate()` hace `router.push` a `/entrar` desde dentro del escáner, que ya está abierto. Puede dejar en `/coleccion` una entrada que solo cuesta un «atrás» de más. Debería pasar por `leaveLayers`.
- `POP_GUARD_MS = 1000`: si un navegador no emite `popstate` tras `go()`, la hoja que espera tarda un segundo en tener su entrada. Es aceptable, pero vale la pena comprobarlo en Safari para iOS instalado como app.
- `rounded-[14px]` está dos veces en el diff nuevo. Debería ir a un token de radio.
- Siguen abiertas estas de la ronda 1:
  - límite por IP en `/api/discogs/search`;
  - vuelta atrás que pisa escrituras concurrentes en `useLibrary`;
  - comentario de «el mismo elemento» en `ShelfApp`;
  - DemoBand con 36 px suelto;
  - ESLint con `react-hooks`.
- Probar en un Android de verdad, con la app instalada: abrir el menú ⋮, pasar a «Pasar a deseos» y pulsar «atrás»; y abrir el escáner, cerrarlo y pulsar «atrás». La lógica está probada con un `history` falso, pero el navegador real solo lo vi en la ronda 1.

DICE: «Atrás» ya tiene un solo dueño y 14 tests que lo atan. Aprobado; queda vigilar las navegaciones que solo cambian la query.

---

## Ronda 3

Comprobado otra vez:
- `tsc --noEmit`: limpio.
- `NEXT_DIST_DIR=.next-rv-code next build`: compila sin errores. He borrado `.next-rv-code` y he quitado otra vez solo mi línea de `tsconfig.json`.
- `tsx --test lib/*.test.ts`: 23 de 23.

Lo que he mirado:
- **`LayerLink` en primitivas compartidas.**
  - Sigue siendo un `next/link` con su `href`, así que el prefetch y el renderizado no cambian.
  - Con un modificador (Cmd, Ctrl, Mayúsculas, Alt) o un botón que no es el principal, sale antes de hacer nada y deja el clic al navegador: nueva pestaña o nueva ventana.
  - Sin capas ocupadas (`busy()` falso) no llama a `preventDefault`. La navegación normal de Next sigue igual, y solo se ejecuta `onNavigate`, que es el `onClick` de siempre.
  - Con capas ocupadas llama a `preventDefault`. He comprobado en `next/dist/client/link.js:363` que Next mira `defaultPrevented` después del `onClick` del usuario, así que no hay doble navegación.
  - `busy()` cubre todo lo que puede comerse un push: capas metidas en el historial, pendientes, un `go` en vuelo, un suelo apuntado o un vaciado programado. Es justo el caso del bloqueo de QA: el artista en la ficha, con su `go(-1)` en vuelo.
- **`SheetRow` con `href`.** Ahora es `LayerLink` en vez de `<a>`, así que ya no recarga el documento ni pierde el estado.
- **`gate()` y «Ver» de `SaveListButton`.** Los dos pasan por `leaveLayers`. Con el escáner aún pendiente, `leave` descarta su push y navega en el siguiente vaciado, así que no queda ninguna entrada basura.
- **`reconcile` con `pathname + search`.** Cubierto por los 2 tests nuevos. No hay ningún `router.replace` de la app que corra con una capa abierta. El único `replaceState` está en `Landing`, que está fuera de las capas.
- **`maxLength` y textos.** Sin riesgo de código.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- `lib/layer-history.ts:111`: ahora que la query cuenta como navegación, un `router.replace` que cambie solo la query con una hoja abierta suelta la capa sin cerrarla. La hoja se queda en pantalla sin entrada propia, y «atrás» saldría de la pantalla. Hoy no ocurre en ningún sitio. Si algún día se filtra por la URL desde dentro de una hoja, habrá que distinguir `replace` de `push`, por ejemplo con un aviso explícito al coordinador.
- `LayerLink`, cuando no hay capas ocupadas, llama a `onNavigate` antes de que Next navegue. Es lo mismo que hacía el `onClick` de antes, pero si algún `onNavigate` hace algo síncrono que dependa de la ruta nueva, lo verá con la vieja.
- Siguen abiertas de rondas anteriores:
  - límite por IP en `/api/discogs/search`;
  - vuelta atrás concurrente en `useLibrary`;
  - `rounded-[14px]` en `Card` y en `CatalogueNotice`;
  - 36 px sueltos de `DemoBand`;
  - ESLint;
  - comprobación en un Android y un iPhone reales, con la app instalada.

DICE: LayerLink solo intercepta cuando hay historial en juego y respeta Cmd/Ctrl. El push ya no se pierde. Aprobado.
