# F5 · Revisión UX/UI (Hummingbird, 6 nov 2026)

Base: cambios sin commitear sobre 163b719. Referencia: `docs/equipo/F5-ux-ui.md` (12 P1).
Cómo se ha probado: servidor propio en :3355 con sesión falsa y Playwright con Chromium táctil a 360×740, 375×812, 390×844 y 768×1024, más 1440×900 con ratón. Letra al 130 %. Con y sin WebGL (swiftshader). Catálogo, importación y código de barras simulados con `page.route`; los fallos de guardado se fuerzan haciendo que `localStorage.setItem` lance un error. Carga grabada con red lenta y CPU ×4. Las capturas están en el scratchpad de la sesión (`shots/`).

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- Buscador (MobileSearch), a 360, 375 y 390. Capturas: s9-u2-typed, s10. Al escribir «u2» sale «Nada para «u2»» con «Prueba con menos palabras…», sin haber preguntado al catálogo, porque con menos de 3 letras no se busca. Con «tusk» pasa lo mismo durante la espera de 550 ms: «Nada para «tusk»» sale a los 50 y a los 250 ms, antes de que salga la petición. Es la misma mentira que tenía «Deshacer»: quien busca U2 cree que no está. Cómo debería quedar: `nothing` solo cuando la frase se ha preguntado de verdad y ha vuelto vacía. Hace falta que el hook exponga «pendiente» (en la espera o sin preguntar) y que `loading` cubra la espera. Con menos de 3 letras, en vez del estado vacío, una línea en `text-sub`: «Pulsa Buscar en el teclado para buscar «u2»», o una fila «Buscar «u2»» que llame a `searchNow()`.
- El aviso (Toast) con la letra al 130 %, a 360. Capturas: s8-toast130, s8-error130. El mensaje sigue en `text-[14px]` y no crece, pero «Deshacer» y «Reintentar» sí crecen y le quitan sitio. Queda «Añadido a Mi Co…» y, lo grave, «No se ha guard…». El arreglo del P1 n.º 4 se queda sin frase justo para quien agranda la letra. Con «X fuera de tu colección» no se llega a saber qué disco era. Cómo debería quedar: el mensaje con `text-sub` (token en rem) y, en el teléfono, `line-clamp-2` en vez de `truncate`. Cuando ocupe dos líneas, la cápsula pasa de `rounded-full` a un radio de unos 22 px. El botón no cambia.
MEJORA:
- Aviso en las capas a pantalla completa. Se pinta a `tabbar-h + player-h + 12` también en el buscador y en el escáner, donde no hay barra. En el buscador deja 66 px de vacío debajo. En el escáner cae encima del campo «Teclea el código» y de su «Buscar» (s8-scan130). Era lo que pedía la auditoría: `safe-bottom + 12` en esas capas.
- Aviso al añadir desde el buscador: dice «Añadido a Mi Colección» con un ✓ y sin la portada. No dice qué disco. Que sea «Tusk añadido a Mi Colección», o que lleve la miniatura.
- El aviso de error repite: «No se ha guardado. Algo ha fallado al guardar.». Basta con «No se ha guardado.»; el porqué solo cuando se sabe (sin conexión, sin espacio).
- «Atrás» tras crear un rack desde «Tus racks» → «Rack nuevo»: queda una entrada de historial colgada. El primer «atrás» no hace nada y hace falta un segundo (s6d). Al abrir una hoja desde otra que se cierra en el mismo gesto, la de abajo tiene que quitar su entrada antes de que la nueva añada la suya, o heredarla. Con las hojas apiladas normales (ficha → «En 1 rack» → Listo → ✕), y cerrando con ✕ o con «atrás», el historial queda limpio: comprobado.
- «Quién más lo tiene»: arriba si llega antes de 300 ms y debajo si no. Así ya no empuja nada después de que la ficha haya entrado. Pero si los racks llegan a los 200 ms y las personas a los 400, la tarjeta se pinta arriba y a los 300 ms salta abajo: un salto de la lista hacia arriba. Que decida con lo que haya a los 300 ms y no se mueva más.
- «Pasamos a la cuadrícula: va más ligera» sale bien sin WebGL, pero sale en cada arranque. Que salga una vez por dispositivo, recordado en `localStorage`.
- Banda de /demo: «Entrar» mide 37×36. Le falta `.hit`. La banda está bien: se pinta desde el servidor, empuja las cabeceras y no tapa nada, a 360 ni con hojas abiertas, y en el escritorio no sale.
- Cabecera de la colección al 130 % a 360: el nombre del rack se queda en «Mi Col…», o se desplaza si el movimiento no está reducido. Antes ya pasaba; no lo ha causado el «+».
- «+» junto a la lupa: vale para esta fase. «Añadir» con texto no cabe, y al 130 % ni siquiera cabe el nombre del rack. Para una persona mayor el «+» de 1,4 px pegado a la lupa se lee como un detalle del icono, no como «añadir». Sin rediseñar la cabecera: el «+» en una pastilla rellena de color `paper` de 14–16 px, con el signo en `ink`, como una insignia en la esquina superior derecha del mismo botón de 48 px. Así se lee como una acción aparte. La etiqueta accesible ya es buena. Quien empieza de cero tiene además el estado vacío con «Buscar un disco».
- Explorar: el artista bajo cada portada va a 13 px (`text-caption`). La tabla de tokens lo ponía en `text-sub` (14).
- Copy: el aviso «Prueba vacía» creada → el rack es masculino: «creado». Se lo paso a Copy.
- Onboarding en z-70 por encima del arranque en z-45: **está bien**. El primer uso es dueño de la pantalla y el arranque se disuelve debajo sin que se vea. La barra de pestañas por encima del arranque, también bien.

