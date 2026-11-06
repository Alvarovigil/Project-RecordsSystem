# F6 — Revisión de copy (Lyrebird)

Fase «Remate». Leído en `git diff 631613d` y en los archivos nuevos (lib/artist-known*, hooks/useKeyboardInset, lib/optimistic). No he arrancado la app: todos los textos nuevos son cortos y se juzgan leyendo el código.

VEREDICTO: APROBADO

No hay nada que bloquee:
- No hay inglés visible.
- No se nombra al proveedor.
- No hay faltas.
- Los errores dicen qué pasó y cómo seguir, sin culpar a nadie.
- Los nombres accesibles contienen la palabra que se ve: «Ver en cuadrícula» contiene «Cuadrícula» y «Ver el estante» contiene «Estante». Así, quien maneja el móvil con la voz puede decir lo que lee.

BLOQUEA:
- (nada)

MEJORA (de más a menos importante):

**1. «Estante» o «estantería»: el mismo sitio con dos nombres** (components/mobile/MobileShelf.tsx:291-292)
- El resto de la app llama a la vista 3D «la estantería»:
  - el aviso de F5: «La estantería en 3D no ha cargado. Te la enseñamos en cuadrícula.»;
  - la carga: «Cargando la estantería»;
  - y la home, que es la estantería.
- El botón nuevo dice «Estante» y «Ver el estante». Quien acaba de leer el aviso no tiene por qué saber que son lo mismo. Además, un estante es una sola balda.
- Propuesta:
  - En el texto visible y en el nombre accesible, «Estantería» y «Ver la estantería».
  - Si «Estantería» no cabe bajo el icono, que el aviso y la carga digan «estante». Lo que importa es que sea una sola palabra en toda la app.

**2. Portadas y diálogos: la misma pareja escrita de dos maneras**
- En la cuadrícula, el `aria-label` es «Abrir Tusk de Fleetwood Mac», sin coma.
- El diálogo de la ficha, en cambio, se llama «Tusk, de Fleetwood Mac», con coma.
- Sin coma se lee mal cuando el título ya lleva «de» («Abrir Hijos de la ira de Extremoduro»).
- Propuesta: «Abrir Tusk, de Fleetwood Mac». Así queda igual que el diálogo.

**3. Explorar sin carga** (components/ExploreView.tsx:622)
- «No hemos podido cargar esto»: «esto» no dice qué, y el lector de pantalla lo anuncia suelto.
- Propuesta: «No hemos podido cargar Explorar».
- El resto está bien:
  - «Sin conexión»;
  - «Cuando vuelva la conexión, esto se carga solo.»;
  - «Puede ser la conexión. Prueba otra vez en un momento.»;
  - «Reintentar».

**4. Artista que no existe** (app/not-found.tsx, el 404 general que ahora también sale para un artista)
- «Esta página no existe. O la dirección está mal escrita, o lo que había aquí ya no está.» está bien escrito, pero no dice que lo que se buscaba era un artista.
- Si sale barato, que /artista tenga su propio `not-found` con dos textos:
  - «No encontramos a este artista.»
  - «Puede que el nombre esté mal escrito. Búscalo desde Añadir.»
- El botón dice «Volver a Rackr Club», cuando la pantalla de error de F5 dice «Volver al inicio» para lo mismo. Propuesta: «Volver al inicio» en las dos.
- Un «404» enorme como titular es jerga para quien no sabe qué significa. El texto de debajo lo salva, así que se puede dejar.

**5. Detalles**
- El `aria-label` «Buscar un disco» del diálogo del buscador está bien. El botón que lo abre dice «Añadir o buscar un disco», y es buena idea que el diálogo diga solo «Buscar», porque es lo que se hace dentro.
- Los `h1` ocultos («Explorar» y el nombre del rack activo, p. ej. «Mi Colección») están bien: es lo que alguien diría de dónde está.
- El nombre «Disco» de reserva para una ficha sin datos está bien.

DICE: Remate limpio, sin inglés ni proveedor. Que la vista 3D se llame igual en toda la app («estantería») y que las portadas lleven la coma.
