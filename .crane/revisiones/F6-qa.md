# F6 «Remate» — QA (Woodpecker)

Fecha: 2026-11-06. Cambios sin commitear sobre `631613d`.

Cómo se ha probado:
- `:3354` con `NEXT_DIST_DIR=.next-rv-qa` y `NEXT_PUBLIC_FAKE_SESSION=1`, repositorio local.
- Playwright con Chromium, móvil táctil a 375×812 y a 360×740. La letra al 130 % se simula con el tamaño del `html`, y el teclado con un `visualViewport` falso.
- El catálogo, simulado con `page.route`.
- Scripts en `/private/tmp/claude-501/qa5b/` (f1…f18, más los s* y r* de F5). Pruebas unitarias extra en `ut/opt.test.ts`.
- `lib/*.test.ts`: artist-known 5/5, catalogue-query 7/7, discogs-budget 7/7, layer-history 18/18, optimistic 6/6.

**Ojo: el código cambió mientras probaba.**
- `tailwind.config.ts` (el token `tap-lg`), `MobileShelf.tsx` y `globals.css` cambiaron entre las 14:19 y las 14:24.
- Con el primer servidor, los botones redondos de la cabecera salían a 15×15 px, porque `h-tap-lg` no existía todavía.
- Reinicié el servidor con la caché limpia y repetí lo que dependía de eso.
- Al terminar eran 65 archivos tocados; al empezar, 60.

Limpieza:
- Servidor parado y `.next-rv-qa` borrado.
- `tsconfig.json` idéntico a git.
- `data/` y `public/covers/` sin cambios.

**Sin querer, el catálogo real:** `curl` a seis `/artista/<slug>` hizo que el servidor preguntase al catálogo con el token de verdad y guardase el resultado en `discogs_search_cache`. Son como mucho seis consultas, y no hubo escrituras de usuario.

## VEREDICTO: BLOQUEADO

## BLOQUEA

### 1. Al 130 %, «Mi Colección» no cabe en la cabecera
- **Pasos:** letra al 130 % → /coleccion, a 360×740 y a 375×812.
- **Qué pasa:**
  - La cápsula del nombre mide 113 px a 360 y 128 px a 375. Dentro, la caja del nombre mide 58 o 73 px, y el texto necesita unos 113.
  - Entra la marquesina, que se ve cortada en «li Colecc» y se mueve sola.
  - A 375 el botón de buscar llega a 359 px, con el «+» encima, pegado al borde.
  - A 100 % sí cabe (87 de 87).
  - Es justo lo que esta fase decía que arreglaba.
- **Por qué:** el botón «Cuadrícula» con la palabra debajo ocupa 87–88 px (15–103), y le quita el sitio al nombre.
- **Qué debería pasar:** «Mi Colección» entero y quieto al 130 %, con los cuatro botones dentro de la pantalla.
  - Por ejemplo: la palabra en el botón solo si cabe, el contador y el nombre en dos líneas sin marquesina, o la barra a dos alturas.
- **Dónde:** `components/mobile/MobileShelf.tsx`, la cápsula del rack (`max-w-[48vw]`, `MarqueeText`) y `RoundButton` con `caption` (~`:779-820`).

## MEJORA

1. **La barra compacta de la ficha al 130 %.** El artista se corta («TAME IMPA…»). El título cabe.
2. **«Quién más lo tiene» al 130 %.** La línea del dueño ya baja entera («de Rackr Club · 11 discos»), pero el nombre del rack sigue cortado a dos líneas («Portadas que justifican el…», «Comprados por la portada. Cer…»).
3. **Explorar con la red caída pero el navegador «en línea»** (supabase abortado; la cobertura mala típica del móvil):
   - Hasta los 5 s, el esqueleto.
   - A los 14 s, «Todavía no hay racks que enseñarte… o no hemos podido leerlas» con un «Recargar» que recarga la página entera.
   - No llega a «No hemos podido cargar esto · Reintentar», porque `popularLists` devuelve `[]` en vez de fallar.
   - Con el navegador sin conexión de verdad sí funciona: «Sin conexión · Reintentar» y, con `online`, se recupera solo (22 racks).
4. **Al entrar en Colección desde otra pestaña con CPU ×4:**
   - Unos 0,7 s de fondo liso con solo la barra (es `ShelfLoading`, sin la marca, como se pidió).
   - Después, unos 2 s con la cabecera y el emblema «Rr» pequeño girando en el centro (el respaldo del estante) hasta que entra el 3D.
   - No es la pantalla de arranque, pero el emblema sí aparece.
