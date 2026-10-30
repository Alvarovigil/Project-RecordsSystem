# F4 · La puerta — dirección de arte (Bowerbird)

Revisado en local: 3345 sin sesión (landing, /entrar, /explorar, /u/rackrclub) y 3346 con sesión (/coleccion, disco, Actividad, Ajustes), a 375 y en escritorio. Diff: `git diff main` en feat/la-puerta.

Las cuatro preguntas:
- **Mayúsculas a 12 px.** Las sans con `--track-label` (0.18em) aguantan: Ajustes y Explorar siguen leyéndose como etiqueta. Las **mono de la landing** con 0.20–0.24em no aguantan. A 12 px gritan, y el kicker «Del código de barras a tu estantería» se parte en dos líneas a 375. El tracking tiene que bajar al subir el cuerpo.
- **Jerarquía.** Secundario .62 (7,1:1), apagado .55 (5,7:1) y tenue .48 (4,6:1) quedan a 7 puntos de alfa entre sí. Al mismo cuerpo, peso y tamaño, apagado y tenue son el mismo gris. Se nota justo en la línea que hace de puente («en Rack · persona»), que es el producto.
- **Las dos píldoras de la landing** no compiten: relleno contra contorno, una sola decisión primaria. Bien resuelto.
- **Píldora de música y /entrar** sí parecen del mismo producto. /entrar habla con la voz de la app: caja, icono rojo y píldora papel. La píldora de música sigue el registro de la landing.

Contraste calculado sobre #0a0a0a: /25 = 2,0:1 · /30 = 2,5:1 · /48 = 4,6:1 · /50 = 4,9:1 · /55 = 5,7:1 · /62 = 7,1:1.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla, tamaño, captura propia frente a referencia, y cómo debería quedar):
- Landing, cierre y pie, 375. En las líneas que este diff ya toca para subirlas a 12 px se queda el gris /25 (2,0:1), en texto que importa:
    · components/Landing.tsx:310 «Gratis · Sin anuncios · Cancela cuando quieras…» → text-paper/50 tracking-[0.12em] (deja de partirse en 3 líneas).
    · components/Landing.tsx:318 y :321 (pie) → text-paper/50 tracking-[0.12em]. Además text-center en el contenedor flex-col del pie: «Hecho por gente con demasiados discos» se parte alineado a la izquierda bajo un «Rackr Club» centrado.
    · El pie queda debajo de la píldora de música. En móvil, al <footer> le hace falta pb-[calc(var(--safe-bottom)+88px)] (24 de margen + 44 de píldora + 20 de aire).
- El puente aplanado (Explorar, «En sus racks», 375). En components/explore/FromOthersRail.tsx:119 el artista va en text-content-muted (.55) y en :123 la línea «en Rack · persona» va en text-content-faint (.48). Los dos tienen 12 px y peso 400, así que se leen como un solo gris. Arreglo: el artista a text-content-secondary (.62, 7,1:1), y la línea del rack se queda en faint. La jerarquía vuelve por distancia real de gris (7,1 frente a 4,6) sin bajar del AA.
    Mismo caso en Ajustes: la etiqueta de grupo (app/(app)/ajustes/page.tsx:145, caption + uppercase + muted) y el subtítulo de fila (caption + muted) salen al mismo tamaño y en el mismo gris; solo los distingue la caja. Arreglo: la etiqueta a text-content-faint, para que nombre la región y quede por detrás, y el subtítulo se queda en muted.
- Las etiquetas mono de la landing a 12 px. Con el tracking pensado para 10 px pesan el doble y se parten. Arreglo: el tracking baja con el cuerpo.
    · components/Landing.tsx:150, :182 y :200 (tracking-[0.24em] / [0.2em]) → tracking-[0.14em].
    · components/Landing.tsx:237 (kicker, [0.18em]) y :278 ([0.16em]) → tracking-[0.1em]. Así el kicker cabe en una línea a 375.
    · components/landing/AboutProject.tsx:74 ([0.24em]) → tracking-[0.14em].
    Regla para el sistema: la mono en mayúsculas a 12 px lleva 0.10–0.14em como máximo. --track-label (0.18em) queda solo para la sans.

