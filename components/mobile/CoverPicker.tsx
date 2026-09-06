"use client";

import { useEffect, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { coverFor } from "@/lib/cover";
import type { CoverOption } from "@/app/api/discogs/covers/route";
import type { Vinyl } from "@/lib/types";

/**
 * Cambiar la portada por la que de verdad tienes en las manos.
 *
 * El catálogo elige una imagen por ti y a veces no es la tuya: la edición
 * española lleva otra foto, la reedición cambió el color, o la ficha guarda un
 * escaneo torcido. Cuando eso pasa, la pantalla del disco describe un objeto
 * que no es el que tienes — y en una aplicación cuyo tema es precisamente el
 * objeto, eso no es un detalle.
 *
 * Aquí salen todas las que existen: las fotos de esta edición, las de las
 * otras prensadas del mismo álbum y la carátula digital. Se elige una y se
 * queda. Nada de subir una foto propia, todavía: casi siempre la buena ya
 * existe en algún sitio, y elegir de una cuadrícula cuesta un toque mientras
 * que hacer una foto decente de una funda cuesta un rato.
 */
export default function CoverPicker({
  open,
  onClose,
  vinyl,
  onChoose,
}: {
  open: boolean;
  onClose: () => void;
  vinyl: Vinyl;
  onChoose: (url: string) => void;
}) {
  const [covers, setCovers] = useState<CoverOption[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCovers(null);
    const q = new URLSearchParams();
    if (vinyl.discogsId) q.set("id", String(vinyl.discogsId));
    if (vinyl.artist) q.set("artist", vinyl.artist);
    if (vinyl.title) q.set("album", vinyl.title);
    fetch(`/api/discogs/covers?${q}`)
      .then((r) => r.json())
      .then((d) => alive && setCovers(d.covers ?? []))
      .catch(() => alive && setCovers([]));
    return () => {
      alive = false;
    };
  }, [open, vinyl.discogsId, vinyl.artist, vinyl.title]);

  const current = coverFor(vinyl);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Cambiar la portada"
      subtitle={vinyl.title}
      size="tall"
      width={460}
      done
    >
      <div className="px-5 pb-6 pt-1">
        {covers === null ? (
          <ul className="grid grid-cols-3 gap-2.5">
            {Array.from({ length: 9 }).map((_, i) => (
              <li key={i} className="skeleton aspect-square rounded-[3px]" />
            ))}
          </ul>
        ) : covers.length === 0 ? (
          <p className="py-8 text-sub text-content-muted">
            No hemos encontrado otras portadas de este disco.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-2.5">
            {covers.map((c) => {
              const on = current === c.url;
              return (
                <li key={c.url}>
                  <button
                    onClick={() => {
                      onChoose(c.url);
                      onClose();
                    }}
                    aria-pressed={on}
                    className="pressable block w-full text-left"
                  >
                    <span className="relative block">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={c.url}
                        alt=""
                        loading="lazy"
                        className={`aspect-square w-full rounded-[3px] object-cover transition ${
                          on ? "ring-2 ring-paper ring-offset-2 ring-offset-surface-raised" : ""
                        }`}
                      />
                      {on && (
                        <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-ink">
                          <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                            <path
                              d="M2.5 7.4 L5.6 10.5 L11.5 3.8"
                              stroke="currentColor"
                              strokeWidth="1.9"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      )}
                    </span>
                    {/* De qué edición sale cada una: sin eso son veinte fundas
                        parecidas y la elección es a ojo. */}
                    <span className="mt-1.5 block truncate text-micro text-content-faint">
                      {c.label}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Sheet>
  );
}
