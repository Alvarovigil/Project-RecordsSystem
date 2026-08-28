"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Avatar from "@/components/ui/Avatar";
import Confirm from "@/components/ui/Confirm";
import { useToast } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import { coverFor } from "@/lib/cover";
import type { ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";

/**
 * A record, on a phone.
 *
 * On a desktop this is the 3D sleeve opening in place, with metadata flanking
 * it. None of that survives a 390px screen, and cramming it in is how you get
 * the reflowed-website feeling. So the phone gets its own thing: a full-height
 * sheet you throw away downward, artwork at the top, actions where the thumb
 * is, and the community bridge — "quién más tiene este disco" — at the bottom
 * where it belongs, as an invitation rather than an interruption.
 *
 * Actions are ordered by how often they are wanted, not by importance:
 * escuchar, guardar en una lista, and only then the destructive end of the
 * menu. The two ways of removing something are deliberately worded apart —
 * "Quitar de esta lista" is reversible bookkeeping, "Borrar de mi colección"
 * is not — because a single "Eliminar" that means either one is how people
 * lose records.
 */
export default function RecordSheet({
  vinyl,
  onClose,
  collections,
  activeListId,
  playing,
  onTogglePlay,
  onAddTo,
  onRemoveFromActive,
  onDelete,
}: {
  vinyl: Vinyl | null;
  onClose: () => void;
  collections: Collection[];
  activeListId: string;
  playing: boolean;
  onTogglePlay: (v: Vinyl) => void;
  onAddTo: (listId: string, v: Vinyl) => void;
  onRemoveFromActive: (v: Vinyl) => void;
  onDelete: (v: Vinyl) => void;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [elsewhere, setElsewhere] = useState<ListWithRecord[]>([]);
  const [picking, setPicking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!vinyl) return;
    setElsewhere([]);
    repo
      .listsWithRelease(vinyl.id)
      .then(setElsewhere)
      .catch(() => {});
  }, [repo, vinyl]);

  if (!vinyl) return null;

  const inLists = collections.filter(
    (c) => c.id !== activeListId && c.vinylIds.includes(vinyl.id),
  );

  return (
    <>
      <Sheet open={Boolean(vinyl)} onClose={onClose} size="full" bare>
        {/* the grabber has to exist even in a bare sheet: it is the only thing
            telling you this is draggable */}
        <div className="sticky top-0 z-10 flex justify-center bg-surface-raised/95 pb-2 pt-2.5 backdrop-blur-sm">
          <span className="sheet-grabber" aria-hidden />
        </div>

        <div className="px-5 pb-8">
          <div className="mx-auto w-full max-w-[420px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={coverFor(vinyl)}
              alt={`Portada de ${vinyl.title}`}
              className="aspect-square w-full rounded-sm object-cover shadow-[0_24px_60px_rgba(0,0,0,0.55)]"
            />

            <h2 className="mt-6 text-title font-medium leading-tight text-paper">{vinyl.title}</h2>
            <p className="mt-1 text-body text-content-secondary">{vinyl.artist}</p>
            <p className="mono mt-2 text-caption uppercase tracking-label text-content-faint">
              {[vinyl.year || null, vinyl.genre || null, vinyl.label || null]
                .filter(Boolean)
                .join(" · ")}
            </p>

            {/* the two things you came for, side by side and thumb-sized */}
            <div className="mt-6 flex gap-2.5">
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-paper text-body font-medium text-ink disabled:opacity-35"
              >
                {playing ? (
                  <>
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                      <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                    </svg>
                    Pausar
                  </>
                ) : (
                  <>
                    <svg width="13" height="13" viewBox="0 0 14 14" aria-hidden>
                      <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                    </svg>
                    {vinyl.previewUrl ? "Escuchar" : "Sin preview"}
                  </>
                )}
              </button>
              <button
                onClick={() => setPicking(true)}
                className="pressable flex h-12 items-center justify-center gap-2 rounded-sm border border-line-strong px-5 text-body font-medium text-paper"
              >
                Guardar
              </button>
            </div>

            {/* where it already lives, so "guardar" never means "otra vez" */}
            {inLists.length > 0 && (
              <p className="mt-3.5 text-sub text-content-muted">
                También en {inLists.map((c) => c.name).join(", ")}.
              </p>
            )}

            {vinyl.tracklist.length > 0 && (
              <section className="mt-9">
                <h3 className="text-caption uppercase tracking-label text-content-muted">
                  Cara A / Cara B
                </h3>
                <ol className="mt-3 divide-y divide-line">
                  {vinyl.tracklist.map((t, i) => (
                    <li key={i} className="flex items-baseline gap-3 py-2.5">
                      <span className="mono w-6 shrink-0 text-caption text-content-faint">
                        {t.position || i + 1}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sub text-content-secondary">
                        {t.title}
                      </span>
                      {t.duration && (
                        <span className="mono shrink-0 text-caption text-content-faint">
                          {t.duration}
                        </span>
                      )}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* the bridge: this record is the door into other people's shelves */}
            {elsewhere.length > 0 && (
              <section className="mt-9">
                <h3 className="text-caption uppercase tracking-label text-content-muted">
                  Quién más lo tiene
                </h3>
                <ul className="mt-3 divide-y divide-line">
                  {elsewhere.slice(0, 5).map((l) => (
                    <li key={l.id}>
                      <Link
                        href={`/u/${l.owner.username}/${l.slug}`}
                        className="pressable flex items-center gap-3 py-3"
                      >
                        <Avatar
                          name={l.owner.displayName}
                          handle={l.owner.username}
                          src={l.owner.avatarUrl}
                          size="sm"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sub text-paper">{l.title}</span>
                          <span className="block truncate text-caption text-content-muted">
                            {l.owner.displayName} · {l.itemCount} discos
                          </span>
                        </span>
                        <span aria-hidden className="text-content-faint">
                          →
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="mt-9 border-t border-line pt-2">
              <SheetRow
                label="Quitar de esta lista"
                onClick={() => {
                  // the shelf's handler confirms this one, with its undo
                  onRemoveFromActive(vinyl);
                  onClose();
                }}
              />
              <SheetRow label="Borrar de mi colección" danger onClick={() => setDeleting(true)} />
            </section>
          </div>
        </div>
      </Sheet>

      {/* saving into a list: its own sheet, so the record stays behind it */}
      <Sheet open={picking} onClose={() => setPicking(false)} title="Guardar en" size="auto" width={380}>
        <div className="py-1">
          {collections.map((c) => {
            const has = c.vinylIds.includes(vinyl.id);
            return (
              <SheetRow
                key={c.id}
                label={c.name}
                detail={has ? "✓" : `${c.vinylIds.length}`}
                onClick={() => {
                  onAddTo(c.id, vinyl);
                  setPicking(false);
                  toast.show(has ? `Ya estaba en ${c.name}` : `Guardado en ${c.name}`, {
                    media: { src: coverFor(vinyl) },
                  });
                }}
              />
            );
          })}
        </div>
      </Sheet>

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Se borrará de toda tu colección"
        body={`${vinyl.title} desaparecerá de todas tus listas. Esto no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={() => {
          onDelete(vinyl);
          onClose();
        }}
      />
    </>
  );
}
