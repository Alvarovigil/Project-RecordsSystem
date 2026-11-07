# F8 «Remate fino» · Revisión UX/UI (Hummingbird)

Base: cambios sin commitear sobre 1485553.

**Cómo se ha probado:**
- Dev en :3355 con sesión falsa.
- Build de producción en :3358 (`.next-rv-ux2`), sin sesión: landing, `/demo` → `/entrar` y Explorar en frío.
- Táctil a 360, 375, 390 y 768, al 100 % y al 130 %, y una pasada a 1440 con ratón.
- «Mala cobertura»: las peticiones de datos cortadas con la red marcada como presente. «Sin conexión»: `context.setOffline`.
- Capturas en `shots10/` del scratchpad.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- Decisión 1. Explorar con mala cobertura (z2-375-100-offline-full): **se queda uno solo.**
  - Hoy salen tres, y además distintos: «Lo tienen ellos» trae una tarjeta tenue con «No se ha podido cargar. Puede ser la conexión. · Reintentar»; «Racks» trae la tarjeta grande «No hemos podido cargar Explorar» con su «Reintentar»; y «Coleccionan como tú», otra vez la primera. La del medio dice «Explorar» dentro de una sección y parece que lo demás sí ha cargado. Tres botones iguales hacen dudar de cuál toca.
  - Cómo debería quedar: un único aviso arriba, justo debajo de «Buscar», con «No hemos podido cargar Explorar · Puede ser la conexión. Prueba otra vez en un momento.» y un solo «Reintentar» que vuelve a pedirlo todo. Las secciones que fallaron se cierran del todo, sin título; las que sí cargaron se quedan.
  - Sin conexión de verdad ya sale un solo aviso («Sin conexión», en producción), y se recupera sola al volver la red. ✔
  - De paso: con mala cobertura los esqueletos siguen 12 s antes de decir nada. Con 8 s basta.
- Decisión 2. Índice de la landing en el móvil (360, z4): **las filas se quedan a 31 px, sin cambiar el dibujo ni tocar arte.**
  - Lo que sí hay que cambiar es el `.hit` vertical. Cada `::after` de 44 se mete 6,5 px en la fila de arriba, y gana la de abajo. Medido: tocar la parte de abajo de «EL CLUB» (2 px por encima de su borde) lleva a «COLECCIONA», y lo mismo «PROYECTA» → «COMPARTE». Es decir, el `.hit` produce toques equivocados.
  - Cómo debería quedar: en esta lista, la zona solo crece en horizontal (o nada). Cada fila tiene exactamente sus 31 px, sin solaparse. 31 px pasa de sobra el mínimo de 24 de WCAG 2.5.8, y son anclas que solo desplazan la página, así que un toque fallido se arregla solo. «Sobre el proyecto» (135×16) sí lleva su `.hit`, porque no tiene a nadie al lado.
- Decisión 3. Botones de vista en la tablet (768, z5): **el mismo arreglo.**
  - Cada botón mide 30×26 y el `::after` de 44 del segundo se mete 7 px en el primero: tocar 3 px a la izquierda de la juntura, dentro del dibujo de «Vista estantería», activa «Vista cuadrícula».
  - Cómo debería quedar: la zona crece solo en vertical (a 44 de alto), y cada mitad se queda con su ancho, sin invadir la otra. Si se quiere llegar a 44 de ancho, los segmentos pasan a 40–44 px cada uno: es un cambio de dibujo pequeño que va con arte, pero no corre prisa.
