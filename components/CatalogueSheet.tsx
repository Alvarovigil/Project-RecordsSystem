"use client";

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import { CrateIcon, RecordGround, RecordHero } from "@/components/record/RecordHero";
import { artistFromCatalogueTitle, artistSlug } from "@/lib/artist";

/**
 * A record from the catalogue, read rather than taken.
 *
 * The whole app assumed that finding a record meant wanting it. Search
 * results had one control and it was "+"; the scanner's tray was a queue of
 * things on their way to your shelf. But the most common thing anybody does
 * with a barcode in a shop is *ask a question* — is this the 1969 pressing,
 * what is stamped in the run-out, is this the one with the extra track — and
 * the answer is none of my business afterwards. Somebody looking things up in
 * a shop was, until now, forced to add every sleeve they picked up and then
 * clean their collection later.
 *
 * So looking and keeping are two controls, always, everywhere a record can be
 * found: the row opens this, the button beside it saves. Neither can be
 * reached by accident from the other.
 *
 * **Es la misma pantalla que la de un disco tuyo**, y no una versión reducida
 * de ella: la misma portada sobre su propio color, el mismo título centrado,
 * los mismos chips, la misma fila de acciones. Era una miniatura de 104px con
 * un botón al lado, y eso hacía que un disco encontrado pareciera el resultado
 * de una consulta en vez de un disco. Tener uno o no tenerlo es un estado, no
 * otra clase de cosa.
 *
 * Lo que cambia es lo único que debe cambiar: el botón dice guardar en vez de
 * decir dónde está, y no hay tarjetas de comunidad porque todavía no hay nada
 * que contar. Y la ficha técnica se abre sola, porque aquí es la pregunta que
 * ha traído a alguien hasta esta pantalla — donde en un disco tuyo se queda
 * plegada tras una línea que se pulsa.
 *
 * **Nothing here writes anything until the button is pressed.** That is the
 * point of the screen, and the reason the button says where it is going.
 */

export type CatalogueItem = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  genre?: string;
  thumb?: string;
  cover_image?: string;
  format?: string[];
};

export default function CatalogueSheet({
  item,
  onClose,
  targetName,
  saved = false,
  busy = false,
  onSave,
  action,
  extra,
}: {
  item: CatalogueItem | null;
  onClose: () => void;
  /** where the button would put it, named on the button itself */
  targetName: string;
  saved?: boolean;
  busy?: boolean;
  onSave?: () => void;
  /** replaces the save button where saving is not what this screen does */
  action?: React.ReactNode;
  /** a second, context-specific action — the scanner uses it for editions */
  extra?: React.ReactNode;
}) {
  // open by default, but still closable: a panel that cannot be folded is a
  // panel the reader is not allowed to finish with
  const [specs, setSpecs] = useState(true);

  /* El catálogo entrega «Artista - Álbum» en un solo campo. Partirlo es lo que
     permite que esta pantalla tenga el mismo pie que la de un disco tuyo, con
     el artista como puerta a su ficha en vez de como parte del título. */
  const artist = item ? artistFromCatalogueTitle(item.title) : null;
  const album =
    item && artist ? item.title.slice(item.title.indexOf(" - ") + 3).trim() : (item?.title ?? "");
  const cover = item?.cover_image ?? item?.thumb ?? "/sleeve-vacio.jpg";

  return (
    <Sheet open={Boolean(item)} onClose={onClose} size="tall" width={460} bare>
      {item && (
        <div className="scroll-y min-h-0 flex-1 overflow-y-auto">
          <div className="relative pb-10">
            <RecordGround cover={cover} />

            <div className="relative mx-auto w-full max-w-[440px] px-5 pt-8">
              <RecordHero
                cover={cover}
                title={album}
                artist={artist}
                artistHref={artist ? `/artista/${artistSlug(artist)}` : null}
                facts={[item.year, item.genre, item.label, item.country]}
                onNavigate={onClose}
              />

              {/* La misma fila de acciones que en un disco tuyo, con lo que
                  aquí tiene sentido. Rellena, porque en esta pantalla guardar
                  es lo único que se puede hacer y debe parecerlo. */}
              <div className="mt-6 flex items-center gap-3">
                {action ?? (
                  <button
                    onClick={onSave}
                    disabled={saved || busy}
                    className={`pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sub font-medium transition-colors disabled:opacity-45 ${
                      saved ? "bg-fill text-paper" : "bg-paper text-ink"
                    }`}
                  >
                    {saved ? <Check /> : <CrateIcon />}
                    <span className="truncate">
                      {saved ? `En ${targetName}` : busy ? "Guardando…" : `Guardar en ${targetName}`}
                    </span>
                  </button>
                )}
                {extra}
              </div>

              <div className="mt-6">
                <RecordSpecsCard
                  key={item.id}
                  discogsId={item.id}
                  open={specs}
                  onOpenChange={setSpecs}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path
        d="M2.5 7.4 L5.6 10.5 L11.5 3.8"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
