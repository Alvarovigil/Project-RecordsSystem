# F5 — Revisión de QA (Woodpecker)

Fecha: 2026-11-06. Sobre los cambios sin commitear que parten de `163b719`.

Cómo se ha probado:
- Servidor propio en `localhost:3354` (`NEXT_DIST_DIR=.next-rv-qa`, `NEXT_PUBLIC_FAKE_SESSION=1`, repositorio local en `localStorage`).
- Playwright con Chromium, móvil táctil a 375×812 y a 360×740. También 812×375 en horizontal y 1280×800 para comparar.
- El catálogo, simulado con `page.route` (`search`, `barcode`, `release`, `artist`, `specs`). No se ha tocado rackr.club.
- Scripts en `/private/tmp/claude-501/qa5b/` (s1…s32).
- `tsc --noEmit` limpio. `lib/catalogue-query.test.ts`: 7/7.
- Al terminar: servidor parado, `.next-rv-qa` borrado, mi línea quitada de `tsconfig.json`. `data/` y `public/covers/` sin cambios.
- En `.crane/revisiones/` hay revisiones F5 de otros (código, copy, arte, UX/UI). No son mías.

## VEREDICTO: BLOQUEADO

Los 11 P1 de la auditoría están casi todos arreglados de verdad.
Quedan tres cosas:
1. «Deshacer» tras borrar no devuelve el disco.
2. El atrás del sistema deja entradas basura cuando se cierran dos capas a la vez, o después de recargar.
3. El escáner pierde lo escaneado si falla el guardado, y no ofrece «Reintentar».

---

## BLOQUEA

### 1. «Deshacer» tras «Borrar de mi colección» no devuelve el disco
- **Pasos:** cuadrícula → Currents → ⋮ → «Borrar de mi colección» → «Borrar» → «Deshacer» en el aviso.
- **Qué pasa:** «Mi Colección» se queda en 39 y Currents no vuelve, tampoco al recargar. En `vinilos.releases.v1` ya no está.
- **Qué debería pasar:** que vuelva a 40, con Currents en su rack («El turno de noche»).
- **Por qué:**
  - `restoreRecord`, con `inLibrary: true`, solo hace `addToList` en cada lista.
  - Nunca vuelve a crear la ficha (`repo.upsertRelease(release)`), que `deleteRelease` sí ha borrado.
  - El cambio optimista tampoco vuelve a poner el disco en `releases`.
  - En el repositorio local, `addToList(DEFAULT_ID)` además no guarda nada: solo lo saca de deseos.
  - Con Supabase, mirando el código, probablemente funciona, porque `deleteRelease` solo borra `list_items`. Aun así falta el `upsertRelease`.
- **Dónde:** `hooks/useLibrary.ts:276-296` (`restoreRecord`).
- **Arreglo:** `await repo.upsertRelease(release)` al empezar la rama `inLibrary`, y en el optimista, `releases: s.releases.some(...) ? s.releases : [...s.releases, release]`.

### 2. El atrás del sistema deja entradas basura
Pasa en dos casos.

**a) Dos capas cerradas a la vez con un botón**
- **Pasos:**
  1. Actividad → Colección → cuadrícula → Currents → ⋮ → «Borrar de mi colección» → «Borrar».
  2. O: «Rack actual» → «Rack nuevo» → nombre → «Crear rack».
  3. Después, atrás.
- **Qué pasa:**
  - Se cierran la confirmación y la ficha, o la hoja de racks y la de rack nuevo.
  - Queda la entrada `__rackrLayer: 1` sin ninguna capa abierta.
  - El primer atrás no hace nada visible: sigue en /coleccion.
  - Hace falta un segundo atrás para llegar a /actividad.
  - Con Escape en la ficha con el menú abierto pasa lo mismo.
