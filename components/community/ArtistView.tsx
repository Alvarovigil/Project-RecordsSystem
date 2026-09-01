"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCovers } from "@/components/ui/Skeleton";
import CatalogueSheet, { type CatalogueItem } from "@/components/CatalogueSheet";
import RecordSheet from "@/components/mobile/RecordSheet";
import { useLibrary } from "@/hooks/useLibrary";
import { useToast } from "@/components/ui/Toast";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist, findArtist } from "@/lib/artist";
import { findCollection, resolveCollections } from "@/lib/collections";
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

  const save = async (item: CatalogueItem) => {
    if (!mine) return;
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
      toast.show(`${payload.vinyl.title} → ${mine.name}`, {
        media: { src: coverFor(payload.vinyl) },
      });
    } catch {
      toast.show("No se pudo añadir ese disco.", { tone: "error" });
    } finally {
      setSaving(null);
      setLooking(null);
    }
  };

  const owned = group?.records ?? [];

  return (
    <Page width="full">
      <header className="pb-9 pt-2">
        <button
          onClick={() => router.back()}
          className="pressable mb-7 flex items-center gap-2 text-sub text-content-muted transition hover:text-paper"
        >
          <span aria-hidden>←</span> Atrás
        </button>

        {/**
         * A face, when there is one.
         *
         * An artist without a portrait is a heading, and a page of headings is
         * a directory. The picture comes from the same catalogue as everything
         * else here and through the same proxy as the sleeves — Discogs
         * refuses to serve its images to another site.
         *
         * When there is no photograph the space is not held open with a grey
         * circle: the name simply takes the top of the page, which is what it
         * would have done anyway.
         */}
        <div className="flex items-end gap-5">
          {portrait?.image && (
            <img
              src={portrait.image}
              alt=""
              className="h-[92px] w-[92px] shrink-0 rounded-full object-cover sm:h-[120px] sm:w-[120px]"
            />
          )}
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-label text-content-muted">Artista</p>
            <h1 className="mt-2 text-display font-medium leading-tight text-paper">
              {portrait?.name || name}
            </h1>
            <p className="mt-2 text-sub text-content-muted">
              {owned.length === 0
                ? "Todavía no tienes ninguno suyo."
                : `${owned.length} ${owned.length === 1 ? "disco" : "discos"} en tu colección`}
            </p>
          </div>
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
        onSave={() => looking && void save(looking)}
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
        onDelete={(v) => void lib.deleteRelease(v.id)}
      />
    </Page>
  );
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export { artistSlug, cleanArtist };
