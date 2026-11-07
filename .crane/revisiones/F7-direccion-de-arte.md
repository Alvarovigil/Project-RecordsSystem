# F7 · Cimientos: dirección de arte (Bowerbird)

Revisado en local en el 3356, con Next 16 y sesión falsa, sobre 8c3396a. Comparado con rackr.club, que lleva F6. Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots5/`:
- estante: demo390.png y demo1440.png;
- esqueletos y avatares: sk.png y skz.png;
- imágenes de compartir: og-user.png y og-rack.png.

Lo que está bien:
- **Estante 3D (/demo):** a 390 y a 1440, luz y color iguales que en producción. La luminancia media es 52,9 frente a 52,8 a 390 y 38,6 frente a 38,8 a 1440, y el RGB medio se mueve 0,2 como mucho. Con la exposición unificada en 0.95 la estantería no se ha aclarado. A 1440 la única diferencia es el aviso de demo, que en local no sale por la sesión falsa.
- **Avatares sin foto** (bloqueé las fotos en el navegador): las iniciales salen sobre el color de la persona en el perfil (grande, «RC»), en la línea del rack (pequeño) y en Explorar. Se leen y no parecen un hueco roto.
- **Imágenes de compartir:** vuelven a llevar Noto Sans. El rótulo «RACKR · LISTA / PERFIL», el titular, la descripción y el pie siguen en el mismo sitio. En perfil cambia el 0,6 % de los píxeles (el titular sube unos 6 px). En rack cambia el 4,1 %: el título de dos líneas va algo más apretado y la descripción sube unos 10 px. La composición es la misma.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla, tamaño, captura propia frente a referencia, y cómo debería quedar):
- Las líneas de los esqueletos de Explorar no se pintan (390, con la carga retenida 20 s). Capturas: sk.png (primera) y skz.png (con el brillo subido).
  Qué pasa: salen los cuadrados de las portadas y de los racks, pero debajo no hay nada. Medido en el navegador, cada `SkeletonLine` mide 0 px de ancho y tiene `display: inline`. El motivo es que `.skeleton { position: relative }` de globals.css (sin capa) gana a la utilidad `absolute` de Tailwind. El span interior se queda en línea, relativo, y el ancho (82 %, 52 %…) se ignora. El hueco sí guarda la altura (por el espacio duro), así que no salta nada. Pero el esqueleto, que promete «la medida real del contenido», enseña cajas sueltas con aire vacío debajo, y parece que falta algo.
  Cómo debería quedar: líneas redondas en fill-subtle con el ancho que ya tienen (título 72–82 %, artista 48–52 %, rack 34–74 %). Arreglo en un solo sitio: en globals.css, `:where(.skeleton) { position: relative; }`, con especificidad cero como `.hit`, para que `absolute` gane. Otra opción es poner `position: absolute` en el `style` de SkeletonLine.

MEJORA:
- Imagen de compartir del rack: el titular de dos líneas queda un poco más apretado que en producción. Si Satori lo permite, `lineHeight: 1.1` (o el que tuviera antes) en el título, para que «el / formato» respire como antes. Son 2–4 px; no bloquea.
- next-env.d.ts está modificado y apunta a `.next-rv-qa2/types`. No es mío: es el servidor de otra revisión. Hay que revertirlo antes del commit, igual que las líneas `.next-rv-*` y `.next/dev` de tsconfig.json, que siguen ahí de los demás.

«No pasan» (diff sobre 8c3396a y archivos nuevos):
- Tipografías vetadas: 0. Noto Sans aparece solo como archivo de las imágenes de compartir (lib/og), y es la que ya llevaban.
- italic / <em>: 0.
- Fondos crema: 0.
- uppercase con tracking en líneas añadidas: 0.
- Hex añadidos: 0.
- text-[Npx] añadidos: 0.
```

DICE: Next 16 no ha tocado ni la luz ni la letra; solo falta que el esqueleto dibuje sus líneas, que ahora miden cero.

---

# Ronda 2

Revisado en local en el 3356 (Next 16). Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots6/`.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla, tamaño, captura propia frente a referencia, y cómo debería quedar):
- La tarjeta tenue de los huecos vacíos de Explorar (EmptySlot, components/ExploreView.tsx:1141; se usa en :657 y :772), en móvil y en escritorio.
  Qué pasa: es `rounded-lg border border-line bg-surface`, es decir, un contorno sobre el mismo negro de la página. Es la misma forma que bloqueé en F5 en EmptyState (caja con borde en vez de la tarjeta) y que se corrigió entonces. Ahora Explorar tendría dos estados vacíos con dos superficies distintas: la tarjeta de «Sin conexión», en fill-subtle sin borde, y esta caja con contorno. Va contra «una sola tarjeta» y «una sola forma por objeto».
  Cómo debería quedar: `rounded-lg bg-fill-subtle` sin borde, la superficie de Card y de EmptyState. Si se quiere más tenue que el estado vacío completo, que lo sea por el contenido (frase en content-muted, sin título), no por la caja. Mejor aún, `EmptyState compact` si la frase lleva salida.

Comprobado:
- Esqueletos de Explorar: las líneas pintan a su ancho (116, 74 y 105 px en una tarjeta de 142), en píldora fill-subtle bajo cada portada. Título, artista y rack se distinguen por la longitud, y la caja ya no tiene aire vacío debajo (skz.png).
- Avatares: con la foto bloqueada, «RC» sobre su verde. Con la foto, la foto tapa entera las iniciales y no se ve ningún halo alrededor (av-el.png). Lo he comprobado una vez cargada la foto: está completa, a 96 px y con opacidad 1.
- Imagen de compartir del rack con lineHeight 1.2: el titular de dos líneas respira como en producción, y la diferencia baja del 4,1 % al 2,4 % de los píxeles (og-rack.png). La de perfil se queda en el 0,6 %. Ya no hay nada que se note a simple vista.

MEJORA:
- (nada nuevo)

«No pasan» (diff y archivos nuevos):
- Tipografías vetadas: 0.
- italic / <em>: 0.
- Fondos crema: 0.
- uppercase con tracking añadido: 0.
- Hex añadidos: 0.
- text-[Npx] añadidos: 0.
- Cajas nuevas con `border-line` y radio: 1 (EmptySlot) → BLOQUEA.
```

Limpieza: servidor parado, `.next-rv-art` borrado, `next-env.d.ts` revertido y mis líneas fuera de tsconfig.json.

DICE: Las líneas del esqueleto ya se pintan; falta que el hueco vacío use la tarjeta de siempre, no una caja con contorno.

---

# Ronda 3

Comprobación rápida en el 3356, a 390 y a 1440 (`/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots7/e.png`).

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

Comprobado:
- EmptySlot (components/ExploreView.tsx) va en `rounded-lg bg-fill-subtle` sin borde, la superficie de Card y de EmptyState, con la frase en text-sub content-muted y la salida opcional en texto secondary. Explorar vuelve a tener una sola tarjeta para lo vacío.
- La razón para no usar EmptyState compact se sostiene: un título propio repetiría el de la sección, y «Coleccionan como tú» no tiene acción. Es la misma superficie con menos contenido, que es lo que pedí.
- Explorar, en móvil y en escritorio, sin cambios en carriles ni racks.

MEJORA:
- (nada)
```

Limpieza: servidor parado, `.next-rv-art` borrado, `next-env.d.ts` sin cambios y mis líneas fuera de tsconfig.json.

DICE: El hueco vacío ya es la tarjeta de siempre: F7 cambia los cimientos sin que se note en la fachada.
