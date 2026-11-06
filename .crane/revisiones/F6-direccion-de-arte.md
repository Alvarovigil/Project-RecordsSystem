# F6 · Remate: dirección de arte (Bowerbird)

Revisado en local en el 3356 con sesión falsa, sobre 631613d: táctil a 390×844 y 375×812, y una pasada a 1440 que incluye la landing (comparada con rackr.club, que ya lleva F5).

Capturas: `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots3/` (hojas de contacto en a.png, b.png y z.png; la de foco es f.png; la landing, land.png).

Lo que está bien:
- **Landing a 1440:** igual que producción, píxel a píxel. Los rótulos pasan a `text-micro` y `text-body` con el mismo valor en el ordenador; la mono conserva su 0.10–0.14em y el número del capítulo va en `text-accent`.
- **Foco global:** se ve un aro paper/0.75 de 2 px con 2 de aire, que sigue el radio de la píldora («Seguir»). Solo aparece con teclado.
- **`rounded-lg`:** sale con el mismo valor (14 px). Se queda un `rounded-[14px]`, en la placa de components/landing/EntryDoor.tsx:152.
- **Contador del rack al 130 %:** baja debajo del nombre en `text-caption secondary`. «Mi Colección» se lee entero, sin que la marquesina lo corte.
- **Ficha al 130 %:** la barra esconde la miniatura y el título se queda con su sitio.
- **Explorar, error y sin conexión:** usan la misma tarjeta de estado vacío (radio 14, `fill-subtle`), con una frase y «Reintentar». Es la primitiva, sin caja nueva.
- **Corazón de ListMetrics:** en `text-accent`, como se pidió.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla, tamaño, captura propia frente a referencia, y cómo debería quedar):
- La palabra «Cuadrícula» / «Estante» bajo el círculo de vista (colección, 390 y 375; peor al 130 %). Capturas: L390-coleccion.png, L390-coleccion-130.png y z.png.
  Qué pasa:
    · La «cápsula de cristal» no se pinta. `bg-ink/72` no se genera: Tailwind 3.4 solo crea las alfas de su escala (múltiplos de 5), y 72 no está. Comprobado en el navegador: el fondo calculado es rgba(0,0,0,0). Queda una palabra blanca suelta sobre las portadas, que desaparece en cuanto pasa una funda clara por debajo.
    · Además va con `left-0`, así que cuelga desde el borde izquierdo del botón de 48 en vez de quedar centrada bajo el icono. Rompe el eje de la fila de cuatro círculos.
  Cómo debería quedar:
    · En tailwind.config.ts, `theme.extend.opacity` con 12, 38, 72, 78, 88 y 92 (0.12 … 0.92). Es un solo cambio, y de paso arregla lo que ya estaba sin pintar con esos mismos valores: la barra de pestañas y el MiniPlayer (`bg-ink/92`, por eso se ve el contenido por detrás de las etiquetas), los círculos de cristal de la cabecera del estante (`/72`), los botones ← y ⋮ de la ficha, del perfil y del artista (`/38`) y la barra compacta de la ficha (`/88`).
    · En MobileShelf.tsx:814, la etiqueta pasa a `left-1/2 -translate-x-1/2` (centrada bajo su botón).

MEJORA:
- Ficha con la barra compacta (L390-ficha-130-scroll.png): el artista va en mono uppercase con 0.16em (RecordScreen.tsx:201) y a 130 % se corta en «BILLIE EILI…». Es contenido, no una etiqueta. Mejor `text-caption text-content-secondary` en caja normal, como el contador del rack. Ya estaba así en producción, por eso no bloquea.
- EntryDoor.tsx:152: el último `rounded-[14px]` → `rounded-lg`, y su `text-[14px]` → `text-sub`.
- Quedan cinco `text-[Npx]` en líneas añadidas (tres de 12, uno de 13 y uno de 14), en rótulos de escritorio: CollectionsOverlay, ShelfApp y SearchOverlay. Pasarlos a `text-micro` / `text-sub` para que sigan el tamaño de texto del navegador.
- Copy (para copy): «o no hemos podido leerlas» en Explorar se refiere a racks, que es masculino: «leerlos».

«No pasan» (diff sobre 631613d y archivos nuevos):
- Tipografías vetadas: 0.
- italic / <em>: 0.
- Fondos crema: 0.
- uppercase con tracking en líneas añadidas: 15. Todas vienen de líneas que ya existían, con el tamaño pasado a token o el gris pasado a faint. La mono de la landing sigue en 0.10–0.14em, y la de escritorio (0.16–0.22em) estaba igual en producción. No hay ninguna con caption a 13 (en el repo: 0).
- Hex añadidos: 0. `#f83a23` → `text-accent`.
- Alfas fuera de escala que no se pintan (repo): bg-ink/72 ×10, bg-ink/38 ×5, bg-ink/92 ×4, bg-ink/78 ×2, bg-ink/88 ×1, bg-paper/88 ×1 y border-paper/12 ×1 → BLOQUEA 1.
```

DICE: El remate está bien cosido; solo falta que el cristal se pinte de verdad, porque una palabra suelta sobre una portada clara no se lee.

---

# Ronda 2

Revisado en local en el 3356: táctil a 390, 375 y 360, al 100 % y al 130 %, y una pasada a 1440 (colección, Explorar, landing y 404 de artista). Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots4/` (hdr.png, bar.png y d.png).

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

Comprobado (fondo calculado en el navegador):
- El cristal ya se pinta: círculos de la cabecera rgba(10,10,10,0.72), barra de pestañas 0.92 y barra compacta de la ficha 0.88. Ya no se ve el contenido por detrás de las etiquetas de la barra de pestañas.
- Botón de vista: «Cuadrícula» va dentro de la cápsula, centrada bajo el icono. Al 130 % en 375 y 360 cede la palabra y se queda en un círculo de 48, y el nombre del rack gana el sitio. En 390 al 130 % la palabra cabe y se queda.
- Los círculos de la cabecera tienen 48 px en los seis casos.
- Barra compacta de la ficha: el artista en text-caption y caja normal («Billie Eilish»), entero también al 130 %.
- 1440: colección, Explorar y landing sin cambios respecto a la ronda anterior. El 404 de artista usa la tarjeta de estado vacío con una sola acción.

MEJORA:
- Al 130 %, la insignia «+» crece con el texto y tapa casi entera la lente de la lupa (hdr.png, filas 2, 4 y 6). La insignia es gráfico, no texto: que se quede en 16 px fijos, o en rem con techo, y desplazada a la esquina para que la lupa se vea.
- La cápsula de vista mide 78×53 (88×62 al 130 %), mientras que sus vecinas miden 48. Queda un poco más alta que la fila. Si se quiere la línea limpia, icono y palabra en horizontal dentro de una cápsula de 48 de alto, como la del nombre del rack.

«No pasan»:
- Tipografías vetadas: 0.
- italic / <em>: 0.
- Fondos crema: 0.
- Hex añadidos: 0.
- text-[Npx] añadidos: 0.
- rounded-[14px] en el repo: 0.
- uppercase con tracking en líneas añadidas: 14. Todas en text-micro o .label, que es el registro de etiqueta de siempre. Caption con uppercase y tracking en el repo: 0.
```

DICE: El cristal ya se pinta y la palabra vive dentro de su cápsula: F6 remata sin abrir nada nuevo.
