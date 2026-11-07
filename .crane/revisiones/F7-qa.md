# F7 «Cimientos» — QA (Woodpecker)

Fecha: 2026-11-07. Árbol de trabajo sobre `8c3396a` (Next 16.4.5, React 19, @react-three/fiber 9, drei 10, Turbopack), con la ronda de arreglos.

Cómo se ha probado:
- **Desarrollo:** `:3354`, `NEXT_DIST_DIR=.next-rv-qa`, `NEXT_PUBLIC_FAKE_SESSION=1`.
- **Producción:** `next build` en `.next-rv-qa2` (compila en 3,6 s, sin avisos) y `next start` en `:3357`. Es la sesión real: sin sesión, visitante.
- **Producción con sesión falsa** (`.next-rv-qa3`, `:3358`, unos minutos): no sirve, porque `FAKE_SESSION` se apaga en producción (`lib/dev-session.ts`). Los flujos con sesión solo se han podido probar en desarrollo; en producción se ha recorrido `/demo`.
- **Medios:** Playwright con Chromium, móvil táctil a 375×812 y 360×740. Catálogo simulado con `page.route`. Scripts en `/private/tmp/claude-501/qa5b/` (los s*, r*, f*, g*, h* de rondas anteriores, más k1…k14).
- **Antes de empezar** borré `.next-sesion` y `.next-verify`, que tenían una semana. `.next` no lo toqué: se había modificado esa misma mañana y había otras revisiones con servidores en el repo (`.next-rv-art`, `.next-rv-ux`).
- **La sesión se cortó una vez** (el proceso murió por memoria con la auditoría al 130 %). Repetí la pasada entera sobre el árbol actual.

Limpieza:
- Servidores 3354, 3357 y 3358 parados.
- `.next-rv-qa`, `.next-rv-qa2` y `.next-rv-qa3` borrados.
- `git checkout -- next-env.d.ts`.
- Quitadas mis líneas de `tsconfig.json`. Quedan `"jsx": "react-jsx"` y `.next/dev/types/**/*.ts`, que no son mías.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: APROBADO

El salto a Next 16 y React 19 no ha roto nada de F5 ni de F6:
- **Estante 3D:** igual, píxel a píxel frente a F6 (diferencia media 0 en la zona del estante a 375).
- **Consola e hidratación:** 0 errores en desarrollo (12 páginas) y en producción (13 páginas).
- **Explorar:** CLS 0.

## BLOQUEA

- Ninguno.

## MEJORA

1. **Explorar con mala cobertura dice dos cosas que no son verdad.**
   - Pasos: supabase abortado y navegador «en línea».
   - Qué pasa:
     - Más abajo sale bien «No hemos podido cargar Explorar · Reintentar», y «Reintentar» recupera 21–22 racks en el sitio.
     - Pero los huecos de arriba dicen «Todavía no hay racks de otros que mirar.» y «Todavía no hay nadie con una colección parecida a la tuya» (en producción, «Todavía no hay colecciones que enseñar.»).
     - En desarrollo, a los 14 s, el hueco de arriba ya decía «Todavía no hay racks» mientras los racks seguían en esqueleto.
   - Qué debería pasar: con `failed` u `offline`, el hueco de «Lo tienen ellos» y el de personas dicen que no se ha podido cargar, o no dicen nada.
   - Dónde: `components/ExploreView.tsx`, el `fallback` de `Hold` (~`:640-670`), que solo mira `lists.length`.
2. **La marca al entrar en Colección desde otra pestaña, solo en desarrollo.**
   - En 3 de unas 16 pasadas en `next dev` se vio la pantalla de arranque («RACKR CLUB») unos 0,2–0,3 s, de Explorar o Actividad a Colección.
   - Con el build de producción, 0 de 16. Pero ahí la pestaña lleva a `/entrar`, porque en producción no hay sesión falsa: con sesión real no se ha podido medir.
   - Sospecha: `ShelfApp.tsx:795`, `if (!measured) return <BootScreen />` sin mirar `isColdStartOn`. Con React 19 el primer render sin medir puede durar más de un fotograma.
3. **/coleccion sin sesión en producción** responde 200 y redirige en el cliente a `/`. El resultado es correcto; solo cambia el código de estado.
4. **/demo → buscar → «+» → /entrar → atrás:** vuelve a /demo con el buscador cerrado y la búsqueda perdida. Es el viejo n.º 14 en /demo; en Explorar sí se conserva.
5. **Landing al 130 %:** los enlaces «EL CLUB», «COLECCIONA», «PROYECTA», «COMPARTE» y «SOBRE EL PROYECTO» miden 20–31 px de alto, por debajo de 44. Ya era así antes.

