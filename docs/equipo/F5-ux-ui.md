# F5 «Estable y para todos»: definición de UX/UI en móvil (Hummingbird, 6 nov 2026)

Encargo: efecto wow en lo que ya lo tiene (estante 3D, portadas, aviso con la funda), pero estable y usable en cualquier móvil y a cualquier edad. **Upgrade, no rediseño**: se quitan fricciones y se ajustan tokens; no se rehace ninguna pantalla.

**Cómo se ha medido.** Servidor propio `localhost:3347` con sesión falsa, y https://rackr.club sin sesión (solo lectura). Chromium táctil (`isMobile`, `hasTouch`) a 375×812, 360×740, 390×844 y 768×1024. Medidas tomadas del DOM: zona táctil, cuerpo de letra, contraste calculado sobre el fondo real, desbordamiento lateral y contenido tapado por la barra. La carga se ha grabado fotograma a fotograma: en local, y en producción con red lenta y CPU ×4. Lo que no se puede emular (muesca real, teclado de iOS, pérdida del contexto WebGL) sale del código y se dice.

**Qué ya está bien desde F4 (comprobado, no tocar):**
- No hay scroll lateral a 360, 375 ni 390.
- El final de cada pantalla queda por encima de la barra de pestañas (último elemento a 670 px y la barra empieza en 685 a 360×740).
- Los campos de texto van a 16 px: la regla global `input:not(#never) { font-size: max(16px, 1em) }` (`app/globals.css:432-435`) evita el zoom de iOS.
- El zoom de la página está permitido.
- Los grises de los tokens ya pasan AA sobre `ink`: ningún texto de la app por debajo de 4,5:1 en colección, explorar, perfil, actividad, ajustes ni rack.
- Los botones redondos de la cabecera de la colección miden 48×48.
- `.reveal-on-hover` ya no esconde nada en pantallas táctiles.

Las fricciones van de más grave a menos. Las **[P1]** entran sí o sí en esta ronda (12); las **[P2]** quedan para después.

---

## 1. ROMPE / BLOQUEA EL USO

### 1.1 [P1] «Deshacer» después de añadir desde el buscador no deshace nada
- **Pantalla y paso:** Colección → lupa → «tusk fleetwood» → «+» → aviso «Tusk → Mi Colección · Deshacer» → tocar «Deshacer».
- **Medida:** el contador pasa de 42 a 43 al añadir, **sigue en 43 después de «Deshacer»** y sigue en 43 al recargar. El aviso desaparece como si hubiera funcionado.
- **Por qué (código), hay dos cierres que leen datos viejos:**
  1. `components/mobile/MobileSearch.tsx:136` lee `search.savedIn[...]` justo después del `await`. Ese objeto es el del render anterior al guardado, así que `saved` es siempre `undefined` y `wasNew` nunca vale `true`. Nunca se toma el camino de «borrar el disco nuevo».
  2. El camino que queda es `onRemoveFromList`, que en `components/ShelfApp.tsx:837` está conectado a `handleToggleVinyl` (`:509-513`). Ese `handleToggleVinyl` consulta `lib.idsOf(colId)` de **antes** de añadir, cree que el disco no está y lo **vuelve a añadir**.
  - Con el escáner pasa lo mismo cuando el disco ya existía (`components/BarcodeScanner.tsx:400-409`).
- **A quién le duele:** a todos. Es la red de seguridad de la app: el Toast se apoya en «actuar y ofrecer deshacer» en vez de preguntar. Si «Deshacer» miente, a la persona mayor que toca «+» sin querer se le queda el disco, y el chaval aprende que deshacer no sirve.
- **Arreglo mínimo:**
  - `addFromCatalogue` (`hooks/useCatalogueSearch.ts:177-213`) devuelve `{ vinyl, wasNew }` y el que llama usa ese valor, no el estado.
  - El deshacer del buscador y del escáner llama a una acción que no alterna: `lib.removeFromList(listId, id)` o `lib.deleteRelease(id)`, nunca a `handleToggleVinyl`.
  - Si se quiere atar del todo, en `ShelfApp.tsx:837` y `:1537` se pasa `(vinylId, listId) => void lib.removeFromList(listId, vinylId)`.
