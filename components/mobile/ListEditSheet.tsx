"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Confirm from "@/components/ui/Confirm";
import { useToast, ToastIcon } from "@/components/ui/Toast";
import CollaboratorsSheet from "@/components/community/CollaboratorsSheet";
import { SORT_LABELS, type SortMode, type Collection } from "@/lib/collections";
import { coverFor } from "@/lib/cover";
import type { Vinyl } from "@/lib/types";
import type { ListVisibility } from "@/lib/data/types";

/**
 * Everything you can do TO a list, as opposed to inside it.
 *
 * On a desktop this lives in a 750-line panel with hover-revealed pencils and
 * a right-click menu. None of those exist on a phone, and the result was that
 * renaming, sorting, publishing and deleting a list were simply unavailable
 * there — the feature wasn't small on mobile, it was missing.
 *
 * The shape is the iOS convention because it is the one people already know:
 * a sheet of rows, grouped by consequence, with the destructive row last and
 * visually apart. Renaming happens in place rather than in a second dialogue —
 * a sheet that opens a sheet to change one word is a flow nobody finishes.
 *
 * `window.prompt` used to do this job. It works, and it also announces that
 * nobody looked at this screen.
 */
export default function ListEditSheet({
  open,
  onClose,
  list,
  visibility,
  isPrimary,
  myId,
  onRename,
  onDelete,
  onSetSort,
  onSetVisibility,
  records,
  onRemoveRecord,
}: {
  open: boolean;
  onClose: () => void;
  list: Collection | null;
  visibility: ListVisibility;
  /** the collection and the wishlist: renameable, but never deletable */
  isPrimary: boolean;
  myId: string;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onSetSort: (id: string, sortBy: SortMode) => void;
  onSetVisibility: (id: string, v: ListVisibility) => void;
  /** what is inside the list, in its own order */
  records: Vinyl[];
  onRemoveRecord: (listId: string, vinylId: string) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [pane, setPane] = useState<"root" | "sort" | "visibility" | "records">("root");
  const [deleting, setDeleting] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (open && list) {
      setName(list.name);
      setPane("root");
    }
  }, [open, list]);

  if (!list) return null;

  const commitName = () => {
    const clean = name.trim();
    if (!clean || clean === list.name) return;
    onRename(list.id, clean);
    toast.show("Lista renombrada", { media: { icon: ToastIcon.list } });
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={() => {
          commitName();
          onClose();
        }}
        title={
          pane === "root"
            ? "Lista"
            : pane === "sort"
              ? "Ordenar por"
              : pane === "records"
                ? "Discos"
                : "Quién puede verla"
        }
        subtitle={pane === "root" ? `${list.vinylIds.length} discos` : list.name}
        size={pane === "records" ? "tall" : "auto"}
        width={400}
        action={
          pane !== "root" ? (
            <Button size="sm" variant="ghost" onClick={() => setPane("root")}>
              Atrás
            </Button>
          ) : undefined
        }
      >
        {pane === "root" && (
          <>
            <div className="px-5 pb-1 pt-4">
              <label className="text-caption uppercase tracking-label text-content-muted" htmlFor="list-name">
                Nombre
              </label>
              <input
                id="list-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                enterKeyHint="done"
                className="mt-2 h-11 w-full rounded-control border border-line-strong bg-transparent px-3 text-body text-paper outline-none transition-colors focus:border-line-focus"
              />
            </div>

            <div className="mt-3 border-t border-line py-1">
              {/* The desktop panel edits a list's contents behind a pencil that
                  appears on hover. There is no hover here, and without a door
                  of its own the only way to take a record out on a phone was to
                  open the record itself and go looking — so the list you are
                  already editing gets its own row. */}
              <SheetRow
                label="Discos"
                detail={`${list.vinylIds.length}`}
                onClick={() => setPane("records")}
              />
              <SheetRow
                label="Ordenar por"
                detail={SORT_LABELS[(list.sortBy ?? "custom") as SortMode]}
                onClick={() => setPane("sort")}
              />
              <SheetRow
                label="Quién puede verla"
                detail={VISIBILITY[visibility].short}
                onClick={() => setPane("visibility")}
              />
              {!isPrimary && <SheetRow label="Invitar a editar" onClick={() => setSharing(true)} />}
            </div>

            {!isPrimary && (
              <div className="border-t border-line py-1">
                <SheetRow label="Borrar lista" danger onClick={() => setDeleting(true)} />
              </div>
            )}
            {isPrimary && (
              // Saying why the option is missing beats a greyed-out row that
              // makes people tap it repeatedly to find out.
              <p className="border-t border-line px-5 py-3.5 text-caption leading-relaxed text-content-muted">
                Tu colección y tu lista de deseos no se pueden borrar. Puedes renombrarlas.
              </p>
            )}
          </>
        )}

        {pane === "records" && (
          <div className="pb-2">
            {records.length === 0 ? (
              <p className="px-5 py-6 text-sub leading-relaxed text-content-muted">
                Esta lista está vacía. Busca un disco y guárdalo aquí.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {records.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-5 py-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={coverFor(v)}
                      alt=""
                      loading="lazy"
                      className="h-10 w-10 shrink-0 rounded-sm object-cover"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sub text-paper">{v.title}</span>
                      <span className="block truncate text-caption text-content-muted">
                        {v.artist}
                      </span>
                    </span>
                    {/* One press, and the undo lives in the toast. A confirm
                        dialogue per record turns tidying a list into forty
                        dialogues. */}
                    <button
                      onClick={() => onRemoveRecord(list.id, v.id)}
                      aria-label={`Quitar ${v.title} de ${list.name}`}
                      className="pressable flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-content-muted transition-colors hover:border-[#ff6b57] hover:text-[#ff6b57]"
                    >
                      <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
                        <path d="M2 6h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="border-t border-line px-5 py-3.5 text-caption leading-relaxed text-content-muted">
              Quitarlos de aquí no los borra de tu colección.
            </p>
          </div>
        )}

        {pane === "sort" && (
          <div className="py-1">
            {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
              <SheetRow
                key={mode}
                label={SORT_LABELS[mode]}
                detail={(list.sortBy ?? "custom") === mode ? "✓" : undefined}
                onClick={() => {
                  onSetSort(list.id, mode);
                  setPane("root");
                }}
              />
            ))}
          </div>
        )}

        {pane === "visibility" && (
          <div className="py-1">
            {(Object.keys(VISIBILITY) as ListVisibility[]).map((v) => (
              <SheetRow
                key={v}
                label={VISIBILITY[v].label}
                detail={visibility === v ? "✓" : undefined}
                onClick={() => {
                  onSetVisibility(list.id, v);
                  setPane("root");
                  toast.show(VISIBILITY[v].confirm, { media: { icon: ToastIcon.list } });
                }}
              />
            ))}
            <p className="border-t border-line px-5 py-3.5 text-caption leading-relaxed text-content-muted">
              {VISIBILITY[visibility].help}
            </p>
          </div>
        )}
      </Sheet>

      <CollaboratorsSheet
        open={sharing}
        onClose={() => setSharing(false)}
        listId={list.id}
        listTitle={list.name}
        isOwner
        myId={myId}
      />

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title={`Se borrará «${list.name}»`}
        body={`La lista desaparece. Los ${list.vinylIds.length} discos siguen en tu colección.`}
        confirmLabel="Borrar lista"
        onConfirm={() => {
          onDelete(list.id);
          onClose();
          toast.show("Lista borrada", { media: { icon: ToastIcon.trash } });
        }}
      />
    </>
  );
}

/**
 * Visibility in words people use, not in database enums.
 *
 * "Unlisted" means nothing to anyone; "cualquiera con el enlace" is the same
 * setting described by what it does.
 */
const VISIBILITY: Record<ListVisibility, { label: string; short: string; help: string; confirm: string }> = {
  public: {
    label: "Cualquiera",
    short: "Pública",
    help: "Aparece en tu perfil y puede salir en Explorar.",
    confirm: "Ahora es pública",
  },
  unlisted: {
    label: "Solo con el enlace",
    short: "Oculta",
    help: "No sale en tu perfil ni en las búsquedas, pero quien tenga el enlace entra.",
    confirm: "Ahora solo se ve con el enlace",
  },
  private: {
    label: "Solo tú",
    short: "Privada",
    help: "Nadie más la ve, ni con el enlace.",
    confirm: "Ahora es privada",
  },
};