## Comprobado y bien

**Desarrollo (sesión falsa), a 375 y a 360:**
- **Estante 3D:** se pinta igual que en F6. Deslizar y tocar abre la ficha. Sin WebGL, cuadrícula en /, /demo y /coleccion, sin «Application error».
- **Añadir y deshacer** desde el buscador y desde el escáner: 40 → 41 → 40, también tras recargar. Doble toque en «+»: 1 POST.
- **Borrar y deshacer:** 39 → 40, con el disco de vuelta en la biblioteca, también tras recargar.
- **Pasar a deseos:** confirma y se deshace.
- **Escáner:**
  - 429 («va lento… Reintentar»).
  - 503 («No hemos podido consultar el catálogo… Reintentar»).
  - Catálogo en 500: «No se ha añadido ninguno. Vuelve a pulsar «Añadir».», con la bandeja intacta.
  - Almacenamiento lleno: sin «Reintentar», y al volver a pulsar guarda.
- **Buscador:**
  - 429 y 503 con su texto y «Reintentar».
  - El reintento automático tras `Retry-After` funciona.
  - «U2» + Intro: 1 petición.
  - A 650 ms por letra, 2 peticiones (antes 7).
- **Atrás capa a capa:** ficha (también con ✕ cinco veces), menú ⋮ («Cambiar la portada», «Mover a deseos», «Borrar»), buscador, escáner → «Buscar a mano», dos atrás rápidos, abrir y cerrar seguido, y recargar con la ficha abierta (un atrás). Sin entradas basura.
- **LayerLink** desde la ficha (artista y rack), desde la hoja del catálogo (artista), desde «Usuarios y racks» y desde «Seguidores»: navega sin recargar y vuelve con atrás.
- **Hojas apiladas:** el bloqueo del scroll va 2 → 1 → nada.
- **Teclado simulado:** «Crear rack» siempre a la vista, también en la hoja anidada del buscador.
- **Racks:** `col-<uuid>` y antiguo `col-1730000000000`, con crear, renombrar, añadir y borrar. `maxLength` 80. Un rack vacío muestra su estado vacío.
- **Cabecera:** a 360 y 375, al 100 y al 130 %, entera y quieta.
- **Foco con teclado:** visible en 41 de 41 paradas.
- **«Gira el teléfono»** a 812×375.
- **Portadas que fallan una vez** (ficha, cuadrícula, /explorar, /u/rackrclub, /artista): todas reintentan y ninguna queda rota.

**Producción (`next start`, Turbopack):**
- **Sin sesión:** la landing bien, `/entrar` con «Entrar con Google», `/coleccion` lleva a `/`, `/ajustes` pide entrar y `/entrar?next=…` conserva el `next`.
- **/demo** con la banda y el estante 3D, igual que en desarrollo. Cuadrícula, ficha, menú y atrás capa a capa. El «+» lleva a `/entrar` y atrás vuelve. Recargar con la ficha abierta y un atrás va a /explorar.
- **Explorar:**
  - Sin conexión: «Sin conexión · Reintentar», y se recupera solo con `online` (21 racks).
  - Con mala cobertura: error con «Reintentar» que recupera en el sitio (ver MEJORA 1).
  - `?q=` sobrevive a recargar, a ir a `/entrar` y a volver atrás.
- **CLS = 0,000** en /explorar, /explorar?q=, /u/rackrclub, /actividad, /artista/radiohead y /coleccion, a 375 y a 360. En desarrollo, el artista da 0,015–0,044.
- **Avatares con la foto bloqueada:** salen las iniciales («R», «Á», «RC», «MF»…), en desarrollo y en producción. Ningún círculo vacío ni imagen rota.
- **/artista/zzzz-inventado:** la página de no encontrado. Radiohead carga.
- **Al 130 %:** sin scroll lateral en /explorar, /actividad, /u/rackrclub, /demo, /, /entrar ni /artista.
- **Sin WebGL:** cuadrícula y fondo estático, sin errores.
- **Consola:** 0 errores y 0 de hidratación en 13 páginas. Los únicos 400 que se ven en desarrollo son `profiles?id=eq.local`, de la sesión falsa, como antes.

VEREDICTO: APROBADO

DICE: Next 16 y React 19 no rompen nada: estante idéntico, 0 errores y CLS 0. Falta que los huecos de Explorar no digan «Todavía no hay» cuando falla la red.
