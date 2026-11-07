# F8 — Revisión de copy (Lyrebird)

Fase «Remate fino». Leído en `git diff 1485553` y en el archivo nuevo `components/explore/ExploreFrame.tsx`. No he arrancado la app.

VEREDICTO: APROBADO

No hay nada que bloquee:
- No hay inglés.
- No se nombra al proveedor.
- No hay faltas.
- Los errores nuevos dicen qué pasó y cómo seguir, sin culpar a nadie, y todos llevan «Reintentar». El de búsqueda añade «Borrar búsqueda».

**El armazón y la vista final dicen lo mismo.** Lo he comprobado con sesión y sin ella.
- Los títulos y las notas salen de las mismas constantes (`OTHERS.member`, `OTHERS.visitor` y `RACKS`), así que no pueden separarse:
  - **Con sesión:** «Lo tienen ellos, tú no», con la nota «Discos sacados de los racks de aquí abajo. Ábrelos y verás quién más los tiene.»
  - **Sin sesión:** «De los racks de aquí abajo», con la nota «Ábrelos y verás quién más los tiene.»
  - **Racks:** «Racks que vale la pena abrir» / «Montados con criterio, no carpetas.»
- También coinciden:
  - «Búsquedas recientes»;
  - el `h1` oculto «Explorar»;
  - el buscador («Buscar» y «Buscar discos, racks o personas»);
  - «Quitar {búsqueda} del historial».
- El armazón no pinta «Se está moviendo» ni la sección de gente. No es un problema de texto: cuando llegan, entran con sus palabras de siempre.

BLOQUEA:
- (nada)

MEJORA:

**1. Una sola voz para el mismo fallo en la misma pantalla** (components/ExploreView.tsx)
- Explorar dice tres cosas distintas para lo mismo:
  - en las notas de las secciones: «No se ha podido cargar. Puede ser la conexión.»;
  - en el aviso de racks: «No hemos podido cargar Explorar»;
  - en la búsqueda: «No hemos podido buscar».
- Se mezclan «se ha» y «hemos».
- Propuesta: «hemos» en los tres, que es la voz de Rackr cuando lo que falla es suyo (como en «No hemos podido consultar el catálogo»). La nota quedaría así: «No hemos podido cargarlo. Puede ser la conexión.»

**2. Sin conexión, dos redacciones**
- La nota dice «Sin conexión. Cuando vuelva, esto se carga solo.»
- El aviso de racks dice «Cuando vuelva la conexión, esto se carga solo.»
- Las dos están bien, pero conviene que sea una. Propuesta: la del aviso, que no deja «vuelva» sin sujeto.
- En la búsqueda, «Cuando vuelva la conexión, prueba otra vez.» está bien distinto: buscar no se reintenta solo.

**3. «Usuarios» en las pestañas de la búsqueda** (ExploreView:558)
- No es de esta fase, solo se ha movido de sitio, pero ahora queda al lado del buscador, que dice «Buscar discos, racks o personas».
- El glosario dice «Personas». Propuesta: la pestaña «Personas» y el título de la sección de resultados (:1012) también «Personas».
- Lo mismo pasa con «Vinilos» (:904) frente a «Discos». Que lo decida quien lleve el glosario, pero el buscador ya promete «discos».

DICE: El armazón y la vista dicen lo mismo con sesión y sin ella. Falta una sola voz para «no ha cargado» y que «Usuarios» sea «Personas».
