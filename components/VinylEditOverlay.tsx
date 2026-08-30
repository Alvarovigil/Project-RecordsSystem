"use client";

import { useState, useRef, useEffect } from "react";
import { analyseCover, type Tone } from "@/lib/palette";
import { coverFor } from "@/lib/cover";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";

type Props = {
  vinyl: Vinyl;
  collections: Collection[];
  activeCollectionId: string;
  isInWishlist?: boolean;
  /** Mi Colección is derived from the library: "remove" there means delete */
  activeIsLibrary?: boolean;
  onAddTo: (collectionId: string) => void;
  onMoveToCollection?: () => void;
  onRemoveFromActive: () => void;
  onDeletePermanently: () => void;
  /** in the preview there is no account to destroy anything in */
  preview?: boolean;
};

/**
 * Edit affordance that sits over the centred (opened) cover: a small pencil
 * icon in the top-right corner of the cover area that fades in on hover.
 * Clicking it opens a popover with the vinyl actions.
 */
export default function VinylEditOverlay({
  vinyl,
  collections,
  activeCollectionId,
  isInWishlist,
  activeIsLibrary = false,
  onAddTo,
  onMoveToCollection,
  onRemoveFromActive,
  onDeletePermanently,
  preview = false,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // close popover on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
        setShowAddMenu(false);
        setConfirmDelete(false);
      }
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  /**
   * What the sleeve looks like under each control.
   *
   * White glass over a white cover is nothing at all — and half the sleeves
   * ever printed are mostly paper. A control that floats over artwork cannot
   * pick a colour once and hope; it has to answer to what is behind it, in
   * the corner it actually sits in rather than in the sleeve's average.
   */
  const [look, setLook] = useState<{ corner: Tone; centre: Tone }>({
    corner: "dark",
    centre: "dark",
  });
  useEffect(() => {
    let alive = true;
    void analyseCover(coverFor(vinyl)).then((l) => {
      if (alive) setLook({ corner: l.corner, centre: l.centre });
    });
    return () => {
      alive = false;
    };
  }, [vinyl]);

  // reset state when changing vinyl
  useEffect(() => {
    setMenuOpen(false);
    setShowAddMenu(false);
    setConfirmDelete(false);
  }, [vinyl.id]);

  const otherCollections = collections.filter(
    (c) => c.id !== activeCollectionId && !c.vinylIds.includes(vinyl.id),
  );

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 group"
      /**
       * The sleeve's real rectangle, not a guess at it.
       *
       * This box was `min(36vw, 50vh)` — a pair of numbers that happened to
       * land near the cover on the window it was written on. The shelf
       * publishes `--cover-half` every frame, measured from the actual
       * geometry (field of view, camera distance, window), and everything
       * else on this screen is already positioned off it. A corner control
       * anchored to an approximation is not in the corner: it floats inside
       * the artwork, which is exactly what it was doing.
       */
      style={{
        width: "calc(var(--cover-half, 21vw) * 2)",
        height: "calc(var(--cover-half, 21vw) * 2)",
      }}
    >
      {/* hover sensor — covers the whole cover area */}
      <div className="pointer-events-auto absolute inset-0" />

      {/* big central CTA only visible when this vinyl is in the wishlist */}
      {isInWishlist && onMoveToCollection && (
        <button
          onClick={onMoveToCollection}
          /* Same material as the pencil, same words as the phone. It was a
             black tablet laid on the artwork with a two-line label in tracked
             capitals; over a bright sleeve that is the loudest thing on the
             screen and it is not even the main action. */
          className={`pointer-events-auto reveal-on-hover absolute left-1/2 top-1/2 flex h-11 -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full px-5 text-[13px] backdrop-blur-xl transition ${
            look.centre === "light"
              ? "bg-ink/30 text-paper hover:bg-ink/50"
              : "bg-paper/[0.14] text-paper hover:bg-paper/25"
          }`}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Ya lo tengo
        </button>
      )}

      <div ref={wrapperRef} className="pointer-events-auto absolute right-3 top-3">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          /* Glass, like every control that floats over artwork in this app —
             but glass of whichever polarity the sleeve leaves room for. An
             opaque black puck on a sleeve is a hole punched in it; white
             glass on a white sleeve is nothing at all. */
          className={`flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-xl transition ${
            look.corner === "light"
              ? "bg-ink/25 text-paper hover:bg-ink/45"
              : "bg-paper/[0.14] text-paper/80 hover:bg-paper/25 hover:text-paper"
          } ${menuOpen ? "opacity-100" : "reveal-on-hover"}`}
          aria-label="Editar vinilo"
        >
          {/* pencil icon */}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 1 L11 4 L4 11 L1 11 L1 8 Z" stroke="currentColor" fill="none" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute top-9 right-0 min-w-[200px] bg-surface-overlay/95 backdrop-blur-sm border border-line-overlay rounded-sm shadow-popover p-1 text-[12px]">
            <div className="relative">
              <button
                onClick={() => setShowAddMenu((v) => !v)}
                disabled={otherCollections.length === 0}
                className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-control disabled:opacity-30 disabled:hover:bg-transparent flex items-center justify-between gap-2"
              >
                <span>Añadir a otra colección</span>
                <span className="text-paper/40">›</span>
              </button>
              {showAddMenu && otherCollections.length > 0 && (
                <div className="absolute right-full top-0 mr-1 min-w-[180px] bg-surface-overlay/95 backdrop-blur-sm border border-line-overlay rounded-sm shadow-popover p-1">
                  {otherCollections.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => {
                        onAddTo(c.id);
                        setShowAddMenu(false);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-control"
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* Mi Colección holds everything you own, so there is nothing to
                "remove" from it — only deleting the record makes sense */}
            {!activeIsLibrary && (
              <button
                onClick={() => {
                  onRemoveFromActive();
                  setMenuOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-paper/80 hover:bg-paper/5 hover:text-paper rounded-control"
              >
                {isInWishlist ? "Quitar de deseos" : "Quitar de este rack"}
              </button>
            )}
            <div className="h-px bg-paper/10 my-1" />
            {preview ? (
              <p className="px-3 py-2 text-[11px] leading-relaxed text-paper/35">
                Editar y borrar discos llega con tu cuenta.
              </p>
            ) : !confirmDelete ? (
              <button
                onClick={() => setConfirmDelete(true)}
                className="w-full text-left px-3 py-2 text-paper/50 hover:bg-red-500/10 hover:text-red-400 rounded-control"
              >
                Eliminar permanentemente
              </button>
            ) : (
              <div className="px-3 py-2 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    onDeletePermanently();
                    setMenuOpen(false);
                  }}
                  className="text-red-400 hover:text-red-300"
                >
                  Confirmar
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-paper/40 hover:text-paper"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