- **Por qué:**
  - La capa de arriba hace `history.back()`, que es asíncrono.
  - Cuando la de abajo limpia, `history.state` sigue siendo el de la de arriba (`layer 2 ≠ 1`), así que no retrocede su propia entrada.

**b) Recargar con una capa abierta**
- **Pasos:** ficha abierta → recargar (tirar para refrescar en Android, o la PWA restaurada por el sistema) → abrir el buscador → atrás.
- **Qué pasa:** el primer atrás no cierra el buscador.
- **Por qué:**
  - `history.state` sobrevive a la recarga con `__rackrLayer: 1`, y `depth` vuelve a 0.
  - El buscador se apunta como capa 1, y al hacer `pop` a una entrada con capa 1 se ignora (`>= mine`).

**Común a los dos:**
- **Qué debería pasar:** un atrás cierra una capa, y con todo cerrado va a la pantalla anterior.
- **Dónde:** `hooks/useBackToClose.ts:55` (`mine = ++depth`) y `:66` (la limpieza solo retrocede si `state === mine`).
- **Arreglo, como idea:**
  - Numerar desde la entrada actual: `mine = layerOf(history.state) + 1`.
  - Al cerrar a mano, retroceder `history.go(-(layerOf(state) - mine + 1))` coordinado (un contador de retrocesos pendientes), o un `history.back()` por capa encadenado.
  - Al montar sin capas abiertas, un `replaceState` que quite `__rackrLayer`.

**Lo que sí funciona** (a 375 y a 360):
- Ficha → atrás cierra la ficha, y otro atrás va a /actividad.
- ✕ → atrás va a /actividad. Cinco veces abrir y cerrar no dejan basura.
- Buscador: «Cancelar» → atrás va a /actividad.
- Ficha + menú: un atrás por capa.
- Buscador → escáner: un atrás por capa.
- Buscador → hoja «Guardar en»: un atrás por capa.
- Buscador → un disco tuyo → ficha: correcto.
- Sin bucles ni saltos de ruta.

### 3. El escáner pierde lo escaneado si no se guarda, y no hay «Reintentar»
- **Pasos:** escáner → código a mano → sale OK Computer → `localStorage.setItem` lanza `QuotaExceededError` → «Añadir 1 a Mi Colección».
- **Qué pasa:**
  - El escáner se cierra igualmente (`onClose()` antes de mirar el resultado) y la bandeja se pierde.
  - El aviso de `useLibrary` («No se ha guardado… · Reintentar») queda tapado al momento por «No se pudo añadir ninguno de los discos.», que no lleva «Reintentar». Solo hay un aviso a la vez.
  - Con 20 discos escaneados y la red caída, se pierden los 20.
  - Con fallos parciales sale «· N sin añadir», sin forma de reintentar esos.
- **Qué debería pasar:** si algo no se guarda, el escáner sigue abierto con esas tarjetas marcadas, o el aviso de error lleva «Reintentar» para lo que falló.
- **Dónde:** `components/BarcodeScanner.tsx:422-427`.

---

## MEJORA

1. **Con un 429 o un 503, el buscador dice «Nada para «radiohead»».** Sale el titular con «Prueba con menos palabras…» y debajo el aviso del límite.
   - El aviso de 429 dice «está devolviendo menos resultados de lo normal», aunque no ha llegado ninguno.
   - Es la misma mentira que se arregló en el escáner.
   - `nothing` no mira `search.degraded` (`components/mobile/MobileSearch.tsx:117`). Con `degraded` en «rate-limit» o «down» y sin filas, debería salir solo el aviso, y además «Reintentar».
2. **Escribir despacio sigue disparando una búsqueda por letra.**
   - A 650 ms por letra, «radiohead» son 7 peticiones (abortadas).
   - A 380 ms por letra, «radiohead in rainbows» son 3, porque el espacio no cambia la clave y no reinicia la espera.
   - Ha bajado mucho (antes eran 21), pero el debounce de 500 ms deja fuera a quien teclea despacio.
   - Se podría alargar la espera cuando la frase es corta, o reiniciar el temporizador con cada tecla y no con cada clave.
