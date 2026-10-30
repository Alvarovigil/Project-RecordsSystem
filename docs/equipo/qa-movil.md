# QA móvil — Rackr (Woodpecker)

Fecha: 2026-10-30. Probado en el navegador integrado a 360×740 (móvil emulado), en
`localhost:3346` (sesión falsa, datos de prueba) y `localhost:3345` (sin sesión, solo
lectura). Lo que no se podía forzar ahí (teclado real, sin conexión, gesto atrás de
Android, letra grande del sistema) está sacado del código y se marca como tal.

## Veredicto

**No está listo para gente con poca soltura.** El esqueleto aguanta: no hay scroll
lateral en ninguna pantalla a 360, las zonas seguras están pensadas, añadir un disco
no se duplica con doble toque y los borrados piden confirmación. Pero hay cinco fallos
que hacen perder cosas o dejan a la persona sin salida, y en tres de ellos la app
dice que todo fue bien.

## ROMPE

### 1. «Lista de deseos» en «Guardar en» saca el disco de todos tus racks, sin avisar
- Pasos: abrir un disco que está en Mi Colección y en otro rack (p. ej. Currents, en
  «El turno de noche») → «En 1 rack» → en «Añadir a», pulsar + en «Lista de deseos».
- Qué pasa: el aviso dice «Guardado en Lista de deseos», sin opción de deshacer. El disco
  sale de Mi Colección (42 → 41) y de «El turno de noche» (5 → 4). Si luego pulsas «Ya lo
  tengo», vuelve a Mi Colección pero **no a sus racks**: esa organización se pierde.
- Qué debería pasar: o la lista de deseos no aparece como un rack más para «añadir» un
  disco que ya tienes, o se dice claramente que va a salir de tu colección y de N racks,
  con opción de deshacer que lo devuelva todo.
- Dónde: `components/mobile/RecordSheet.tsx:709-718` (aviso de éxito genérico), la lista
  de racks de `components/mobile/SaveSheet.tsx`, y la regla en
  `supabase/migrations/0021_coleccion.sql:119-126`, que borra el disco de todos los demás
  racks.

### 2. Un rack vacío en vista estante es una pantalla negra
- Pasos: «Tus racks» → «Rack nuevo» → nombre y «Crear rack» sin elegir discos.
- Qué pasa: pantalla negra con la barra arriba. No hay mensaje ni botón. En la vista
  cuadrícula sí sale «Este rack está vacío · Buscar discos». La vista estante es la que se
  usa por defecto (y no se recuerda: `MobileShelf.tsx:141`).
- Qué debería pasar: el mismo estado vacío en las dos vistas.
- Dónde: `components/mobile/MobileShelf.tsx:282-284` monta `VinylShelf3D` sin comprobar si
  el rack está vacío; el estado vacío solo está en la cuadrícula (`:568`).

### 3. Volver atrás con una hoja abierta te saca de la pantalla
- Pasos: Actividad → Colección → tocar un disco (se abre la ficha) → botón o gesto de
  atrás del sistema.
- Qué pasa: vuelves a Actividad y la ficha desaparece con la pantalla. En Android, con la
  app instalada, el gesto de atrás en la primera pantalla cierra la app.
- Qué debería pasar: atrás cierra la hoja de arriba y nada más.
- Dónde: ninguna hoja añade una entrada al historial (no hay `pushState` ni `popstate` en
  el repo). Pasa con la ficha, el buscador, «Tus racks», «Guardar en», el escáner y
  Compartir.

### 4. El punto rojo de Actividad no se apaga nunca, y la invitación no se ve
- Pasos: con sesión o sin ella, mirar la pestaña Actividad (punto rojo, «3 avisos sin
  ver») → entrar → recargar.
- Qué pasa: Actividad dice «Todavía no se mueve nada» y el punto sigue ahí después de
  entrar dos veces y recargar. En el almacenamiento hay una invitación pendiente
  («Compras de Record Store Day») que no aparece en la pantalla. Con datos reales, eso
  sería una invitación que nunca contestas.
