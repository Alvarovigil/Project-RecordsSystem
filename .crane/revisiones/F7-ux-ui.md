# F7 «Cimientos» · Revisión UX/UI (Hummingbird)

Base: cambios sin commitear sobre 8c3396a (Next 16 + React 19, avatares, Explorar sin saltos).

**Cómo se ha probado:**
- Servidor propio en :3355, en `.next-rv-ux` nuevo (no quedaba el de la versión anterior), con sesión falsa.
- Playwright táctil a 360, 375, 390 y 768, al 100 % y al 130 %, y una pasada a 1440 con ratón.
- Saltos de diseño medidos con `PerformanceObserver('layout-shift')`.
- El pulso retrasado 2,5 s y «Lo tienen ellos» vaciado, con `page.route`. Fotos de avatar con 404.
- Capturas en `shots8/` del scratchpad.

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- Explorar, primera visita de la sesión, a 360, 375 y 390. Capturas: x1 (frames de 300 y 750 ms) y x3-…-300/900.
  - Lo que se ve: durante 1,2 s debajo de «Buscar» no hay nada, solo negro hasta la barra de pestañas. Los títulos de sección aparecen a los 1.484 ms con red normal y a los 2.083 con red lenta. En la segunda visita, en 248 ms.
  - Antes de F7 los esqueletos salían enseguida. El salto está bien arreglado (CLS 0,000 en todas las pruebas), pero el precio es una pantalla vacía en el primer contacto. Es lo de F5: una pantalla vacía le dice a una persona mayor que la app se ha colgado.
  - Cómo debería quedar: la espera del pulso baja de 1.200 a 300 ms, el mismo umbral que «Quién más lo tiene». Por debajo de 300 ms no se nota como espera. Pasado ese tiempo salen los esqueletos (que ya miden lo mismo que el contenido) y el pulso, si llega, va al final, como ahora.
  - Si se quiere apurar el pulso arriba: que la página lo pida en el servidor, o que lo guarde de la última vez (como el snapshot de la colección) para saber desde el primer fotograma si hay pulso. Nunca más de 300 ms de vacío.