- **Criterio de aceptado:** añadir y luego «Deshacer» deja el contador igual que antes y el «+» de la fila vuelve a su estado inicial. Probar con la colección y con un rack como destino, y con un disco nuevo y con uno que ya tenías.

### 1.2 [P1] El aviso tapa el buscador (y la cabecera de la ficha) durante 6 s
- **Pantalla y paso:** buscador → añadir. También: la ficha del disco → «En 1 rack» → añadir a un rack.
- **Medida:** el aviso se pinta en `top: safe-top + 12px` (`components/ui/Toast.tsx:99`) con unos 48 px de alto, de 12 a 60. El campo de búsqueda ocupa de 10 a 54 (`MobileSearch.tsx:151-176`, `h-11` con `safe-top + 10`), así que lo tapa entero y tapa también «Cancelar». En la ficha tapa «←» y «⋮». Dura `LIFETIME_ACTION = 6000` ms (`Toast.tsx:56`) y no se detiene mientras lo tocas. El botón «Deshacer» mide unos 30 px de alto (`Toast.tsx:147`, `py-1.5 text-sub`).
- **A quién le duele:** al que añade varios discos seguidos. Es el uso principal del buscador, y durante 6 s no puede escribir el siguiente. A la persona mayor, 6 s no le dan para leer «1975 To 1987 → Mi Colecc…» y encontrar el botón.
- **Arreglo mínimo (sin rediseñar la cápsula):**
  - En el teléfono, el aviso sale **abajo**: `bottom: calc(var(--tabbar-h) + var(--player-h) + 12px)` en las pantallas con barra, y `calc(var(--safe-bottom) + 12px)` en las capas a pantalla completa (buscador, ficha, escáner). El deslizar para cerrar pasa a ser hacia abajo.
  - Duración con acción: 8 s. El temporizador se para mientras hay un dedo encima (`onPointerDown`/`onPointerUp`) y mientras tiene el foco.
  - «Deshacer» con zona táctil de 44 px (ver 2.2; el dibujo no cambia).
  - El texto pasa de «X → Mi Colección» a «X añadido a Mi Colección»: la flecha no se lee en voz alta y a los 70 años no se entiende.

### 1.3 [P1] El aviso de límite del catálogo sale a la tercera búsqueda
- **Pantalla y paso:** buscador → escribir «fleetwood mac rumours» a ritmo normal, y repetir con otro disco.
- **Medida:**
  - Escribiendo a unos 170 ms por tecla, con una pausa entre palabras, salen **2 o 3 búsquedas por frase**: cada pausa de más de 300 ms dispara una (`hooks/useCatalogueSearch.ts:97`, sin mínimo de letras).
  - Cada búsqueda que no está en caché hace **5 + 2·(palabras − 1) consultas** al catálogo, y el doble si hay tildes (`app/api/discogs/search/route.ts:134-162`). «fleetwood mac rumours» son 5 + 7 + 9 = **21 consultas**, más la de las fotos de artistas.
  - El catálogo da **60 por minuto para toda la app**. Una sola persona buscando tres discos seguidos agota el minuto de todos.
  - Las búsquedas intermedias no se cancelan: `cancelled` solo ignora la respuesta, y el servidor sigue gastando consultas.
  - Además, una respuesta parcial o limitada **se guarda en caché 30 días** (`route.ts:280`: `results.length > 0`, sin mirar `health`). Desde caché se devuelve sin `degraded`, así que el aviso desaparece y el resultado incompleto se queda un mes.
- **A quién le duele:** a quien está catalogando (el uso de más valor), y a cualquier otra persona que busque en ese mismo minuto. Ve «hemos llegado al límite» sin haber hecho nada raro.
- **Arreglo mínimo:**
  - En el cliente:
    - Espera de 550 ms y mínimo de 3 letras.
    - `AbortController` en el `fetch`, que el servidor respete con `req.signal`.
    - No buscar mientras la última tecla es un espacio.
  - En el servidor:
    - Guardar en caché solo si `!health.rateLimited && health.failed === 0`.
    - Hacer las consultas partidas por palabras (artista + título) solo si las 5 primeras devuelven menos de unos 8 resultados.
    - Contar a nivel de proceso las consultas del último minuto y, por encima de unas 45, responder con lo que haya y `degraded: "rate-limit"` sin pedir más.
  - El texto de `CatalogueNotice` está bien. Que salga menos.

