# F7 — Revisión de copy (Lyrebird)

Fase «Cimientos». Leído en `git diff 8c3396a`. Casi todo el diff es por dentro: temporizadores, esqueletos y el componente `Hold`. Los textos visibles nuevos son tres, y todos están en Explorar.

VEREDICTO: APROBADO

No hay nada que bloquee:
- No hay inglés.
- No se nombra al proveedor.
- No hay faltas.
- No hay ningún `aria-label` nuevo. Los esqueletos llevan `aria-hidden`, que es lo correcto: un lector de pantalla no tiene por qué anunciar cajas grises.
- La nota del pulso dice «…en sus estanterías», con la palabra que propuse en F6 para toda la app.

BLOQUEA:
- (nada)

MEJORA:

**1. «Ahora mismo no hay nada en esos racks que no tengas ya.»** (components/ExploreView.tsx:660)
- Para el caso para el que se escribió (con sesión, hay racks y todos sus discos ya los tienes) está bien. Dice por qué el hueco está vacío y no culpa a nadie.
- Pero el mismo texto sale en dos casos más, porque la condición de vacío es `lists.length === 0 || findsCount === 0`, y en esos dos no es verdad:
  - **No hay racks.** «Esos racks» no se refiere a nada. Además, el título sin sesión es «De los racks de aquí abajo», y abajo no hay racks.
  - **Sin sesión.** «Que no tengas ya» supone una colección que el visitante no tiene.
- Propuesta, una nota por caso:
  - Con sesión y con racks: se deja como está.
  - Sin racks: «Todavía no hay racks de otros que mirar.»
  - Sin sesión: «Ahora mismo no hay discos que enseñar aquí.»
- La nota solo se ve un momento, hasta que `Hold` cierra el hueco, así que no bloquea. Pero lo que se ve tiene que ser verdad.

**2. Las notas mientras cargan**
- Mientras los carriles cargan, las secciones enseñan ya su título y su nota de verdad:
  - «Se está moviendo» / «Lo que otros acaban de colocar en sus estanterías.»
  - «Coleccionan como tú» / «Puede que os solapéis más de lo que crees.»
  - «Gente con la que empezar» / «Colecciones que mirar antes de montar la tuya.»
- Está bien: no prometen nada que el esqueleto no vaya a cumplir.
- La única pega es que la sección de gente, si al final queda vacía y a la vista, se queda con su título y sin explicar por qué no hay nada, porque no tiene `fallback`. Si se le añade, propuesta:
  - con sesión: «Todavía no hay nadie con una colección parecida a la tuya.»;
  - sin sesión: «Todavía no hay colecciones que enseñar.»

DICE: Fase casi sin textos y sin fallos. Solo la nota del hueco vacío miente cuando no hay racks o no hay sesión: una frase por caso.
