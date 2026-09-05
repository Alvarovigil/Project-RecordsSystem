import type { CatalogueItem } from "@/components/CatalogueSheet";

export type ArtistPayload = {
  artist: { id: number; name: string; image: string | null } | null;
  releases: CatalogueItem[];
};

/**
 * Lo que sabemos de un artista, mientras dure la sesión.
 *
 * La ficha de un disco se abre al instante porque no pide nada: el disco ya
 * está en memoria y su portada ya está pintada detrás. La del artista, en
 * cambio, es otra ruta, y hasta ahora empezaba de cero cada vez que se
 * entraba: misma petición, misma espera, misma foto descargándose otra vez.
 *
 * Aquí se guarda la promesa, no el resultado. Guardar la promesa significa que
 * dos sitios que preguntan a la vez — el enlace que se adelanta y la pantalla
 * que se abre — comparten una sola petición en lugar de hacer dos.
 */
const inflight = new Map<string, Promise<ArtistPayload>>();

const keyOf = (name: string, release?: number | null) =>
  `${name.toLowerCase()}|${release ?? ""}`;

export function getArtist(name: string, release?: number | null): Promise<ArtistPayload> {
  const key = keyOf(name, release);
  const had = inflight.get(key);
  if (had) return had;

  const params = new URLSearchParams({ q: name });
  if (release) params.set("release", String(release));
  const p = fetch(`/api/discogs/artist?${params}`)
    .then((r) => r.json())
    .then((d) => ({
      artist: d.artist ?? null,
      releases: (d.releases ?? []).slice(0, 40) as CatalogueItem[],
    }))
    .catch(() => {
      // un fallo no se queda cacheado: la próxima vez se vuelve a intentar
      inflight.delete(key);
      return { artist: null, releases: [] } as ArtistPayload;
    });

  inflight.set(key, p);
  return p;
}

/**
 * Pedirlo antes de que haga falta.
 *
 * Mientras alguien mira la ficha de un disco, el nombre del artista está ahí
 * como un enlace y hay una posibilidad razonable de que lo pulse. La petición
 * se lanza en ese hueco — el navegador está parado — y la foto se descodifica
 * de paso, así que al pulsar no queda nada que esperar. Si no lo pulsa, lo
 * único que ha costado es una consulta que el servidor ya tenía cacheada.
 */
export function warmArtist(name: string, release?: number | null) {
  if (typeof window === "undefined" || !name) return;
  const run = () =>
    void getArtist(name, release).then((d) => {
      if (!d.artist?.image) return;
      const img = new Image();
      img.src = d.artist.image;
      void img.decode().catch(() => {});
    });

  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void) => void })
    .requestIdleCallback;
  if (idle) idle(run);
  else setTimeout(run, 400);
}