5. **Teclado en «Guardar en» dentro del buscador.** Al pulsar «Nuevo rack» y abrirse el teclado, la hoja se encoge bien, pero el campo con «Crear» se queda por debajo del área visible: 615 px, con lo visible hasta 440.
   - Un `scrollIntoView` del campo cuando cambia el hueco lo resolvería.
   - En la hoja «Rack nuevo» está bien: «Crear rack» a 416–464 con lo visible hasta 476, y a 472–520 con lo visible hasta 532.
6. **/artista/zzzz-inventado** enseña la 404 propia, pero responde **200**, porque `loading.tsx` ya ha empezado a mandar la página. Para buscadores, un `noindex` o resolverlo antes del `loading`.
7. **Portadas en la cuadrícula.** Tras un fallo de red, algunas `<img>` fuera de pantalla quedan rotas: 23 de 34. Al llegar con el scroll no se ve ninguna rota. El reintento con espera está solo en el 3D.
8. **Carrera con el mismo disco.** Si A añade X y falla mientras B añade el mismo X con éxito, `revertOptimistic` quita X. Es un caso límite; se corrige con la siguiente lectura.
9. **«Cuadrícula» bajo el icono** va como texto blanco sin fondo encima de las portadas del estante. A juicio de UX.
10. **Quien teclea despacio sigue haciendo una petición por letra.** A 650 ms por letra, 7 peticiones abortadas. Sin cambios desde F5.

## Comprobado y bien

- **Marca:**
  - En frío en /coleccion y /demo sale la pantalla de arranque.
  - Desde Explorar o Actividad hacia Colección no sale nunca (detectada por `aria-label="Cargando la colección"`).
- **Recargar con la ficha abierta:** un solo atrás lleva a /actividad. Con el buscador abierto después, un atrás lo cierra y otro va a /actividad.
- **Hojas apiladas:** el contador `data-sheet-open` va 1 → 2 → 1 → nada. El fondo no recupera el scroll al cerrar la de arriba.
- **Portadas del estante que fallan:** se piden otra vez (40 de 41) y se pintan.
- **Explorar sin conexión:** «Sin conexión · Reintentar», y vuelve sola con `online`.
- **`?q=` en Explorar:**
  - Escribir deja `/explorar?q=radiohead+kid+a`.
  - Sobrevive a recargar, a pasar por `/entrar?next=…` y a volver atrás.
  - Al vaciar el campo, se quita.
- **Hidratación:** 0 errores en /explorar, también después de /coleccion, y en /coleccion, /u/…, el rack y /actividad.
- **Vista estante o cuadrícula:** se recuerda tras recargar (`vinilos:view`). El botón lleva la palabra («Cuadrícula» o «Estantería»).
- **Foco con teclado:** visible en 41 de 41 paradas en /coleccion, /explorar y /u/rackrclub. Las portadas de la cuadrícula ya tienen nombre accesible («Abrir Currents de Tame Impala»).
- **Rack nuevo** con id `col-<uuid v4>`.
  - Crear, renombrar desde «Nombre», añadir un disco con «Guardar en» y borrar funcionan.
  - Un rack antiguo `col-1730000000000` inyectado aparece, admite discos, se renombra y se borra.
- **/artista:** zzzz-inventado → «404 Esta página no existe». Radiohead y Tame Impala cargan normal.
- **Deshacer con dos escrituras a la vez:**
  - Por la interfaz no se puede provocar con el repositorio local, porque escribe sin esperas.
  - Las 6 pruebas de `optimistic` pasan, y 4 mías más: A falla mientras B añade Y al mismo rack, queda Y; A borra X y falla mientras B quita Z, X vuelve y Z sigue fuera; A pasa a deseos y falla mientras B añade a otro rack, se conserva lo de B.
- **Estante con CPU ×4:**
  - En frío, la pantalla de arranque y después el estante, sin fotogramas negros.
  - Desde otra pestaña, ver la MEJORA 4.
- **Regresiones de F5:**
  - Atrás capa a capa: ficha, ✕ cinco veces, buscador, menú ⋮ con «Cambiar la portada», «Mover a deseos» y «Borrar», Escape, escáner → «Buscar a mano», enlace de la ficha.
  - Deshacer tras borrar (39 → 40, aguanta la recarga) y tras añadir desde el buscador y desde el escáner.
  - Escáner con 429 («va lento») y 503, con «Reintentar».
  - Fallo de guardado en el escáner: «No se ha añadido ninguno. Vuelve a pulsar «Añadir».», y la bandeja se queda.
  - Buscador con 429 y 503, sin «Nada para…».
  - «U2» + Intro: 1 petición.
  - Sin WebGL, cuadrícula en /, /demo y /coleccion.
  - «Gira el teléfono» a 812×375.
  - Doble toque en «+»: 1 POST.
  - Pasar a deseos y deshacerlo.