### 1.4 [P1] Si falla la red, la app dice «Guardado» y no ha guardado
- **Pantalla y paso:** con mala cobertura, añadir, quitar o mover un disco desde la ficha, el buscador o «Ya lo tengo».
- **Por qué (código, sigue igual que en QA n.º 5):**
  - `act()` (`hooks/useLibrary.ts:114-127`) no tiene `catch`.
  - Todas las llamadas son `void lib.saveToList(...)` (`ShelfApp.tsx:469, 483, 493, 511, 533`).
  - El aviso de éxito sale antes de saber el resultado.
  - Además, cada escritura relee **todo** (`listReleases`, `listLists` e `itemsOfLists`: tres viajes) antes de que la estantería cambie. Con 3G, el aviso dice «hecho» y la pantalla tarda segundos en enterarse.
- **A quién le duele:** al chaval con una mano en el metro, que cree que ha guardado y no.
- **Arreglo mínimo:**
  - `act` devuelve `Promise<boolean>` y captura el error.
  - Quien llama hace `await` y, si falla, enseña el aviso de error que ya existe (`tone: "error"`, «No se ha guardado. Sin conexión.», con «Reintentar» como acción).
  - Para que no se note la espera: cambio optimista en `itemsByList` antes de la escritura y vuelta atrás si falla.

### 1.5 [P1] La estantería pinta negro antes de aparecer (1–2 s)
- **Pantalla y paso:** abrir `/coleccion`, o tocar la pestaña «Colección» por primera vez en la sesión viniendo de Explorar o de un enlace.
- **Medida (fotogramas cada 200 ms, 375×812):**
  - Arranque en frío, local: **0–840 ms negro** con solo la barra, 840–2.150 ms la pantalla de arranque (marca y nombre) y después la estantería.
  - Explorar → «Colección»: **0–550 ms negro**, 550–1.550 ms pantalla de arranque. En total, 1,5 s antes de ver un disco.
- **Por qué (código):**
  1. `ShelfApp.tsx:731` devuelve `<main className="bg-ink" />` hasta que `useDevice` mide. El servidor no pinta nada útil, y además la página es `force-dynamic` con `auth.getUser()` (`app/(app)/coleccion/page.tsx`) y no tiene `loading.tsx`.
  2. `BootScreen` se carga con `dynamic(..., { ssr: false })` (`ShelfApp.tsx:48`), así que la propia pantalla de arranque necesita descargar su trozo antes de salir. Eso es el negro.
  3. La pantalla de arranque tiene un **mínimo de 900 ms** (`:257`) y se enseña la primera vez que se monta la colección en la sesión (`bootedThisLaunch`), no solo al abrir la app. Por eso sale también al llegar desde Explorar.
  4. No hay plan B si WebGL no está o se pierde el contexto: en `components/VinylShelf3D.tsx` no hay ningún `webglcontextlost`. En iPhones viejos, al volver de segundo plano con muchas texturas, el lienzo puede quedarse negro sin salida. Esto sale del código; aquí no se ha podido forzar.
- **A quién le duele:** a todos en el primer segundo, que es cuando se juzga la app. A la persona mayor, una pantalla negra le dice «se ha colgado».
- **Arreglo mínimo (el wow se queda):**
  - `app/(app)/coleccion/loading.tsx` con el **mismo dibujo** que `BootScreen` (marca, nombre y fondo), y `BootScreen` importado de forma estática, no con `dynamic`: pesa 40 líneas. Así el primer fotograma ya es la marca y nunca negro.
  - En `ShelfApp.tsx:731`, mientras no hay medida, pintar ese mismo `BootScreen` en vez de un `main` vacío.
  - Pantalla de arranque solo en el arranque en frío de verdad: `performance.getEntriesByType("navigation")[0]` con `type` igual a `navigate` o `reload` y la ruta de entrada `/coleccion`. Si llegas desde otra pestaña, se ve directamente la cuadrícula o el estante. Bajar el mínimo de 900 a 400 ms.
  - En `VinylShelf3D`: escuchar `webglcontextlost` en `gl.domElement` y, si salta (o si no hay WebGL), cambiar a la cuadrícula con el aviso «Hemos pasado a la cuadrícula para ir más ligeros». El estante tiene que poder caerse a algo que se lee.

