# F5 — Revisión de copy (Lyrebird)

Fase «estable y usable en el móvil». Leído en `git diff 163b719` y en los archivos nuevos (ErrorScreen, DemoBand, `app/**/error.tsx`, `global-error.tsx`, los `loading.tsx`, ErrorBoundary). Esta vez no he arrancado la app: los textos se pueden juzgar leyendo el código, y ninguno es lo bastante largo como para cortarse a 375 px.

VEREDICTO: APROBADO

No hay nada que bloquee:
- No queda inglés en ningún texto visible. «Application error» desaparece del todo.
- No se nombra al proveedor en la interfaz. El único texto que lo roza es el error interno «El disco no está en el catálogo», y no llega a enseñarse.
- No hay faltas de ortografía.
- Singular y plural están bien: «1 rack» / «N racks» en la confirmación de deseos, y «Añadido a X» / «N discos añadidos a X» en el escáner.
- Ningún error culpa a la persona y todos llevan salida: «Reintentar», «Buscar a mano» o «Volver a tu colección».
- «Añadido a Mi Colección» ya sustituye a «Título → lista», y «Deshacer» es el mismo en todos los avisos.

Lo que sí hay son tres sitios donde el mismo gesto se dice de dos o tres maneras. Conviene arreglarlo antes de subir.

BLOQUEA:
- (nada)

MEJORA (de más a menos importante):

**1. Pasar a deseos: tres nombres en un mismo flujo** (components/mobile/RecordSheet.tsx)
- Ahora mismo, en el mismo flujo se lee:
  - en el menú (:691): «Mover a la lista de deseos»;
  - en la confirmación (:743 y :749): «Pasará a tus deseos» y el botón «Mover a deseos»;
  - en el aviso con «Deshacer»: «${título} pasa a Lista de deseos», con mayúscula a mitad de frase porque usa el nombre de la lista.
- Propuesta: un solo nombre, «deseos», en las tres pantallas:
  - menú: «Mover a deseos»;
  - confirmación: «Pasará a tus deseos» y «Mover a deseos» (se quedan como están);
  - aviso: «Movido a tus deseos», que va en paralelo a «Añadido a…».
- El cuerpo de la confirmación (:744) está bien: «Se quitará de tu colección y de 2 racks.» La segunda frase, «Un disco está en una cosa o en la otra, nunca en las dos», no dice cuáles son esas dos cosas. Propuesta: «Un disco o lo tienes o lo quieres: no puede estar en los dos sitios.»
- No es la renombración de toda la app que dejé pendiente en F4, porque «Lista de deseos» sigue siendo el nombre de la lista. Es solo que este flujo, que es nuevo, no mezcle tres formas.

**2. «Guardar» un disco, cuando el glosario dice «Añadir»**
- components/mobile/RecordSheet.tsx:800 — «Guardado en ${name}» → «Añadido a ${name}». Tres líneas más arriba, la misma ficha dice «Añadido a ${name}» para el mismo gesto.
- components/mobile/MobileShelf.tsx:325 (rack vacío) — «Busca un disco o escanea su código, y guárdalo en este rack.» → «Busca un disco o escanea su código, y añádelo a este rack.»
- components/mobile/MobileShelf.tsx:322 (rack ajeno vacío) — «Quien lo hizo todavía no ha guardado ningún disco aquí.» → «Quien lo hizo todavía no ha añadido ningún disco.» Se quita «aquí» porque el título ya dice «Este rack».
- «Guardar» se queda para los racks.

**3. Pantalla de error** (components/app/ErrorScreen.tsx)
- El cuerpo dice «No es culpa tuya. Vuelve a intentarlo; si sigue igual, vuelve a tu colección.»
  - «Vuelve… vuelve» se repite.
  - «No es culpa tuya» saca la culpa a relucir, cuando nadie la había mencionado.
  - Propuesta: «Esta pantalla no ha cargado. Prueba otra vez o vuelve a tu colección.»
- El botón «Volver a tu colección» también sale en `app/error.tsx` y `global-error.tsx`, es decir, en la portada, el QR y los enlaces. Ahí llega gente sin cuenta: no tiene colección, y /coleccion la manda a la portada. Si la portada es justo lo que ha fallado, el botón la devuelve al mismo sitio.
  - Propuesta: fuera de la app, «Volver al inicio» con enlace a «/».
  - Dentro de la app, «Volver a tu colección» está bien.
- «Algo ha fallado» y «Reintentar» están bien.

**4. Errores al guardar** (hooks/useLibrary.ts:29-33)
- Ahora mismo:
  - «No se ha guardado: este navegador no tiene espacio.»
  - «No se ha guardado. Sin conexión.»
  - «No se ha guardado. Algo ha fallado al guardar.»
- Fallan tres cosas:
  - La puntuación no es la misma en los tres.
  - El tercero repite «guardar».
  - El de espacio no dice cómo seguir.
- Propuesta:
  - «No se ha guardado: no hay conexión.»
  - «No se ha guardado: el móvil no tiene espacio. Libera algo y vuelve a intentarlo.»
  - «No se ha guardado.» A secas, porque «Reintentar» ya dice lo que hay que hacer.
- Una nota funcional, no de copy: el comentario dice que reintentar no arregla el caso sin espacio, pero ese aviso también lleva «Reintentar».
- La portada ha perdido su error propio. Antes decía «No se ha podido guardar la portada.» y ahora sale el genérico. Si se puede, que diga «No se ha guardado la portada.»

**5. Escáner** (components/BarcodeScanner.tsx)
- «El catálogo está saturado, prueba en unos segundos» → «El catálogo va lento. Prueba en unos segundos.»
  - «Saturado» suena a jerga de servidor.
  - La coma separa dos frases que deberían ir con punto.
