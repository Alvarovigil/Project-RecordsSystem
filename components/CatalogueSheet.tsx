"use client";

import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import RecordSpecsCard from "@/components/RecordSpecsCard";

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
 * The sheet leads with the pressing rather than with the album, because that
 * is the question that brought somebody here — `RecordSpecsCard` opens by
 * default for the same reason, where on your own record screen it stays folded
 * away behind a line you press.
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
  const meta = item
    ? [item.year, item.country, item.format?.slice(0, 2).join(", "), item.label]
        .filter(Boolean)
        .join(" · ")
    : "";

  return (
    <Sheet open={Boolean(item)} onClose={onClose} size="tall" width={460} bare>
      {item && (
        <div className="scroll-y min-h-0 flex-1 overflow-y-auto">
          <div className="px-5 pb-8 pt-5">
            <div className="flex gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.cover_image ?? item.thumb ?? "/sleeve-vacio.jpg"}
                alt=""
                className="h-[104px] w-[104px] shrink-0 rounded-[3px] object-cover"
              />
              <div className="min-w-0 flex-1">
                <h2 className="text-heading font-medium leading-tight text-content">
                  {item.title}
                </h2>
                {meta && (
                  <p className="mt-2 text-sub leading-relaxed text-content-muted">{meta}</p>
                )}
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-2">
              {action ?? (
                <button
                  onClick={onSave}
                  disabled={saved || busy}
                  className="pressable flex h-12 w-full items-center justify-center gap-2 rounded-full bg-content text-body font-medium text-surface transition-colors disabled:opacity-45"
                >
                  {saved ? (
                    <>
                      <Check />
                      En {targetName}
                    </>
                  ) : busy ? (
                    "Guardando…"
                  ) : (
                    `Guardar en ${targetName}`
                  )}
                </button>
              )}
              {extra}
            </div>

            {/* Open, not folded. On your own record screen the pressing is a
                detail behind a line; here it is the reason the sheet exists. */}
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