MEJORA:
- Píldora «Poner música» (components/landing/SoundGate.tsx:442). Mientras no suena nada se queda abierta y ocupa 198×44 en mayúsculas sobre el texto corrido de toda la landing en el móvil. En la captura tapa «Formato, s…» en La prensa. Antes de F4, pasada la puerta, se quedaba plegada. Propuesta: que esté abierta solo arriba del todo (open = announced || peeking || (!current && atTop)) y plegada en el icono con su aria-label a partir del primer scroll. Si se quiere abierta siempre, el fondo tiene que tapar: bg-ink/55 → bg-[rgb(var(--ink-rgb)/0.8)].
- Registro de los botones de la landing. Arriba son mayúsculas de 13 px con tracking («INSTALAR LA APP» / «ENTRAR»). En el cierre son caja normal de 15 px con icono («Instalar la app» / «Entrar con Google, sin instalar»). Encima, el titular gigante también va en mayúsculas, junto con «Sobre el proyecto» y «Poner música»: son cuatro bloques en mayúsculas apilados en el primer pantallazo. Propuesta para F6/F8: las acciones van siempre en caja normal (como en /entrar y en la app) y las mayúsculas se quedan para las etiquetas.
- Contorno de «Entrar» sobre las portadas: border-paper/40 se pierde encima de una funda clara. Usar border-paper/60, o un fondo bg-[rgb(var(--ink-rgb)/0.4)] con desenfoque como la píldora de música.
- /entrar y Perfil sin sesión: la barra marca «Colección» como activa y Actividad lleva el punto rojo. El rojo es «vivo o sin leer», y para un visitante no hay nada sin leer. Se lo paso a ux-ui; en la marca, el acento pierde valor si aparece para nadie.
- Grises que siguen por debajo del AA y que este diff no toca (para F8):
    · Información: components/SaveToList.tsx:84 y :86 (contadores /30), components/CollectionsOverlay.tsx:983 (/20), components/SearchOverlay.tsx:236 (atajos /25), y los placeholders de components/SearchOverlay.tsx:211, components/SaveToList.tsx:105 y components/CollectionsOverlay.tsx:403 (/25–/30) → a text-content-faint.
    · Decorativo, puede quedarse bajo con aria-hidden: separadores «·» y flechas «→» (components/CommunityBridge.tsx:165, :173 y :569). Mejor con un token propio, --text-decor: rgb(var(--paper-rgb) / 0.28), que diga «esto no se lee», en vez de alfas sueltas.
- Tokens. --t-micro y --t-caption valen ahora los dos 12 px, así que en la práctica son uno. Hay que decirlo en globals.css (micro = alias de caption) y retirar micro en F8; dos nombres para un mismo valor invitan a pensar que hay dos niveles.
    Con eso la escala de grises queda en dos pasos de verdad: secondary para la segunda línea y faint para la tercera. Muted (.55) queda entre las dos sin diferenciarse de ninguna; en F8, o se funde con faint o pasa a .58 y faint a .48, y en cada componente la jerarquía se marca con secondary frente a faint, no con muted frente a faint.
- components/ExploreView.tsx:451 «text-content-faint/70»: en Tailwind 3 la opacidad sobre var() no se genera. Pasa lo mismo que con los fondos que no se pintan; conviene comprobarlo.
- components/ui/Avatar.tsx:74 deja las iniciales en Math.max(9, …), y a 9 px salen en las caras pequeñas de Explorar. Son gráfico, no texto, porque el nombre va al lado, así que no bloquea; pero si se quiere coherencia con la regla, Math.max(12, …) o sin iniciales por debajo de 28 px.

