"use client";

import ErrorScreen from "@/components/app/ErrorScreen";

/**
 * Un fallo dentro de la app se queda dentro de la pantalla que falló.
 *
 * Este límite vive bajo el layout de la app, así que la barra de pestañas, el
 * reproductor y los avisos siguen montados: se puede ir a otra pestaña sin
 * tener que cerrar nada.
 */
export default function AppError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorScreen {...props} />;
}