- «No hemos podido consultar el catálogo» está bien: dice qué ha pasado, y debajo está «Reintentar».

**6. Sin 3D** (components/mobile/MobileShelf.tsx)
- «Pasamos a la cuadrícula: va más ligera» explica por qué, pero no qué ha pasado: la estantería ha desaparecido sin que nadie la quitara.
- Propuesta: «La estantería en 3D no ha cargado. Te la enseñamos en cuadrícula.»

**7. Detalles**
- components/DemoBand.tsx — «Colección de ejemplo · nada se guarda» funciona, pero «nada se guarda» suena a telegrama. Alternativa: «Colección de ejemplo: no se guarda nada». «Entrar» es el verbo bueno, el de F4.
- components/mobile/BootScreen.tsx — el `aria-label` «Cargando tu colección» también suena en /demo, donde la colección no es tuya. Propuesta: «Cargando la colección».

**Bien como está**
- «Añadido a Mi Colección» y «Deshacer», con el título del disco en la portada en miniatura y no en el texto.
- «Tu colección está vacía» y «Este rack está vacío», con «Buscar un disco» y «Escanear el código».
- «Busca un disco por título o artista, o escanea el código de barras de la funda.» Aquí se dice «código de barras», que resuelve la duda de F4 con «código».
- «Añadir o buscar un disco» como etiqueta del botón de la lupa: dice las dos cosas, y el comentario explica por qué.
- «No hemos podido leer la ficha de este disco.»
- «Ver tus racks» en un rack ajeno vacío.

DICE: Sin inglés, sin el proveedor y con salida en cada error. Falta que deseos tenga un solo nombre y que a un disco se le «añada», no se le «guarde».

---

## Ronda 2

Vuelto a leer en `git diff 163b719`, con los archivos nuevos. Esta vez tampoco he arrancado la app.

VEREDICTO: APROBADO

**Aplicado y bien escrito:**
- Deseos ya tiene un solo nombre en todo el flujo:
  - «Mover a deseos» en el menú y en la confirmación;
  - «Movido a tus deseos» en el aviso con «Deshacer»;
  - y la segunda frase: «Un disco o lo tienes o lo quieres: no puede estar en los dos sitios.»
  - No queda ninguna «lista de deseos» nueva.
- A un disco ya se le «añade»:
  - «Añadido a X» en la ficha, el escáner, la estantería y el «Reintentar» que sí funciona;
  - «añádelo a este rack» y «todavía no ha añadido ningún disco» en el rack vacío.
- Errores al guardar (useLibrary):
  - Todos tienen la misma forma: «No se ha guardado / No se ha borrado / No se ha guardado la portada», seguido de dos puntos y la causa.
  - El de espacio dice cómo seguir y ya no ofrece «Reintentar».
  - El genérico queda en «No se ha guardado.», con el botón al lado.
- ErrorScreen: dentro de la app dice «…o vuelve a tu colección» y fuera «…o vuelve al inicio», con el enlace a «/». Ya no tiene el «No es culpa tuya» ni la repetición de «vuelve».
- «Tusk añadido a Mi Colección» se lee bien, y «añadido» concuerda con «disco».
- Buscador:
  - «Buscar «u2»» con «En el catálogo» debajo dice exactamente qué va a pasar.
  - «Buscando en el catálogo…» está bien.
- DemoBand: «Colección de ejemplo: no se guarda nada» y «Entrar».
- Sin 3D: «La estantería en 3D no ha cargado. Te la enseñamos en cuadrícula.»
- Escáner: «El catálogo va lento. Prueba en unos segundos.»
- Cargando: «Cargando la colección».
- No hay inglés nuevo, no se nombra al proveedor y el plural de racks está bien.

BLOQUEA:
- (nada)

MEJORA (no bloquea):
- components/ui/CatalogueNotice.tsx — el aviso de límite dice ahora «El catálogo no ha podido contestar: hemos llegado al límite de consultas por minuto. Vuelve a intentarlo en un momento.», y además lleva la coletilla «La búsqueda en el catálogo está en beta…».
  - Son tres frases. «Consultas por minuto» y «beta» son jerga.
  - Y el escáner explica lo mismo con otras palabras («va lento»).
  - Propuesta:
    - Con la lista vacía: «El catálogo va lento ahora mismo. Prueba en unos segundos.»
    - Con resultados: «El catálogo va lento: faltan resultados. Prueba en unos segundos.»
    - La coletilla de «beta», fuera; o, si se quiere conservar, «Seguimos mejorando la búsqueda.»
- components/BarcodeScanner.tsx:472 — «No se pudo añadir ninguno de los discos.»
  - Es el único error en indefinido («se pudo»): los demás dicen «No se ha…».
  - Tampoco dice cómo seguir, cuando las tarjetas siguen en la bandeja.
  - Propuesta: «No se ha añadido ninguno. Vuelve a pulsar «Añadir».»
- El aviso de añadido lleva el título solo desde el buscador («Tusk añadido a…»). En la ficha, el escáner y la estantería sigue siendo «Añadido a X». Está bien así, porque en la ficha el disco ya está delante; solo lo apunto para que sea una decisión y no un descuido.
- `app/(app)/error.tsx` manda a /coleccion también a quien mira Explorar sin sesión, y de ahí acaba en la portada. Llega igual, así que se puede dejar.

DICE: Deseos ya tiene un solo nombre, los discos se añaden y cada error dice qué pasó. Solo sobra jerga en el aviso del catálogo.