Comprobado y aprobado:
1. Deshacer del buscador: añadir Tusk (nuevo) y «Deshacer» deja el contador en 40, el disco vuelve a «Añadir» y no queda en «En tu colección». ✔
2. Aviso abajo a 696–746 px (375), sin tocar el campo, que está a 10–54. Desaparece entre 7,2 y 8,7 s. Con el dedo encima 10 s sigue ahí y, al soltar, le queda el tiempo que tenía. «Deshacer» de 88×44 y «Reintentar» de 92×44. ✔ (salvo el 130 %, que está en BLOQUEA)
3. Ritmo de búsqueda: «fleetwood mac rumours» escrito a 170 ms por tecla hace **1** búsqueda. «U2» + Intro busca, baja el teclado y sale U2. ✔ (salvo el estado vacío falso, que está en BLOQUEA)
4. Guardado que falla: la estantería vuelve atrás y sale el aviso rojo con «Reintentar». «Reintentar» guarda (40 → 41). ✔
5. Carga: el primer fotograma con contenido, también con CPU ×4 y red lenta, es la marca con la barra de pestañas, nunca negro. Explorar → Colección no enseña el arranque, solo la espera del estante (unos 300 ms, con cabecera). ✔
6. Sin WebGL: cuadrícula y aviso. ✔
7. A 375 no sale `TopNav`: barra de pestañas desde el primer fotograma. ✔
8. Rack vacío en vista estante: «Este rack está vacío» con «Buscar un disco» y «Escanear el código»; sin lienzo negro. ✔
9. «Atrás» cierra la ficha, el buscador y la confirmación de deseos, una capa cada vez, y nunca sale de /coleccion. ✔ (salvo la entrada colgada de MEJORA)
10. Tokens en rem a 16/14/13/12 y `--text-faint` a 0,52. Ningún texto por debajo de 12 px en colección, explorar, actividad ni ajustes. Al 130 % todo escala (Explorar: 13 → 16,9 px) y no hay scroll lateral a 360. En el escritorio no cambian (15/13/12). ✔
11. `.hit`: ninguna zona táctil por debajo de 44 en las pantallas medidas. En la ficha, ✕, ⋮ y Escuchar llevan `::after` de 44. ✔ (salvo «Entrar» de la banda)
12. Movimiento reducido: la cabecera corta con «…» y no se mueve, y `MotionConfig` está en el layout. ✔
- Mover a deseos: «Se quitará de tu colección y de 1 rack. Un disco está en una cosa o en la otra, nunca en las dos.» Clara, con «Cancelar» y «Mover a deseos» de 48. ✔
- Escáner: «El catálogo está saturado, prueba en unos segundos» (429) y «No hemos podido consultar el catálogo» (503), en dos líneas y con «Reintentar». ✔
- «Algo ha fallado»: frase humana, «Reintentar» y «Volver a tu colección» de 48 px, y la barra de pestañas sigue debajo. ✔
- Escritorio a 1440 y tableta a 768: sin cambios ni roturas (la tableta sigue con la interfaz de escritorio, que es P2). ✔
```

DICE: Deshacer ya dice la verdad; ahora el buscador dice «nada» sin haber preguntado y el aviso se corta al 130 %. Dos arreglos y pasa.

---

## Ronda 2 (6 nov 2026)

Misma configuración: servidor en :3355 con sesión falsa, catálogo simulado y táctil a 360×740, 375×812 y 390×844, al 100 % y al 130 %. Capturas: r2-*, r2b-*, r2c-*.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- Buscador, tarjeta de 429 al 130 % a 360 (r2b-429): el texto ocupa 9 líneas. Le sobra «La búsqueda en el catálogo está en beta y seguimos trabajando en ella» en este momento: quien espera solo necesita «hemos llegado al límite; vuelve a intentarlo en un momento» y «Reintentar». Se lo paso a Copy.
- Cabecera de la colección al 130 % a 360: el nombre del rack sigue sin caber («Colecció…» desplazándose). Ya pasaba antes y no es de esta ronda: apuntado para F6, por ejemplo quitando el número de discos de la cabecera cuando no cabe.
```

Comprobado:
- **Buscador.** «u2» sin Intro enseña la fila «Buscar «u2»» (72 px de alto; 94 al 130 %); al tocarla salen los resultados. «tusk» enseña «Buscando en el catálogo…» a los 50 y a los 450 ms, nunca «Nada para…». Con 429 sale la tarjeta del catálogo con «Reintentar» (`.hit`, 44 px).
- **Aviso.** «Tusk añadido a Mi Colección», entero en las seis combinaciones. Al 130 % se apila: el texto en dos líneas y «Deshacer» (114×44) debajo. El error queda en «No se ha guardado.» con «Reintentar». Sale a 12 px del borde en el buscador. «Deshacer» devuelve el «+» de la fila.
- **«Atrás».** Después de crear un rack, el primer «atrás» ya vuelve a Explorar: no queda ninguna entrada colgada.
- **Lo demás.** «Entrar» de la banda con `::after` de 44×44. El artista en Explorar a 14 px. «“Prueba vacía” creado». La insignia «+» se ve en la esquina de la lupa y se distingue.
- **Limpieza.** Servidor parado, `.next-rv-ux` borrado y quitada solo mi línea de `tsconfig.json`. `data/` y `public/covers/` sin cambios.

DICE: El buscador ya no dice «nada» sin preguntar y el aviso se lee entero al 130 %. Aprobado; la tarjeta del límite pide menos texto.
