# F5 · Estable y usable en el móvil: dirección de arte (Bowerbird)

Revisado en local en el 3356 con sesión falsa: táctil a 390×844 y 375×812, y una pasada a 1440. Lo he comparado con rackr.club sin sesión, que sigue en la versión anterior. Diff: cambios sin commitear sobre 163b719.

Capturas, de colección, ficha, buscador, Explorar, perfil, rack, Ajustes, /demo, arranque, aviso, rack vacío y texto al 130 %: `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots/` (L = local, P = producción).

Lo que no cambia y está bien:
- **Escritorio a 1440.** Explorar local y Explorar en producción son la misma pantalla píxel a píxel. La barra Are.na (`RackrClub / Colección · Actividad · Explorar`) está intacta, y en rem la escala sale con los mismos valores. La estantería 3D y su titular no se mueven.
- **Móvil, cuerpo y secundario.** Con 16 y 14 los títulos de Explorar, del perfil y del buscador ganan aire sin perder jerarquía. El puente («Rackr Club · Portadas…») sigue en tercera línea.
- **`.hit`.** No cambia el dibujo: el check de la cuadrícula y el botón de la ficha siguen siendo los mismos círculos.
- **Avatar.** A 16 y 22 px, una inicial a 12 px. Cierra lo que quedó abierto en F4.
- **Arranque.** El Mark con «RACKR CLUB» sobre tinta y la barra de pestañas debajo ya desde el primer frame. Ya no hay negro ni salto.
- **Cabecera.** El «+» va sobre la lupa dentro del mismo círculo, con el mismo trazo de 1,4. Se lee como un solo icono y no le quita sitio al nombre del rack.
- **Aviso abajo.** Es la misma cápsula de cristal (`surface-overlay/85` con desenfoque) y queda justo encima de la barra. No inventa un registro nuevo.
- **ErrorScreen.** Mark, titular de 17, cuerpo muted, una píldora primaria y otra ghost. Habla igual que /entrar.
- **DemoBand.** Va en caption secondary sobre `surface-raised`, y «Entrar» va subrayado en caja normal. Es discreta y no grita «DEMO».
- **«Pasar a deseos».** Usa la primitiva `Confirm` que ya existía. Sin caja nueva.
- **Escáner.** Los estados nuevos (saturado, no disponible) van en el mismo `text-sub` de la fila, con `line-clamp-2`. Sin color nuevo.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla, tamaño, captura propia frente a referencia, y cómo debería quedar):
- Etiquetas en mayúsculas con tracking a 13 px. Pasa en todas las pantallas del móvil (375 y 390): buscador «ARTISTAS» / «AÑADIR A TU COLECCIÓN», ficha «CARA A», Ajustes «TU PERFIL» / «LA APLICACIÓN», perfil «GÉNEROS» / «POR DÉCADAS», hoja «AÑADE DISCOS».
  Capturas: L390-buscador-q.png, L390-ficha.png, L390-ajustes.png y L390-perfil-scroll.png, frente a P390-perfil-scroll.png.
  Qué pasa: el suelo de móvil sube `--t-caption` a 13, y hay 28 etiquetas que van en `text-caption uppercase tracking-label` (0.18em). Crecen con él, y con ellas el tracking. El propio globals.css dice: «the tracked labels that only name a region stay at 12». El código contradice su regla, y la etiqueta, que debería quedar detrás, pasa a competir con el texto de lectura. Es lo mismo que se corrigió en F4 con la mono de la landing.
  Cómo debería quedar: todas las `text-caption uppercase tracking-label` pasan a `text-micro uppercase tracking-label`, que se queda en 12 (0,75rem) también en el móvil. Mejor todavía, una utilidad `.label` (`text-micro uppercase tracking-label text-content-faint`) en globals, para que la regla viva en un solo sitio y no en 28 clases.
- Estado vacío del rack (colección, 375). Captura: L375-rack-vacio.png.
  Qué pasa: es lo primero que ve quien acaba de llegar, y sale como una caja cuadrada con contorno `border-line`. El relleno `bg-fill-subtle/40` no se genera (opacidad sobre var()), así que queda solo el borde. Es una tercera superficie: no es la `Card` (radio 14 sobre `fill-subtle`, la de Ajustes y del perfil) ni el diálogo negro. Va contra «una sola tarjeta».
  Cómo debería quedar: en components/ui/EmptyState.tsx, el contenedor pasa a `rounded-[14px] bg-fill-subtle` sin borde, que es la superficie de `Card`. Cuerpo, botones y texto se quedan como están. Así se arregla también en Explorar, Perfil, Rack y Actividad, porque comparten la primitiva.

