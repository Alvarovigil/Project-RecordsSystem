"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { coverFor } from "@/lib/cover";
import { cleanArtist } from "@/lib/artist";
import type { Vinyl } from "@/lib/types";

/**
 * Hacer un rack, que es más que ponerle un nombre.
 *
 * Antes «Rack nuevo» abría un campo de texto en la propia fila: escribías, se
 * creaba, y te quedabas con un cajón vacío que había que ir a llenar disco a
 * disco desde otra pantalla. Nombrar era todo lo que la aplicación te dejaba
 * hacer en el momento en que sabías perfectamente lo que querías meter dentro
 * — porque un rack no se te ocurre en abstracto, se te ocurre mirando discos.
 *
 * Así que son tres cosas y en este orden: cómo se llama, por qué existe, y qué
 * va dentro.
 *
 * **La descripción no es un extra decorativo.** «El turno de noche» dice más
 * que «Rock, 40 discos», pero «El turno de noche — lo que pongo cuando ya no
 * queda nadie despierto» es lo que hace que alguien guarde el rack de un
 * desconocido. Es opcional, y se pide aquí porque después nadie vuelve a
 * ponerla.
 *
 * **Los discos se eligen aquí y no en una segunda pantalla.** Es tu colección,
 * ya está descargada, y la rejilla se filtra escribiendo. Se puede crear vacío
 * — a veces el rack es para lo que aún no tienes — pero cuesta lo mismo no
 * hacerlo.
 */
export default function NewRackSheet({
  open,
  onClose,
  records,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** tu colección, para elegir de ella */
  records: Vinyl[];
  /** crea el rack y mete dentro lo elegido; devuelve el id */
  onCreate: (input: { title: string; description: string; vinylIds: string[] }) => Promise<string>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const q = filter
      .trim()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
    if (!q) return records;
    return records.filter((v) =>
      `${v.title} ${v.artist}`
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .includes(q),
    );
  }, [records, filter]);

  const reset = () => {
    setTitle("");
    setDescription("");
    setChosen(new Set());
    setFilter("");
  };

  const submit = async () => {
    const clean = title.trim();
    if (!clean || busy) return;
    setBusy(true);
    try {
      await onCreate({ title: clean, description: description.trim(), vinylIds: [...chosen] });
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <Sheet
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Rack nuevo"
      size="full"
      width={480}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="px-5 pb-2 pt-1">
          {/* El nombre, con el tamaño que tendrá en su pantalla: se está
              escribiendo un título, no rellenando un campo de un formulario. */}
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="El turno de noche"
            enterKeyHint="next"
            aria-label="Nombre del rack"
            className="w-full bg-transparent text-heading font-medium text-paper outline-none placeholder:text-content-faint"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Lo que pongo cuando ya no queda nadie despierto. (Opcional)"
            aria-label="Descripción del rack"
            className="mt-2.5 w-full resize-none bg-transparent text-sub leading-relaxed text-content-secondary outline-none placeholder:text-content-faint"
          />
        </div>

        {records.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-3 border-t border-line px-5 pb-2.5 pt-3.5">
              <h3 className="text-caption uppercase tracking-label text-content-muted">
                {chosen.size === 0
                  ? "Añade discos"
                  : `${chosen.size} ${chosen.size === 1 ? "disco" : "discos"}`}
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
              {shown.slice(0, 60).map((v) => {
                const on = chosen.has(v.id);
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => toggle(v.id)}
                      aria-pressed={on}
                      className="pressable block w-full text-left"
                    >
                      <span className="relative block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={coverFor(v)}
                          alt=""
                          loading="lazy"
                          className={`aspect-square w-full rounded-[3px] object-cover transition-opacity ${
                            on ? "opacity-100" : "opacity-55"
                          }`}
                        />
                        {/* la marca de elegido, en la esquina: la misma que en
                            Explorar para «esto ya está en casa» */}
                        <span
                          aria-hidden
                          className={`absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full transition ${
                            on
                              ? "bg-paper text-ink"
                              : "border border-paper/30 bg-ink/40 text-transparent"
                          }`}
                        >
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
          </>
        )}

        {/* El botón se queda abajo, encima de todo: la rejilla es larga y la
            decisión no puede vivir al final de un scroll. */}
        <div className="sticky bottom-0 mt-auto border-t border-line bg-surface-raised/95 px-5 pb-3 pt-3 backdrop-blur-md">
          <button
            onClick={() => void submit()}
            disabled={!title.trim() || busy}
            className="pressable flex h-12 w-full items-center justify-center rounded-full bg-paper text-sub font-medium text-ink transition-opacity disabled:opacity-40"
          >
            {busy
              ? "Creando…"
              : chosen.size > 0
                ? `Crear con ${chosen.size} ${chosen.size === 1 ? "disco" : "discos"}`
                : "Crear rack"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
