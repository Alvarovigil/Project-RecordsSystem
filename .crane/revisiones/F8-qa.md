# F8 «Remate fino» — QA (Woodpecker)

Fecha: 2026-11-07. Árbol de trabajo sobre `1485553`.

Cómo se ha probado:
- **Desarrollo:** `:3354`, `.next-rv-qa`, `NEXT_PUBLIC_FAKE_SESSION=1`.
- **Producción:** `:3357`, `.next-rv-qa2`, sin sesión.
- **La ronda de arreglos entró a mitad.** Reinicié los dos con la caché limpia, volví a hacer el build y repetí la pasada.
- **Medios:** Playwright con Chromium, móvil táctil a 375×812 y 360×740. Tableta a 768×1024 y 1024×768, y escritorio a 1440×900, para lo de TopNav. Catálogo simulado con `page.route`. Scripts en `/private/tmp/claude-501/qa5b/`.

**Ojo, catálogo real:** en una de las primeras pruebas de búsqueda en Explorar no simulé `/api/discogs/search`, y el servidor hizo **una** búsqueda real («radiohead»). Las demás, simuladas.

Limpieza:
- Servidores parados y `.next-rv-qa*` borrados.
- `git checkout -- next-env.d.ts`.
- Quitadas mis líneas de `tsconfig.json`, que queda igual que git.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: BLOQUEADO

## BLOQUEA

### 1. La búsqueda de Explorar que falla sigue diciendo «Nada para…» y nunca «No hemos podido buscar»
- **Pasos:** /explorar → escribir «radiohead» (o abrir `/explorar?q=radiohead`) con Supabase cortado y el catálogo en 503. Es la mala cobertura de verdad: todo falla.
- **Qué pasa:**
  - Sale «No hemos podido consultar el catálogo…» y debajo **«Nada para «radiohead» — Prueba con menos palabras…»**, con «Escanear un código».
  - Las pestañas dicen «Discos 0 · Racks 0 · Personas 0».
  - No hay «Reintentar».
  - Con solo Supabase caído: «Racks 0 · Personas 0», sin ningún aviso.
  - Con el catálogo en 429: «va lento: faltan resultados» y también «Nada para…».
  - Pasa en producción y en desarrollo, a 375 y a 360.
- **Qué debería pasar:** lo que anuncia esta fase. «No hemos podido buscar · Reintentar», y nunca «Nada para» ni «0» de algo que no se ha podido preguntar.
- **Por qué:**
  - La rama de `failed` existe (`components/ExploreView.tsx:890-893`, y `:1073` en las pestañas), pero `failed` no se pone nunca.
  - `searchProfiles` y `searchLists` se tragan el error de Supabase y devuelven `[]` (`lib/data/supabase.ts:635` y `:643`). Es lo mismo que se arregló en F6 para `popularLists` y `suggestedProfiles`.
  - Que el catálogo esté caído (`catalogue.degraded`: «down» o «rate-limit») tampoco cuenta para no decir «Nada para» (`:902`). En el buscador del móvil esto ya se arregló en F5.

## MEJORA

1. **Zonas táctiles que siguen por debajo de 44:**
   - El índice de la landing (EL CLUB, COLECCIONA, PROYECTA, COMPARTE) mide 31 px de alto ahora que se ha quitado `.hit`. Sí es verdad que ya no se roban los toques: el centro y los bordes caen en su propio enlace.
   - En tableta (con sesión):
     - El menú de cuenta («Mi perfil», «Ajustes») tiene filas de 35 px.
     - «Vista estantería» y «Vista cuadrícula» miden 30×44, y los lápices «Editar discos» 28×44: llegan a 44 de alto, pero no de ancho.
   - En tableta sin sesión, «ENTRAR» mide 106×32.
2. **/actividad en escritorio con sesión:** CLS de 0,034 a 0,056 (`DIV.pt-2`) en desarrollo. Por debajo de 0,1; lo apunto.
3. **El MiniPlayer no lo he podido abrir** en las pruebas (el audio está simulado). Revisado solo en el código: el reproducir y el título llevan `.hit`.
4. **Sesión compartida (`lib/auth-cookie.ts`):** sin probar, porque no hay sesión real en las pruebas.

## Comprobado y bien

**Explorar con Supabase cortado** (producción, a 375 y 360):
- A los 4 s, armazón y esqueletos.
- A los 9 s, un solo «No hemos podido cargar Explorar · Reintentar» bajo el buscador, y las secciones que fallan desaparecen.
- **Ningún «Todavía no hay» a los 9, 15, 25 ni 36 s.**
- «Reintentar» recupera en el sitio (21 racks).
- CLS 0,000 en todo el recorrido; no vi el 0,35 aceptado.

**Explorar sin conexión** con la página ya cargada: se queda lo que había, y con `online` sigue bien.

**Explorar en frío** (producción):
- Buscador a ~110 ms, y racks a 310–630 ms.
- Con 3G y CPU ×4: buscador a ~450 ms, armazón con títulos a ~1,17 s y racks a ~4 s.
- CLS 0.
- `?q=` sobrevive a recargar, a pasar por /entrar y a volver atrás.

**CLS a 375 y 360:**
- 0,000 en /explorar, /explorar?q=, /u/rackrclub, /actividad y /coleccion. /artista, 0,015–0,017.
- Escritorio y tableta: 0,001–0,009 en producción (TopNav ya no salta).