VEREDICTO: BLOQUEADO

DICE: Casi todo F6 aguanta, pero al 130 % «Mi Colección» sigue sin caber: el botón «Cuadrícula» le quita el sitio y entra la marquesina.

---

# Ronda 2

Fecha: 2026-11-06. Servidor `:3354` arrancado con la caché limpia y el código ya quieto (68 archivos). Playwright a 320, 360, 375 y 414, con la letra al 100, 115, 130 y 150 %. Scripts g1…g7 en `/private/tmp/claude-501/qa5b/`.

Limpieza al terminar:
- Servidor parado y `.next-rv-qa` borrado.
- `tsconfig.json` idéntico a git.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: BLOQUEADO

El bloqueo de la cabecera está arreglado. El de las portadas aparece ahora porque esta ronda dice que ya está cubierto en toda la app, y no lo está.

## BLOQUEA

### 1. Una portada que falla una vez se queda rota en la ficha, en Explorar y en el perfil
- **Pasos:**
  - Cuadrícula → simular que cada portada falla **solo la primera vez** (`page.route` sobre `/covers/` y `cover?url=`) → abrir Lux.
  - O: abrir /explorar o /u/rackrclub con la misma simulación.
- **Qué pasa:**
  - Cada imagen se pide una sola vez y se queda con el icono de imagen rota del navegador y el texto alternativo encima.
  - Ficha: la portada grande («Portada de Lux» sobre negro), el fondo difuminado y las miniaturas de «Quién más lo tiene».
  - /explorar: 36 imágenes rotas («Lo tienen ellos, tú no», portadas dentro de las cajas de rack).
  - /u/rackrclub: 13 (la cabecera y las tiras).
  - La cuadrícula de la colección y el estante sí reintentan y se recuperan: 32 de 34 se piden dos veces y no queda ninguna rota.
- **Qué debería pasar:** lo que dice esta ronda: reintentar a 1,5 s y a 5 s, y si no carga, la funda. Nunca el icono roto.
- **Dónde:** `<img>` sueltos que no pasan por `Cover` ni por `COVER_RETRY_MS`:
  - `components/record/RecordHero.tsx:94` (portada de la ficha) y `:40` (fondo);
  - `components/ui/Crate.tsx:135` y `:157` (cajas de rack);
  - `components/explore/FromOthersRail.tsx:110`;
  - `components/community/ProfileView.tsx:268` y `:451`;
  - `components/ExploreView.tsx:851`.
  - En total hay 76 `<img>` en `components/` y `Cover` solo se usa en 9 archivos.

## MEJORA

1. **La cabecera elige mal en dos casos extremos**, con marquesina cuando sí cabría en dos líneas:
   - 320 al 130 y al 150 %: vuelve a «Cuadrícula» con palabra y el nombre se desplaza («Cole…»).
   - 375 al 150 %: icono solo y cápsula de 183 px, pero con marquesina. En cambio a 360 al 150 %, con 168 px, sí pone dos líneas.
   - Los casos pedidos (360 y 375 al 130 %) están bien.
2. **Quien teclea despacio:** a 650 ms por letra, 7 peticiones abortadas. Sin cambios.
3. **/artista inventado responde 200.** Decisión tomada; lo dejo anotado.

## Comprobado y bien

- **Cabecera** (matriz de 16 combinaciones):
  - 360 y 375 al 130 %: «Mi Colección» entero y quieto, con icono solo; buscar dentro de la pantalla (348/360 y 363/375).
  - 414 a cualquier tamaño, y 360 y 375 al 100 y al 115 %: correcto. A 360 al 150 %, en dos líneas.
  - Con un nombre largo («Bandas sonoras que aguantan solas»), la marquesina: es el caso «no cabe de ninguna forma».
- **Explorar con mala cobertura** (supabase abortado y el navegador «en línea»):
  - Hacia los 12 s, «No hemos podido cargar Explorar · Reintentar».
  - «Reintentar» recarga en el sitio, sin navegar, y salen 22 racks y 9 personas.
  - Si solo fallan las personas, los racks se siguen viendo (13).
  - 0 errores de hidratación.
- **Teclado en la hoja anidada** (buscador → «Guardar en» → «Nuevo rack»): el campo (396–419) y «Crear» (392–424) quedan dentro de lo visible (440). «Rack nuevo», bien.
- **Repetidas de la ronda 1, todas bien:**
  - Marca solo en frío.
  - Un atrás tras recargar con la ficha abierta.
  - Bloqueo de scroll con hojas apiladas (2 → 1 → nada).
  - Vista recordada, con «Cuadrícula» y «Estantería».
  - `?q=` sobrevive a recargar, a pasar por /entrar y a volver atrás.
  - Hidratación 0.
  - Foco visible en todas las paradas.
  - Racks: id `col-<uuid>` y rack antiguo `col-1730000000000`, con renombrar.
  - 404 de artista inventado; Radiohead y Tame Impala cargan.
