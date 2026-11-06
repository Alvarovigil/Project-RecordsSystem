"use client";

import { useEffect } from "react";
import Button from "@/components/ui/Button";
import { Mark } from "@/components/ui/Loading";

/**
 * Lo que se ve cuando algo se ha roto, en vez de «Application error».
 *
 * Una frase humana, sin código ni inglés, y dos salidas: probar otra vez lo
 * mismo, o volver al sitio que siempre funciona. En la app instalada no hay
 * barra del navegador, así que una pantalla de error sin botones es una
 * pantalla de la que solo se sale cerrando la app.
 *
 * Se pinta dentro del marco de la app siempre que el marco sigue en pie, y
 * por eso la barra de pestañas se queda debajo: lo que ha fallado es esta
 * pantalla, no Rackr.
 */
export default function ErrorScreen({
  error,
  reset,
  outside = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /**
   * Fuera de la app (la portada, el QR, los enlaces): quien llega ahí puede no
   * tener colección, y /coleccion sin cuenta lo devolvería a la portada.
   */
  outside?: boolean;
}) {
  useEffect(() => {
    // para quien lo esté depurando; a la persona no se le enseña
    console.error(error);
  }, [error]);

  return (
    <main
      role="alert"
      className="flex min-h-screen-d flex-col items-center justify-center bg-ink px-6 pb-chrome text-center text-paper"
    >
      <Mark size={44} />
      <h1 className="mt-6 text-heading font-medium text-paper">Algo ha fallado</h1>
      <p className="mt-2 max-w-[32ch] text-body text-content-muted">
        {outside
          ? "Esta pantalla no ha cargado. Prueba otra vez o vuelve al inicio."
          : "Esta pantalla no ha cargado. Prueba otra vez o vuelve a tu colección."}
      </p>
      <div className="mt-7 flex w-full max-w-[20rem] flex-col gap-2.5">
        <Button variant="primary" size="lg" block onClick={reset}>
          Reintentar
        </Button>
        <Button variant="ghost" size="lg" block href={outside ? "/" : "/coleccion"}>
          {outside ? "Volver al inicio" : "Volver a tu colección"}
        </Button>
      </div>
    </main>
  );
}