### 1.6 [P1] En el móvil se ve primero la barra de escritorio, montada encima de sí misma
- **Pantalla y paso:** cualquier pantalla con `AppShell` en producción y red lenta (por ejemplo `/u/rackrclub/jazz-sin-hacer-un-master`).
- **Medida:** entre 1,1 y 3,5 s se pinta `TopNav` a 375 px, con «Explorar» y «Buscar» uno encima del otro. Después desaparece y sale la barra de pestañas. Es un salto de toda la cabecera.
- **Por qué:** `useDevice` supone «escritorio» en el servidor (`hooks/useDevice.ts`, `SERVER`), y `AppShell.tsx:47` y `:53` eligen la barra en JavaScript.
- **A quién le duele:** a quien llega por un enlace compartido (el primer contacto con Rackr) y con mala cobertura: ve una web rota antes de ver la app.
- **Arreglo mínimo:** pintar las dos en el servidor y esconder con CSS hasta medir: `TopNav` dentro de `hidden md:block` y `TabBar` dentro de `md:hidden`. Después de medir manda `isPhone`, como hoy. Opcional: una primera suposición por `user-agent` en el layout del servidor.

### 1.7 [P1] Un rack vacío en vista estante es una pantalla negra
- Sigue igual que en QA n.º 2. `components/mobile/MobileShelf.tsx:282` monta `VinylShelf3D` sin mirar si `vinilos.length === 0`. El estado vacío solo existe en la cuadrícula (`:568`).
- **Arreglo:** si no hay discos, el mismo `EmptyState` en las dos vistas. Cuando el rack es la colección, el texto dice «Tu colección está vacía», con «Buscar un disco» y «Escanear el código» abriendo la hoja de siempre.

### 1.8 [P1] «Atrás» del sistema te saca de la pantalla en vez de cerrar la hoja
- Sigue igual que en QA n.º 3. No hay `pushState` en ninguna hoja (`components/ui/Sheet.tsx`, `MobileSearch`, `RecordSheet` ni el escáner). En Android, con la app instalada, el gesto de atrás con una ficha abierta **cierra la app**.
- **A quién le duele:** a toda persona con Android; para la mayor es el gesto principal.
- **Arreglo mínimo:** un hook `useBackToClose(open, onClose)` dentro de `Sheet` y de las tres capas a pantalla completa. Al abrir hace `history.pushState({ sheet: id })`. Con `popstate` cierra. Al cerrar con la X, `history.back()` si la entrada sigue arriba. Las hojas apiladas apilan entradas.

---

## 2. TAMAÑOS Y LECTURA

### 2.1 Suelo propuesto para el móvil, en tokens

El problema ya no son los valores sueltos: en las pantallas del móvil casi todo usa tokens. El problema es **el valor de los propios tokens**. `--t-sub: 13px` se usa 132 veces y `--t-caption: 12px` 119 veces, también en texto que hay que leer: el artista bajo cada portada, la bio del perfil, los subtítulos de las filas y las descripciones de Explorar. Medido a 375: Explorar tiene **221 textos por debajo de 14 px**, el perfil 67 y la ficha del rack 30. Se arregla subiendo tres valores, y unos 290 sitios suben a la vez.

| Rol (token) | Hoy | Móvil (F5) | Para qué |
|---|---|---|---|
| `--t-body` | 15 | **16** | lo que se lee: bio, descripciones, avisos, títulos de fila |
| `--t-sub` | 13 | **14** | secundario que se lee: artista, «de Rackr Club · 11 discos», subtítulos |
| `--t-caption` | 12 | **13** | metadatos: cifras, fechas, etiquetas de la barra de pestañas |
| `--t-micro` | 12 | 12 | solo rótulos en versalitas que nombran una zona; nunca un dato |
| `--t-heading` / `--t-title` / `--t-display` | 17 / 21 / 30 | sin cambio | — |

