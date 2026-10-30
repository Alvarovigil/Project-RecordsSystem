# Rackr en el móvil: pasada de UX/UI (Hummingbird, 30 oct 2026)

Recorrido a 375×812 y a 360×740. Con sesión en `localhost:3346` (sesión falsa, datos locales) y sin sesión en `localhost:3345` (datos reales, solo lectura). Las medidas se tomaron del DOM (tamaño de toque, cuerpo de letra y contraste calculado sobre el fondo real). La cámara está bloqueada en el navegador integrado, así que el escáner solo se probó hasta su respaldo «teclear el código».

Va ordenado de más a menos grave. En cada fricción: **pantalla y paso**, **qué pasa**, **a quién le duele**, **arreglo mínimo** y **fase**.

---

## Bloquean un recorrido entero

### 1. En el navegador del móvil no hay forma de entrar ni de crear cuenta
- **Pantalla y paso:** landing `/` → `/instalar`, sin sesión y en un teléfono.
- **Qué pasa:** el único botón del primer pantallazo es «Instalar la app» (149×36, 12 px). En el teléfono, la cabecera con «Entrar» está oculta (`hidden sm:flex`). `EntryDoor` solo enseña «Empezar gratis» en dispositivos con puntero, nunca en táctiles. `/instalar` en iOS y en Android sin aviso nativo tiene **0 elementos pulsables**: ni «Entrar sin instalar» (solo sale en escritorio), ni «Atrás», ni «Entrar con Google». La única salida es «Prefiero mirar en el navegador» (231×18, 12 px, `paper/35`), al final de una página de unos 7.400 px. Lleva a Explorar, que tampoco tiene botón de entrar.
- **A quién le duele:** a todos los que llegan desde un enlace y no quieren instalar o no saben hacerlo. Sobre todo a la persona mayor: «abre el menú ⋮ y elige Instalar aplicación» es justo el paso que no va a dar.
- **Arreglo mínimo:** en `EntryDoor` (variante hero, táctil), un segundo botón «Entrar con Google» junto a «Instalar la app». En `/instalar` (iOS y Android), «Entrar sin instalar» igual que en escritorio, y un «Entrar» discreto en la cabecera móvil de las pantallas sin sesión (Explorar, perfil, rack).
- **Fase:** F4.

### 2. Sin sesión, «Colección» y «Perfil» te enseñan a una persona inventada como si fueras tú
- **Pantalla y paso:** barra de pestañas sin sesión. «Colección» → `/demo` y «Perfil» → `/u/vera`.
- **Qué pasa:** «Colección» abre «Mi Colección 42» con discos que no son tuyos, y lo único que avisa de que es un ejemplo es el título de la pestaña del navegador. «Perfil» abre a «Vera Ontañón», con «0 discos», una bio que dice «Treinta discos» y un botón «Seguir». En la página del artista (`/artista/rosalia`) sale «3/19 discos · En tu colección» y «Lo que te falta». En Explorar, «Lo tienen ellos, tú no» se calcula contra esa colección de ejemplo.
- **A quién le duele:** a cualquiera que llegue por un enlace compartido (el recorrido 3). Ve una «Mi Colección» que no ha hecho y un perfil ajeno en su pestaña de perfil. A una persona mayor la desorienta del todo, y a alguien joven le parece que la app está rota.
- **Arreglo mínimo:** sin sesión, «Colección» y «Perfil» llevan a una sola pantalla «Entra para empezar tu colección», con «Entrar con Google» y «Mirar Explorar». `/demo` puede quedarse, pero con una banda visible «Colección de ejemplo». Fuera «En tu colección», «Lo que te falta» y «tú no» cuando no hay «tú».
- **Fase:** F4 (cabe con la puerta de entrada; los datos ya los arregló F1).