- Qué debería pasar: entrar en Actividad apaga el punto, y lo que lo enciende se ve allí.
- Dónde: `components/ActivityView.tsx:58-62` marca como leído una sola vez al montar,
  cuando `notif.unread` todavía vale 0 porque las notificaciones no han llegado
  (`hooks/useNotifications.ts:48`). Además, el contador de la barra
  (`useUnreadCount`) es otro estado aparte, que solo se refresca al recuperar el foco. No
  he encontrado por qué no se pinta la invitación.

### 5. Si falla la red, la app dice «Guardado» y no guarda (sacado del código)
- Pasos: sin conexión o con un error del servidor, añadir un disco a un rack desde la
  ficha, o quitarlo.
- Qué pasa: el aviso «Guardado en X» / «Fuera de X» sale antes de saber si ha
  funcionado. Si la petición falla, la promesa rechazada no la recoge nadie y no se
  avisa.
- Dónde: `components/mobile/RecordSheet.tsx:716-722` y `components/ShelfApp.tsx`
  (`handleSaveToList = (v, listId) => void lib.saveToList(...)`); `hooks/useLibrary.ts`
  `act()` no tiene `catch`. Aquí no se pudo reproducir: la sesión falsa escribe en el
  almacenamiento del navegador, no en la red.

## MOLESTA

6. **El aviso tapa la barra de arriba durante 6 s.** Al añadir desde el buscador, el
   aviso queda encima del campo y de «Cancelar». En la ficha, encima de ← y ⋮.
   `components/ui/Toast.tsx:98-99` (arriba del todo), `LIFETIME_ACTION = 6000`.
7. **Al cerrar una hoja que estaba encima de otra, la página de detrás vuelve a hacer
   scroll.** «Tus racks» → ⋮ de un rack → cerrar: `body[data-sheet-open]` desaparece con
   «Tus racks» todavía abierta. `components/ui/Sheet.tsx:86-89`: cada hoja borra la marca
   al cerrarse, sin contar las que siguen abiertas.
8. **Los nombres largos de rack se meten debajo del ⋮** en «Tus racks» («Bandas sonoras
   que aguantan solas» acaba en x=336 y el botón empieza en 304). Medido: el padding
   derecho real es 12px, porque `pr-3` gana a `pr-12`. `components/mobile/MobileShelf.tsx:340`
   frente a `components/community/RackRow.tsx:90`.
9. **No se puede agrandar nada.** El zoom está bloqueado (`app/layout.tsx:102-103`) y el
   texto va en px fijos: 62 usos de `text-[10px]`, 10 de `text-[9px]`, y las etiquetas de
   la barra de abajo a 10px. Con la letra de la raíz al 125%, la barra sube a 20px pero
   las etiquetas siguen en 10px. Para gente mayor es lo primero que falla.
10. **Escáner, código a mano:** si tecleas menos de 8 cifras, el campo se vacía sin
    decir nada. Acepta letras aunque el teclado sea numérico. Si repites el mismo código
    en menos de 4 s, se ignora en silencio. `components/BarcodeScanner.tsx:190-195` y
    `:586-589`.
11. **La ficha del disco salta:** «Quién más lo tiene» llega tarde y aparece encima de las
    canciones, empujándolas. Si ibas a tocar algo, tocas otra cosa.
    `components/mobile/RecordSheet.tsx:447`.
12. **Se puede guardar un nombre de perfil en blanco:** «   » se acepta, sale «Perfil
    actualizado» y se guarda `""` (la base de datos no lo impide).
    `components/community/EditProfileSheet.tsx:89-95`, `0001_init.sql:29`.
13. **/explorar falla al hidratar** (`WantedRail`): «Hydration failed… Switched to client
    rendering». En desarrollo salen 3 errores; en producción la sección parpadea.