- Tableta (768): el panel de racks del escritorio (z8-768-panel) sigue con «CERRAR» de 62×18, los lápices de 28×28, «Filtrar…» de 24 y «CREAR» de 18. «Zonas de 44 en la tablet» todavía no llega a este panel: `.hit` en esos cuatro.
```

Comprobado y bien:
- **Explorar en frío, en producción.** Desde el primer fotograma ya se ven el buscador, los títulos y los esqueletos de las dos primeras secciones, también con red lenta y CPU ×4. CLS 0,000. Sin JS ya están el buscador y las secciones.
- **Explorar sin conexión o con mala cobertura.** Nunca dice «Todavía no hay».
- **Marca al cambiar de pestaña.** Ningún fotograma con la marca a pantalla completa en 5 cambios seguidos entre Colección, Explorar y Actividad.
- **Búsqueda de `/demo`.** «+» lleva a `/entrar?next=/demo?buscar=tusk`; al volver, el buscador sigue abierto con «tusk» y sus resultados.
- **Regresión.** En colección, Explorar, Actividad, Ajustes y perfil:
  - a 360, 375 y 390, al 100 % y al 130 %: sin scroll lateral, sin texto por debajo de 12 px y sin zonas por debajo de 44;
  - a 768 al 130 %: sin scroll lateral;
  - a 1440: sin roturas y con `h1` en cada pantalla.

**Limpieza:**
- Servidores parados; `.next-rv-ux` y `.next-rv-ux2` borrados.
- `next-env.d.ts` revertido.
- Quitadas mis cuatro líneas de `tsconfig.json`. Lo que ha cambiado ahí durante la revisión (`.next-rv-art`/`.next-rv-code` ↔ `.next-rv-qa`/`.next-rv-qa2`) es de otros revisores.
- `data/` y `public/covers/` sin cambios.

DICE: Explorar ya se ve desde el primer fotograma. Un solo aviso sin red, y quitad el .hit vertical donde las filas se tocan: hoy roba toques.

---

## Ronda 2

Dev en :3355 con sesión falsa, a 360 (también al 130 %), 375 y 768. Capturas en `shots11/` del scratchpad.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- Aviso único de Explorar (w1-t-after): bien. El salto al fallar lo **acepto** como cambio de estado anunciado.
  - Medido: si estás arriba, «Lo que todo el mundo busca» sube de 1.148 a 324 px. Es lo que estaba debajo del pliegue y sube a la vista junto con el aviso.
  - Si estás leyendo esa sección cuando falla, solo se mueve 71 px (de 395 a 324), porque la página se acorta.
  - El CLS que medimos es 0,557 (no 0,35), pero ocurre una sola vez, a los 8 s y sin que la persona esté tocando nada.
  - La opción barata para suavizarlo: que las secciones que fallan se cierren con una transición de altura de unos 200 ms (sin ella con movimiento reducido). Así el contenido sube en vez de aparecer de golpe más arriba.
  - Copy: el aviso dice «No hemos podido cargar Explorar» con media página cargada debajo. Mejor «No hemos podido cargar parte de Explorar» o «Algunas secciones no han cargado». Se lo paso a Copy.
- Panel de racks en la tablet: «CERRAR» y «CREAR» ya llegan a 44 (`.hit`), y «Editar lista →» llega a 313×44 (`.hit-y`). Los lápices son `.hit-y`, así que miden 28×44: no roban nada, pero no llegan a 44 de ancho como dice la ronda. A su derecha hay margen: pueden crecer a 44×44 sin tocar la fila. «Rack nuevo» (campo) mide 37 de alto.
- Textos: en Explorar, «Personas» ya está, pero al 130 % a 360 las pestañas «TODO · DISCOS 2 · RACKS 0 · PERSONAS 0» saltan a dos líneas y «PERSONAS 0» queda sola, centrada (w2-explorar-search). Mejor una fila con scroll lateral. En la hoja del buscador del móvil siguen «Discos | Usuarios y racks»: que diga «Personas y racks» o «Personas», para que el mismo concepto se llame igual en los dos sitios.
```

Comprobado:
- **Aviso de Explorar.** Uno solo, debajo de «Buscar», con un único «Reintentar». Las secciones que fallan se cierran y lo que cargó se queda.
- **Índice de la landing a 360.** Sin `.hit`: cada fila conserva sus 31 px y ya no roba toques (tocar dentro de «EL CLUB» abre «EL CLUB»; el borde de abajo, la fila de abajo). «Sobre el proyecto» mantiene su `.hit`.
- **Tableta: vista.** `.hit-y` (30×44 cada uno). En la juntura, cada lado se queda con lo suyo.
- **Limpieza.** Servidor parado, `.next-rv-ux` borrado, `next-env.d.ts` revertido y mis líneas de `tsconfig.json` quitadas. `data/` y `public/covers/` sin cambios.

DICE: Ya no se roba ni un toque y sin red sale un solo aviso. Aprobado; que el cierre de secciones se anime y el aviso diga «parte de».

---

## Ronda 3

Dev en :3355 con sesión falsa, a 360 al 130 % y a 375 al 100 %, con 768 para la cuenta. Fallos simulados con `page.route`: catálogo, base de datos, o los dos. Capturas en `shots12/` del scratchpad.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- Búsqueda de Explorar cuando fallan las dos fuentes pero hay discos tuyos que coinciden (v1-360-130%-all): salen dos notas seguidas, cada una con su «Reintentar» («No hemos podido consultar el catálogo…» y «No hemos podido buscar racks ni personas»). Es la misma repetición que se quitó en la página. Que se junten en una sola: «No hemos podido consultar el catálogo ni buscar racks y personas. Lo que ves es lo que ya tienes. · Reintentar».
- Hoja del buscador con el catálogo caído y sin nada tuyo que coincida: dice «Lo que ves es lo que ya tienes en tu colección», pero debajo no hay nada. En ese caso sobra la segunda frase.
```

Comprobado:
- **Búsqueda de Explorar.** No sale «Nada para» ni ningún «0» que no sea verdad.
  - Falla todo y no hay nada tuyo que coincida: «No hemos podido buscar · Puede ser la conexión… · Reintentar».
  - Falla una sola fuente: se ve lo que llegó y, encima, su nota con «Reintentar».
  - Un «RACKS 0» solo sale cuando esa fuente contestó de verdad.
- **Hoja del buscador.** Con el catálogo caído no dice «Nada para». Después de «Reintentar» con red, el «Nada para «zzqx»» es verdad. Los segmentos dicen «Discos | Personas y racks».
- **Pestañas de búsqueda a 360 al 130 %.** Van en una sola fila y la última se corta en el borde, así que se ve que hay más.
- **Página de Explorar.** El aviso dice «No hemos podido cargar parte de Explorar». El cierre de secciones ya está terminado al medir.
- **Tableta.** «Tu cuenta» con zona de 44×44 y «Buscar» con 50×44.
- **Limpieza.** Servidor parado, `.next-rv-ux` borrado, `next-env.d.ts` revertido y mis líneas de `tsconfig.json` quitadas (las de `.next-rv-qa`, que han entrado mientras tanto, son de QA). `data/` y `public/covers/` sin cambios.

DICE: Ninguna búsqueda dice «nada» cuando lo que ha fallado es la red. Aprobado; solo falta juntar las dos notas cuando fallan las dos fuentes.