### 3. Añadir un disco está escondido detrás de una lupa que dice «Buscar»
- **Pantalla y paso:** primera pantalla con cuenta (`/coleccion`) → querer añadir un disco.
- **Qué pasa:** la cabecera tiene cuatro iconos sin texto: cuadrícula/estante (48×48), «Mi Colección ⌄», (i) y lupa. Añadir y escanear viven dentro de la lupa, con la etiqueta «Buscar». No hay ningún «+», «Añadir» ni «Escanear» a la vista. Con la colección vacía, el botón del estado vacío («Buscar discos») lleva a **otra búsqueda**, la de Explorar (`/explorar?buscar=1`). Esa no tiene «Guardar en», ni escáner, ni el botón de 44 px: su «Guardar» mide 28×28 y sus filtros (TODO / DISCOS / RACKS / USUARIOS) miden **15 px de alto**.
- **A quién le duele:** al listón del contrabrief («añade su primer disco sin que nadie se lo explique»). La persona mayor no asocia «Buscar» con «Añadir», y la joven tarda.
- **Arreglo mínimo:** en la cabecera de Colección, cambiar la lupa por un botón con texto «Añadir» (o «+ Añadir»), que abre la misma hoja de siempre. El estado vacío de tu colección abre esa misma hoja (`openSearch`), no Explorar, y con dos botones: «Buscar un disco» y «Escanear el código». El texto «Este rack está vacío» pasa a «Tu colección está vacía» cuando el rack es la colección.
- **Fase:** F5 (un gesto), o «nueva» si se quiere separar de vocabulario.

### 4. Compartir tu perfil no existe
- **Pantalla y paso:** Perfil propio → compartir.
- **Qué pasa:** `ProfileView` tiene «Editar perfil» y la rueda de Ajustes; no tiene «Compartir». Tampoco lo tiene el perfil ajeno. El rack sí lo tiene, pero como icono suelto de 48×48 sin texto (la etiqueta es solo para lector de pantalla). En tu colección, compartir está dentro de (i) → «Compartir el rack».
- **A quién le duele:** al recorrido 3 entero. Además, compartir es lo que trae gente nueva.
- **Arreglo mínimo:** «Compartir» (la `ShareSheet` que ya existe) junto a «Editar perfil» en el tuyo y junto a «Seguir» en el ajeno. En el rack, el icono de compartir lleva la palabra «Compartir» debajo o dentro.
- **Fase:** F5.

### 5. Seguir a alguien no enseña nada de lo que ya tiene
- **Pantalla y paso:** Explorar → «Seguir a Toni Romero» → Actividad.
- **Qué pasa:** el aviso «Sigues a Toni Romero» sale bien, pero Actividad sigue en «Todavía no se mueve nada». Solo cuenta lo que llegue a partir de ahora. Lo he visto en el entorno de prueba (sesión falsa y datos locales); habría que confirmarlo con una cuenta real. El botón de seguir de Explorar mide 36×36. «Buscar gente» del vacío lleva a Explorar, no a buscar personas.
- **A quién le duele:** al recorrido 4. La primera vez que alguien sigue a otro, la app parece vacía y la sensación es «esto no funciona».
- **Arreglo mínimo:** al seguir, Actividad rellena con lo último que añadió esa persona (sus 10 últimos discos o racks, marcados «antes de que le siguieras»). El botón de seguir de las tarjetas pasa a 44 px. «Buscar gente» abre Explorar con el buscador puesto en «Personas».
- **Fase:** F6 (Explorar y Actividad a la Are.na).

---

## Rozan en cada uso

### 6. «Guardar» significa tres cosas
- **Pantalla y paso:** hoja del disco, rack ajeno y buscador.
- **Qué pasa:** en un rack ajeno, «Guardar» es quedarte el rack, y al lado hay un corazón con «0» (38×26) que es «me gusta». En la hoja de un disco que no tienes, «Guardar» es añadirlo a tu colección. En el buscador de Colección, «Guardar en · Mi Colección · Cambiar» elige el rack de destino. En la hoja de un disco que sí tienes, el mismo botón pasa a ser «En 1 rack». En Explorar, el botón para añadir se llama «Guardar Rumours…».
- **A quién le duele:** a todos; a la persona mayor, del todo.
- **Arreglo mínimo:** un verbo por gesto. Un **disco** se **añade**: «Añadir a mi colección», y si ya lo tienes, «En tu colección ✓». Un **rack** se **guarda**: «Guardar», y fuera el corazón. «Guardar en» del buscador pasa a «Se añade a: Mi Colección · Cambiar».
- **Fase:** F5.