14. **Crear un rack con doble toque:** el freno es el estado `busy`, no una ref
    (`components/mobile/NewRackSheet.tsx:74-77`). Dos pulsaciones en el mismo instante
    crean dos racks. Un toque humano normal sí queda frenado. En el modo local o de
    visitante, además, el id es `col-${Date.now()}` (`lib/collections.ts:144`): los dos
    racks salieron con el mismo id, y al borrar uno se borraron los dos.
15. **La vista estante/cuadrícula no se recuerda en el móvil** (`MobileShelf.tsx:141`):
    cada vez que entras vuelves al estante.

## COSMÉTICO

16. «rackr.app/u/vera» en Editar perfil: el dominio es rackr.club.
    `components/community/EditProfileSheet.tsx:223`.
17. /ajustes no tiene título propio («Rackr Club — Your records. Your people.», en
    inglés). El título de la página de artista sale sin tilde («Rosalia»).
18. Explorar a 360: los filtros TODO/DISCOS/RACKS/USUARIOS se parten en dos líneas.
19. Hoja Compartir a 740 de alto: «Guardar en el carrete» queda cortado abajo.
20. Escáner sin cámara: sigue enseñando el visor con su línea, como si escaneara.
21. Lectores de pantalla: las portadas del estante (canvas) y las de la cuadrícula
    (botones sin nombre, imágenes sin `alt`) no se anuncian, y la ficha es un diálogo
    sin etiqueta.
22. Una línea fina cruza la ficha del disco a ~632px, de lado a lado, por detrás de la
    tarjeta «Quién más lo tiene». No la he localizado.

## No concluyente o del entorno de pruebas

- Tu propio perfil enseña «Seguir», y seguirte funciona. Con la sesión falsa,
  `relationship` va a Supabase y devuelve `isYou: false`. Hay que comprobarlo con sesión
  real.
- Las peticiones 400 a `profiles?id=eq.local` son de la sesión falsa.
- Teclado: no se puede emular aquí. No hay manejo de `visualViewport` en todo el repo.
  Los campos de abajo (código a mano del escáner, «Sobre ti» en Editar perfil) son los
  que más riesgo tienen de quedar tapados en Android.
- Sin conexión: el service worker guarda las páginas ya vistas; las escrituras, ver
  el n.º 5.
- `zoom: 1.25` en CSS hace desaparecer el estante 3D. Es un efecto del zoom de CSS, no
  vale como prueba.

## Lo que funciona

- Añadir desde la búsqueda: dos toques seguidos dejan un solo disco y aparece
  «Deshacer».
- Escáner sin cámara: pasa a teclear el código y avisa de «Ya está en Mi Colección» con
  «Añadir igual».
- «Ya lo tengo» con doble toque: entra una sola vez.
- Seguir y dejar de seguir: doble toque sin duplicados, y dejar de seguir pide
  confirmación.
- Borrar un rack: la confirmación es clara y aguanta nombres de 120 caracteres con
  emojis y tildes. Vaciar el nombre de un rack no se guarda: vuelve al anterior.
- Las hojas se cierran tocando el fondo y con Escape. El menú ⋮ de la ficha se cierra
  bien.
- No hay scroll lateral en ninguna pantalla a 360 (landing, explorar, perfil, rack,
  artista, instalar, colección, actividad, ajustes).
- Los campos de texto van a 16px, así que iOS no hace zoom al tocarlos. El perfil tiene
  límites de longitud (40/24/160).
- Zonas seguras: la barra de abajo, las hojas, el aviso, el escáner, el buscador y la
  ficha usan `--safe-*`.
- Los estados vacíos de la búsqueda y de Actividad se entienden y dan una salida.

## Estado en que quedan los datos de prueba (3346)

OK Computer está en Mi Colección. Currents ya no está en «El turno de noche» (4 discos),
por el fallo n.º 1. Los racks de prueba están borrados. Rumours aparece dos veces; creo
que es del otro agente.

