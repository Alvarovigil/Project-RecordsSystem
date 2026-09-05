"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCovers } from "@/components/ui/Skeleton";
import CatalogueSheet, { type CatalogueItem } from "@/components/CatalogueSheet";
import { RecordGround } from "@/components/record/RecordHero";
import RecordSheet from "@/components/mobile/RecordSheet";
import { useLibrary } from "@/hooks/useLibrary";
import { useToast } from "@/components/ui/Toast";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist, findArtist } from "@/lib/artist";
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

  const [more, setMore] = useState<CatalogueItem[] | null>(null);
  const [portrait, setPortrait] = useState<{ image: string | null; name: string } | null>(null);
  const [looking, setLooking] = useState<CatalogueItem | null>(null);
  const [open, setOpen] = useState<Vinyl | null>(null);
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

  useEffect(() => {
    if (!name) return;
    let alive = true;
    setMore(null);
    const params = new URLSearchParams({ q: name });
    if (anchor) params.set("release", String(anchor));

    fetch(`/api/discogs/artist?${params}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        if (d.artist) setPortrait({ image: d.artist.image ?? null, name: d.artist.name });

        /**
         * What you are missing, which means the albums and not the pressings.
         *
         * Matching on the release id alone is not enough: owning a 2019
         * repress of Motomami should hide Motomami, and those are two
         * different ids. So a title you already have on the shelf takes the
         * row out, whichever pressing it is.
         */
        const ownedIds = new Set(lib.releases.map((v) => v.discogsId));
        const ownedTitles = new Set(
          (group?.records ?? []).map((v) =>
            v.title.toLowerCase().replace(/[^a-z0-9]+/g, ""),
          ),
        );
        const rows: CatalogueItem[] = (d.releases ?? [])
          .filter(
            (r: { id: number; title: string }) =>
              !ownedIds.has(r.id) &&
              !ownedTitles.has(r.title.toLowerCase().replace(/[^a-z0-9]+/g, "")),
          )
          .slice(0, 24);
        setMore(rows);
      })
      .catch(() => alive && setMore([]));
    return () => {
      alive = false;
    };
  }, [name, anchor, group, lib.releases]);

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
       * Así que el retrato hace de portada, con su propio fondo difuminado, y
       * lo que cambia es lo que cambia de verdad: es redondo, porque es una
       * cara, y debajo van los números que sí se pueden contar de un artista
       * en lugar de los chips de una edición.
       */}
      <header
        className="relative -mx-5 mb-2 pb-8 sm:-mx-8"
        style={{ marginTop: "calc(-1 * max(1.5rem, var(--safe-top)))" }}
      >
        <RecordGround cover={heroImage} />

        <div className="relative flex h-16 items-center justify-between px-4">
          <button
            onClick={() => router.back()}
            aria-label="Atrás"
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-ink/55 text-paper ring-1 ring-inset ring-paper/15 backdrop-blur-xl transition-colors hover:bg-ink/75"
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
            className="pressable flex h-10 w-10 items-center justify-center rounded-full bg-ink/55 text-paper ring-1 ring-inset ring-paper/15 backdrop-blur-xl transition-colors hover:bg-ink/75"
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

        <div className="relative mx-auto w-full max-w-[440px] px-5 text-center">
          {/* Redondo y del mismo tamaño que la funda de un disco en su ficha:
              el retrato ocupa el sitio de la portada, así que si midiera otra
              cosa las dos pantallas dejarían de rimar. */}
          {portrait?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={portrait.image}
              alt=""
              className="mx-auto aspect-square w-[62%] max-w-[240px] rounded-full object-cover shadow-[0_26px_60px_rgba(0,0,0,0.62)]"
            />
          ) : (
            /* Sin foto no se deja un círculo gris esperando: el catálogo tiene
               fichas sin retrato y un hueco de relleno se lee como un fallo de
               carga. El nombre se queda con la parte de arriba, que es lo que
               habría hecho igualmente. */
            <div className="h-6" />
          )}

          <h1 className="mt-7 text-title font-medium leading-tight text-paper">
            {portrait?.name || name}
          </h1>

          <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
            <li className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary">
              Artista
            </li>
            {owned.length > 0 && (
              <li className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary">
                {owned.length} {owned.length === 1 ? "disco tuyo" : "discos tuyos"}
              </li>
            )}
            {more !== null && more.length > 0 && (
              <li className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary">
                {more.length} por descubrir
              </li>
            )}
          </ul>

          {owned.length === 0 && (
            <p className="mt-4 text-sub text-content-muted">
              Todavía no tienes ninguno suyo.
            </p>
          )}
        </div>
      </header>

      {owned.length > 0 && (
        <section className="pb-12">
          <h2 className="text-body font-medium text-paper">En tu colección</h2>
          <ul className="mt-5 grid grid-cols-3 gap-x-4 gap-y-7 sm:grid-cols-4 lg:grid-cols-6">
            {owned.map((v, i) => (
              <li key={v.id}>
                <button onClick={() => setOpen(v)} className="pressable block w-full text-left">
                  <Cover src={coverFor(v)} eager={i < 6} className="aspect-square w-full rounded-[3px]" />
                  <span className="mt-2 block truncate text-sub font-medium text-paper">{v.title}</span>
                  <span className="block truncate text-caption text-content-muted">
                    {v.year || ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-t border-line pb-16 pt-10">
        <h2 className="text-body font-medium text-paper">
          {owned.length > 0 ? "Lo que te falta" : `Discos de ${name}`}
        </h2>
        <p className="mt-1.5 text-sub text-content-muted">
          Del catálogo, sin lo que ya tienes. Toca uno para ver su ficha.
        </p>

        <div className="mt-6">
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

      <CatalogueSheet
        item={looking}
        onClose={() => setLooking(null)}
        targetName={mine?.name ?? "Mi Colección"}
        saved={Boolean(looking && saved[looking.id])}
        busy={saving === looking?.id}
        onSave={() => (looking ? save(looking) : null)}
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
        onClose={() => setOpen(null)}
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

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { artistSlug, cleanArtist };