### 7. Vocabulario mezclado en pantalla (medido en textos visibles)
- **Qué pasa:** «Cajones que vale la pena abrir» y «Colecciones que alguien ha montado… no carpetas» (Explorar); «Lista de deseos» y «Mover a la lista de deseos» (hojas); «Quién puede verla · Pública» (opciones del rack, en femenino por «lista»); «quién se fija en las tuyas» (Actividad vacía); «Usuarios y racks» (buscador de Colección) frente a «USUARIOS» y «VINILOS» (buscador de Explorar); «Mi Colección de Rackr Club» en «Quién más lo tiene»; «Borrar de mi colección»; género en inglés («Electronic»); y «Compartir a Rosalia» sin tilde.
- **A quién le duele:** a todos; cada palabra nueva es una pregunta más.
- **Arreglo mínimo:** Colección / Racks / Deseos / Personas / Discos. Esto queda así: «Racks que vale la pena abrir», «Deseos», «Pasar a Deseos», «Quién puede verlo», «Personas y racks», «la colección de Rackr Club», «Quitar de mi colección». Los géneros pasan por un diccionario corto al español.
- **Fase:** F5.

### 8. Los resultados del catálogo llegan en bruto
- **Pantalla y paso:** Colección → lupa → «rumours fleetwood».
- **Qué pasa:** cada fila es «Fleetwood Mac - 1975 To 1987 / 2019 · US · Vinyl, LP, Album, Reissue, Vinyl, LP, Album, Reissue, …» (×5), con asteriscos de desambiguación («Orchestra*») y singles mezclados con álbumes. Con «motomami» sale «Ashee - Oxytocin» y «2023 · Unknown · Vinyl, 12", Shape, Limited Edition». En Explorar, el primer resultado de «rumours» es un grupo que se llama Rumours.
- **A quién le duele:** a quien no sabe qué es una «reissue» ni un 12": la mayoría.
- **Arreglo mínimo:** título y artista en dos líneas (partir por « - »), quitar el «*» final, formato resumido a una palabra («LP», «Single», «Caja») sin repetir, país en español y nada de «Unknown». Primero los álbumes, después lo demás. El «+4 ediciones» que ya enseña el escáner, también aquí.
- **Fase:** F9 (búsqueda y catálogo), o F5 si se toma solo el texto.

### 9. Racks escondidos en el título de la cabecera
- **Pantalla y paso:** Colección → ¿dónde están mis racks?
- **Qué pasa:** se llega solo tocando «Mi Colección ⌄», que no parece un botón. En «Tus racks», «Mi Colección» y «Lista de deseos» aparecen como racks más, con un candado de unos 10 px y sin texto que diga si son públicos o privados.
- **A quién le duele:** al recorrido 2. La gente joven acaba encontrándolo; la persona mayor, no.
- **Arreglo mínimo:** debajo de la cabecera, una fila de pastillas «Colección · Deseos · Racks (5)», o al menos «Mi Colección ⌄» con fondo de botón y la palabra «Racks». En la fila de cada rack, «Público» o «Privado» en texto, no solo el candado.
- **Fase:** F5, con F8 para la pastilla.

### 10. Sin sesión, Explorar es Pinterest y no Are.na
- **Pantalla y paso:** `/explorar`.
- **Qué pasa:** el orden es «Lo tienen ellos, tú no», «Cajones…», «Coleccionan como tú», «Lo que todo el mundo busca» (con «2193 lo quieren»: cifras que salen del proveedor, aunque no se le nombre) y, con sesión, «Tu estantería tira a rock». En las tarjetas de rack, «0» y «1» sin etiqueta (34×23).
- **A quién le duele:** a quien llega sin conocer a nadie: no hay una persona por la que empezar arriba.
- **Arreglo mínimo:** el que ya está en el plano. Arriba, lo de la gente que sigues (o, sin sesión, «Empieza por aquí»: Rackr Club y 3 personas); después racks; fuera los rankings. Contadores con su palabra («1 guardado») o sin contadores.
- **Fase:** F6.