3. **«Reintentar» funciona, pero no confirma nada.**
   - Tras reintentar no sale «Añadido» ni «Deshacer».
   - En el buscador, el «+» sigue disponible aunque ya está guardado (por `forgetSave`).
   - El fallo al borrar dice «No se ha guardado», que es raro para un borrado.
   - Con el almacenamiento lleno se ofrece «Reintentar» aunque el propio comentario dice que eso no lo arregla.
4. **La banda de /demo al 130 %:**
   - El texto se corta en «Colección de ejemplo · nada se…», justo la parte que importa.
   - «Entrar» mide 48×36, por debajo de 44.
   - La banda tiene la altura fija de 36 px y el texto en rem (`components/DemoBand.tsx:16` y `:42`).
5. **Al 130 % y a 360**, los títulos del catálogo en el buscador se quedan en «Radiohead - Ki…»: se pierde justo el disco. Mejor a dos líneas. Sin scroll lateral en ninguna pantalla probada.
6. **Pantalla de arranque al navegar.** Al llegar a Colección por primera vez desde Explorar o Actividad, se ve «RACKR CLUB» unos 150–400 ms. Es el `loading.tsx` o la rama `!measured`. Antes era negro más un segundo de arranque, así que ha mejorado mucho, pero `isColdEntry` no llega a `loading.tsx`. Las siguientes visitas no lo enseñan.
7. **Sin WebGL**, el botón «Ver el estante» sigue en la cabecera y no hace nada.
8. **En horizontal**, antes de medir el dispositivo, a 812 px se pinta `TopNav` (`hidden md:contents`) hasta que entra «Gira el teléfono». Solo se ve en un arranque en frío lento con el teléfono tumbado.
9. **El aviso abajo y el teclado de iOS.** Con el teclado abierto en iOS, el aviso, al ir pegado a la barra, puede quedar detrás del teclado. No se ha probado en un dispositivo real.
10. **Ir hacia adelante** en el historial entra en una entrada de capa sin capa abierta.
11. **Del inventario anterior, siguen igual:**
    - Rack sin `maxLength`.
    - ««QA vacío» creada» en vez de «creado» (`components/ShelfApp.tsx:462`).

---

## P1 de la auditoría: estado

| # | P1 | Estado |
|---|---|---|
| 1 | Sin WebGL, «Application error» | **Arreglado**. /, /demo y /coleccion a 375 y 1280 con `--disable-webgl --disable-3d-apis`: cuadrícula o fondo, 0 canvas, sin errores. Perder el contexto a mitad también lleva a la cuadrícula. |
| 2 | Sin `error.tsx` | **Arreglado**. Existen los tres. Con `specs` roto, la ficha técnica no tumba nada. |
| 3 | El buscador gasta el límite | **Arreglado en lo grave**: 21 → 1–3 peticiones, con mínimo de 3 letras, abort, caché y un único reintento tras `Retry-After`. «U2» + Intro: 1 petición y baja el teclado. Ver MEJORA 1 y 2. |
| 4 | Caché parcial 30 días | **Arreglado** en el código (`whole = !rateLimited && failed === 0`). |
| 5 | «Deshacer» tras añadir vuelve a añadir | **Arreglado**, desde el buscador, desde el escáner y hacia un rack propio. Nuevo → sale de la biblioteca. Doble toque: 1 POST. |
| 6 | El aviso tapa el buscador | **Arreglado**. Abajo (696–746 a 375, 624–674 a 360). `elementFromPoint` en «Cancelar» da «Cancelar». Dura 8,15 s. Con el dedo encima 10 s sigue ahí, y al soltar se va en unos 7 s. |
| 7 | «Guardado» sin guardar | **Arreglado** en el buscador, «Guardar en» y borrar: error con «Reintentar» y el contador no se mueve. **No** en el escáner (BLOQUEA 3). |
| 8 | Atrás con hoja abierta | **Arreglado lo básico**, con basura en dos casos (BLOQUEA 2). |
| 9 | Arranque en negro | **Arreglado**. El HTML del servidor ya trae la marca y la barra. Primer contenido a ~150 ms, y a ~460 ms con 3G (300 ms, 200 KB/s) y CPU ×4. Ningún fotograma vacío ni barra de escritorio a 375 ni a 360. |
| 10 | Rack vacío en negro | **Arreglado**: «Este rack está vacío» en la vista estante. Doble toque en «Crear rack»: un rack. |
| 11 | Pasar a deseos sin avisar | **Arreglado**: confirma («Se quitará de tu colección y de 1 rack») y «Deshacer» lo devuelve a «El turno de noche». |

