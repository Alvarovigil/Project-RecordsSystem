# F4 — Revisión de copy (Lyrebird)

Rama `feat/la-puerta`, contra `main`. Leído en el código y comprobado en http://localhost:3345 a 375 px, sin sesión (/entrar, /actividad, /explorar y la landing).

VEREDICTO: APROBADO

No hay nada que bloquee. No hay promesas sin respaldo, ni inglés colado en la interfaz, ni faltas de ortografía, y ninguna acción principal es ambigua. A 375 px no se corta ningún texto: «Entra para guardarlo» ocupa unos 128 px en una píldora de unos 210. Los botones de la landing en caja normal están bien: «Instalar la app» y «Entrar» caben en una sola fila.

Lo que sí hay es el mismo gesto con tres verbos distintos, y conviene arreglarlo antes de subir.

BLOQUEA:
- (nada)

MEJORA (de más a menos importante):

**Un solo verbo para entrar: «Entrar»**
- components/SignInButton.tsx:22 — «Iniciar sesión» → «Entrar». Es la barra de la landing en escritorio. En el resto del producto se dice «Entrar», y el propio comentario de EntryDoor dice que las versalitas son voz de etiqueta, no de botón.
- components/landing/EntryDoor.tsx:79 — «Empezar gratis» → «Entrar gratis». Este botón abre Google, igual que el «Entrar» del móvil en el mismo hueco. Con «Empezar», el de escritorio promete otra cosa.
- app/(app)/entrar/page.tsx:27 y components/landing/AppDoor.tsx:30 — «…en cualquier sitio donde abras sesión» → «…en el móvil y en el ordenador». «Abrir sesión» es un tercer verbo y además es jerga.

**/entrar**
- app/(app)/entrar/page.tsx:26 — «Entra para empezar» → «Entra y empieza tu colección». Ahora mismo no dice qué se empieza, y aquí llega quien ha tocado Colección o Perfil.
- app/(app)/entrar/page.tsx:27 — «Tu colección, tus racks y la gente que sigues, en cualquier sitio donde abras sesión. Gratis y con tu cuenta de Google.» → «Tu colección, tus racks y la gente que sigues, en el móvil y en el ordenador. Es gratis.» El botón de debajo ya dice «Entrar con Google», así que la frase lo repetía.

**Actividad sin sesión**
- components/ActivityView.tsx:96 — «Cuando entres y sigas a alguien, aquí aparecerá lo que van añadiendo, los racks que publican y quién se fija en los tuyos.» → «Cuando entres y sigas a alguien, verás los discos que añade, los racks que publica y quién se guarda los tuyos.» Hay tres problemas:
  - «alguien… van» no concuerda.
  - «Aquí» ya sale en el título.
  - Suelto, «los tuyos» se lee como «tu familia».

**Nota para el navegador de otra app: tres redacciones de lo mismo**
- components/landing/EntryDoor.tsx:146 — «Ábrelo en Safari o Chrome para entrar: toca ⋯ y elige «Abrir en el navegador».»
- components/landing/AppDoor.tsx:89 — «Para entrar, ábrelo en Safari o Chrome: toca ⋯ y elige «Abrir en el navegador».»
- components/install/InstallScreen.tsx:114 — «…Toca ⋯ y elige «Abrir en Safari» o «Abrir en Chrome».»

Propuesta para las tres, la misma frase: «Para entrar, ábrelo en Safari o Chrome: toca ⋯ y busca «Abrir en el navegador».»

El comentario de EntryDoor dice que son «las mismas palabras que /instalar», y no lo son. Pongo «busca» en vez de «elige» porque esa opción no se llama igual en Instagram, Facebook y WhatsApp: entre comillas parece un texto literal que la persona no va a encontrar tal cual.

**Explorar sin sesión**
- components/ExploreView.tsx:530 — «En sus racks» → «De los racks de aquí abajo». Sin sesión no hay un «ellos» antes, así que «sus» no tiene a quién referirse. Ojo: la nota de debajo empieza por «Discos sacados de los racks de aquí abajo», así que si se cambia el título hay que dejar esa nota solo en «Ábrelos y verás quién más los tiene» para el visitante.
- components/ExploreView.tsx:590 — «Gente para empezar» → «Gente con la que empezar». Ahora se lee como «gente para que empiece».
- components/ExploreView.tsx:593 — «Colecciones para mirar antes de tener la tuya.» → «Colecciones que mirar antes de montar la tuya.»
- components/ExploreView.tsx:542-543 — «Cajones que vale la pena abrir» y «Colecciones que alguien ha montado con criterio, no carpetas.» No es de F4, pero está en la misma pantalla, justo debajo de los textos nuevos. Aquí se dicen «cajones» y «colecciones» para lo que son racks, y el contrabrief lo pone como fricción. Propuesta: «Racks que vale la pena abrir» y «Montados con criterio, no carpetas.»

