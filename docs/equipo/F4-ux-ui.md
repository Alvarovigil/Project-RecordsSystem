# F4 «La puerta»: revisión de UX/UI en móvil (Hummingbird, 30 oct 2026)

## Tercera vuelta: confirmación

```
VEREDICTO: APROBADO

- /instalar (375): primero los pasos (333 y 442 px, dentro de la primera pantalla), después las
  salidas (782 y 826 px) y la maqueta al final (961 px). Sin scroll horizontal.
- Cómo funciona, abierto desde Ajustes: arriba hay «Cerrar» (63×44), no «Saltar». En la última
  pantalla solo queda «Listo».
- /entrar: «Entra y empieza tu colección», «Entrar con Google» y «Mirar sin cuenta», los dos de
  319×48. Desde la ficha de un disco sin sesión, «Entra para guardarlo» lleva a
  /entrar?next=/u/rackrclub/jazz-sin-hacer-un-master.
- Perfil con sesión: la pestaña enlaza a /u/vera.
- Ficha del disco en un rack: queda por encima de la barra de pestañas (z 60 sobre 50). Lo que se
  toca en la franja de la barra cae en la ficha y no en la barra, y «Entra para guardarlo» se
  puede pulsar.

MEJORA (no bloquea):
- /entrar con ?next: «Mirar sin cuenta» sigue llevando a /explorar. Si vienes de un rack, sería
  más natural «Seguir mirando», de vuelta a `next`.
- Para el revisor de código: el filtro de `next` (empieza por "/" y no por "//") deja pasar
  "/\evil.com", que algunos navegadores leen como "//". Rechazar también la barra invertida.
```

DICE: Puerta cerrada y bien rotulada: entras, vuelves a donde estabas y nada te miente.

---

## Segunda revisión, tras los arreglos de frontend

Misma rama y mismos servidores, a 375×812 y 360×740.

```
VEREDICTO: APROBADO

Los dos bloqueos:
- Explorar sin sesión: resuelto. Los títulos son «En sus racks», «Cajones que vale la pena abrir»,
  «Gente para empezar» y «Lo que todo el mundo busca», sin «Sin lo que ya tienes». La sección
  «Tu estantería tira a…» ya no sale. El único «tu» que queda es «Colecciones para mirar antes
  de tener la tuya», que está bien. Con sesión, los cinco títulos de antes siguen igual.
- Seguir y Guardar sin sesión: resuelto.
  - Por código: FollowButton, SaveListButton, ListMetrics, CatalogueSheet y RecordSheet llevan a
    /entrar con useIsVisitor(), y el visitante nunca ve «Siguiendo», «Guardada» ni el corazón
    lleno.
  - En pantalla: la hoja del disco sin sesión dice «Entra para guardarlo» (219×48).
  - No pulsé «Seguir» en 3345 porque allí no se escribe. Con sesión (3346), «Seguir a Albert
    Trueta» sigue funcionando: sale el aviso «Sigues a…» y pasa a «Dejar de seguir».

Las mejoras:
- Actividad sin sesión: hecho. Dice «Aquí se ve lo que mueve tu gente / Cuando entres…», con
  «Entrar» (→ /entrar, 44 px) y «Buscar gente». Sin punto rojo.
- Pestaña Perfil sin sesión: hecho. Lleva a /entrar?desde=perfil y se enciende «Perfil», no
  «Colección».
- Píldora de música: hecho. Es un <button> con aria-label «Poner música» (175×44). Después del
  scroll se pliega a 77×44, con fondo ink/0.8 y desenfoque.
- /instalar: hecho. Primero los pasos (902 y 1011 px) y después las salidas (1350 y 1394 px),
  centradas.
- Cómo funciona: hecho. «Saltar» mide 59×44, los puntos 44×44, y en la última pantalla el botón
  dice «Listo» y cierra de vuelta a Ajustes.
- Cifras del perfil a 360: hecho. Quedan dos filas de dos, sin cifra suelta y sin scroll
  horizontal.
- Título de Ajustes: «Ajustes · Rackr Club».

Con sesión todo sigue igual: pestañas a /coleccion y /u/vera, la hoja del disco con «En 1 rack» y
«Compartir», y Explorar con sus secciones personales.

MEJORA (no bloquea):
- /instalar: los pasos siguen empezando a 902 px, debajo del pliegue y después de la maqueta.
  Entre el texto «dos pasos» y los pasos hay una pantalla de teléfono. Si molesta, la maqueta va
  detrás de los pasos.
- Cómo funciona: en la última pantalla se ven a la vez «Saltar» y «Listo». Ocultar «Saltar» ahí.
- Los textos a /25 y /30 de la lista anterior (pie de la landing, Select, contadores, overlay de
  escritorio) siguen pendientes. Encajan en F7.
```