MEJORA:
- El rojo de error, que me preguntabais: sí, tiene que ser token. Lo propongo en globals: `--danger: #ff6b57` (el rojo legible sobre tinta, distinto de `--accent` #f83a23, que es «vivo/sin leer») y `--danger-surface: #2a1512`, con `danger` / `danger-surface` en tailwind.config. Hay una docena de usos sueltos: Toast.tsx:208 y :257, ConfirmButton.tsx:67, Button.tsx:28, Sheet.tsx:322, Onboarding.tsx:294, CollaboratorsSheet.tsx:142 y :174, ListEditSheet.tsx:193 y AccordionShelf.tsx:306. Ojo: con opacidad sobre var() Tailwind 3 no genera la clase, así que hay que declararlo con `<alpha-value>` (rgb en canales) o mantener las alfas fijas en el token.
- Toast.tsx:220: el mensaje sigue en `text-[14px]`. Así no sigue el tamaño de texto del navegador, que era el motivo del cambio a rem. Pasarlo a `text-sub` (14 en el móvil, 13 en el ordenador).
- Barra de pestañas al 130 % (L375-t130.png): «Colección», «Actividad» y «Explorar» quedan a unos 7 px. Como iOS, que no escala las etiquetas de la tab bar con el tamaño dinámico, propongo poner techo a la etiqueta: `font-size: min(var(--t-caption), 0.9375rem)`. El icono y el nombre ya se entienden a 15, y así no se tocan.
- DemoBand es una barra sólida arriba. La regla dice que en las barras superiores del móvil no van fondos sólidos que corten la portada. Como aviso se entiende que tenga que leerse, pero puede ir de cristal: `bg-[rgb(var(--ink-rgb)/0.7)] backdrop-blur-xl` con su `border-line`, y así se lee igual sin el corte recto encima de la estantería.
- global-error.tsx pinta `<html>` sin las variables de `next/font` ni `grain`, y sale en system-ui. Es una pantalla rara, pero entonces deja de parecer Rackr. Hay que importar Inter igual que el layout raíz, o dar el fallback a la pila de globals.
- Copy (para copy, no es mío): el aviso «"Prueba vacía" creada» concuerda con el nombre y no con «rack», que es masculino. Mejor «Rack "…" creado».
- Siguen para F8: `--t-micro` y `--t-caption` ya divergen en el móvil (12 frente a 13), así que micro deja de ser un alias y pasa a ser el tamaño de la etiqueta. Hay que documentarlo así en globals.

«No pasan», sobre el diff y los archivos nuevos:
- Tipografías vetadas: 0. Las únicas coincidencias son «times» dentro de comentarios en inglés y «Explorar», falsos positivos.
- italic / <em>: 0.
- Fondos crema: 0. La única coincidencia es `group-hover:bg-paper` en el botón del aviso, que es el hover de siempre y no un fondo.
- uppercase con tracking en líneas añadidas: 6. Cinco son `text-[12px]` → `text-micro` en mono que ya existían (MarqueeText, DemoNotice, QR y SearchOverlay), con el mismo valor en rem. La sexta, RecordSheet `h4 text-caption uppercase tracking-label`, cae dentro del BLOQUEA 1.
- Colores fijos nuevos en líneas añadidas: 0. Los #ff6b57 / #2a1512 del aviso ya estaban.
```

DICE: Agrandar no ha rebajado nada; solo las etiquetas han crecido con el cuerpo, y el vacío, el primer sitio que se pisa, tiene que ser la tarjeta de siempre.

---

# Ronda 2

Revisado otra vez en local, en el 3356 con sesión falsa: táctil a 390×844 y 375×812, y una pasada a 1440. Capturas en `/private/tmp/claude-501/-Users-alvarorodriguezvigil-Repositorios-Personal-Vinilos/cd1ca67b-69bd-425d-a957-34c69470ca76/scratchpad/shots2/` (hojas de contacto en m1.png, m2.png y z.png).

```
VEREDICTO: APROBADO
BLOQUEA:
- (nada)

Comprobado:
- Etiquetas: con `.label` (12 px, uppercase, tracking-label) «ARTISTAS», «AÑADIR A TU COLECCIÓN», «CARA A», «TU PERFIL», «GÉNEROS» y «POR DÉCADAS» vuelven a quedar detrás del texto de lectura, a la altura de producción. En el repo no queda ningún text-caption con uppercase y tracking.
- Estado vacío: ahora es la Card (radio 14 sobre fill-subtle, sin borde), la misma superficie que Ajustes y que el perfil. Queda una sola tarjeta.
- Rojo de error: --danger / --danger-surface en rgb con <alpha-value>, así que las alfas sí se generan.
- Barra de pestañas al 130 %: con --t-tab hay aire entre «Colección» y «Actividad».
- DemoBand de cristal: la estantería se ve por debajo sin el corte recto, y la frase sigue leyéndose.
- Insignia «+»: un círculo paper de 16 px en la esquina de la lupa se lee como «añadir» y no como un contador. No se confunde con el punto rojo de Actividad, que conserva su significado de «vivo».
- Aviso: la cápsula sigue igual, y el texto ya está en text-sub. En el rack recién creado pone «"Prueba vacía" creado».
- 1440: Explorar es igual que en producción. La barra Are.na está intacta.

MEJORA:
- Quedan dos #ff6b57 sueltos que el diff no toca. components/community/ListMetrics.tsx:69 (el corazón de «me gusta») debería ir a text-accent, porque un like es «vivo», no un error. app/admin/u/[id]/page.tsx:247 debería ir a text-danger. Para F8.
- A 1440, la línea del artista en Explorar baja unos 3 px por un cambio de interlineado. No afecta a la jerarquía; solo lo anoto.

«No pasan» (diff y archivos nuevos sin seguimiento):
- Tipografías vetadas: 0.
- italic / <em>: 0.
- Fondos crema: 0.
- uppercase con tracking en líneas añadidas: 5. Las cinco son text-[12px] → text-micro en mono que ya existían (MarqueeText, DemoNotice, QR y SearchOverlay), con el mismo valor. En los archivos nuevos: 0. text-caption con uppercase y tracking en el repo: 0.
- text-[Npx] añadidos: 0. Hex rojos en el diff: 0.
```

DICE: Las etiquetas vuelven a su sitio y el vacío ya es la tarjeta de siempre: F5 agranda sin perder la voz.