**Deseos**
- components/CatalogueSheet.tsx:224 — «Ya está en tu lista de deseos» y «Añadir a la lista de deseos». Están bien escritos y coinciden con el resto de la app de hoy, pero el glosario acordado es Colección / Racks / Deseos y «Deseos» no aparece todavía en ningún sitio. No lo cambiaría en un solo botón: es un cambio para toda la app de una vez («Añadir a Deseos», «Ya está en Deseos»), y conviene decidirlo antes de que se cuele otra «lista de deseos».

**Detalles**
- components/Landing.tsx:615 — «No hemos podido entrar con Google. Prueba otra vez.» → «No se ha podido entrar con Google. Prueba otra vez.» Quien entra es la persona, no «nosotros». El resto del aviso está bien: dice qué ha pasado y cómo seguir.
- components/landing/EntryDoor.tsx:100-101 y 104-107 — debajo de «…sin cuenta todavía.» vienen «Entrar con Google, sin instalar» y «Mirar sin cuenta»: cinco «sin» en tres líneas. Propuesta: «Se guarda en tu pantalla de inicio y se abre como una app. Sin tienda y sin descarga.» Se quita «sin cuenta todavía», porque «Mirar sin cuenta» ya lo dice justo debajo.
- components/onboarding/Slides.tsx:115 — cuando se abre otra vez desde Ajustes, «Saltar» → «Cerrar». Quien vuelve a ver la presentación no se está saltando nada. «Listo» al final está bien.
- components/mobile/RecordSheet.tsx:378 y components/CatalogueSheet.tsx:210 — «Entra para guardarlo» cabe a 375 px, pero a 320 px se cortaría. Si se quiere margen, «Entra y guárdalo» ocupa unos 102 px frente a 128.

**Bien como está**
- «Mirar sin cuenta»: el mismo texto en las tres puertas.
- «Entrar con Google, sin instalar»: dice las dos cosas que hay que saber.
- «Poner música», «Un momento…» y «Sin música ahora»: cortos, en el registro de Rackr y sin tecnicismos. Mejor que el antiguo «Sin sonido».
- «Cómo funciona» y «La presentación de Rackr, en cinco pantallas»: son cinco de verdad.
- El título de la pestaña «Ajustes».
- El catálogo no se nombra en ningún texto nuevo.

DICE: Para entrar había tres verbos («Entrar», «Empezar gratis», «Iniciar sesión») y tres versiones del aviso de Safari. Que quede uno de cada.

---

## Segunda pasada, después de los cambios de frontend

Lo he comprobado en `git diff main` y en http://localhost:3345 a 375 px.

VEREDICTO: APROBADO

**Aplicado y bien escrito:**
- Entrar:
  - En la landing, «Entrar» en la barra y «Entrar gratis» en el escritorio.
  - Ya no queda «Iniciar sesión», «Empezar gratis» ni «abras sesión» en ningún texto visible.
- /entrar:
  - Título: «Entra y empieza tu colección».
  - Texto: «…en el móvil y en el ordenador. Es gratis.»
- Actividad sin sesión: concuerda, y «los tuyos» ya se refiere a los racks.
- La nota para el navegador de otra app:
  - Es una sola, `IN_APP_NOTE` en lib/site.ts.
  - Se usa en la landing, en la pantalla de la app instalada y en /instalar.
- Explorar:
  - «De los racks de aquí abajo», con la nota sin repetir.
  - «Racks que vale la pena abrir» y «Montados con criterio, no carpetas.»: ya no queda ningún «Cajones».
  - «Gente con la que empezar» y «Colecciones que mirar antes de montar la tuya.»
- El aviso de error: «No se ha podido entrar con Google. Prueba otra vez.»
- El texto bajo «Instalar la app» de la landing: «Sin tienda y sin descarga.»
- Las diapositivas abiertas desde Ajustes: «Cerrar» arriba y «Listo» al final.

**Mejora (no bloquea):**
- components/Landing.tsx:530 — «Del código a tu estantería» → «Del código de barras a tu estantería».
  - Para quien no tiene soltura con el móvil, «código» a secas puede leerse como algo técnico.
  - Si se acortó para que cupiera, se puede dejar como está, porque el texto de debajo ya habla del código de la contraportada.
- «Lista de deseos» sigue en seis sitios. Lo dejo así a propósito: pasar a «Deseos» es una decisión para toda la app de una vez.

DICE: Ya hay un solo verbo para entrar y una sola nota para Safari, y no queda ningún «Cajones». Lo único dudoso es si «código» a secas se entiende.
