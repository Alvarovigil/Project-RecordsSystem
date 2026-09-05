"use client";

import { useEffect, useState } from "react";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import { CrateIcon, IconButton, RecordGround, RecordHero } from "@/components/record/RecordHero";
import SaveSheet from "@/components/mobile/SaveSheet";
import type { Collection } from "@/lib/collections";
import type { Vinyl } from "@/lib/types";
import RecordScreen, {
  RecordTopBar,
  useScrolledPast,
} from "@/components/record/RecordScreen";
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
 * Lo que cambia es la botonera, y solo la botonera. Donde un disco tuyo dice
 * dónde está guardado, este ofrece las dos cosas que se pueden querer hacer con
 * un disco que no tienes: **añadirlo a tu colección** — porque lo acabas de
 * comprar o ya lo tenías en casa — o **apuntarlo en la lista de deseos**, que
 * es la respuesta a «este me falta». Son dos verbos distintos y ninguno de los
 * dos es el otro, así que están los dos a la vista y no uno detrás de un menú.
 *
 * Al añadirlo a la colección el deseo deja de tener sentido — ya lo tienes — y
 * ese botón desaparece, dejando sitio a la hoja de racks de siempre, que se
 * despliega sola: acabas de meter un disco en casa y lo siguiente que puede
 * apetecerte es colocarlo en algún sitio. Ni tarjetas de comunidad ni menú de
 * tres puntos, porque todavía no hay nada que contar ni nada que borrar.
 *
 * La ficha técnica se abre sola, porque aquí es la pregunta que ha traído a
 * alguien hasta esta pantalla — donde en un disco tuyo se queda plegada tras
 * una línea que se pulsa.
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
  onWish,
  wished = false,
  collections,
  coverOf,
  onAddToList,
  onRemoveFromList,
  onCreateList,
  action,
  extra,
}: {
  item: CatalogueItem | null;
  onClose: () => void;
  /** where the button would put it, named on the button itself */
  targetName: string;
  saved?: boolean;
  busy?: boolean;
  /** devuelve el disco guardado, si el sitio que llama puede darlo */
  onSave?: () => unknown;
  /** apuntarlo en la lista de deseos, sin meterlo en la colección */
  onWish?: () => void;
  wished?: boolean;
  /** con esto la hoja de racks se despliega sola después de guardar */
  collections?: Collection[];
  coverOf?: (vinylId: string) => string | null;
  onAddToList?: (listId: string, vinyl: Vinyl) => void;
  onRemoveFromList?: (listId: string, vinyl: Vinyl) => void;
  onCreateList?: (name: string) => Promise<string> | string;
  /** replaces the save button where saving is not what this screen does */
  action?: React.ReactNode;
  /** a second, context-specific action — the scanner uses it for editions */
  extra?: React.ReactNode;
}) {
  // open by default, but still closable: a panel that cannot be folded is a
  // panel the reader is not allowed to finish with
  const [specs, setSpecs] = useState(true);
  const { sentinel, scrolled } = useScrolledPast(Boolean(item));
  /* el disco, ya con id propio, en cuanto entra en la biblioteca: es lo que
     necesita la hoja de racks para saber dónde está y dónde no */
  const [kept, setKept] = useState<Vinyl | null>(null);
  const [picking, setPicking] = useState(false);

  // otro disco bajo la misma pantalla: lo anterior no cuenta
  useEffect(() => {
    setKept(null);
    setPicking(false);
  }, [item?.id]);

  const keep = async () => {
    const v = (await onSave?.()) as Vinyl | null | undefined;
    if (v && collections && onAddToList) {
      setKept(v);
      setPicking(true);
    }
  };

  /* El catálogo entrega «Artista - Álbum» en un solo campo. Partirlo es lo que
     permite que esta pantalla tenga el mismo pie que la de un disco tuyo, con
     el artista como puerta a su ficha en vez de como parte del título. */
  const artist = item ? artistFromCatalogueTitle(item.title) : null;
  const album =
    item && artist ? item.title.slice(item.title.indexOf(" - ") + 3).trim() : (item?.title ?? "");
  const cover = item?.cover_image ?? item?.thumb ?? "/sleeve-vacio.jpg";

  return (
    <RecordScreen open={Boolean(item)} onClose={onClose}>
      {item && (
        <>
          <RecordTopBar
            onClose={onClose}
            cover={cover}
            title={album}
            artist={artist}
            scrolled={scrolled}
          />

          <div className="relative -mt-16 pb-10">
            <RecordGround cover={cover} />

            <div className="relative mx-auto w-full max-w-[440px] px-5 pt-16">
              <RecordHero
                cover={cover}
                title={album}
                artist={artist}
                artistHref={artist ? `/artista/${artistSlug(artist)}` : null}
                facts={[item.year, item.genre, item.label, item.country]}
                onNavigate={onClose}
                sentinel={sentinel}
              />

              {/**
               * La misma fila que en un disco tuyo, con los mismos tamaños:
               * el círculo relleno de 44px, la píldora que se queda con el
               * ancho sobrante, y los redondos de al lado. Lo único distinto
               * es lo que dicen.
               */}
              <div className="mt-6 flex items-center gap-3">
                {action ?? (
                  <>
                    <button
                      onClick={() => void keep()}
                      disabled={saved || busy}
                      className="pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full bg-paper px-4 text-sub font-medium text-ink transition-colors disabled:opacity-45"
                    >
                      {saved ? <Check /> : <CrateIcon />}
                      <span className="truncate">
                        {saved
                          ? `En ${targetName}`
                          : busy
                            ? "Guardando…"
                            : `Añadir a ${targetName}`}
                      </span>
                    </button>

                    {/* El deseo desaparece en cuanto el disco es tuyo: querer
                        algo que ya tienes no es un estado que exista. */}
                    {onWish && !saved && (
                      <IconButton
                        label={wished ? "Ya está en tu lista de deseos" : "Añadir a la lista de deseos"}
                        onClick={onWish}
                      >
                        {wished ? (
                          <path
                            d="M8 13.2 3 8.6a3 3 0 1 1 5-3.2 3 3 0 1 1 5 3.2Z"
                            fill="currentColor"
                          />
                        ) : (
                          <path
                            d="M8 13.2 3 8.6a3 3 0 1 1 5-3.2 3 3 0 1 1 5 3.2Z"
                            stroke="currentColor"
                            strokeWidth="1.5"
                            strokeLinejoin="round"
                          />
                        )}
                      </IconButton>
                    )}
                  </>
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
        </>
      )}

      {/* La hoja de racks de siempre: la misma que en un disco tuyo, con las
          mismas filas. Se abre sola al guardar porque colocar lo que acabas de
          meter en casa es lo siguiente que se hace, y se cierra sin más si no
          era el caso. */}
      {kept && collections && onAddToList && (
        <SaveSheet
          open={picking}
          onClose={() => setPicking(false)}
          vinyl={kept}
          collections={collections}
          coverOf={coverOf}
          onCreateList={onCreateList}
          onAdd={(listId) => onAddToList(listId, kept)}
          onRemove={(listId) => onRemoveFromList?.(listId, kept)}
        />
      )}
    </RecordScreen>
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