**Marca al cambiar de pestaña hacia Colección:** 0 de 8 pasadas (y 0 de 16 antes de la ronda). En frío en /coleccion y /demo sí sale.

**/demo y la búsqueda:**
- /demo → buscar «radiohead» → «+» → `/entrar?next=%2Fdemo%3Fbuscar%3Dradiohead` → atrás: vuelve con el buscador abierto, «radiohead» y los 3 resultados. Otro atrás lo cierra, y otro va a /explorar.
- `/demo?buscar=kid a` lo abre con «kid a» y quita el parámetro.
- `?buscar=` vacío no abre nada.
- `?buscar=<img onerror…>` se escribe como texto, sin ejecutarse.

**Regresiones de F5 a F7 (desarrollo, y producción donde se puede):**
- Añadir y deshacer, borrar y deshacer (39 → 40, aguanta la recarga).
- Escáner con 429, 503 y fallo de guardado.
- Buscador del móvil con 429 y 503.
- Atrás capa a capa, también tras recargar.
- LayerLink al artista.
- Hojas apiladas y teclado simulado.
- Cabecera al 130 %.
- Sin WebGL.
- «Gira el teléfono».
- Avatares con la foto bloqueada: iniciales.
- Portadas que fallan una vez: se reintentan.
- **Consola:** 0 errores y 0 de hidratación en 12 páginas de desarrollo y 10 de producción.

VEREDICTO: BLOQUEADO

DICE: El Explorar caído ya no miente, pero su búsqueda sí: con todo fallando dice «Nada para» y «Racks 0» en vez de «No hemos podido buscar».

---

# Ronda 3

Fecha: 2026-11-07. Build de producción nuevo (`.next-rv-qa2`, `:3357`) y desarrollo (`.next-rv-qa`, `:3354`), los dos con la caché limpia. Búsquedas del catálogo simuladas siempre: esta ronda no ha habido ninguna consulta real. Scripts m2, m8 y m11…m14 en `/private/tmp/claude-501/qa5b/`.

Limpieza al terminar:
- Servidores parados y `.next-rv-qa*` borrados.
- `next-env.d.ts` revertido.
- `tsconfig.json` sin mis líneas.
- `data/` y `public/covers/` sin cambios.

## VEREDICTO: APROBADO

## BLOQUEA

- Ninguno.

## MEJORA

1. **Tableta con sesión, colección de escritorio:** «Vista estantería» y «Vista cuadrícula» siguen en 30×44, y los lápices «Editar discos» en 28×44. Llegan a 44 de alto, no de ancho.
2. **Con el catálogo en 429**, la búsqueda de Explorar dice «No hemos podido buscar · Puede ser la conexión». El buscador del móvil dice «va lento». Es correcto, pero sería más preciso decir que va lento.
3. **El CLS con Explorar caído** es de 0,55–0,62: el cierre animado a los ~7,1 s, en unos 160 ms. Aceptado.

## Comprobado y bien

**Búsqueda en Explorar** (producción y desarrollo, por URL y escribiendo):

| Fallo | Qué sale |
|---|---|
| Todo caído | «No hemos podido buscar · Reintentar», pestañas sin números |
| Solo Supabase | «Discos 1» con su resultado, y una nota «No hemos podido buscar racks ni personas · Reintentar». Racks y Personas sin «0» |
| Solo el catálogo, o 429 | «No hemos podido buscar · Reintentar», con Racks y Personas a 0 (respuesta real) |
| Catálogo caído y un rack que sí coincide («portadas») | Sale el rack y la nota del catálogo |

- **Nunca «Nada para», en ningún caso.** «Reintentar» recupera los tres.

**Buscador del móvil (desarrollo):**
- Catálogo caído: «No hemos podido consultar el catálogo · Reintentar».
- «Personas y racks» con Supabase caído: «No hemos podido buscar · Reintentar».
- Los reintentos recuperan, y no sale «Nada para».

**Buscador de escritorio (1440):**
- Discos con el catálogo caído: «No hemos podido consultar el catálogo · Reintentar».
- «Personas y racks» con Supabase caído: «No hemos podido buscar · Reintentar».
- Cuando la otra fuente sí contesta, sin aviso.
- «Reintentar» recupera.

**Explorar con Supabase cortado (producción):**
- «No hemos podido cargar Explorar · Reintentar» a los 9 s.
- Ningún «Todavía no hay» a los 36 s.
- «Reintentar» recupera 21 racks.

**Zonas táctiles de 44:** el menú de cuenta en tableta y «Entrar» ya miden 44.

**Regresiones:**
- Consola 0 en desarrollo (12 páginas) y en producción (8).
- Añadir y deshacer, borrar y deshacer.
- Escáner con 503 y fallo de guardado.
- Buscador del móvil con 429 y 503.
- Atrás capa a capa y tras recargar.
- LayerLink al artista.
- Marca al ir a Colección: 0 de 8.
- Cabecera al 130 %.
- Iniciales en los avatares.

VEREDICTO: APROBADO

DICE: Aprobado: si falla una fuente, la búsqueda lo dice con su «Reintentar» y ya no inventa «Nada para» ni ceros, en Explorar, en el móvil y en el escritorio.
