"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Collection } from "@/lib/collections";

const isPrimary = (c: Collection) => (c.kind ?? "custom") !== "custom";

type PickerProps = {
  collections: Collection[];
  targetId: string;
  anchor: HTMLElement | null;
  disabledIds?: string[];
  onPick: (listId: string) => void;
  onCreate: (name: string) => Promise<string>;
  onClose: () => void;
};

/**
 * Floating list picker. Lives in fixed coordinates because the results list
 * scrolls and would clip it.
 */
export function ListPicker({
  collections,
  targetId,
  anchor,
  disabledIds = [],
  onPick,
  onCreate,
  onClose,
}: PickerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const r = anchor?.getBoundingClientRect();
    if (!r) return;
    const W = 264;
    setPos({
      top: Math.min(r.bottom + 8, window.innerHeight - 340),
      left: Math.max(12, Math.min(r.right - W, window.innerWidth - W - 12)),
    });
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    // Esc closes the picker only — the search behind it must stay open
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [anchor, onClose]);

  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const listed = collections.filter((c) => !q.trim() || norm(c.name).includes(norm(q.trim())));
  const primaries = listed.filter(isPrimary);
  const customs = listed.filter((c) => !isPrimary(c));

  const Row = ({ c }: { c: Collection }) => {
    const off = disabledIds.includes(c.id);
    return (
      <button
        onClick={() => !off && onPick(c.id)}
        disabled={off}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] transition ${
          off ? "cursor-default text-paper/25" : "text-paper/85 hover:bg-paper/[0.06] hover:text-paper"
        }`}
      >
        <span className="flex-1 truncate">{c.name}</span>
        {off ? (
          <Check className="text-paper/30" />
        ) : (
          <span className="text-[11px] text-paper/30">{c.vinylIds.length}</span>
        )}
        {c.id === targetId && !off && <span className="h-1.5 w-1.5 rounded-full bg-paper/70" />}
      </button>
    );
  };

  return (
    <div
      ref={panelRef}
      style={pos ? { top: pos.top, left: pos.left } : { visibility: "hidden" }}
      className="fixed z-[60] w-[264px] border border-paper/15 bg-[#0d0d0d] shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      <div className="border-b border-paper/10 px-3 py-2">
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar lista…"
          className="w-full bg-transparent text-[13px] text-paper outline-none placeholder:text-paper/30"
        />
      </div>
      <div data-scrollable className="max-h-[220px] overflow-y-auto py-1">
        {primaries.map((c) => (
          <Row key={c.id} c={c} />
        ))}
        {primaries.length > 0 && customs.length > 0 && <div className="my-1 h-px bg-paper/[0.07]" />}
        {customs.map((c) => (
          <Row key={c.id} c={c} />
        ))}
        {listed.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-paper/40">Ninguna lista con ese nombre</div>
        )}
      </div>
      <div className="border-t border-paper/10">
        {creating || (q.trim() && listed.length === 0) ? (
          <input
            autoFocus
            defaultValue={listed.length === 0 ? q.trim() : ""}
            placeholder="Nombre de la lista"
            onKeyDown={async (e) => {
              if (e.key !== "Enter") return;
              const name = (e.target as HTMLInputElement).value.trim();
              if (name) onPick(await onCreate(name));
            }}
            className="w-full bg-transparent px-3 py-2.5 text-[13px] text-paper outline-none placeholder:text-paper/30"
          />
        ) : (
          <button
            onClick={() => setCreating(true)}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] text-paper/70 transition hover:bg-paper/[0.06] hover:text-paper"
          >
            <span className="flex h-4 w-4 items-center justify-center border border-paper/30 text-[11px] leading-none">
              +
            </span>
            Crear lista
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The destination, stated ONCE above the results instead of repeated on every
 * row. Everything you save goes here until you change it.
 */
export function DestinationBar({
  collections,
  targetId,
  onTargetChange,
  onCreateList,
}: {
  collections: Collection[];
  targetId: string;
  onTargetChange: (id: string) => void;
  onCreateList: (name: string) => Promise<string>;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const target = collections.find((c) => c.id === targetId) ?? collections[0];

  return (
    <div className="flex items-center gap-2">
      <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/35">
        Guardar en
      </span>
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 border-b border-paper/25 pb-0.5 text-[13px] text-paper transition hover:border-paper/70"
      >
        <span className="max-w-[170px] truncate">{target?.name ?? "Lista"}</span>
        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden>
          <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.1" />
        </svg>
      </button>
      {open && (
        <ListPicker
          collections={collections}
          targetId={targetId}
          anchor={btnRef.current}
          onCreate={onCreateList}
          onPick={(id) => {
            onTargetChange(id);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function Check({ className = "" }: { className?: string }) {
  return (
    <svg width="11" height="11" viewBox="0 0 12 12" fill="none" className={className} aria-hidden>
      <path d="M2 6.4 L4.6 9 L10 3.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Per-row action. Quiet until you reach the row, so a list of results doesn't
 * read as a wall of buttons.
 */
export function RowSave({
  collections,
  targetId,
  containedIn = [],
  savedIn = null,
  busy = false,
  onSave,
  onUndo,
  onCreateList,
  onTargetChange,
}: {
  collections: Collection[];
  targetId: string;
  containedIn?: string[];
  savedIn?: string | null;
  busy?: boolean;
  onSave: (listId: string) => void;
  onUndo?: (listId: string) => void;
  onCreateList: (name: string) => Promise<string>;
  onTargetChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const justSaved = savedIn ? collections.find((c) => c.id === savedIn) : null;
  const already = containedIn.includes(targetId);

  if (justSaved) {
    return (
      <div className="flex shrink-0 items-center gap-3 pr-2 text-[12px]">
        <span className="flex items-center gap-1.5 text-paper/55">
          <Check className="text-paper/70" />
          <span className="max-w-[120px] truncate">{justSaved.name}</span>
        </span>
        {onUndo && (
          <button
            onClick={() => onUndo(justSaved.id)}
            className="mono text-[10px] uppercase tracking-[0.16em] text-paper/35 transition hover:text-paper"
          >
            Deshacer
          </button>
        )}
      </div>
    );
  }

  if (already) {
    return (
      <span className="flex shrink-0 items-center gap-1.5 pr-3 text-[12px] text-paper/35">
        <Check />
        Guardado
      </span>
    );
  }

  return (
    <div ref={wrapRef} className="flex shrink-0 items-stretch pr-2">
      <button
        onClick={() => onSave(targetId)}
        disabled={busy}
        className="rounded-sm border border-paper/20 px-3 py-1.5 text-[12px] text-paper/70 transition hover:border-transparent hover:bg-paper hover:text-ink disabled:opacity-40 group-hover:border-paper/40"
      >
        {busy ? "Guardando…" : "Guardar"}
      </button>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Guardar en otra lista"
        title="Guardar en otra lista"
        className="reveal-on-hover ml-1 flex w-6 items-center justify-center rounded-sm text-paper/30 transition hover:text-paper"
      >
        <svg width="9" height="9" viewBox="0 0 8 8" fill="none">
          <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.2" />
        </svg>
      </button>
      {open && (
        <ListPicker
          collections={collections}
          targetId={targetId}
          anchor={wrapRef.current}
          disabledIds={containedIn}
          onCreate={onCreateList}
          onPick={(id) => {
            onTargetChange(id);
            setOpen(false);
            onSave(id);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