### 11. La colección abre en el estante 3D, y el 3D no se puede leer
- **Pantalla y paso:** primera pantalla con cuenta.
- **Qué pasa:** las portadas se apilan a sangre sin título ni artista. Para el lector de pantalla no hay ningún disco: `read_page` solo encuentra los cuatro botones de la cabecera y la barra. En el ejemplo, una portada es un cartel de «Apple Music 2024» en vez de la funda. La cuadrícula, en cambio, se lee bien: 164×205, título 15 px y artista debajo.
- **A quién le duele:** a quien quiere encontrar un disco y a quien usa VoiceOver.
- **Arreglo mínimo:** cuadrícula por defecto en el móvil, con el 3D a un toque y recordado (ya está en el plano). El botón que cambia de vista lleva texto («Estante» / «Cuadrícula»), no solo el icono del modo contrario.
- **Fase:** F6 (la portada de Apple es para F9 y la caché de portadas).

### 12. Quién lo tiene: la sección no enseña personas
- **Pantalla y paso:** hoja de un disco → «Quién más lo tiene».
- **Qué pasa:** el título promete personas y la lista son racks («Mi Colección · de Rackr Club · 106 discos», «Para empezar por algún sitio · de Rackr Club»), sin avatar ni nombre delante. Si una persona lo tiene en tres racks, sale tres veces.
- **A quién le duele:** al recorrido 5, que es el corazón del producto.
- **Arreglo mínimo:** dos bloques. «Lo tienen»: avatares de personas (primero las que sigues), usando la `PersonRow` común. «Está en estos racks»: los racks, sin contar las colecciones, que ya están arriba. Es reordenar lo que ya llega, no pedir datos nuevos.
- **Fase:** F9 (pantalla del disco), o F8 si se hace con `PersonRow`.

---

## Accesibilidad medida (F7)

### 13. El zoom está bloqueado
`<meta viewport … maximum-scale=1, user-scalable=no>` (`app/layout.tsx:102-103`). Quien no ve bien no puede ampliar nada, y menos los textos de 10–11 px. **Arreglo:** quitar `maximumScale` y `userScalable`. Si el estante 3D necesita el gesto de pellizco, que lo capture él (`touch-action`), no la página. **F7.**

### 14. Textos por debajo de 12 px en información que importa
- Barra de pestañas: **10 px**, y las inactivas a **3,51:1**. Es lo que más se mira de la app.
- Artista bajo cada portada en el rack: **11 px a 3,76:1**.
- Landing: «Entrar en silencio» y «Sobre el proyecto» a 11 px; más de 29 textos de la landing a 10 px, en `paper/35` (≈2,4:1) y `paper/25`.
- En el código hay 115 usos de `text-[10px]`, `text-[11px]` y `text-[9px]`.
- **Arreglo:** pestañas a 11–12 px y las inactivas a `paper/60` como mínimo; textos secundarios con el token `content-muted` subido hasta AA (4,5:1 sobre `ink`); 12 px de suelo. **F7.**

### 15. Contraste de controles
«Cambiar» (el que elige dónde se añade el disco): 16 px a **2,12:1**. «Guardar en», «42», «10 discos» y la subetiqueta del escáner están entre 3,5 y 3,8:1. **Arreglo:** «Cambiar» en `paper` o en el acento, y los textos secundarios al token AA. **F7.**