- **Dónde:** en `app/globals.css`, un `@media (max-width: 767px), (pointer: coarse) { :root { … } }` debajo del bloque de tipos (`:109-115`). El escritorio no cambia.
- **En `rem`, no en `px`:** `--t-body: 1rem; --t-sub: .875rem; --t-caption: .8125rem; --t-micro: .75rem`. Así, si alguien sube el tamaño de letra del navegador (Android Chrome → Tamaño del texto; Safari → Aa), la app lo respeta. Hoy todo está en px y no se mueve. Es la diferencia más grande para la persona de 70 años.
- **Regla:** ningún `text-[Npx]` en componentes de móvil. Si hace falta un tamaño nuevo, es un token nuevo.

**Objetivo táctil.**
- `--tap: 44px` ya existe (`globals.css:134`) y se usa en 5 sitios. Pasa a ser obligatorio en toda zona táctil, y 48 px para la acción principal de cada pantalla.
- Utilidad nueva `.hit`, que agranda la zona sin cambiar el dibujo:
  - `.hit { position: relative }`
  - `.hit::after { content: ""; position: absolute; left: 50%; top: 50%; width: max(100%, var(--tap)); height: max(100%, var(--tap)); transform: translate(-50%, -50%) }`
- Separación mínima de 8 px entre zonas que no se pueden solapar.

