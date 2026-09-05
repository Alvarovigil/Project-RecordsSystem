"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { useImagesReady } from "@/hooks/useImagesReady";
import FadeImage from "@/components/ui/FadeImage";
import { Reveal, SkeletonCovers, useDeadline } from "@/components/ui/Skeleton";
import CatalogueSheet, { type CatalogueItem } from "@/components/CatalogueSheet";
import RecordSheet from "@/components/mobile/RecordSheet";
import { useLibrary } from "@/hooks/useLibrary";
import { useToast } from "@/components/ui/Toast";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist, findArtist } from "@/lib/artist";
import { getArtist } from "@/lib/artist-cache";
import { findCollection, findWishlist, resolveCollections } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";

/**
 * Everything of one artist: what you have, and what you are missing.
 *
 * The second half is the reason this page exists. A list of the four Rosalía
 * records you already own is a filter, and you could get that from the search
 * box; the interesting screen is the one that also shows the six you do not
 * have, because that is the question a collector actually asks about an
 * artist they like.
 *
 * Your own records come from the library, so they are on screen in the frame
 * this mounts. The rest is one narrow Discogs query — see the `artist`
 * parameter in the search route — and it arrives when it arrives, under a
 * skeleton, without holding up the half that was already known.
 */
export default function ArtistView({ slug }: { slug: string }) {
  const lib = useLibrary();
  const toast = useToast();
  const router = useRouter();

  const [portrait, setPortrait] = useState<{ image: string | null; name: string } | null>(null);
  const [looking, setLooking] = useState<CatalogueItem | null>(null);
  const [open, setOpen] = useState<Vinyl | null>(null);
  /* recién guardado: la pantalla del disco llega con la hoja de racks puesta */
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<Record<number, true>>({});

  const group = useMemo(() => findArtist(lib.releases, slug), [lib.releases, slug]);
  const name = group?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const collections = useMemo(
    () =>
      resolveCollections(
        lib.lists.map((l) => ({
          id: l.id,
          name: l.title,
          vinylIds: lib.idsOf(l.id),
          kind: l.kind,
        })),
        lib.releases.map((r) => r.id),
      ),
    [lib.lists, lib.releases, lib.idsOf],
  );
  const mine = findCollection(collections);

  /**
   * The artist, identified rather than matched.
   *
   * This used to ask the catalogue for the *name* and print everything that
   * came back — which is how a page for Rosalía filled up with a 1970s Spanish
   * singer's singles. Different people who share a word, and Discogs knows it:
   * every release names its artist by id.
   *
   * So when the shelf already holds one of their records, its id is what gets
   * sent, and the answer cannot be about somebody else. Only for an artist
   * whose records you do not have yet does it fall back to the name.
   */
  const anchor = group?.records.find((r) => r.discogsId)?.discogsId ?? null;

  /**
   * Una petición por artista, y no una por cada cambio de la biblioteca.
   *
   * Esto dependía de `group` y de `lib.releases` — dos objetos cuya identidad
   * cambia cada vez que la biblioteca se refresca, que al arrancar es dos
   * veces: primero la copia guardada y después el servidor. Cada cambio
   * volvía a poner la pantalla en carga y a pedir el artista otra vez, y eso
   * es exactamente lo que se veía: la página montándose, deshaciéndose y
   * volviéndose a montar.
   *
   * La petición depende solo de a quién se está mirando. Lo que hay que quitar
   * de la lista — lo que ya tienes — se calcula después, aquí abajo, que es
   * donde correspondía desde el principio.
   */
  const [catalogue, setCatalogue] = useState<CatalogueItem[] | null>(null);

  useEffect(() => {
    if (!name) return;
    let alive = true;
    setCatalogue(null);
    setPortrait(null);

    getArtist(name, anchor).then((d) => {
      if (!alive) return;
      if (d.artist) setPortrait({ image: d.artist.image ?? null, name: d.artist.name });
      setCatalogue(d.releases);
    });
    return () => {
      alive = false;
    };
  }, [name, anchor]);

  /**
   * Lo que te falta, que son los álbumes y no las ediciones.
   *
   * Cruzar solo por id de edición no basta: tener el reprensado de 2019 de
   * Motomami tiene que esconder Motomami, y son dos ids distintos. Así que un
   * título que ya está en la estantería quita la fila, sea la prensada que
   * sea.
   */
  const key = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "");
  const more = useMemo(() => {
    if (catalogue === null) return null;
    const ownedIds = new Set(lib.releases.map((v) => v.discogsId));
    const ownedTitles = new Set((group?.records ?? []).map((v) => key(v.title)));
    return catalogue
      .filter((r) => !ownedIds.has(r.id) && !ownedTitles.has(key(r.title)))
      .slice(0, 24);
  }, [catalogue, lib.releases, group]);

  /**
   * De dónde sale el color del fondo.
   *
   * Del retrato si lo hay, y si no de la portada de uno de sus discos: lo que
   * no puede pasar es que la cabecera se quede en negro plano mientras la
   * ficha de cualquiera de esos discos sí tiene fondo. Una funda vacía es el
   * último recurso, el mismo que usa el resto de la aplicación.
   */
  const heroImage =
    portrait?.image ??
    (group?.records[0] ? coverFor(group.records[0]) : null) ??
    "/sleeve-vacio.jpg";

  /** Compartir es la única acción que tiene sentido aquí, y es la del disco. */
  const share = async () => {
    const url = typeof window === "undefined" ? "" : window.location.href;
    const title = portrait?.name || name;
    try {
      if (navigator.share) await navigator.share({ title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.show("Enlace copiado");
      }
    } catch {
      /* cancelar el diálogo del sistema no es un error */
    }
  };

  const save = async (item: CatalogueItem): Promise<Vinyl | null> => {
    if (!mine) return null;
    let kept: Vinyl | null = null;
    setSaving(item.id);
    try {
      const res = await fetch("/api/discogs/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: item.id }),
      });
      const payload = await res.json();
      if (!payload.vinyl) throw new Error("no vinyl");
      await lib.saveToList(payload.vinyl, mine.id);
      setSaved((s) => ({ ...s, [item.id]: true }));
      kept = payload.vinyl as Vinyl;
      toast.show(`${payload.vinyl.title} → ${mine.name}`, {
        media: { src: coverFor(payload.vinyl) },
      });
    } catch {
      toast.show("No se pudo añadir ese disco.", { tone: "error" });
    } finally {
      setSaving(null);
    }
    return kept;
  };

  const wish = async (item: CatalogueItem) => {
    const list = findWishlist(collections);
    if (!list) return;
    try {
      const res = await fetch("/api/discogs/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ releaseId: item.id }),
      });
      const payload = await res.json();
      if (!payload.vinyl) throw new Error("no vinyl");
      await lib.saveToList(payload.vinyl, list.id);
      toast.show(`${payload.vinyl.title} → ${list.name}`, {
        media: { src: coverFor(payload.vinyl) },
      });
      setLooking(null);
    } catch {
      toast.show("No se pudo apuntar ese disco.", { tone: "error" });
    }
  };

  const owned = group?.records ?? [];

  /**
   * El género, del disco que sea: primero de los tuyos, y si no, del catálogo.
   *
   * El que más se repite y no el primero que aparece — una ficha suelta mal
   * etiquetada no puede decidir de qué va un artista entero.
   */
  const genre = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of [...owned.map((v) => v.genre), ...(catalogue ?? []).map((r) => r.genre)]) {
      const clean = (g ?? "").split(",")[0]?.trim();
      if (clean) counts.set(clean, (counts.get(clean) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }, [owned, catalogue]);

  /** cuántos suyos se conocen en total: los tuyos más los que te faltan */
  const total = owned.length + (more?.length ?? 0);

  /**
   * Una sola puerta de carga para toda la pantalla.
   *
   * Esta página se montaba a trozos delante de quien la abría: primero el
   * nombre sacado del slug, luego la foto — que cambia de sitio todo lo que
   * hay debajo —, luego un chip más, luego la rejilla. Cada pieza que entra
   * empuja a la anterior, y eso se lee como lentitud aunque el tiempo total
   * sea el mismo.
   *
   * Las dos cosas que faltan llegan en la misma petición, así que hay un solo
   * momento en el que la pantalla está completa: cuando esa petición contesta
   * y la foto está descodificada. Hasta entonces se enseña el hueco con su
   * forma exacta; después entra todo junto.
   *
   * Con un plazo, claro: si el catálogo no contesta en dos segundos y medio se
   * enseña lo que haya — el nombre y un fondo — porque una pantalla en blanco
   * esperando a estar perfecta es una pantalla rota.
   */
  const answered = more !== null;
  const heroDecoded = useImagesReady(answered ? [heroImage] : []);
  const impatient = useDeadline(4000);
  const ready = (answered && heroDecoded) || impatient;

  return (
    <Page width="full">
      {/**
       * La misma cabecera que un disco, con una persona dentro.
       *
       * Era un encabezado de documento: una miniatura de 92px, la palabra
       * «Artista» en versalitas y un título a la izquierda. La ficha de un
       * disco, a dos pantallas de distancia, es una portada grande sobre su
       * propio color con el nombre centrado debajo — y las dos son la misma
       * clase de página: una cosa del catálogo que has ido a mirar.
       *
       * Así que la foto ocupa la parte de arriba entera y se disuelve hacia
       * abajo en el fondo de la aplicación, con el nombre apoyado en ese
       * degradado. Sin marco: una funda tiene bordes que respetar y una cara
       * no, y meter el retrato en un círculo sobre una copia difuminada de sí
       * mismo era dibujar dos veces la misma imagen. Debajo, los números que
       * sí se pueden contar de un artista en lugar de los chips de una
       * edición.
       */}
      <header
        className="relative -mx-5 mb-8 pb-2 sm:-mx-8"
        style={{ marginTop: "calc(-1 * max(1.5rem, var(--safe-top)))" }}
      >
        <div className="relative z-10 flex h-16 items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            aria-label="Atrás"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-ink/38 text-paper backdrop-blur-xl transition-colors hover:bg-ink/60"
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M11.5 3.5 L5.5 9 L11.5 14.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            onClick={share}
            aria-label={`Compartir a ${portrait?.name || name}`}
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-ink/38 text-paper backdrop-blur-xl transition-colors hover:bg-ink/60"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M8 10.5V2.6 M5 5.4 L8 2.4 L11 5.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3.2 9.4v3.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V9.4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        {/**
         * La foto a sangre, y el nombre encima de ella.
         *
         * El retrato estaba metido en un círculo sobre un fondo difuminado —
         * un marco dentro de otro marco, con la misma imagen dos veces. Una
         * cara no es una funda: no tiene bordes que respetar ni proporción que
         * defender, así que ocupa el ancho entero y se disuelve hacia abajo en
         * el fondo de la aplicación. El degradado hace de suelo donde apoyar el
         * nombre, que es lo que evita tener que oscurecer la foto entera para
         * poder leerlo.
         */}
        <Reveal
          ready={ready}
          className="relative -mt-16"
          skeleton={
            /* El mismo hueco, a la misma altura y con las mismas piezas: si el
               esqueleto no mide lo que va a medir el contenido, el salto que
               evita se lo provoca él. */
            <div>
              <div className="skeleton h-[58svh] max-h-[520px] w-full" style={{ borderRadius: 0 }} />
              <div className="relative -mt-28 mx-auto w-full max-w-[440px] px-5">
                <div className="skeleton mx-auto h-7 w-1/2 rounded-full" />
                <div className="mt-5 flex justify-center gap-1.5">
                  <div className="skeleton h-6 w-20 rounded-full" />
                  <div className="skeleton h-6 w-28 rounded-full" />
                </div>
              </div>
            </div>
          }
        >
          <div>

          <div className="relative h-[58svh] max-h-[520px] w-full overflow-hidden">
            {/* La foto puede cambiar bajo los pies: hasta que el catálogo
                contesta, ahí está la portada de uno de sus discos difuminada.
                El cambio se funde en vez de parpadear. */}
            <FadeImage
              src={heroImage}
              alt={portrait?.image ? `Foto de ${portrait?.name || name}` : ""}
              eager
              className="h-full w-full"
              imgClassName={`object-cover object-top ${portrait?.image ? "" : "scale-125 blur-2xl"}`}
            />
            {/* El mismo degradado de seis paradas que la ficha de un disco: casi
                nada durante el primer tercio, y negro con sitio de sobra antes
                de las palabras. */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom," +
                  "rgba(10,10,10,0.35) 0%," +
                  "rgba(10,10,10,0.06) 22%," +
                  "rgba(10,10,10,0.14) 44%," +
                  "rgba(10,10,10,0.44) 62%," +
                  "rgba(10,10,10,0.78) 78%," +
                  "rgba(10,10,10,0.95) 90%," +
                  "#0a0a0a 100%)",
              }}
            />
          </div>

          <div className="relative -mt-28 mx-auto w-full max-w-[440px] px-5 text-center">
            <h1 className="text-title font-medium leading-tight text-paper">
              {portrait?.name || name}
            </h1>

            {/**
             * Dos datos, y los dos dicen algo.
             *
             * «Artista» era una etiqueta que repetía lo que ya se ve — hay una
             * cara y un nombre encima —, y «4 discos tuyos» junto a «24 por
             * descubrir» son dos mitades de la misma cuenta puestas a
             * competir. Un género sitúa a quien no lo conoce, y una fracción
             * dice de un vistazo por dónde vas: 4 de 28 es una respuesta, 4 y
             * 24 son dos números que hay que sumar.
             */}
            <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
              {genre && (
                <li className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary">
                  {genre}
                </li>
              )}
              {total > 0 && (
                <li className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary">
                  <span style={{ fontVariantNumeric: "tabular-nums" }}>
                    {owned.length}/{total}
                  </span>{" "}
                  discos
                </li>
              )}
            </ul>

            {owned.length === 0 && (
              <p className="mt-4 text-sub text-content-muted">Todavía no tienes ninguno suyo.</p>
            )}
          </div>
          </div>
        </Reveal>
      </header>

      {/* Las rejillas entran con la cabecera y no antes: la de tu colección es
          local y estaría lista al instante, pero enseñarla mientras arriba
          todavía hay un hueco gris es exactamente la sensación de página que se
          va montando sola. */}
      <Reveal
        ready={ready}
        skeleton={
          <SkeletonCovers
            n={12}
            cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-6"
            gap="gap-x-4 gap-y-7"
          />
        }
      >
        {owned.length > 0 && (
          /**
           * Lo tuyo, en un carrusel; lo que te falta, en rejilla.
           *
           * No es una inconsistencia: son dos cosas distintas. Lo que ya
           * tienes es un recordatorio — normalmente tres o cuatro discos — y
           * una rejilla de tres columnas con una fila y media pide una
           * pantalla entera para decir algo que cabe en un vistazo. Lo que te
           * falta es un catálogo para recorrer, y eso sí es una rejilla.
           */
          <section className="pb-10">
            <SectionTitle>En tu colección</SectionTitle>
            <ul className="rail rail-page mt-4 flex gap-3.5 pb-1">
              {owned.map((v, i) => (
                <li key={v.id} className="w-[136px] shrink-0 snap-start sm:w-[160px]">
                  <button onClick={() => setOpen(v)} className="pressable block w-full text-left">
                    <Cover
                      src={coverFor(v)}
                      eager={i < 4}
                      className="aspect-square w-full rounded-[3px]"
                    />
                    <span className="mt-2.5 block truncate text-sub font-medium text-paper">
                      {v.title}
                    </span>
                    <span className="mt-0.5 block truncate text-caption text-content-muted">
                      {v.year || ""}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-line pb-16 pt-8">
          <SectionTitle
            note={
              owned.length > 0
                ? "Del catálogo, sin lo que ya tienes."
                : "Del catálogo. Toca uno para ver su ficha."
            }
          >
            {owned.length > 0 ? "Lo que te falta" : `Discos de ${name}`}
          </SectionTitle>

          <div className="mt-5">
            {more === null ? (
              <SkeletonCovers n={12} cols="grid-cols-3 sm:grid-cols-4 lg:grid-cols-6" gap="gap-x-4 gap-y-7" />
            ) : more.length === 0 ? (
              <EmptyState
                compact
                title="No hemos encontrado más"
                body="O lo tienes todo suyo, o el catálogo no ha querido contestar esta vez."
                action={{ label: "Buscar a mano", href: "/explorar?buscar=1" }}
              />
            ) : (
              <ul className="grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
                {more.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => setLooking(r)}
                      className="pressable block w-full text-left"
                    >
                      <span className="relative block">
                        <Cover
                          src={r.cover_image ?? r.thumb ?? "/sleeve-vacio.jpg"}
                          className="aspect-square w-full rounded-[3px]"
                        />
                        {saved[r.id] && (
                          <span className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-ink/75 text-paper backdrop-blur-xl">
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                              <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                      </span>
                      <span className="mt-2 block truncate text-sub text-paper/85">
                        {r.title.replace(new RegExp(`^${escapeRe(name)}\\s+-\\s+`, "i"), "")}
                      </span>
                      <span className="block truncate text-caption text-content-muted">
                        {[r.year, r.country].filter(Boolean).join(" · ")}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </Reveal>

      <CatalogueSheet
        item={looking}
        onClose={() => setLooking(null)}
        targetName={mine?.name ?? "Mi Colección"}
        saved={Boolean(looking && saved[looking.id])}
        busy={saving === looking?.id}
        onSave={() => (looking ? save(looking) : null)}
        onSaved={(v) => {
          setLooking(null);
          setJustSaved(true);
          setOpen(v);
        }}
        onWish={() => looking && void wish(looking)}
        collections={collections}
        coverOf={(id) => {
          const v = lib.releases.find((x) => x.id === id);
          return v ? coverFor(v) : null;
        }}
        onAddToList={(listId, v) => void lib.saveToList(v, listId)}
        onRemoveFromList={(listId, v) => void lib.removeFromList(listId, v.id)}
      />

      <RecordSheet
        vinyl={open}
        onClose={() => {
          setOpen(null);
          setJustSaved(false);
        }}
        pickOnOpen={justSaved}
        collections={collections}
        activeListId={mine?.id ?? ""}
        playing={false}
        onTogglePlay={() => {}}
        onAddTo={(listId, v) => void lib.saveToList(v, listId)}
        onRemoveFromActive={(v) => void lib.removeFromList(mine?.id ?? "", v.id)}
        onRemoveFromList={(listId, v) => void lib.removeFromList(listId, v.id)}
        coverOf={(id) => {
          const v = lib.releases.find((x) => x.id === id);
          return v ? coverFor(v) : null;
        }}
        onDelete={(v) => void lib.deleteRelease(v.id)}
      />
    </Page>
  );
}

/**
 * El título de una sección, con su misma medida en las dos que hay.
 *
 * Estaban escritos a mano y con distinto aire encima y debajo, y el primero se
 * comía el degradado de la cabecera. Uno solo, con su nota opcional debajo, y
 * el ritmo lo fija la sección y no la frase.
 */
function SectionTitle({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div>
      <h2 className="text-heading font-medium leading-tight text-paper">{children}</h2>
      {note && <p className="mt-1.5 text-sub text-content-muted">{note}</p>}
    </div>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { artistSlug, cleanArtist };