DICE: «Añadir a deseos» saca el disco de todos tus racks sin decirlo, y «Ya lo tengo» no lo devuelve a ninguno.

---

# F4 «La puerta» — QA móvil

Rama `feat/la-puerta`, sin commit todavía. Probado a 360×740: en `:3345` sin sesión y en
`:3346` con la sesión falsa. «Entrar con Google» no se ha pulsado en ningún momento.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pasos, qué pasa, qué debería pasar):
- Quien llega desde el navegador de Instagram, WhatsApp o Facebook (webview) solo ve
  puertas de Google, y Google no deja entrar ahí.
  Pasos: landing con html[data-no-install] (lo que pone lib/install en un webview).
  Qué pasa: los botones visibles son «EMPEZAR GRATIS» y «Entrar con Google», los dos
  signInWithGoogle, que Google rechaza en un webview (disallowed_useragent). No hay
  «Mirar sin cuenta» ni un aviso para abrirlo en el navegador.
  Debería: en el webview, igual que /instalar, decir cómo salir al navegador y ofrecer
  «Mirar sin cuenta».
  Dónde: components/landing/EntryDoor.tsx:66-78 y :112-117 (.door-pointer) y
  app/globals.css:767-770.
- Sin sesión, Explorar sigue hablando de «tu» colección, que es la de ejemplo.
  Pasos: :3345/explorar.
  Qué pasa: salen «Coleccionan como tú» y «Tu estantería tira a rock» (el género sale
  de la estantería de ejemplo). «Lo que todo el mundo busca» quita lo que «ya tienes»,
  que también es la de ejemplo. Al abrir un disco aparece «Añadir a Mi Colección», que
  lo guarda en una estantería local que el visitante no puede ver: Colección le lleva
  a /entrar.
  Debería: con useIsVisitor, no sacar esas dos secciones ni quitar discos según la de
  ejemplo, y cambiar «Añadir» por «Entra para guardarlo».
  Dónde: components/ExploreView.tsx:121-137 (topGenre y ownedDiscogsIds), :582, :615,
  :628, :844.
- Sin sesión, el punto rojo de Actividad avisa de cosas que son de ejemplo.
  Pasos: :3345, cualquier pestaña.
  Qué pasa: «3 avisos sin ver» que son las notificaciones sembradas de ejemplo (una
  invitación de Marta, Teo te sigue…). Entrar en Actividad no las enseña ni apaga el
  punto. Su estado vacío ofrece «Ver mi colección» → /coleccion, que redirige a la
  landing, no a /entrar.
  Debería: un visitante no tiene avisos; el botón, o no sale, o lleva a /entrar.
  Dónde: lib/data/local.ts:889-891 (seedNotificationsOnce), components/app/TabBar.tsx
  (useUnreadCount sin mirar si es visitante), components/ActivityView.tsx:140.
MEJORA:
- Pestañas dobles: sin sesión, Colección y Perfil van a /entrar y siempre se ilumina
  Colección. Pulsas «Perfil» y la barra dice que estás en Colección; volver a pulsar
  Perfil no hace nada. TabBar.tsx:71.
- TabBar decide si eres visitante con `available && !user`, sin esperar a que cargue la
  sesión (useIsVisitor sí espera). En el arranque en frío de alguien con sesión,
  Colección apunta un momento a /entrar y no sale encendida. TabBar.tsx:37.
- «Poner música» antes de que llegue /api/jukebox (o si falla): suena la aguja y nada
  más. La píldora sigue diciendo «Poner música» y no avisa de nada; cada toque es otra
  aguja. dropNeedle → handOver con la cola vacía (SoundGate.tsx:216, 290-296). En local
  la lista llega en menos de 50 ms, así que aquí no se ve; con red móvil sí. Además
  /api/jukebox se pide 4 veces al cargar la landing.
