"use client";

import { useState } from "react";
import Avatar from "@/components/ui/Avatar";
import Sheet from "@/components/ui/Sheet";
import type { Notification } from "@/lib/data/types";

/**
 * Las invitaciones, que son preguntas y no noticias.
 *
 * Iban apiladas encima del río, una tarjeta por cada una. Con dos está bien;
 * con quince, la pantalla de Actividad deja de ser Actividad y se convierte en
 * una bandeja de trámites que hay que despachar antes de ver nada — y encima
 * cada tarjeta ocupa cuatro líneas para decir lo que cabe en una.
 *
 * Así que arriba va lo que hace falta saber de un vistazo: **cuántas hay y de
 * quién**, en un renglón con las caras. Dentro se responden todas seguidas, en
 * una hoja alta, que es donde una tarea repetida se hace cómoda. Nada de
 * «aceptar todas»: aceptar es ponerse a editar la lista de otra persona, y eso
 * se decide una por una.
 */
export default function Invites({
  invites,
  onRespond,
}: {
  invites: Notification[];
  onRespond: (id: string, accept: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  if (invites.length === 0) return null;

  const n = invites.length;
  const first = invites[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="pressable mb-8 flex w-full items-center gap-3 rounded-[14px] bg-fill-subtle px-4 py-3.5 text-left transition-colors hover:bg-fill"
      >
        <span className="flex shrink-0 -space-x-2">
          {invites.slice(0, 3).map((i) => (
            <span key={i.id} className="block rounded-full ring-2 ring-surface">
              <Avatar
                name={i.actor.displayName}
                handle={i.actor.username}
                src={i.actor.avatarUrl}
                size="sm"
              />
            </span>
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body text-paper">
            {n === 1
              ? `${first.actor.displayName} te invita a editar un rack`
              : `${n} invitaciones para editar racks`}
          </span>
          <span className="block truncate text-caption text-content-muted">
            {n === 1 ? first.listTitle : `${first.actor.displayName} y ${n - 1} más`}
          </span>
        </span>
        <span className="shrink-0 rounded-full bg-paper px-3.5 py-1.5 text-caption font-medium text-ink">
          Responder
        </span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Invitaciones"
        subtitle={`${n} ${n === 1 ? "rack" : "racks"} a los que te han invitado`}
        size="tall"
        width={440}
        done
      >
        <ul className="px-3 pb-5 pt-1">
          {invites.map((i) => (
            <li key={i.id} className="border-b border-line last:border-b-0">
              <div className="flex items-center gap-3 px-2 py-3">
                <Avatar
                  name={i.actor.displayName}
                  handle={i.actor.username}
                  src={i.actor.avatarUrl}
                  size="md"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-body text-paper">{i.listTitle}</span>
                  <span className="block truncate text-caption text-content-muted">
                    de {i.actor.displayName}
                  </span>
                </span>
                <span className="flex shrink-0 gap-2">
                  <button
                    onClick={() => onRespond(i.id, true)}
                    className="pressable h-9 rounded-full bg-paper px-4 text-caption font-medium text-ink"
                  >
                    Aceptar
                  </button>
                  <button
                    onClick={() => onRespond(i.id, false)}
                    aria-label={`Rechazar la invitación de ${i.actor.displayName}`}
                    className="pressable flex h-9 w-9 items-center justify-center rounded-full border border-line-strong text-content-muted transition-colors hover:text-paper"
                  >
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                      <path
                        d="M2.5 2.5 L11.5 11.5 M11.5 2.5 L2.5 11.5"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