Otros puntos:
- **Escáner con 429 / 503:** «El catálogo está saturado…» o «No hemos podido consultar el catálogo», con «Reintentar» que funciona.
- **«Gira el teléfono» a 812×375:** sale en frío y al girar; no sale en una tableta de 1024×768.
- **/demo:** banda «Colección de ejemplo · nada se guarda» desde el primer byte.
- **Sin probar:** el escáner sin sesión (#12) y Supabase real.

VEREDICTO: BLOQUEADO

DICE: Deshacer tras borrar no devuelve el disco, el atrás deja entradas muertas y el escáner pierde lo escaneado si falla el guardado.

---

# Ronda 2

Fecha: 2026-11-06. Mismo montaje: `:3354`, Playwright, 375×812 y 360×740, catálogo simulado. Scripts s* (repetidos) y r1…r7 en `/private/tmp/claude-501/qa5b/`. Al terminar: servidor parado, `.next-rv-qa` borrado, `tsconfig.json` como en git y `data/` y `public/covers/` sin cambios.

## VEREDICTO: BLOQUEADO

Los tres bloqueos de la ronda 1 están arreglados. Pero el coordinador del historial ha roto un enlace que antes funcionaba.

## BLOQUEA

### 1. Tocar el artista en la ficha (o en la hoja de un disco del catálogo) no lleva a su página
- **Pasos:**
  - Cuadrícula → Currents → tocar «Tame Impala» bajo el título.
  - O: Buscar → «radiohead» → tocar la fila «Radiohead - Kid A» → en la hoja, tocar «Radiohead».
- **Qué pasa:**
  - La ficha (o la hoja) se cierra y te quedas en /coleccion, con el buscador abierto en el segundo caso.
  - No se navega nunca: a los 6 s sigue en /coleccion.
- **Qué debería pasar:** ir a /artista/tame-impala, y que el atrás vuelva a la colección.
- **Por qué:**
  - Es un `<Link>` normal con `onClick={onNavigate}` (`onClose`).
  - El cierre a mano hace `history.go(-1)` un tick después y se come el `router.push`.
  - Los enlaces que ya son `LayerLink` funcionan bien: la fila de rack en «Quién más lo tiene» y el artista en el buscador.
- **Dónde:**
  - `components/record/RecordHero.tsx:111` → usar `LayerLink`.
  - Pasa por ahí desde `RecordSheet.tsx:458` y `CatalogueSheet.tsx:185`.
  - Conviene buscar cualquier otro `Link` dentro de una capa que tenga `onClick={onClose}`.

## MEJORA

1. **Recargar con la ficha abierta deja un atrás muerto.** La marca se limpia y el buscador ya se cierra al primer atrás, pero la entrada recargada sigue en la pila: hacen falta dos atrás más para llegar a /actividad. Se podría resolver con `settle()` + `history.go(-n)`, o asumirlo.
2. **Quien teclea despacio sigue haciendo una petición por letra.** A 650 ms por letra, «radiohead» son 7 peticiones (abortadas). A 380 ms ya sale 1, porque el espacio reinicia la espera.
3. **Escáner con el catálogo en 500.** La bandeja se queda y «Añadir 1» funciona como reintento, pero el aviso «No se pudo añadir ninguno de los discos.» no dice que se puede volver a pulsar.
4. **La primera vez que se entra en Colección desde Explorar o Actividad**, sigue saliendo «RACKR CLUB» unos 300 ms. Sin cambios.
5. **Sin cambios:** el nombre del rack sigue sin `maxLength`.

## Comprobado y bien

- **«Deshacer» tras borrar:** 39 → 40, con Currents de vuelta en la biblioteca y en su rack. Aguanta la recarga.
- **Atrás, sin basura ni bucles (375 y 360):**
  - Ficha + atrás, y cerrar con ✕ (también 5 veces seguidas) → /actividad.
  - Buscador: con «Cancelar» y con atrás.
  - Ficha → ⋮ → atrás de capa en capa.
  - Menú ⋮ → «Cambiar la portada», «Mover a deseos» o «Borrar» (cierra una hoja y abre otra en el mismo toque): un atrás por capa.
  - Borrar confirmado → un atrás va a /actividad.
  - «Crear rack» desde la hoja de racks: no deja entrada; el atrás va a la página anterior.
  - Escape en la ficha.
  - Escáner → «Buscar a mano» → el buscador con el código → atrás lo cierra.
  - Buscador → escáner → hoja «Guardar en».
  - Dos atrás seguidos rápidos, y cuatro aperturas y cierres seguidos.
  - Recargar con la ficha abierta: el buscador se cierra al primer atrás.
- **Escáner con fallo de guardado:**
  - La bandeja se queda y el aviso sale encima.
  - Al quitar el fallo, «Añadir 1» guarda y confirma con «Deshacer».
  - Con el almacenamiento lleno no se ofrece «Reintentar»; el texto lo explica.
- **Buscador:**
  - Con 429 y 503 sale solo su aviso con «Reintentar», sin «Nada para…».
  - «radiohead in rainbows» a 380 ms por letra: 1 petición.
  - «U2» + Intro: 1 petición.
- **Regresiones:**
  - Doble toque en «+»: 1 POST, y «Deshacer» lo saca de la biblioteca.
  - Deshacer hacia un rack propio.
  - Doble toque en «Crear rack»: un rack.
  - Doble toque en una fila de «Guardar en»: una sola vez («En 2 racks»).
  - Pasar a deseos con confirmación y «Deshacer».
  - Guardar en / borrar con fallo: error y el estado no se mueve.
- **Sin WebGL:** cuadrícula en /, /demo y /coleccion, y «Ver el estante» desactivado.
- **«Gira el teléfono»** a 812×375, y no sale en una tableta.
- **Arranque en frío:** primer contenido a ~150–260 ms, sin negro ni barra de escritorio.
- **Al 130 %:** sin scroll lateral y la banda de /demo ya no se corta. Ningún control por debajo de 44 px en las pantallas probadas.
- **El aviso:** en el buscador va al fondo, porque la barra está tapada; con la barra visible queda encima de ella (685–746).

VEREDICTO: BLOQUEADO

DICE: Lo de la ronda 1 está arreglado, pero tocar el artista en la ficha ahora la cierra y no navega: falta LayerLink en RecordHero.

---

# Ronda 3

Fecha: 2026-11-06. Mismo montaje (`:3354`, Playwright, 375×812 y 360×740, catálogo simulado). Scripts nuevos r8…r14 en `/private/tmp/claude-501/qa5b/`, y repetidos los de las rondas 1 y 2.

Limpieza al terminar:
- Servidor parado y `.next-rv-qa` borrado.
- `tsconfig.json` idéntico a git. Al quitar mi línea quedó una coma colgando y la quité.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: APROBADO

## BLOQUEA

- Ninguno.

## MEJORA

1. **Recargar con la ficha abierta deja un atrás muerto.** La entrada recargada sigue en la pila: el buscador se cierra al primer atrás, pero hacen falta dos más para llegar a /actividad. Igual que en la ronda 2.
2. **Quien teclea despacio sigue haciendo una petición por letra.** A 650 ms por letra, «radiohead» son 7 peticiones (abortadas). A 380 ms, 1.
3. **Primera entrada en Colección desde otra pestaña.** Sigue saliendo «RACKR CLUB» unos 300 ms.
4. **Error de hidratación en /explorar** (`components/explore/WantedRail.tsx:18`).
   - Sale cuando ya hay biblioteca en `localStorage`, por ejemplo al entrar en /explorar después de /coleccion.
   - React vuelve a pintar en el cliente y no se rompe nada.
   - No es de F5: el archivo no ha cambiado desde `163b719`. Lo dejo apuntado.
5. **Sin probar:** «Ver el perfil de…» del menú de un rack guardado en la estantería (`MobileShelf.tsx:570`). En el repositorio local el rack guardado no aparece en la lista de racks, así que no se puede llegar.

## Comprobado y bien

**Navegación desde capas** (sin recargas de página completas, y el atrás vuelve a la pantalla de debajo con la capa cerrada):
- Ficha → artista: /artista/tame-impala. Atrás → /coleccion → /actividad.
- Hoja de un disco del catálogo → artista: /artista/radiohead. Atrás → /coleccion.
- «Quién más lo tiene» → rack (RackRow): /u/rackrclub/portadas-…
- Buscador «Usuarios y racks» → persona: /u/rackrclub.
- Perfil → hoja «Seguidores» → persona: /u/francisco. Atrás → /u/rackrclub → /explorar.
- Página de rack → ⋮ → «Ver el perfil de Rackr Club» (`SheetRow` con `href`): navegación suave, sin recarga. Atrás → el rack → /explorar.

**Sin capas abiertas:**
- Explorar → ListCard y PersonCard.
- Actividad → persona.
- Artista → rack.
- Todos navegan y vuelven con atrás.

**Atrás** (pasada completa de las rondas 1 y 2): un atrás por capa, sin entradas basura ni bucles, en:
- La ficha (con ✕, también cinco veces seguidas) y el menú ⋮.
- «Cambiar la portada», «Mover a deseos» y «Borrar» desde ⋮.
- Borrar confirmado y «Crear rack».
- Escape.
- Buscador → escáner → «Buscar a mano».
- La hoja «Guardar en» dentro del buscador.
- Dos atrás rápidos y abrir y cerrar seguido.
- Recargar con la ficha abierta.

**Regresiones:**
- **Deshacer:** tras borrar vuelve a 40. Tras añadir desde el buscador y desde el escáner vuelve a 40 y sale de la biblioteca. Hacia un rack, deshace.
- **Doble toque:** en «+», un solo POST. En «Crear rack», un rack (`maxLength` 80).
- **Pasar a deseos:** confirma y se puede deshacer.
- **Fallos al guardar:**
  - Con el almacenamiento lleno: error, sin «Reintentar», y nada se mueve.
  - En el escáner: la bandeja se queda.
  - Con el catálogo en 500: «No se ha añadido ninguno. Vuelve a pulsar «Añadir».».
- **Buscador:** 429 → «El catálogo va lento ahora mismo…» con «Reintentar». 503 con su texto, sin «Nada para…». «U2» + Intro: 1 petición.
- **Sin WebGL:** cuadrícula en /, /demo y /coleccion, sin «Application error».
- **«Gira el teléfono»** a 812×375.
- **Arranque en frío:** primer contenido a 146–192 ms, sin negro ni barra de escritorio.

VEREDICTO: APROBADO

DICE: Aprobado: el artista navega desde la ficha y el catálogo, el atrás va capa a capa y deshacer, escáner y fallos aguantan.
