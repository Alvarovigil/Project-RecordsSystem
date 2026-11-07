import { readFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * La letra de las imágenes para compartir.
 *
 * `ImageResponse` trae una por defecto, y Next 16 la cambió: era Noto Sans y
 * ahora es Geist. Las tarjetas que salen al compartir un perfil, un rack o un
 * disco se habrían visto con otra letra de un día para otro, así que se le
 * pasa la de siempre (mismo fichero, mismo nombre). Se declara con su peso
 * real, 400: Next 14 la registraba como 700 sin serlo. Donde una imagen pide
 * negrita, Satori usa esta (no hay otra) o la engorda él.
 *
 * Licencia: SIL OFL 1.1, en `lib/og/OFL.txt`.
 *
 * Se lee del disco una vez por instancia: con `process.cwd()` y una ruta fija
 * el empaquetado de Vercel sabe que tiene que llevarse el fichero.
 */
let font: Promise<Buffer> | null = null;

export async function ogFonts() {
  font ??= readFile(join(process.cwd(), "lib/og/noto-sans-v27-latin-regular.ttf"));
  return [{ name: "sans serif", data: await font, weight: 400 as const, style: "normal" as const }];
}
