"use client";

import "./globals.css";
import { Inter } from "next/font/google";
import ErrorScreen from "@/components/app/ErrorScreen";

/* La misma Inter que el layout raíz: este documento lo sustituye entero, y sin
   ella la pantalla salía en system-ui y dejaba de parecer Rackr. */
const sans = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

/**
 * El último límite: cuando lo que falla es el propio layout raíz.
 *
 * Next lo pinta en lugar de todo el documento, así que trae su propio `html`
 * y `body`. Sin él, un fallo aquí era la página en blanco de «Application
 * error», en inglés y sin salida.
 */
export default function GlobalError(props: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="es" className={sans.variable}>
      <body className="grain bg-ink">
        <ErrorScreen {...props} outside />
      </body>
    </html>
  );
}