### 16. Toques por debajo de 44 px (medidos)
| Dónde | Control | Tamaño |
|---|---|---|
| Landing | Instalar la app | 149×36 |
| Landing | Entrar en silencio | 125×17 |
| Landing | Reproducir / Siguiente | 13×13 |
| Landing | Prefiero mirar en el navegador | 231×18 |
| Rack | ← Rackr Club | 89×18 |
| Rack | Me gusta (corazón «0») | 38×26 |
| Rack | Más opciones | 36×44 |
| Rack y disco | Escuchar (sobre la portada) | 32×32 |
| Perfil | 8 seguidores / 0 siguiendo | 82×24 / 74×24 |
| Perfil | Pestañas Perfil · Colección · Racks | ×34 |
| Explorar | Seguir (tarjeta de persona) | 36×36 |
| Explorar | Contadores de rack | 34×23 |
| Buscar (Explorar) | TODO / DISCOS / RACKS / USUARIOS / VER TODO | ×15 |
| Buscar (Explorar) | Guardar disco | 28×28 |
| Buscar (Colección) | Discos / Usuarios y racks | ×32 |
| Buscar (Colección) | Cancelar | 63×38 |
| Aviso | Deshacer | 78×28 |
| Hoja del disco | Cerrar / Más opciones | 40×40 |

**Arreglo:** zona táctil de 44 px con `::after` o con padding, sin cambiar el dibujo. **F7.**

### 17. Lo que depende de verlo
- El icono de compartir del rack y del disco no lleva texto.
- La barra de pestañas no da nombre accesible: `read_page` lee los enlaces vacíos aunque el texto se vea.
- **Arreglo:** que el texto de la pestaña sea el nombre accesible (quitar `aria-hidden`, si lo tiene). **F7.**

---

## Entrada sin cuenta

### 18. La pantalla de sonido sigue bloqueando, y antes parpadea
- **Qué pasa:** en cada visita, «Vamos allá» (166×44) / «Entrar en silencio» (125×17, 11 px). Antes de que salga, se pinta medio segundo la landing de debajo y desaparece.
- **Arreglo:** el del plano. La landing se ve directamente y el sonido es un botón «Con sonido» en la esquina. Mientras tanto, como mínimo, que no salga por segunda vez (recordado) y que «Entrar en silencio» sea un botón de 44 px.
- **Fase:** F4.

### 19. Titular enorme en versalitas y «01 / 02 / 03»
«EL CLUB / COLECCIONA / PROYECTA / COMPARTE» a 34 px en mayúsculas son anclas, aunque parecen titular, y debajo vienen «01 · 02 · 03» a 10 px en rojo. Es justo lo que el contrabrief marca como cliché. **Arreglo:** caja normal y fuera los números; el carácter lo dan el estante y las portadas. **F4** (o F8, si va con pulido).

---

## Menores

20. **Aviso que tapa el buscador.** Al añadir un disco, el aviso «Rumours Live → Mi Colec…» sale arriba (top 1 px) y tapa el campo de búsqueda y «Cancelar». Además, el buscador se vacía, así que para añadir otro hay que volver a teclear. **Arreglo:** el aviso abajo, encima de la barra, y la búsqueda se conserva. Cambiar «→» por «añadido a». **F5.**
21. **Escáner sin cámara.** «No pudimos abrir la cámara. Puedes teclear el código a mano.» no dice cómo dar el permiso, y «Listo» es el botón principal aunque no se haya escaneado nada. **Arreglo:** «Para usar la cámara, permítelo en los ajustes del navegador», y «Listo» secundario hasta que haya algo. **F7.**
22. **Punto rojo en Actividad siempre.** Sale sin sesión y con la actividad vacía. **Arreglo:** que solo salga con algo sin leer. **F6.**
23. **Perfil sin sesión: lo secundario va primero.** El perfil abre con «Sus tres» y las gráficas («Cómo suena su estantería», «Géneros 47%») antes que los racks. **Arreglo:** pestaña inicial «Racks», o los racks antes de las gráficas. **F6.**
24. **Perfil propio en el entorno de prueba.** Con la sesión falsa, `/u/vera` enseña «0 discos, 0 racks» y «Seguir», como si no fueras tú. Seguramente es cosa de mezclar sesión falsa y lecturas de Supabase, pero hay que comprobarlo en producción con una cuenta real. **QA.**
25. **Opciones del rack.** «Invitar a editar» sigue a la vista, cuando el plano dice que la colaboración se pausa. **F5.**
26. **Borrar un disco no se puede deshacer, y añadirlo sí.** Al añadir sale «Deshacer». Al borrar sale «Esto no se puede deshacer» con dos botones de 158×44. **Arreglo:** borrar también con aviso y «Deshacer» durante 5 s, sin confirmación. **F5.**
27. **Hidratación en Explorar.** En desarrollo, la consola marca un desajuste de hidratación en `WantedRail`, y la sección parpadea esqueleto → contenido. **Arreglo:** se va con los rankings de F6.