- Zoom con pellizco (sacado del código; aquí no se puede pellizcar): el estante 3D
  ocupa toda la pantalla con touch-none (VinylShelf3D.tsx:861), y con cualquier hoja
  abierta el body pasa a touch-action:none (globals.css:608-611). Si alguien amplía en
  otra pantalla y vuelve a Colección o abre una ficha, no puede reducir con dos dedos
  salvo encima de la barra de arriba o de abajo. Y justo en la ficha, donde se lee, no
  se puede ampliar.
- Grises: se subieron los tokens, pero quedan grises fijos al 20-30 %. Medido en la
  landing a 360: «Gratis · Sin anuncios…», «Rackr Club» y «Hecho por gente…» en
  rgba(…, 0.25), unos 2:1 de contraste (Landing.tsx:310, 318, 321). Hay más en
  TopNav.tsx:128 y :137, SearchOverlay.tsx:211 y :236, SaveToList.tsx (6) y Select.tsx:123.
- Landing a 360: el logo fijo de arriba se pinta encima del texto al hacer scroll, y la
  píldora de música tapa las últimas líneas del pie.
- Ficha técnica: «Publicada 03 A». String(released).slice(0,4) corta «03 Apr 2026»
  (RecordSpecsCard.tsx:306). Viene de antes de F4.
- Explorar: en «En sus racks», la línea «en Mi Colección · Álvaro Rodv…» corta el nombre
  del dueño, que es justo lo que importa.
- «Cómo funciona» desde Ajustes: el último botón dice «Entra al club →» a alguien que ya
  está dentro. «Saltar» mide 51×26 px. El gesto atrás con la presentación abierta te
  saca de Ajustes (lo mismo que el fallo 3 de arriba).
```

## Comprobado y bien (F4)

- No hay ningún enlace en la app que lleve a /demo ni a /u/vera. Siguen abriéndose si
  escribes la dirección a mano.
- La landing móvil tiene «Instalar la app» + «Entrar» arriba, y al final «Entrar con
  Google, sin instalar» + «Mirar sin cuenta», con zonas de toque de 44 px.
- /instalar tiene entrar y mirar; según el código, en un webview y con la app
  instalada no salen.
- /entrar sin sesión: título, botón de Google y «Mirar sin cuenta» → /explorar.
  Con sesión redirige a /coleccion.
- La página de artista sin sesión ya no dice «tu colección» ni «3/19».
- «Poner música» con la lista cargada: tocar la píldora pone la canción y pasa a
  «Pausa».
- «Cómo funciona»: se abre en la primera pantalla. «Saltar» y «Entra al club» vuelven a
  Ajustes sin pasar por nombre y @. Pulsarlo dos veces seguidas no la abre dos veces.
- La barra de pestañas a 12 px cabe a 360 («Colección», «Actividad», «Explorar»,
  «Perfil»). En /, /instalar, /entrar, /explorar, /u/rackrclub y /artista/rosalia no hay
  texto por debajo de 12 px, salvo las iniciales de los avatares (9 px), ni scroll
  lateral.
- Zoom permitido: el viewport ya no lleva maximumScale ni userScalable.

Nota para quien haga el commit: con la sesión falsa, añadir un disco escribe en
`data/vinilos.json` y `public/covers/`, porque la API de release escribe en el repo.
Ahora mismo están limpios, pero conviene mirarlo antes de cada commit.

DICE: En el navegador de Instagram, la puerta nueva solo ofrece Google, y Google ahí no abre.

---

# F4 «La puerta» — re-prueba tras los arreglos de frontend

Probado a 360×740: `:3345` sin sesión y `:3346` con sesión falsa. Google no se ha
pulsado. El webview se simuló poniendo `html[data-in-app]` y `data-no-install`.

```
VEREDICTO: BLOQUEADO
BLOQUEA:
- Sin sesión, buscar en Explorar y pulsar el «+» de un resultado guarda de verdad y lo
  celebra.
  Pasos: :3345/explorar → buscar «radiohead» → «+» de Kid A.
  Qué pasa: sale el aviso «Kid A · guardado». Se escribe en el localStorage (la
  estantería de ejemplo, que el visitante no ve) y se hace POST /api/discogs/release.
  En local, ese POST escribió data/vinilos.json y public/covers/radiohead-kid-a-….jpg
  en el repo (ya revertido). No lleva a /entrar.
  Debería: lo mismo que «Entra para guardarlo» en las fichas, o sea ir a /entrar sin
  llamar a nada.
  Dónde: components/ExploreView.tsx:183-195 (saveRow sin comprobar si es visitante) y
  el botón de :768-772. saveWanted (:150) tampoco lo comprueba, pero hoy solo se llega
  a él desde la ficha, que sí está protegida.