MEJORA:
- «Lo tienen ellos» vacío a la vista (x3-…-5000): aceptable, porque no empuja nada y lo dice con su nota. Pero queda un hueco de unos 210 px sin nada entre la nota y «Racks que vale la pena abrir», y parece que falta algo por cargar. Que la altura sostenida la ocupe una tarjeta tenue (`surface`, borde `line`) con la nota centrada dentro y, si cabe, un enlace «Abrir un rack» que baje a la sección de abajo. Así el hueco se lee como un estado y no como una carga atascada. Cuando se pierda de vista, que se cierre como ya hace.
- Avatares con la foto rota (x5, x6): las iniciales salen, pero tras unos 6,5–8 s, cuando se acaban los reintentos (1,5 s + 5 s). Hasta entonces el círculo es solo del color de la persona, sin letras. Que las iniciales estén siempre pintadas debajo de la foto: si la foto llega las tapa, y si no, nunca hay un círculo mudo. El código ya pinta el color debajo; faltan las letras.
- Tableta (768): siguen los 60 «Reproducir» de 32×32 en la cuadrícula de escritorio, y la barra con zonas de 39 px. Es el P2 de siempre, sin cambios en F7.
```

**Comprobado sin cambios respecto a F6 (Next 16 + React 19 no se nota):**
- **Medidas, en colección, Explorar, Actividad, Ajustes y perfil.** Los tokens siguen igual (16/14/13/12 en rem y `--text-faint` a 0,52). Ningún texto por debajo de 12 px. Ninguna zona táctil por debajo de 44 en el móvil. Sin scroll lateral a 360, 375 y 390, al 100 % ni al 130 %. A 768, sin scroll lateral en ninguna pantalla.
- **Flujos.**
  - La ficha se abre, y «atrás» la cierra sin salir de /coleccion.
  - Buscar «tusk» → «+» → «Tusk añadido a Mi Colección · Deshacer», y «Deshacer» devuelve el «+».
- **Escritorio a 1440.** Colección, Explorar y perfil sin roturas ni scroll lateral.
- **Explorar.** CLS 0,000 con red normal, con red lenta y con el pulso retrasado. Los esqueletos miden lo mismo que el contenido (los títulos no se mueven: 120, 459, 811, 1.148 y 1.468 px antes y después de cargar).

**Limpieza:**
- Servidor parado y `.next-rv-ux` borrado.
- En `tsconfig.json` he quitado mis dos líneas (`.next-rv-ux/types` y `.next-rv-ux/dev/types`, que Next 16 añade aparte).
- Quedan líneas de `.next-rv-qa`, `.next-rv-qa2` y `.next/dev`, y el cambio de `next-env.d.ts` que importa `.next-rv-qa2/…`. Nada de eso es mío.
- `data/` y `public/covers/` sin cambios.

DICE: Explorar ya no salta, pero ahora calla 1,2 s al entrar. Bajad la espera a 300 ms y que el esqueleto hable; lo demás aguanta.

---

## Ronda 2

**Cómo se ha probado:**
- Dev en :3355 con sesión falsa, a 360 y a 375, al 100 % y al 130 %.
- Build de producción (`next build` + `next start` en :3358, en `.next-rv-ux2`), sin sesión, a 360 y a 375, con red normal y con red lenta + CPU ×4.
- Capturas en `shots9/` del scratchpad.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- «Abrir un rack» dentro de la tarjeta vacía: es un botón de texto de 87×20 sin `.hit`. Que lleve `.hit` (44 px), como todo lo que se toca.
- Explorar en frío en producción con un móvil lento (red lenta + CPU ×4): hasta los 3,2 s solo se ve la barra de pestañas. El HTML del servidor no trae ni el buscador ni los títulos; sin JS, la página está vacía (p2-nojs). No es de F7, pero es el siguiente negro que queda. Que el servidor pinte el buscador y los esqueletos de las dos primeras secciones, que ya miden lo mismo que el contenido. Así el primer fotograma ya es Explorar.
```

Comprobado:
- **Espera del pulso en producción.**
  - Con red normal, del buscador al primer título pasan 83–99 ms.
  - Con red lenta y CPU ×4, 274–284 ms, siempre por debajo de 300.
  - CLS 0,000 en todas las pasadas, en dev y en producción.
  - Ya no hay un vacío que se pueda leer como «se ha colgado».
- **«Lo tienen ellos» vacío a la vista (x3-…-5000, a 375 y a 360 al 130 %).**
  - Se ve la tarjeta tenue con borde, «Ahora mismo no hay nada en esos racks que no tengas ya.» centrada y «Abrir un rack», que baja a «Racks que vale la pena abrir» (queda a 80 px de arriba).
  - El hueco ya se lee como un estado.
- **Avatares.** Las iniciales («ÁR») están pintadas debajo de la foto desde el principio: ya no hay círculo mudo mientras carga o reintenta.
- **Consola.** Sin errores de hidratación. Solo salió uno cuando yo cambiaba el tamaño de letra del `<html>` antes de hidratar, y es cosa de la prueba.

**Limpieza:**
- Servidores parados, `.next-rv-ux` y `.next-rv-ux2` borrados.
- `next-env.d.ts` revertido (`git checkout`).
- Quitadas mis cuatro líneas de `tsconfig.json`.
- Siguen en `tsconfig.json` cambios que no son míos y no he tocado: `jsx: react-jsx`, `.next/dev`, `.next-rv-qa` y `.next-rv-qa2`.
- `data/` y `public/covers/` sin cambios.

DICE: Explorar ya contesta en menos de 300 ms y el hueco vacío dice lo que es. Aprobado; el próximo negro está en el HTML del servidor.