DICE: La puerta abre y no miente; quien llega por un enlace ya sabe dónde está y cómo entrar.

---

## Primera revisión

Rama `feat/la-puerta`, sin commitear. La he recorrido a 375×812 y a 360×740: sin sesión en `localhost:3345` (solo lectura) y con sesión falsa en `localhost:3346`. Las medidas salen del DOM: tamaño de toque, cuerpo de letra, contraste calculado sobre el fondo real y textos cortados o partidos.

```
VEREDICTO: BLOQUEADO

BLOQUEA:
- Explorar sin sesión (/explorar, 375 y 360). Siguen tres textos que le hablan a un «tú» que no
  existe: «Coleccionan como tú», «Lo que todo el mundo busca · Sin lo que ya tienes» y la sección
  entera «Tu estantería tira a rock · Lo más perseguido del género, sin lo que ya tienes». Salen
  de la colección de ejemplo local, igual que el «Lo tienen ellos, tú no» que ya se arregló. Es la
  mentira que el punto 4 de la fase dice cerrar.
  Arreglo mínimo: con useIsVisitor(), se oculta la sección «Tu estantería tira a…»,
  «Coleccionan como tú» pasa a «Gente para empezar» y se quita «Sin lo que ya tienes».

- Seguir y Guardar sin sesión (perfil, tarjetas de Explorar, rack ajeno, hoja del disco). Lo he
  visto en el código, no pulsándolo, porque en 3345 no se escribe nada. El repositorio de
  visitante hereda de `local` todas las escrituras (createVisitorRepository: `...local`). El
  visitante que llega por un enlace y toca «Seguir» recibe «Sigues a Rackr Club», pero
  `relationship()` siempre devuelve following:false para un id real, así que el botón vuelve a
  «Seguir». «Guardar» un disco lo mete en la colección de ejemplo. Es justo el primer gesto de
  quien cruza la puerta, y le mentimos.
  Arreglo mínimo: en FollowButton, en SaveListButton y en el «Guardar» de la hoja del disco, si
  useIsVisitor() es cierto, router.push("/entrar") en vez de escribir. Opcional: «Entra para
  seguir a Rackr Club» como subtítulo de /entrar.

MEJORA:
- Pestaña «Actividad» sin sesión: sigue enseñando «Sigue a alguien o guarda un rack…» con «Ver
  mi colección», que lleva a /coleccion y de ahí te devuelve a la landing. El punto rojo sale
  siempre. Debería llevar a /entrar como Colección y Perfil, o enseñar el mismo bloque que
  /entrar, y sin punto.
- Barra de pestañas sin sesión: al tocar «Perfil» se ilumina «Colección», porque las dos van a
  /entrar y el código solo enciende la primera. Mejor que se encienda la que has tocado (pasar
  ?desde=perfil) o que no se encienda ninguna.
- Píldora «Poner música» de la landing: la píldora entera (198×44) es un <div> con onClick, sin
  role ni tabindex. Dentro hay dos botones de 13×13. Con teclado o lector de pantalla solo existen
  los de 13 px. Hacer un <button> de la píldora y que los dos de dentro sean iconos.
- /instalar en el móvil: el texto promete «dos pasos», pero los pasos empiezan a 1.006 px, debajo
  del pliegue y de la maqueta del teléfono. Encima quedan «Entrar con Google, sin instalar» y
  «Mirar sin cuenta», así que la página parece de entrar, no de instalar. Pasar las dos salidas
  debajo de los pasos, o poner los pasos antes que la maqueta. «Mirar sin cuenta» va alineado a
  la izquierda y «Entrar con Google» centrado; mejor los dos centrados.
- Landing: el hero «Entrar» va directo a Google sin pasar por /entrar. Para alguien mayor funciona
  (un toque y Google). Que /entrar exista y el hero no lo use es una incoherencia aceptable.
- Textos reales que siguen en /20, /25 o /30 (por debajo de AA). Los demás de esos grises son
  separadores y están bien:
  - Landing.tsx:310, 318 y 321: «Gratis · Sin anuncios · …», «Rackr Club», «Hecho por gente…»
    a /25 (≈2:1).
  - Select.tsx:123: pistas de las opciones a /25.
  - SaveToList.tsx:86: contador a /30.
  - CommunityBridge.tsx:643: contador a /30.
  - CollectionsOverlay.tsx: año (944) a /25; «/ n» (983) a /20; etiquetas mono (552, 880, 980)
    a /25 y /30.
  - Placeholders a /30 (SearchOverlay:211, SaveToList:105 y 131, CollectionsOverlay:630).
  - Screens.tsx:242 y 251: los números de la maqueta de la landing.
  Todos a /50, o con el token content-faint.
- Diapositivas («Cómo funciona», desde Ajustes): «Saltar» mide 51×26 y los puntos 18×18. Llevarlo
  a 44 px de zona táctil.
- Perfil a 360 px: las cifras se parten en dos líneas y «0 siguiendo» queda sola debajo. Con
  gap-x-4 o 13 px caben en una.
- /ajustes tiene como título el genérico «Rackr Club — Your records…»; mejor «Ajustes · Rackr
  Club».
- Para QA, no es de F4: sin sesión, la consola lanza «Error: Sin sesión» sin capturar desde
  useLibrary → supabase.listReleases (requireUser), en el rack y en el perfil.
```

