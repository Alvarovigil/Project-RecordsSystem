"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import { useToast, ToastIcon } from "@/components/ui/Toast";
import { useSaves } from "@/hooks/useListFlags";

/**
 * Keeping a list somebody else made.
 *
 * The decision underneath this button is the one Spotify made about playlists
 * and everyone copied for a reason: a saved list stays **theirs**. It is a
 * reference, not a copy — when they add a record, yours changes too, and you
 * cannot edit it. That is what makes saving cheap: you are not taking on a
 * maintenance job, you are keeping a pointer.
 *
 * The cost is a corner people get stuck in — "I want this list but with my
 * changes". The escape hatch for that is duplicating, which is not offered
 * yet: until the copy is properly resolved, showing the door is worse than
 * not having it.
 */
export default function SaveListButton({
  listId,
  listTitle,
  ownerName,
  ownerHandle,
  size = "md",
}: {
  listId: string;
  listTitle: string;
  ownerName: string;
  ownerHandle: string;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const toast = useToast();
  // el mismo estado que lee el contador de guardadas que hay al lado, y que
  // cualquier otra copia de esta lista en pantalla: dos respuestas distintas a
  // "¿la tengo guardada?" en la misma vista es un fallo que se ve
  const saves = useSaves();
  const saved = saves.ready ? saves.has(listId) : null;
  const [menu, setMenu] = useState(false);

  const toggle = async () => {
    const next = !saved;
    try {
      await saves.toggle(listId, next);
      if (next) {
        // says where it went, because "guardada" alone leaves you wondering
        toast.show("Guardada en tu colección", {
          media: { icon: ToastIcon.list },
          // to the list itself, not to the neighbourhood it lives in: "Ver"
          // that drops you in your own shelf and leaves you to find what you
          // just saved is an offer the user has to finish themselves
          action: {
            label: "Ver",
            onClick: () => router.push(`/coleccion?lista=${listId}`),
          },
        });
      } else {
        toast.undo(
          "Ya no la guardas",
          () => {
            void saves.toggle(listId, true);
          },
          { media: { icon: ToastIcon.list } },
        );
      }
    } catch (e) {
      // says which of the two failed, and — where the backend gave a reason —
      // what it was. "No se pudo guardar" on an unsave is its own small lie.
      const why = e instanceof Error && e.message ? ` (${e.message})` : "";
      toast.show(next ? `No se pudo guardar.${why}` : `No se pudo quitar.${why}`, {
        tone: "error",
      });
    }
  };

  const share = async () => {
    const url = `${window.location.origin}/u/${ownerHandle}/${slugish(listTitle)}`;
    // the platform sheet when there is one; the clipboard is the honest
    // fallback, and it says so rather than silently doing nothing
    if (navigator.share) {
      try {
        await navigator.share({ title: listTitle, url });
        setMenu(false);
        return;
      } catch {
        return; // cancelled by the user is not an error
      }
    }
    await navigator.clipboard?.writeText(url);
    setMenu(false);
    toast.show("Enlace copiado", { media: { icon: ToastIcon.link } });
  };

  if (saved === null) return <span aria-hidden style={{ minWidth: 104 }} />;

  return (
    <>
      <div className="flex items-center gap-1.5">
        <Button
          variant={saved ? "secondary" : "primary"}
          size={size}
          onClick={toggle}
          style={{ minWidth: size === "sm" ? 96 : 112 }}
        >
          {saved ? "Guardada" : "Guardar"}
        </Button>
        <button
          onClick={() => setMenu(true)}
          aria-label={`Más opciones de ${listTitle}`}
          className="pressable flex h-11 w-9 items-center justify-center text-content-muted transition-colors hover:text-paper"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
            <circle cx="8" cy="3.2" r="1.35" fill="currentColor" />
            <circle cx="8" cy="8" r="1.35" fill="currentColor" />
            <circle cx="8" cy="12.8" r="1.35" fill="currentColor" />
          </svg>
        </button>
      </div>

      <Sheet
        open={menu}
        onClose={() => setMenu(false)}
        title={listTitle}
        subtitle={`Rack de ${ownerName}`}
        size="auto"
        width={380}
      >
        <div className="py-1.5">
          <SheetRow
            label={saved ? "Quitar de mi colección" : "Guardar en mi colección"}
            detail={saved ? undefined : "Se actualiza sola"}
            onClick={() => {
              void toggle();
              setMenu(false);
            }}
          />
          {/* duplicar: oculto por ahora, hasta que la copia esté resuelta */}
          <SheetRow label="Compartir enlace" onClick={() => void share()} />
          <SheetRow label={`Ver el perfil de ${ownerName}`} href={`/u/${ownerHandle}`} />
        </div>
        {/* what saving actually does, said once, where the choice is made */}
        <p className="mx-2 mt-1 border-t border-line px-3 pb-3.5 pt-3 text-caption leading-relaxed text-content-muted">
          Guardada, la lista sigue siendo de {ownerName} y cambia cuando {ownerName.split(" ")[0]} la
          cambia.
        </p>
      </Sheet>
    </>
  );
}

const slugish = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