---

## Las dos preguntas de producto

### ¿Quitar un disco de tu colección debería quitarlo también de tus racks?
**Sí, y es lo que ya hace.** Lo he comprobado: «Se borrará de toda tu colección. Rumours desaparecerá de todos tus racks». Desde F3, un rack es una forma de ordenar lo que tienes: un disco que no tienes no puede estar ordenado en tu estantería. Mantenerlo en el rack sería volver a las «dos Mi Colección». Hay tres matices:
- **Deseos queda fuera:** un deseo no está en tu colección, y quitar algo de la colección no lo toca.
- **Quitar de un rack no lo quita de la colección.** Esto ya funciona así y tiene que decirse en la hoja: «Quitar de este rack (sigue en tu colección)».
- **Que se pueda deshacer.** Hoy pide confirmación y no tiene vuelta atrás. Con usuarios mayores, un toque de más no puede vaciar cinco racks: mejor un aviso con «Deshacer» que un diálogo. Y el aviso dice cuántos racks toca: «Quitado de tu colección y de 2 racks · Deshacer».

### ¿Lo que metes en un rack privado debe aparecer en tu colección, que es pública?
**Sí, entra en la colección. Pero la colección tiene que poder ser privada, y el aviso tiene que estar en el momento de guardar.** Si un disco de un rack privado no estuviera en la colección, la colección dejaría de ser «lo que tienes», y volveríamos al problema de F3. «Privado» se refiere al rack (la agrupación, el nombre, la nota), no a la propiedad del disco. Para que nadie se lleve un susto:
- en la hoja de «Rack nuevo» y en las opciones de un rack privado: «Los discos también entran en tu colección. Si no quieres que se vean, haz privada tu colección»;
- la colección con su propio «Pública / Privada» (en el selector ya sale un candado junto a «Mi Colección»: que se entienda qué significa);
- quien de verdad quiere esconder un disco (un regalo, algo que va a vender) tiene la colección privada, o Deseos, que no cuenta como colección.

---

## Orden que propongo para F4–F7

1. **F4 · Entrar sin barreras**, ampliada con las fricciones 1, 2 y 18. Hoy, en el teléfono, no hay forma de entrar sin instalar y el visitante ve una colección y un perfil que no son suyos. Va antes que nada porque corta el recorrido 3 (compartir) en la otra punta: todo enlace que alguien comparta acaba en una persona que no puede entrar. Es poco código: un botón en `EntryDoor`, otro en `InstallScreen` y destinos sin sesión en `TabBar`.
2. **F7 · Accesibilidad, solo la parte barata, a la vez que F4:** el zoom (dos líneas), el suelo de 12 px en las pestañas y en los artistas, el contraste de los secundarios y las zonas táctiles de 44 px. Es CSS y tokens, no toca flujos ni choca con F5. Dejarla para el final es pasarse tres fases revisando pantallas que no se pueden ampliar.
3. **F5 · Un vocabulario y un gesto**, ampliada con las fricciones 3 («Añadir» visible y el vacío que abre la hoja buena), 4 (Compartir en el perfil), 6, 7, 9, 20, 25 y 26. Aquí se juega el listón de «añade su primer disco sin que se lo expliquen».
4. **F6 · Explorar a la Are.na y cuadrícula por defecto**, con las fricciones 5 (rellenar al seguir), 10, 11, 22 y 23.
5. **El resto de F7:** VoiceOver en los 5 recorridos, cuando las pantallas ya no se muevan.

La 12 («Quién lo tiene» con personas) y la 8 (resultados del catálogo legibles) son las dos que más acercan el producto a su idea. Si F9 se queda lejos, las adelantaría como encargo suelto después de F6.

DICE: En el móvil no se puede entrar sin instalar; arreglad la puerta antes de pintar la casa.