**Contraste.**
- Texto ≥ 4,5:1 sobre el fondo real, también sobre `surface-overlay` (#141414) y sobre las cápsulas `bg-paper/[0.07]`. Hoy `--text-faint` (0,48) da 4,6 sobre `ink` y baja a **4,46** en la cápsula de dominio de `/instalar`. Subir `--text-faint` a 0,52.
- Prohibido en texto `text-paper/<50` (hoy quedan 28; las del móvil, en la lista de abajo). Los separadores «·» y las líneas pueden ir más bajos.
- Iconos que se pulsan: ≥ 3:1.

### 2.2 Dónde se incumple (medido a 360, 375 y 390)

Zonas táctiles < 44 px **[P1, se resuelven todas con `.hit`]** (es una sola entrada de la lista P1):

| Pantalla | Control | Medida | Dónde |
|---|---|---|---|
| Aviso | Deshacer | ~70×30 | `components/ui/Toast.tsx:147` |
| Ficha del disco | Cerrar / Más opciones | 40×40 | `components/record/RecordScreen.tsx:160, 201` |
| Ficha del disco | Escuchar (junto al título) | 36×36 | `components/mobile/RecordSheet.tsx:259` |
| Ficha del disco | Vinilo anterior / siguiente | 36×36 | `components/mobile/Tracklist.tsx:301` |
| Ficha del disco | Escuchar pista | 32×32 | `components/mobile/Tracklist.tsx:246` |
| Ficha del disco | Enlace al artista | 90×22 | `RecordSheet.tsx` (título) |
| Buscador | Cancelar | 63×38 | `components/mobile/MobileSearch.tsx:179` |
| Buscador | Discos / Usuarios y racks | ×32 | `MobileSearch.tsx` (pestañas) |
| Hojas | «Listo» de la cabecera | 54×30 | `components/ui/Sheet.tsx:127` |
| Guardar en | + / ✓ de cada rack | 32×32 | `components/mobile/SaveSheet.tsx:89, 100` |
| Explorar | Me gusta del rack | 35×24 | `components/community/ListMetrics.tsx:68` |
| Explorar | Seguir (tarjeta de persona) | 36×36 | `components/community/FollowButton.tsx:105` |
| Explorar | Guardar disco | 28×28 | `components/ExploreView.tsx:781` |
| Explorar | Campo «Buscar discos, racks o personas» | 263×22 | `components/ExploreView.tsx` (cabecera) |
| Rack | ← @usuario / ← Rackr Club | 61×18 / 105×30 | `components/community/ListView.tsx:130` |
| Rack | Más opciones | 36×44 | `ListView.tsx` |
| Rack | Escuchar (sobre cada portada) | 32×32 | `ListView.tsx:354` |
| Perfil | «8 seguidores» / «0 siguiendo» | 82×24 / 74×24 | `components/community/ProfileView.tsx` |
| Perfil | Pestañas Perfil · Colección · Racks | ×34 | `ProfileView.tsx:408` |
| Perfil | Filas de artista | 304×30 | `ProfileView.tsx` (gráfica de artistas) |
| Ajustes | Editar | 67×34 | `app/(app)/ajustes/page.tsx:82` |
| Página de artista | Atrás / Compartir | 40×40 | `components/community/ArtistView.tsx` |
| Colección (cuadrícula) | Ya lo tengo / Sonando | 36×36 | `components/mobile/MobileShelf.tsx:613` |

**Letra < 12 px [P1, va con la entrada de tokens]:**
- Iniciales del avatar a **9–10 px** (medido: «AT» y «LS» en Explorar a 9 px, «MF» en Actividad a 10 px). En `components/ui/Avatar.tsx:74`, `Math.max(9, px*0.34)`. **Arreglo:** `Math.max(12, Math.round(px * 0.4))`. En `xxs` (16 px) y `xs` (22 px), una sola inicial en vez de dos.

**Valores sueltos que quedan en lo que se ve en el móvil [P2, salvo la barra]:**
- `components/app/TabBar.tsx:127, 148`: `text-[12px]` → `text-caption` (con la tabla de arriba sube a 13). **[P1, va con los tokens]**
- `components/ui/Toast.tsx:137`: `text-[14px]` → `text-sub`.
- `components/app/MiniPlayer.tsx` (3), `components/record/RecordScreen.tsx` (2), `components/VinylGrid.tsx` (2) y `components/ui/Select.tsx` (3): a su token.
- Landing e instalar: `components/Landing.tsx` (15), `components/landing/EntryDoor.tsx` (8), `components/landing/Screens.tsx` (15), `components/install/PhonePreview.tsx` (12) y `components/install/Steps.tsx` (4).
- Lo demás (`CollectionsOverlay`, `ShelfApp` de escritorio, `SearchOverlay`, `SaveToList`, `CommunityBridge` y `admin`) es de escritorio: no entra en F5.

**Grises por debajo de AA que quedan [P2]:**
- Escritorio: `components/CollectionsOverlay.tsx:285, 471, 924, 959, 1033`, `components/SaveToList.tsx:79, 84, 279`, `components/SearchOverlay.tsx:239`, `components/ShelfApp.tsx:1506` y `components/app/TopNav.tsx:128, 137` (separadores; están bien).
- Móvil y landing: `components/DemoNotice.tsx:41` (`text-paper/30` en un botón) y `components/onboarding/Scenes.tsx:74` (separador; está bien).
- `/instalar`: cápsula «rackr.club» a 4,46:1 (se arregla con `--text-faint` a 0,52).
- Las maquetas de iOS de `/instalar` («Marcadores», «Copiar» a 1,77:1) son un dibujo del sistema; están bien.

---

## 3. ESTABILIDAD PERCIBIDA

- **[P1] Pantalla negra, cabecera de escritorio y rack vacío:** ver 1.5, 1.6 y 1.7.

- **[P1] «Quién más lo tiene» llega tarde y empuja las canciones.**
  - `components/mobile/RecordSheet.tsx:461` solo pinta la tarjeta cuando ya hay `friends` o `elsewhere`. Está **encima** de `Tracklist` (`:556`), así que, cuando llega, todo lo de debajo baja. Si ibas a tocar una pista, tocas otra.
  - **Arreglo:** reservar el sitio con un esqueleto de la altura de dos filas mientras carga, y quitarlo sin hueco si al final no hay nadie. O, sin tocar el orden de producto, que el bloque solo aparezca si llegó antes de 300 ms y, si no, que entre debajo de las canciones.

- **[P2] Al cerrar una hoja encima de otra, el fondo vuelve a hacer scroll.** `Sheet.tsx:89` borra `data-sheet-open` aunque quede otra abierta. **Arreglo:** un contador en `document.body.dataset.sheetOpen`, que se suma al abrir y se resta al cerrar.

- **[P2] La vista estante o cuadrícula no se recuerda en el móvil.** `MobileShelf.tsx:141` empieza siempre en el estante. El escritorio sí lo recuerda (`ShelfApp.tsx` con `vinilos:view`). **Arreglo:** la misma clave en `localStorage`, envuelta en `try`. No cambia qué vista sale la primera vez: el estante se queda como entrada (es el wow).

- **[P2] Explorar falla al hidratar en `WantedRail`.** Medido en local: tres `Hydration failed` en cada carga, y la sección se pinta dos veces. En producción no salta error, pero sí el parpadeo. `components/explore/WantedRail.tsx`: lo que dependa del cliente (sesión, colección local), detrás de un `useEffect` y con el mismo esqueleto en el servidor y en el cliente.

- **[P1] `prefers-reduced-motion` no llega a lo que más se mueve.** El CSS lo respeta (12 bloques en `globals.css`), pero lo animado con framer-motion y Three no:
  - el muelle de las hojas (`Sheet.tsx`, `SPRING`);
  - el aviso (`Toast.tsx:119-122`);
  - el desenfoque de 700 ms de `BootScreen`;
  - el giro de la marca (`.loader-meridian` sí lo respeta);
  - la inercia y el imán del estante 3D (`VinylShelf3D.tsx`);
  - el texto que se desplaza solo en la cabecera (`MarqueeText`, `@keyframes marquee` en `globals.css:155`, que no tiene bloque `reduce`).

  **Arreglo mínimo:**
  - `<MotionConfig reducedMotion="user">` en el layout de la app, una línea que cubre todas las hojas y avisos.
  - En `VinylShelf3D`, con `matchMedia('(prefers-reduced-motion: reduce)')`: sin inercia y paso a paso de disco en disco. El estante sigue siendo 3D; solo deja de deslizarse solo.
  - `MarqueeText`: con `reduce`, el nombre se corta con «…» y no se mueve.

  A quien se marea con el movimiento (a muchas personas mayores les pasa con el vértigo) la app le habrá respetado el ajuste del sistema.

- **[P2] El estante en teléfonos modestos.**
  - `dpr={[1, 1.5]}`, `antialias: true`, `powerPreference: "high-performance"` y una textura con `anisotropy = 8` por portada (`VinylShelf3D.tsx:62, 321, 886-891`).
  - En una colección de 106 discos, cuidado con la memoria en iPhones de hace 4 o 5 años.
  - **Propuesta:** si `navigator.deviceMemory <= 4` o `hardwareConcurrency <= 4`, `dpr` a 1 y `anisotropy` a 4, y cargar texturas solo para los discos a ±8 posiciones del que estás viendo.
  - Esto no se ha medido aquí (el Chromium del Mac no sirve de vara). Que lo confirme QA con un teléfono de gama media.

---

## 4. MEJORA

- **[P2] Tableta (768×1024, táctil) recibe la interfaz de escritorio.**
  - 22 a 30 controles por debajo de 44 px por pantalla: «Vista colección» y «Vista cuadrícula» a 30×26, «Editar discos» a 28×28, «CERRAR» a 62×18 y los enlaces de `TopNav` a 39 de alto.
  - El perfil tiene scroll lateral (`scrollWidth` 776 sobre 768, el carril `rail-page`).
  - **Arreglo barato:** con `touch` (no `isPhone`), aplicar el suelo de tokens de 2.1 y `.hit` a los iconos de escritorio. El rediseño de tableta no es de F5.
- **[P2] «Añadir» sigue escondido en la lupa.** Es la fricción n.º 3 de la auditoría del 30 de octubre, y no está hecha. En la cabecera de la colección (`MobileShelf.tsx:270`), el botón se llama «Buscar». Mínimo: `aria-label="Añadir o buscar"` y un «+» pequeño junto a la lupa. Lo que importa es el listón «añade su primer disco sin que se lo expliquen».
- **[P2] El botón de vista enseña dónde estás, no adónde vas.** El icono es el de la vista actual y la etiqueta es la contraria (`MobileShelf.tsx:220-225`). Para quien no lee iconos, mejor la palabra debajo: «Cuadrícula» o «Estante».
- **[P2] Borrar desde «Deshacer» devuelve el disco solo al rack activo** (`ShelfApp.tsx:498`), no a todos los racks en los que estaba. Guardar la lista de racks antes de borrar y devolverlo a todos.
- **[P2] Pantalla de entrada (landing) a 360:** «EL CLUB / COLECCIONA / PROYECTA / COMPARTE» son anclas de 31 px de alto y «Sobre el proyecto» mide 135×18. Va con la revisión de la landing, no con F5.
- **[P2] «Quién más lo tiene» sigue enseñando racks, no personas** (fricción n.º 12 de octubre). No entra en estabilidad. Se apunta para F9.

---

## Lista P1 de esta ronda (12)

1. Deshacer del buscador y del escáner: `hooks/useCatalogueSearch.ts:177-213`, `components/mobile/MobileSearch.tsx:136`, `components/ShelfApp.tsx:837, 1537`.
2. El aviso abajo, 8 s, pausa con el dedo, «añadido a» y «Deshacer» de 44 px: `components/ui/Toast.tsx:56, 99, 147`.
3. Límite del catálogo: espera, mínimo de letras y cancelar en el cliente (`hooks/useCatalogueSearch.ts:78-99`); en el servidor, caché solo de respuestas completas, consultas en cascada y presupuesto por minuto (`app/api/discogs/search/route.ts:134-162, 280`).
4. Escrituras que fallan avisan y se reintentan, con cambio optimista: `hooks/useLibrary.ts:114-127`, y las llamadas de `ShelfApp.tsx`.
5. Nunca negro al cargar la colección: `loading.tsx` con `BootScreen`, `BootScreen` estático, sin el `main` vacío, arranque solo en frío y mínimo de 400 ms: `components/ShelfApp.tsx:48, 257, 731`, `app/(app)/coleccion/`.
6. Si WebGL no está o se pierde, el estante cae a la cuadrícula: `components/VinylShelf3D.tsx` (alrededor del `<Canvas>`, `:870`).
7. Sin barra de escritorio en el teléfono: ocultar con CSS antes de medir. `components/app/AppShell.tsx:47, 53`.
8. Rack vacío en vista estante con su estado vacío: `components/mobile/MobileShelf.tsx:282`.
9. «Atrás» cierra la hoja: `useBackToClose` en `components/ui/Sheet.tsx`, `MobileSearch`, `RecordSheet` y el escáner.
10. Suelo de letra en tokens y en `rem` (cuerpo 16, secundario 14, metadatos 13, rótulos 12), `--text-faint` a 0,52, barra de pestañas a token e iniciales del avatar ≥ 12: `app/globals.css:109-115, 44`, `components/app/TabBar.tsx:127, 148`, `components/ui/Avatar.tsx:74`.
11. `.hit` de 44 px en los 23 controles de la tabla 2.2.
12. Movimiento reducido (`MotionConfig`, estante sin inercia, sin marquesina) y «Quién más lo tiene» sin empujar las canciones: layout de la app, `VinylShelf3D.tsx`, `MarqueeText.tsx`, `components/mobile/RecordSheet.tsx:461`.

**Para QA, al cerrar la ronda:**
- Repetir las medidas a 360, 375 y 390 con letra del navegador al 130 %.
- Añadir → Deshacer, con la colección y con un rack como destino.
- Tres búsquedas seguidas sin que salga el aviso de límite.
- Modo avión → añadir.
- Grabar la carga de `/coleccion` en un teléfono real.
- Gesto atrás en Android con la ficha abierta.
- Ajuste de reducir movimiento activado.

DICE: El wow ya está; lo que falla es que «Deshacer» no deshace, el aviso tapa y el negro asusta. Arreglad la red, no el trapecio.
