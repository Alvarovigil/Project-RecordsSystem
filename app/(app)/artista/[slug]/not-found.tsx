import { Page } from "@/components/app/AppShell";
import EmptyState from "@/components/ui/EmptyState";

export const metadata = { title: "Artista no encontrado" };

/**
 * Un artista que no está en el catálogo.
 *
 * Aquí se llega desde un enlace viejo o desde un nombre tecleado a mano en la
 * dirección. El tren del 404 general es para una dirección que no existe; esto
 * es otra cosa: la página existe, el artista no. Se dice eso y se ofrece la
 * salida que sí sirve, que es buscarlo.
 */
export default function ArtistNotFound() {
  return (
    <Page width={560}>
      <h1 className="sr-only">Artista no encontrado</h1>
      <div className="pt-16">
        <EmptyState
          title="No encontramos a este artista."
          body="Puede que el nombre esté mal escrito. Búscalo desde Añadir."
          action={{ label: "Volver al inicio", href: "/coleccion" }}
        />
      </div>
    </Page>
  );
}
