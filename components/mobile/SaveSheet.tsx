"use client";

import { useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import RackRow from "@/components/community/RackRow";
import { rackOfCollection } from "@/lib/rack";
import type { Collection } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";

/**
 * Where this record lives, and everywhere it could.
 *
 * The old sheet was a menu: a list of rack names, a count on the right, and a
 * tick beside the ones that already held the record. Pressing a rack you were
 * already in did nothing you could see. So it answered "which rack shall I add
 * this to" and nothing else — and that is the smaller half of the question
 * somebody has when they open it. The other half is "where is this, actually",
 * and after that, "take it out of that one".
 *
 * So the racks it is already in come first, under their own heading, with a
 * filled check that removes on press. Everything else follows with a plus.
 * One list, two states, and every row does something.
 *
 * Two things it deliberately keeps from being a database view: each rack
 * carries the cover of a record inside it, so the list is made of sleeves
 * rather than of names; and the collection is shown but cannot be unticked —
 * it is not a rack you put things in, it is everything you own that you are
 * not still hunting, so leaving it is done by wanting the record, not by
 * pressing a check here.
 */
export default function SaveSheet({
  open,
  onClose,
  vinyl,
  collections,
  /** resolves a record id to a cover, so a rack can show what is in it */
  coverOf,
  onAdd,
  onRemove,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  vinyl: Vinyl;
  collections: Collection[];
  coverOf?: (vinylId: string) => string | null;
  onAdd: (listId: string) => void;
  onRemove: (listId: string) => void;
  onCreate?: () => void;
}) {
  const [filter, setFilter] = useState("");

  const { inside, outside } = useMemo(() => {
    const norm = (s: string) =>
      s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    const q = norm(filter.trim());
    const shown = q ? collections.filter((c) => norm(c.name).includes(q)) : collections;
    return {
      inside: shown.filter((c) => c.vinylIds.includes(vinyl.id)),
      outside: shown.filter((c) => !c.vinylIds.includes(vinyl.id)),
    };
  }, [collections, vinyl.id, filter]);

  // a filter is help above a dozen rows and clutter below it
  const searchable = collections.length > 8;

  /**
   * La misma fila que la estantería, el buscador y la ficha de un disco.
   *
   * No una variación: {@link RackRow}, la única fila de rack que hay. Quien
   * acaba de elegir un rack en la pantalla principal encuentra aquí el mismo
   * objeto, y la manera más rápida de que dos listas parezcan una sola
   * aplicación es que sean la misma lista. Lo único que cambia es el control de
   * la derecha, porque aquí no se navega: se añade o se quita.
   */
  const Row = ({ c, held }: { c: Collection; held: boolean }) => {
    const locked = held && c.kind === "collection";
    return (
      <li>
        <RackRow
          rack={rackOfCollection(c, coverOf, { locked })}
          disabled={locked}
          onClick={() => (held ? (locked ? undefined : onRemove(c.id)) : onAdd(c.id))}
          trailing={
            held ? (
              <span
                aria-hidden
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  locked ? "bg-fill text-content-muted" : "bg-paper text-ink"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
            ) : (
              <span
                aria-hidden
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line-strong text-content-secondary"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 2.5v9M2.5 7h9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
              </span>
            )
          }
        />
      </li>
    );
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Guardar en"
      subtitle={vinyl.title}
      size="tall"
      width={420}
      action={
        onCreate && (
          <button
            onClick={onCreate}
            className="pressable text-sub font-medium text-paper transition-colors hover:text-paper/80"
          >
            Rack nuevo
          </button>
        )
      }
    >
      {/* No scroller of its own: PhoneSheet already wraps its children in one,
          and a second inside it is two things that can be dragged. */}
      <div className="pb-6">
        {searchable && (
          <div className="px-3 pb-3 pt-1">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Buscar un rack"
              aria-label="Buscar un rack"
              className="h-11 w-full rounded-control bg-fill-subtle px-3.5 text-body text-content outline-none placeholder:text-content-faint"
            />
          </div>
        )}

        {inside.length > 0 && (
          <>
            <Heading>Guardado en</Heading>
            <ul className="flex flex-col gap-1 px-3">
              {inside.map((c) => (
                <Row key={c.id} c={c} held />
              ))}
            </ul>
          </>
        )}

        {outside.length > 0 && (
          <>
            <Heading>{inside.length > 0 ? "Añadir a" : "Tus racks"}</Heading>
            <ul className="flex flex-col gap-1 px-3">
              {outside.map((c) => (
                <Row key={c.id} c={c} held={false} />
              ))}
            </ul>
          </>
        )}

        {inside.length === 0 && outside.length === 0 && (
          <p className="px-5 py-8 text-sub text-content-muted">
            Ningún rack con ese nombre.
          </p>
        )}
      </div>
    </Sheet>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-4 pb-2 pt-4 text-caption uppercase tracking-label text-content-muted">
      {children}
    </h3>
  );
}