«No pasan» (sobre el diff):
- Tipografías vetadas: 0 coincidencias.
- italic / <em> en líneas añadidas: 0.
- Fondos crema añadidos: 0.
- uppercase con tracking en líneas añadidas: 82. Es el registro de etiqueta que ya existía (--track-label, «reservado para etiquetas que nombran una región»), redimensionado, no inventado. Se justifica por el sistema, salvo la mono de la landing (ver BLOQUEA 3).
```

DICE: La puerta está bien dibujada; lo que falta es que el gris vuelva a separar el disco del rack donde vive.

---

# Re-revisión tras los arreglos de frontend

Revisado otra vez en local a 375: la landing de arriba abajo (también con `data-in-app` forzado, para ver la WebviewDoor), Explorar sin sesión y el código de Ajustes.

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

Comprobado:
- Pie y cierre: Landing.tsx en text-paper/50 (4,9:1) con tracking 0.12em y centrado. El pie queda por encima de la píldora gracias a pb-[calc(var(--safe-bottom)+88px)].
- El puente: FromOthersRail tiene el artista en .62 (7,1:1) y la línea del rack en .48 (4,6:1). El escalón se ve en la captura.
- Ajustes: la etiqueta de grupo pasa a content-faint y queda por detrás del subtítulo de fila.
- Mono de la landing: con 0.14em ya no grita.
- Píldora de música: abierta arriba y plegada en el icono tras 24 px de scroll, con fondo ink/0.8 que sí tapa.
- Botones: «Instalar la app» y «Entrar» van en caja normal a 15 px; «Entrar» con borde paper/60. Las acciones de la landing hablan ya como /entrar y como la app.
- La banda de tinta bajo el logo fijo funde bien el texto que pasa por debajo.
- WebviewDoor: una frase en paper/80 y «Mirar sin cuenta» en píldora papel. Es la misma familia que /entrar y que el cierre, sin un registro nuevo.

MEJORA:
- Landing.tsx:237: el kicker «Del código de barras a tu estantería» sigue partiéndose en dos líneas a 375, aun con 0.1em. Ahora el corte cuelga alineado bajo el texto y no rompe; si se quiere en una sola línea, la vía es el copy («Del código a tu estantería») o gap-3 en lugar de gap-4, no bajar más el tracking.
- WebviewDoor: la frase de 14 px va sobre la estantería. Cuando cargan portadas claras detrás, conviene asegurarla con un fondo bg-[rgb(var(--ink-rgb)/0.6)] y desenfoque, como la píldora, o con text-shadow.
- Sigue en pie para F8 lo que no tocaba esta fase: los grises /20–/30 de SaveToList, CollectionsOverlay y SearchOverlay; --t-micro como alias de --t-caption; las iniciales a 9 px de Avatar.tsx:74. El punto rojo de Actividad para el visitante es de ux-ui.
```

DICE: Ahora el gris vuelve a separar disco y rack, y la puerta habla igual en la landing, en /entrar y dentro de Instagram.

---

# Tercera vuelta (confirmación)

```
VEREDICTO: APROBADO
Comprobado a 375:
- El kicker «Del código a tu estantería» cabe en una línea (18 px de alto).
- WebviewDoor en la landing con html[data-in-app]: la frase va en una placa ink/0.6 con desenfoque y se lee sobre las portadas; «Mirar sin cuenta» va en píldora papel.
- /entrar con data-in-app: la frase de Safari/Chrome sustituye al botón de Google y Actividad ya no lleva el punto rojo.
- La transición de página termina en filter:none: ni el h1 ni sus ancestros conservan filtro ni opacidad.
- «Entrar gratis» (escritorio, 14 px) y «Entrar» van en caja normal.
MEJORA:
- En /entrar dentro de una app, «Mirar sin cuenta» es la única acción y va como enlace de texto, mientras que en la landing es una píldora papel. Mejor el mismo tratamiento en las dos (píldora).
- El botón de la esquina de escritorio (SignInButton.tsx:20) sigue en mayúsculas a 12 px. Se acepta como parte del registro de la barra de cabecera, junto a «Your records. Your people.».
```

DICE: La puerta queda limpia: una frase, un botón y la misma voz desde Instagram hasta /entrar.
