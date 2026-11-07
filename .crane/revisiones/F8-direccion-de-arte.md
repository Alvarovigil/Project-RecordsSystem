# F8 · Remate fino: dirección de arte (Bowerbird)

Revisado en local en el 3356, sobre 1485553, a 390, 375 y 1440, con la landing incluida. Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots8/` (m1.png en móvil y m2.png en escritorio).

Lo que está bien:
- **Explorar desde el servidor:** el primer frame ya trae el buscador en su cápsula, los títulos de sección con su subtítulo y los esqueletos con sus líneas, a la medida de lo que llega. Nada salta cuando aparecen las portadas y los racks, en 390, 375 y 1440.
- **`.hit`:** no cambia el dibujo de la landing, de TopNav ni de los botones redondos.
- **AccountMenu:** el círculo «VO» y su aro de hover siguen redondos. Sin `overflow-hidden`, la foto en `rounded-full` no se sale.
- **PageFade sin fundido en frío:** la primera pantalla aparece entera, sin el velo, y casa con el primer frame que ya trae el servidor.
- **Estados de error:** usan las primitivas de siempre. «No hemos podido buscar» va en EmptyState, y el hueco de sección en la tarjeta EmptySlot (fill-subtle, sin borde). No hay superficies nuevas.

**El índice de la landing en el móvil: se deja como está, sin separar.**
- «EL CLUB / COLECCIONA / PROYECTA / COMPARTE» a 34 px con interlínea de 31 es un solo bloque tipográfico. Es el titular de la portada y la identidad de la entrada. Con 13 px más entre filas se convierte en una lista de cuatro enlaces y pierde el golpe, que es justo lo que no se puede tocar en un remate.
- En tamaño de toque cumple de sobra: cada fila es una palabra de 34 px que ocupa casi todo el ancho, 31 px de alto por unos 200–280 de ancho. El mínimo AA de WCAG 2.2 (2.5.8) es 24 px. Los 44 son el nivel AAA y la guía de iOS, pensados para iconos, no para palabras de este tamaño.
- Lo que sí hay que cambiar: quitar `.hit` de esas cuatro filas (Landing.tsx, el `text-[34px] uppercase`). Con capas de 44 sobre filas de 31, cada capa invisible se mete 6,5 px en la fila vecina, y el toque en el borde de «COLECCIONA» puede abrir «PROYECTA». Cada fila tiene que ser su propia zona exacta.

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

MEJORA:
- Índice de la landing en el móvil: se deja sin separar. Quitar `.hit` de las cuatro filas para que las capas de 44 no se pisen entre filas de 31 (ver arriba).
- Para QA y UX, no es de marca: con todas las lecturas cortadas (Supabase abortado), a los 35 s Explorar sigue diciendo «Todavía no hay racks de otros que mirar.» en vez de «No se ha podido cargar. Puede ser la conexión.», y la sección de racks se queda con el esqueleto para siempre (L390-explorar-error.png y L1440-explorar-error.png). Parece que `popularLists()` resuelve [] en vez de fallar, así que nunca llega a `fail()`. Visualmente es el estado que F8 quería quitar: un pulso que no acaba y una frase que da por vacío lo que no ha cargado.
- EmptySlot a 1440: el hueco de «Lo tienen ellos, tú no» es una losa de unos 1400×265 con una frase pequeña en el centro. Se mantiene el alto para no mover nada, y eso se acepta. Si se quiere más tranquilo, que la frase vaya alineada a la izquierda, a la altura de los títulos, y no flotando en el centro.

«No pasan» (diff sobre 1485553, sin next-env ni tsconfig, y ExploreFrame.tsx nuevo):
- Tipografías vetadas: 0.
- italic / <em>: 0.
- Fondos crema: 0.
- uppercase con tracking en líneas añadidas: 4. Las cuatro son líneas que ya existían y solo ganan `hit`: índice de la landing (−0.01em), «Sobre el proyecto» (0.05em) ×2 y la mono de SearchOverlay (0.16em, solo en escritorio).
- Hex/rgba añadidos: 1, el aro de hover de AccountMenu (rgba(245,243,238,0.10)), que ya estaba; la línea solo gana `hit`.
- text-[Npx] añadidos: 7, todos en líneas que ya existían y solo ganan `hit`.
- Cajas nuevas con borde y radio: 0 (la que aparece es el buscador movido a ExploreFrame, con las mismas clases).
```

Limpieza: servidor parado, `.next-rv-art` borrado, `next-env.d.ts` revertido y mis líneas fuera de tsconfig.json.

DICE: El índice se queda apretado, que es la portada; solo hay que quitarle `.hit` para que cada palabra se toque sola.

---

# Ronda 2

Comprobado en el 3356 a 360 y 390 (al 100 % y al 130 %) y a 1440. Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots9/` (idx.png y e.png).

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

Comprobado:
- Índice de la landing, sin `.hit` y con `overflow-hidden` por fila: no se corta ninguna letra. Las C y las O conservan el redondo de arriba y de abajo, y la Y y la P quedan enteras, a 360, a 390 y a 1440. Cada fila es su propia zona (31 px en el móvil y 53 en el escritorio), y el bloque se ve igual que antes. Al 130 % no cambia, porque el titular va en px a propósito.
- Explorar con error: un solo aviso bajo «Buscar» («No hemos podido cargar Explorar» con «Reintentar»), en la tarjeta de EmptyState. Los carriles del catálogo siguen debajo, y ya no hay esqueletos que no acaban.
- TopNav: sin cambios a la vista con sesión.

Decisión sobre el padding de EmptySlot a ≥1024: **se queda**. La frase vive dentro de una tarjeta, y en una tarjeta el texto siempre va con su margen interior: Card, EmptyState y el aviso de error de la misma pantalla también lo llevan. La referencia de alineación es el borde de la tarjeta, que ya está en x=32 con el título. Sin padding, la frase tocaría el borde y la losa dejaría de ser una tarjeta.

MEJORA:
- El `overflow-hidden` con interlineado 0,92 deja 5 px de caja recortada (scrollHeight 36 frente a 31). Con las palabras de hoy no se nota porque son mayúsculas sin tilde. Si algún día entra una tilde en mayúscula (Á, É, Í) o una Ñ, se cortará. Dejarlo anotado junto al copy del índice.
```

Limpieza: servidor parado, `.next-rv-art` borrado, `next-env.d.ts` revertido y mis líneas fuera de tsconfig.json.

DICE: El índice no pierde ni una letra y cada palabra se toca sola; el padding se queda, porque es el de la tarjeta.
