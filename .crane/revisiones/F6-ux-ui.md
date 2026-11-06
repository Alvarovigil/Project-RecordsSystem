# F6 «Remate» · Revisión UX/UI (Hummingbird)

Base: cambios sin commitear sobre 631613d. Cómo se ha probado:
- Servidor propio en :3355 con sesión falsa.
- Playwright táctil a 360×740, 375×812, 390×844 y 768×1024, al 100 % y al 130 %, con WebGL (swiftshader) y sin él. Una pasada a 1440×900 con teclado.
- axe-core 4.10 en 9 pantallas y en tres hojas abiertas.
- Sin red: peticiones de datos cortadas y `navigator.onLine` a falso.
- Carga con CPU ×6 y red lenta.
- Capturas en el scratchpad de la sesión (`shots6/`).

```
VEREDICTO: BLOQUEADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- Cabecera de la colección, botón de vista (MobileShelf). Pasa a 360, 375 y 390, y se agrava al 130 %. Capturas: c-360-130%-home, f-375-130-grid y hdr.
  - La palabra de destino sale fuera del botón, suelta debajo del icono. En el estante, «Cuadrícula» flota encima de la primera portada. En la cuadrícula, «Estante» queda como si fuera el título de la sección, justo encima de una cuadrícula. Quien no lee iconos (para quien se puso la palabra) lee «Estante» y ve otra cosa.
  - Al 130 %, los botones redondos crecen de 48 a 62 px porque van en rem. A 360, el de vista (x 16–78) pisa 21 px al del nombre del rack (x 57–230), y el de la ficha (209–271) también lo pisa. Los círculos de cristal se cortan entre sí.
  - Cómo debería quedar: la palabra dentro del botón, debajo del icono y dentro de la misma pastilla de cristal (unos 48×58, en `.label` de 12). Así se lee como parte del botón y nunca encima de una portada. Los botones de la cabecera, fijos en 48 px aunque la letra crezca: solo crece el texto. A 360 al 130 %, ninguna zona táctil se solapa con otra (separación de al menos 8 px).
MEJORA:
- axe no está a 0 en dos pantallas:
  - `/actividad` no tiene `h1` (`page-has-heading-one`).
  - En `/demo`, la banda queda fuera de los puntos de referencia (`region`): debería ser `<aside aria-label="Colección de ejemplo">`.
  - Las otras 7 pantallas y las 3 hojas: 0. Las hojas tienen nombre: «Rumours, de Fleetwood Mac», «Guardar en», «Buscar un disco».
- Ficha al 130 % a 360: los títulos de las canciones se cortan en 8 o 9 letras («Second H…», «Never Goi…», «Go Your …»). Que el título baje a dos líneas, o que se esconda la duración cuando no cabe.
- Tableta, perfil a 768: sigue con scroll lateral (776 sobre 768). Ya venía de F5.
- El teclado que sube el pie de la hoja no se puede emular en Chromium: que QA lo compruebe en un iPhone de verdad.
- La marca que espera al primer fotograma: en dev, con CPU ×6, no hay ningún fotograma negro (16 de 16 con la marca). Pero a los 9 s seguía la marca, y en dev no se distingue si es la espera o la descarga. Lo del tiempo máximo, que QA lo confirme en el build de producción.
```

Comprobado y bien:
- **Navegar.** Explorar → Colección no enseña la marca: a los 400 ms ya está el estante. Después de recargar, un solo «atrás» vuelve a Explorar.
- **Hojas apiladas.** Al cerrar la de arriba («Guardar en» → Listo), el fondo sigue bloqueado y no se mueve.
- **Explorar sin conexión.** Sale «Sin conexión · Cuando vuelva la conexión, esto se carga solo» con «Reintentar» (112×44), y se recupera sola al volver la red. `/explorar?q=rumours` rellena el buscador.
- **Vista recordada.** Después de recargar se queda en la cuadrícula. La palabra cambia bien: «Cuadrícula» / «Estante» (lo que falla es dónde está).
- **Cabecera al 130 %.** «Mi Colección» cabe entera, con el «40» debajo.
- **Ficha al 130 %.** La barra esconde la miniatura y «Rumours» cabe. «Quién más lo tiene» va en dos líneas y no corta los nombres de los racks.
- **Foco a 1440.** 2 px sólido, con 2 px de separación, en toda la cabecera. El escritorio a 1440 y la tableta en la colección y en Explorar, sin roturas.

**Limpieza.** Servidor parado, `.next-rv-ux` borrado y mi línea fuera de `tsconfig.json` (la de `.next-rv-qa` no es mía). `data/` y `public/covers/` sin cambios.

DICE: El remate está casi: solo la palabra de vista, suelta fuera del botón, que al 130 % pisa el nombre del rack. Metedla dentro y fijad 48 px.

---

## Ronda 2

Misma configuración: servidor en :3355 con sesión falsa, táctil a 360×740, 375×812 y 390×844, al 100 % y al 130 %, y 768 para el perfil. Capturas en `shots7/` del scratchpad.

```
VEREDICTO: APROBADO
BLOQUEA (pantalla o componente, tamaño, captura, qué falla y cómo debería quedar):
- (nada)
MEJORA:
- Insignia «+» de la lupa al 130 % (g-360-130%-shelf, g-390-130%-grid): la insignia crece con la letra (rem), el icono no, y tapa casi entera la lupa. Que la insignia vaya en px fijos (unos 16) como el círculo de 48. La etiqueta accesible ya dice «Añadir o buscar».
- «Explorar con mala cobertura sin recargar» (lo de QA): no lo he podido reproducir con mi simulación, porque Next pasó a una navegación completa. Que QA lo confirme con su prueba.
```

Comprobado:
- **Cabecera de la colección, en las seis combinaciones.**
  - La palabra va dentro de la cápsula del botón: «Cuadrícula» en 78×53 y «Estantería» en 73×53. Ya no flota sobre las portadas ni parece un título.
  - Al 130 % a 360 y a 375, el botón queda solo con el icono (48×48), con la palabra en `aria-label`. A 390 al 130 % cabe con la palabra (88×62).
  - Los círculos van fijos a 48 px, con separación de 8 a 19 px entre zonas.
  - «Mi Colección» entero y quieto (sw = cw, sin animación), con el «40» debajo.
- **Canciones al 130 %.** Pasan a dos líneas («Second / Hand News»), sin «…». Al 100 % siguen en una línea, salvo la que no cabe.
- **axe.** 0 en `/actividad` (con `h1` «Actividad») y en `/demo`.
- **Perfil a 768.** Sin scroll lateral en `/u/alvaro` ni en su colección (768/768).
- **Limpieza.** Servidor parado, `.next-rv-ux` borrado y quitada solo mi línea de `tsconfig.json`. `data/` y `public/covers/` sin cambios.

DICE: La palabra ya vive dentro del botón y «Mi Colección» se queda quieta y entera. Aprobado; solo falta fijar en px la insignia del «+».
