"use client";

import { useEffect, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { coverFor } from "@/lib/cover";
import { cleanArtist } from "@/lib/artist";
import type { Vinyl } from "@/lib/types";

/**
 * Elegir con qué te presentas.
 *
 * Tres, exactamente tres, y en orden: el primero es el que se ve entero en las
 * tarjetas y en la ficha que sale al pasar por encima de un nombre. Por eso al
 * pulsar uno se añade al final en vez de ordenarse solo — el orden es una
 * decisión más, y es gratis tomarla aquí.
 *
 * El límite no se avisa con un mensaje: al llegar a tres, lo que se puede
 * hacer es quitar uno. Un cartel rojo diciendo «máximo 3» es la aplicación
 * regañando por haber entendido bien lo que ofrecía.
 */
export default function PickThreeSheet({
  open,
  onClose,
  records,
  current,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  /** tu colección */
  records: Vinyl[];
  /** ids, en orden */
  current: string[];
  onSave: (ids: string[]) => Promise<void> | void;
}) {
  const [chosen, setChosen] = useState<string[]>(current);
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setChosen(current);
  }, [open, current]);

  const norm = (s: string) =>
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  const q = norm(filter.trim());
  const shown = q
    ? records.filter((v) => norm(`${v.title} ${v.artist}`).includes(q))
    : records;

  const toggle = (id: string) =>
    setChosen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );

  const byId = (id: string) => records.find((v) => v.id === id);

  return (
    <Sheet open={open} onClose={onClose} title="Tus tres" subtitle="Con lo que te presentas" size="full" width={480}>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Lo elegido, arriba y en su orden: es el resultado, y verlo mientras
            se elige es lo que convierte tres toques en una decisión. */}
        <div className="flex gap-2.5 px-5 pb-3 pt-1">
          {[0, 1, 2].map((i) => {
            const v = chosen[i] ? byId(chosen[i]) : null;
            return (
              <div key={i} className="flex-1">
                {v ? (
                  <button
                    onClick={() => toggle(v.id)}
                    aria-label={`Quitar ${v.title}`}
                    className="pressable relative block w-full"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverFor(v)}
                      alt=""
                      className="aspect-square w-full rounded-[3px] object-cover"
                    />
                    <span
                      aria-hidden
                      className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ink/75 text-paper backdrop-blur-md"
                    >
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path
                          d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                      </svg>
                    </span>
                  </button>
                ) : (
                  <div className="aspect-square w-full rounded-[3px] border border-dashed border-line-strong" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 pb-2.5 pt-3.5">
          <h3 className="text-caption uppercase tracking-label text-content-muted">
            {chosen.length < 3 ? `Elige ${3 - chosen.length} más` : "Listo"}
          </h3>
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar"
            aria-label="Filtrar tu colección"
            className="h-8 w-32 rounded-full bg-fill-subtle px-3 text-caption text-paper outline-none placeholder:text-content-faint"
          />
        </div>

        <ul className="grid grid-cols-3 gap-2.5 px-5 pb-4 sm:grid-cols-4">
          {shown.slice(0, 90).map((v) => {
            const at = chosen.indexOf(v.id);
            const on = at >= 0;
            const full = chosen.length >= 3 && !on;
            return (
              <li key={v.id}>
                <button
                  onClick={() => toggle(v.id)}
                  aria-pressed={on}
                  className={`pressable block w-full text-left ${full ? "opacity-35" : ""}`}
                >
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverFor(v)}
                      alt=""
                      loading="lazy"
                      className={`aspect-square w-full rounded-[3px] object-cover transition-opacity ${
                        on ? "opacity-100" : "opacity-70"
                      }`}
                    />
                    {on && (
                      /* el número, no una palomita: aquí el orden es parte de
                         lo que se está eligiendo */
                      <span className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-paper text-caption font-medium text-ink">
                        {at + 1}
                      </span>
                    )}
                  </span>
                  <span className="mt-1.5 block truncate text-caption text-content-secondary">
                    {v.title}
                  </span>
                  <span className="block truncate text-micro text-content-faint">
                    {cleanArtist(v.artist)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="sticky bottom-0 mt-auto border-t border-line bg-surface-raised/95 px-5 pb-3 pt-3 backdrop-blur-md">
          <button
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(chosen);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            disabled={busy}
            className="pressable flex h-12 w-full items-center justify-center rounded-full bg-paper text-sub font-medium text-ink disabled:opacity-40"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
