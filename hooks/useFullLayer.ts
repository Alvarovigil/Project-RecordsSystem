"use client";

import { useEffect } from "react";

/** cuántas capas a pantalla completa hay abiertas a la vez (buscador + escáner) */
let open = 0;

/**
 * Una capa que tapa la pantalla entera: sin barra de pestañas ni reproductor.
 *
 * El aviso (Toast) se coloca en el teléfono encima de esa barra. Dentro del
 * buscador o del escáner la barra no está, y el aviso flotaba a media altura
 * sobre el campo «Teclea el código». Mientras haya una de estas capas abierta,
 * `<html data-full-layer>` baja el aviso a la zona segura (ver
 * `--toast-bottom` en globals.css). Se cuenta, no se alterna: el escáner se
 * abre encima del buscador, y cerrar uno no puede quitárselo al otro.
 */
export function useFullLayer(active: boolean) {
  useEffect(() => {
    if (!active) return;
    open += 1;
    document.documentElement.dataset.fullLayer = "";
    return () => {
      open = Math.max(0, open - 1);
      if (open === 0) delete document.documentElement.dataset.fullLayer;
    };
  }, [active]);
}
