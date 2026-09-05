import { Page } from "@/components/app/AppShell";
import { SkeletonCovers } from "@/components/ui/Skeleton";

/**
 * El hueco de la ficha de un artista, mientras Next trae la ruta.
 *
 * Aquí estaba la diferencia que se notaba. Abrir un disco es una capa que se
 * levanta sobre la pantalla en la que ya estabas: el disco está en memoria y su
 * portada ya está pintada detrás, así que no hay nada que esperar. Ir al
 * artista es cambiar de ruta — el navegador tiene que traerse la página — y sin
 * esto la aplicación se quedaba en la pantalla anterior unos cuantos
 * fotogramas y luego saltaba a la nueva a medio montar.
 *
 * Con un `loading` la navegación pinta en el mismo fotograma del toque, y lo
 * que pinta es exactamente la forma que va a tener la página: la foto, el
 * nombre, los dos chips. Después el contenido entra en su sitio en vez de
 * empujarlo.
 */
export default function LoadingArtist() {
  return (
    <Page width="full">
      <div
        className="relative -mx-5 mb-8 pb-2 sm:-mx-8"
        style={{ marginTop: "calc(-1 * max(1.5rem, var(--safe-top)))" }}
      >
        <div className="skeleton h-[58svh] max-h-[520px] w-full" style={{ borderRadius: 0 }} />
        <div className="relative -mt-28 mx-auto w-full max-w-[440px] px-5">
          <div className="skeleton mx-auto h-7 w-1/2 rounded-full" />
          <div className="mt-5 flex justify-center gap-1.5">
            <div className="skeleton h-6 w-20 rounded-full" />
            <div className="skeleton h-6 w-24 rounded-full" />
          </div>
        </div>
      </div>

      <SkeletonCovers n={12} cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" gap="gap-x-4 gap-y-7" />
    </Page>
  );
}