- **Regresiones de F5:**
  - Atrás capa a capa.
  - Deshacer tras borrar (39 → 40, aguanta la recarga) y tras añadir.
  - Escáner con 429 y con fallo de guardado.
  - Buscador con 429 y 503, y «U2» + Intro.
  - Sin WebGL, sin «Application error».
  - «Gira el teléfono».

VEREDICTO: BLOQUEADO

DICE: La cabecera ya cabe, pero con un fallo de red la portada de la ficha se queda rota: RecordHero, Crate y Explorar no usan Cover.

---

# Ronda 3

Fecha: 2026-11-06. Servidor `:3354` arrancado con la caché limpia. Para comparar con `631613d`, levanté un worktree temporal en `:3355` y lo borré al terminar. Scripts h1…h5 en `/private/tmp/claude-501/qa5b/`.

Limpieza al terminar:
- Los dos servidores parados.
- `.next-rv-qa` y el worktree borrados (`git worktree prune`).
- `tsconfig.json` idéntico a git.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: APROBADO

## BLOQUEA

- Ninguno.

## MEJORA

1. **Avatar que no carga: círculo vacío en vez de iniciales.**
   - En headless, las fotos de Google (`lh3…/ACg8oc…`) fallan con `ERR_BLOCKED_BY_ORB`, así que lo vi en «Coleccionan como tú».
   - Antes de F6 salía el icono roto; ahora, tras 3 intentos, un círculo oscuro vacío.
   - El respaldo natural del avatar son sus iniciales: `components/ui/Avatar.tsx:89` llama a `RetryImg` sin `fallback`.
   - No es regresión, pero queda a medias.
2. **Salto grande al cargar /explorar (CLS 0,62).** Cuando llega la tira «Lo tienen ellos, tú no», todo lo de debajo baja unos 380 px.
   - Con caché caliente, `631613d` da lo mismo (0,62), así que no es de esta ronda.
   - Con un hueco reservado se arreglaría.
3. **Quien teclea despacio:** sigue haciendo una petición por letra. Sin cambios.
4. **La cabecera a 320 al 150 %:** sigue con marquesina. Aceptado.

## Comprobado y bien

**Portadas con un fallo de red.** La primera petición de cada imagen falla; resultado a los 7 s:

| Pantalla | URLs | Reintentadas | Rotas a la vista |
|---|---|---|---|
| Ficha | 4 | 3 | 0 |
| Cuadrícula | 34 | 32 | 0 |
| /explorar | 64 | 59 | 0 |
| /u/rackrclub | 14 | 14 | 0 |
| Página de rack | 11 | 11 | 0 |
| /artista/radiohead | 25 | 25 | 0 |
| Estante 3D | 41 | 40 | 0 |

- /actividad no carga imágenes.

**Si fallan siempre:**
- 3 intentos por imagen y después la superficie de respaldo: el cuadrado gris en la ficha y en Explorar, y las cajas de rack vacías pero dibujadas.
- Ni un icono roto en ninguna pantalla.

**Con red normal, comparado con `631613d`:**
- Las mismas imágenes, con la misma posición, tamaño, `object-fit` y `object-position`: 0 diferencias en /explorar, /u/rackrclub, el rack, el artista, la cuadrícula y la ficha.
- Las mismas peticiones de portadas. Las únicas de más son los reintentos de los avatares que fallan.
- La misma estabilidad del diseño (CLS igual en las seis pantallas).
- Los tiempos, dentro del ruido: el percentil 90 del final de las imágenes va de 902 a 3.336 ms en las dos versiones.

**Regresiones de F5 y F6:**
- Marca solo en frío.
- Un atrás tras recargar con la ficha abierta.
- Bloqueo de scroll con hojas apiladas.
- Deshacer tras borrar (39 → 40, aguanta la recarga).
- Escáner con fallo de guardado.
- Buscador con 429 y 503.
- Sin WebGL.
- «Gira el teléfono».
- Cabecera a 360 y 375 al 130 %: entera y quieta.
- Hidratación 0 en 8 cargas.
- Explorar con mala cobertura → «No hemos podido cargar Explorar · Reintentar», que se recupera en el sitio.

VEREDICTO: APROBADO

DICE: Aprobado: con un fallo de red ninguna portada se queda rota y con red normal nada cambia. Solo falta poner iniciales en el avatar que no carga.