- /entrar dentro de Instagram/WhatsApp sigue siendo un callejón sin salida, y ahora es
  a donde llevan TODAS las escrituras sin sesión.
  Pasos: :3345/entrar con html[data-in-app].
  Qué pasa: solo «Entrar con Google» (que Google rechaza en un webview) y «Mirar sin
  cuenta». La landing ya dice «Ábrelo en Safari o Chrome…»; /entrar, no. El visitante de
  Instagram que pulsa Seguir, Guardar o Me gusta acaba aquí.
  Debería: el mismo aviso de webview que la landing (.door-webview, o .hide-in-app en el
  botón de Google).
  Dónde: components/landing/AppDoor.tsx (lo usa app/(app)/entrar/page.tsx).
MEJORA:
- Al volver de /entrar no vuelves a lo que querías guardar: /entrar no recuerda de dónde
  venías (no hay ?next=). Pulsas «Entra para guardarlo» en un disco, entras y apareces
  en tu colección, sin el disco.
- «Cambiar la portada» aparece en el ⋮ de un disco de un rack ajeno, con sesión o sin
  ella. Se abre el selector y elegir una no hace nada, porque onChangeCover no llega
  hasta ahí (RecordSheet.tsx:662).
- En las páginas de rack (/u/…/<rack>), la ficha del disco se abre debajo de la barra
  de pestañas: elementFromPoint(180,720) da la barra. No sé si viene de antes.
- Pestañas: con «atrás» de /entrar?desde=perfil a /entrar?desde=perfil, la luz se queda
  en Colección. El pathname no cambia y el efecto no se vuelve a ejecutar
  (TabBar.tsx:61-65). Es un detalle.
- Zoom en el estante: ahora es touch-pinch-zoom (bien, se puede pellizcar). Pero con la
  página ampliada no se puede desplazar encima del estante: el arrastre lo usa el
  estante. Solo se mueve por la barra de arriba o la de abajo. Aceptable.
- Seguir con la sesión falsa: sale «Sigues a Rackr Club», pero al recargar no lo
  sigues. Es cosa del entorno: la sesión falsa escribe en local y lee los perfiles
  reales de Supabase. Seguir, me gusta y guardar sobre datos reales solo se pueden dar
  por buenos con una sesión real.
