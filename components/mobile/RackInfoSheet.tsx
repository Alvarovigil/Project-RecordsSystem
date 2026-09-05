"use client";

import Sheet from "@/components/ui/Sheet";
import { portraitOf } from "@/lib/collection-portrait";
import { cleanArtist } from "@/lib/artist";
import type { Vinyl } from "@/lib/types";

/**
 * Qué hay dentro de este rack, en el móvil.
 *
 * Esta información existía y solo se podía ver en un escritorio: el panel de
 * racks de la versión grande imprime una tabla — discos, última incorporación,
 * género que más pesa, décadas — que en el teléfono no tenía ninguna puerta.
 * Y el teléfono es donde vive esta aplicación.
 *
 * No es la misma tabla. Es el mismo retrato que hace el perfil de una
 * colección entera, aplicado a un cajón: lo que hay dentro dicho en tarjetas,
 * con el mismo lenguaje que el resto de la aplicación en lugar de una tabla de
 * dos columnas. Un rack tiene forma igual que la tiene una estantería, y
 * enseñársela a quien lo montó es la mitad de la gracia de haberlo montado.
 */
export default function RackInfoSheet({
  open,
  onClose,
  title,
  description,
  records,
  onRename,
  onEdit,
  onShare,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  records: Vinyl[];
  onRename?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
}) {
  const portrait = portraitOf(records);
  const artists = new Set(records.map((v) => cleanArtist(v.artist)).filter(Boolean)).size;
  const last = records[records.length - 1];

  const facts: { k: string; v: string; note?: string }[] = [
    { k: "Discos", v: String(records.length), note: `${artists} ${artists === 1 ? "artista" : "artistas"}` },
  ];
  if (last) facts.push({ k: "Lo último", v: last.title, note: cleanArtist(last.artist) });
  if (portrait.genre)
    facts.push({ k: "Sobre todo", v: portrait.genre.name, note: `${portrait.genre.share}% del rack` });
  if (portrait.decade)
    facts.push({ k: "Su década", v: portrait.decade.label, note: `${portrait.decade.count} discos` });
  if (portrait.label)
    facts.push({ k: "Sello que repite", v: portrait.label.name, note: `${portrait.label.count} veces` });
  if (portrait.span) facts.push({ k: "De", v: `${portrait.span.from} a ${portrait.span.to}` });

  return (
    <Sheet open={open} onClose={onClose} title={title} subtitle={description} size="tall" width={420} done>
      <div className="px-5 pb-6 pt-2">
        <ul className="grid grid-cols-2 gap-2.5">
          {facts.map((f) => (
            <li key={f.k} className="rounded-[14px] bg-fill-subtle px-4 py-3.5">
              <p className="text-micro uppercase tracking-label text-content-faint">{f.k}</p>
              <p className="mt-1.5 truncate text-body leading-snug text-paper">{f.v}</p>
              {f.note && <p className="mt-0.5 truncate text-caption text-content-muted">{f.note}</p>}
            </li>
          ))}
        </ul>

        {(onEdit || onRename || onShare) && (
          <div className="mt-5 flex gap-2.5">
            {onEdit && (
              <button
                onClick={onEdit}
                className="pressable h-11 flex-1 rounded-full bg-fill text-sub font-medium text-paper transition-colors hover:bg-fill-strong"
              >
                Editar discos
              </button>
            )}
            {onRename && (
              <button
                onClick={onRename}
                className="pressable h-11 flex-1 rounded-full border border-line-strong text-sub text-content transition-colors hover:border-line-focus"
              >
                Renombrar
              </button>
            )}
            {onShare && (
              <button
                onClick={onShare}
                aria-label="Compartir el rack"
                className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-line-strong text-content"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M8 10.5V2.6 M5 5.4 L8 2.4 L11 5.4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M3.2 9.4v3.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V9.4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