## Lo que funciona

- **La puerta en el móvil está resuelta.**
  - Primer pantallazo: «INSTALAR LA APP» (166×44) y «ENTRAR» (100×44), lado a lado, sin pantalla de sonido delante.
  - Al final de la landing: «Entrar con Google, sin instalar» (248×44) y «Mirar sin cuenta» (123×44).
  - `/instalar` ya tiene salidas.
  - `/entrar` es clara para alguien mayor: icono, «Entra para empezar», una frase, un botón de 319×48 y una alternativa del mismo tamaño.
- **Sin sesión, Colección y Perfil llevan a `/entrar`**; ya no hay «Vera» ni «Mi Colección 42».
- **La página de artista sin sesión** dice «Discos de Rosalía · Del catálogo» y ya no dice «en tu colección».
- **Zoom permitido:** `width=device-width, initial-scale=1, viewport-fit=cover`.
- **El paso a 12 px no rompe nada a 360 ni a 375.**
  - Barra de pestañas: «Actividad» a 12 px cabe en 90 px.
  - Pestañas del perfil: la suma es 313 de 360.
  - Píldoras del buscador, cabecera de la colección, hoja de la ficha del rack (etiquetas en versalitas «DISCOS», «LO ÚLTIMO», «SU DÉCADA») y diapositivas: nada cortado sin «…», ninguna versalita partida, nada solapado y sin scroll horizontal (`scrollWidth` 360).
  - Lo que se trunca con «…» (títulos largos en tarjetas de 142 px) está hecho a propósito.
- **Contraste:** en el buscador, la colección y la ficha del rack no queda ningún texto por debajo de 4,5:1. «Cambiar» pasó de 2,12:1 a AA.
- **Jerarquía:** con los grises más claros se sigue leyendo bien. Las etiquetas en versalitas grises quedan por debajo de los valores en blanco y los subtítulos por debajo de los títulos. Lo que distingue un nivel de otro es el cuerpo y el peso, no solo el gris, así que subir el gris no la aplana.

DICE: La puerta ya abre; ahora que nadie te diga «sigues a» o «tu estantería» sin haber entrado.