```

## Comprobado y arreglado

- **Webview, landing:** con data-in-app desaparecen las puertas de Google y salen «Ábrelo
  en Safari o Chrome…» + «Mirar sin cuenta», arriba y al final.
- **Explorar sin sesión:** no queda ningún «tú» ni «tu». Los títulos son «En sus racks»,
  «Gente para empezar» y «Lo que todo el mundo busca», sin «Sin lo que ya tienes».
  El género de «tu estantería» no sale. En la ficha pone «Entra para guardarlo», que
  lleva a /entrar sin escribir nada (localStorage idéntico antes y después).
- **Actividad sin sesión:** el punto rojo no aparece. La pantalla dice «Aquí se ve lo que
  mueve tu gente» con «Entrar» → /entrar y «Buscar gente».
- **Escrituras sin sesión que llevan a /entrar sin escribir** (comprobado comparando el
  localStorage): Seguir (perfil), Me gusta y Guardar (rack), «Entra para guardarlo»
  (ficha del disco en un rack y en Explorar). Doble toque en Seguir: una sola ida a
  /entrar.
- **Pestañas:** Perfil → /entrar?desde=perfil enciende Perfil; Colección → /entrar
  enciende Colección. Mientras carga la sesión ya no se considera visitante a nadie.
- **Música** (revisado en el código): si se pulsa antes de que llegue la lista, la
  píldora dice «Un momento…» y empieza a sonar en cuanto llega. Sin lista dice «Sin
  música ahora». La lista se pide una sola vez.
- **Grises en móvil:** el pie de la landing pasa a 0.50. Los que quedan al 20-30 % son
  de componentes de escritorio (CollectionsOverlay, SearchOverlay, TopNav, SaveToList).
- **Hojas:** el body pasa a touch-action: pinch-zoom, así que en una ficha se puede
  ampliar.
- **«Publicada»** ahora sale entera («6 feb 2026»).
- **Con sesión (:3346):** Me gusta y Guardar rack funcionan («Guardada en tu
  colección») y se deshacen. Añadir desde la búsqueda de Explorar: «The Bends ·
  guardado», y se borra bien con el aviso de deshacer.

## git status

`data/vinilos.json` y `public/covers/` quedan limpios. Mis dos pruebas de añadir
(Kid A sin sesión y The Bends con sesión) los escribieron, y las he revertido a mano.
Ojo: cualquier «Guardar» en local los vuelve a ensuciar (`/api/discogs/release` escribe
en disco cuando no está en Vercel).

DICE: El «+» de la búsqueda de Explorar deja guardar a quien no tiene cuenta, y le dice que ha ido bien.

---

# F4 «La puerta» — 3.ª vuelta

Probado a 360×740: `:3345` sin sesión y `:3346` con sesión falsa. Google no se ha
pulsado. Las peticiones de escritura se vigilaron envolviendo `fetch` y comparando el
localStorage antes y después.

```
VEREDICTO: BLOQUEADO
BLOQUEA:
- Redirección abierta en /entrar?next= con sesión.
  Pasos: con sesión, abrir /entrar?next=/%5Cevil.com (o /entrar?next=/%09/evil.com).
  Qué pasa: el servidor responde 307 con «Location: /\evil.com» (o «/<tab>/evil.com»).
  El navegador lo resuelve como //evil.com: new URL('/\\evil.com', origen) da
  http://evil.com/. Te saca de la web. Con //evil.com y https://evil.com sí se queda en
  /coleccion.
  Debería: aceptar solo rutas que, resueltas contra el origen, sigan en el mismo origen
  (como ya hace app/auth/callback/route.ts:19-20), o rechazar «\» y caracteres de control.
  Dónde: app/(app)/entrar/page.tsx:25. La misma comprobación está en
  hooks/useSession.ts:92 (signInWithGoogle) y :179 (nextFromEntry); allí el callback la
  vuelve a filtrar, pero conviene una sola función segura.
MEJORA:
- Con el enlace directo a /demo, guardar lleva a /entrar?next=%2Fdemo. Al entrar, la
  persona acaba en la estantería de ejemplo, que se llama «Mi Colección». Mejor no
  aceptar /demo como next, o retirar /demo.
- Escáner sin sesión (solo desde /demo): se abre, pide la cámara y deja escanear.
  Al pulsar «Añadir N», manda a /entrar y se pierde todo lo escaneado. Mejor cerrar el
  paso al abrir el escáner, no al final.
- useEntryGate deja pasar mientras carga la sesión (useIsVisitor es false durante la
  carga). Un «+» muy rápido en un arranque en frío escribiría como si hubiera sesión.
  La ventana es corta; no lo he reproducido.
- next=/explorar no guarda lo que habías buscado (se pierde ?q): al volver no está tu
  búsqueda.
