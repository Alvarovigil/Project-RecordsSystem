"use client";

import { useEffect, useRef } from "react";
import Sheet from "./Sheet";
import Button from "./Button";

/**
 * The question you ask only when undo cannot answer it.
 *
 * Three rules, all of them about not tricking anyone:
 *   - the title names the consequence, not the action ("Se borrará la lista"
 *     rather than "¿Borrar lista?"), because the consequence is what someone
 *     is actually deciding about;
 *   - the confirming button says what it does — "Borrar", never "Aceptar";
 *   - cancel holds the initial focus. If a dialog opens under a thumb already
 *     travelling toward the screen, the safe option is the one that must be
 *     under it.
 */
export default function Confirm({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  danger = true,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (open) requestAnimationFrame(() => cancelRef.current?.focus());
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} size="auto" width={400} bare>
      <div className="px-6 pb-6 pt-7">
        <h2 className="text-heading text-paper">{title}</h2>
        {body && <p className="mt-2 text-sub text-content-muted">{body}</p>}
        {/* the destructive option is on the right and never pre-focused */}
        <div className="mt-6 flex gap-2.5">
          <Button ref={cancelRef} variant="ghost" block onClick={onClose}>
            Cancelar
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            block
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