- Entorno: con el panel del navegador oculto, PageFade no recibe su
  requestAnimationFrame y la página se queda con opacity 0 + blur. Es lo que explica
  las capturas borrosas de vueltas anteriores, no un fallo de producto (en un móvil
  visible el rAF llega).
```

## Arreglado y comprobado

- **«+» de la búsqueda de Explorar sin sesión** → `/entrar?next=%2Fexplorar`. No hay
  POST a /api/discogs/release, no hay aviso de «guardado» y el localStorage queda igual
  (solo se refresca la caché `rackr.snapshot`, sin Kid A). Doble toque: una sola ida.
- **/entrar con data-in-app**: «Para entrar, ábrelo en Safari o Chrome…» + «Mirar sin
  cuenta», sin botón de Google. Sin data-in-app: «Entrar con Google» + «Mirar sin
  cuenta».
- **El portero, sin sesión, en todas las escrituras:**
  - Búsqueda del estante (/demo): «Añadir … a Mi Colección» → /entrar, sin POST.
  - Escáner con «Escribir el código»: «Añadir 1 a Mi Colección» con doble toque →
    /entrar, sin POST.
  - Artista: «Entra para guardarlo» y «Añadir a la lista de deseos» →
    /entrar?next=%2Fartista%2Frosalia. «Lo que te falta» no sale al visitante.
  - WantedRail: no tiene «+» rápido; la ficha dice «Entra para guardarlo».
  - El ⋮ con «Cambiar la portada» ya no sale en discos ajenos.
- **/entrar?next con sesión**: //evil.com y https://evil.com → /coleccion; /explorar →
  /explorar. Pero mira el bloqueo de arriba.
- **Atrás y adelante entre /entrar?desde=perfil y /entrar**: la pestaña encendida sigue
  la dirección (Perfil ↔ Colección).
- **Ficha del disco en un rack**: con `.page-fade[data-arrived]` el filtro queda en
  `none` y la ficha (z-60) está por encima de la barra
  (`elementFromPoint(180,720)` = ficha).
- **Música**: «Poner música» → Pausa/Siguiente; un doble toque no la vuelve a parar.
- **Con sesión (:3346), sigue igual que antes:**
  - Explorar: «The Bends · guardado».
  - Buscador del estante: «Kid A → Domingos largos», y el contador sube de 6 a 7.
  - Rack: Me gusta / Quitar me gusta y Guardar / Guardada van y vuelven.
  - Lo he borrado todo después.

## git status

Las pruebas con sesión volvieron a escribir `data/vinilos.json` y dos portadas en
`public/covers/`. Revertido; ahora están limpios.

DICE: /entrar?next=/\evil.com te saca de Rackr: dos barras se filtran, una barra invertida no.

---

# F4 — re-prueba del `next` de /entrar (con sesión, :3346)

```
VEREDICTO: APROBADO
Location de /entrar?next=… (curl):
  /%5Cevil.com            → /coleccion
  /%09/evil.com           → /coleccion
  /%0A/evil.com           → /coleccion
  /%5C%5Cevil.com         → /coleccion
  %5C%5Cevil.com          → /coleccion
  //evil.com              → /coleccion
  https://evil.com        → /coleccion
  javascript:alert(1)     → /coleccion
  http://rackr.invalid@evil.com/ → /coleccion
  evil.com                → /evil.com (ruta interna, no sale)
  /u/rackrclub?x=1#y      → /u/rackrclub?x=1#y
Las cuatro entradas usan safeNext: el callback de auth, /entrar, signInWithGoogle y
nextFromEntry. El callback de auth no lo he probado con curl (necesita un código real
de Google).
useEntryGate no deja pasar mientras carga la sesión (si loading, devuelve true sin
navegar). Leído en el código, no reproducido.
MEJORA (menor): un toque mientras carga la sesión se descarta sin avisar. Es aceptable.
```

data/ y public/covers no se han tocado en esta prueba.

DICE: Once maneras de escaparse por el next, y todas acaban en /coleccion. Este sí aguanta.
