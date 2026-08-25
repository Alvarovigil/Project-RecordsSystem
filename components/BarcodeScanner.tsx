"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Vinyl } from "@/lib/types";
import type { Collection } from "@/lib/collections";
import { DestinationBar } from "./SaveToList";

type Match = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  thumb?: string;
  format?: string[];
};

/** One pass of the camera over one sleeve, and what came of it. */
type Scan = {
  key: string;
  code: string;
  status: "looking" | "added" | "duplicate" | "notfound" | "error";
  match?: Match;
  /** what to undo: the record left the library entirely if we created it */
  saved?: { vinylId: string; listId: string; wasNew: boolean };
  listName?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  collections: Collection[];
  targetId: string;
  onTargetChange: (id: string) => void;
  onCreateList: (name: string) => Promise<string>;
  allVinilos: Vinyl[];
  onSaveToList: (v: Vinyl, listId: string) => void;
  onRemoveFromList: (vinylId: string, listId: string) => void;
  onDeleteVinyl: (vinylId: string) => void;
  /** hand an unreadable code back to the text search, so the trail never ends */
  onSearchManually: (query: string) => void;
};

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

/**
 * Whether this device can scan at all. Decided after mount: the camera only
 * exists on the client and only over https, and a button that leads nowhere is
 * worse than no button.
 */
export function useCanScan() {
  const [canScan, setCanScan] = useState(false);
  useEffect(() => {
    setCanScan(Boolean(navigator.mediaDevices?.getUserMedia));
  }, []);
  return canScan;
}

/** The barcode mark, shared by every surface that offers the camera. */
export function BarcodeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden>
      <path
        d="M1 5.5V2.5A1.5 1.5 0 0 1 2.5 1h3M12.5 1h3A1.5 1.5 0 0 1 17 2.5v3M17 12.5v3a1.5 1.5 0 0 1-1.5 1.5h-3M5.5 17h-3A1.5 1.5 0 0 1 1 15.5v-3"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M4.6 5.4v7.2M7 5.4v7.2M9.6 5.4v7.2M13.4 5.4v7.2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

export default function BarcodeScanner({
  open,
  onClose,
  collections,
  targetId,
  onTargetChange,
  onCreateList,
  allVinilos,
  onSaveToList,
  onRemoveFromList,
  onDeleteVinyl,
  onSearchManually,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopFns = useRef<Array<() => void>>([]);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchable, setTorchable] = useState(false);
  const [typing, setTyping] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [flash, setFlash] = useState(false);

  // The scan loop lives outside React's render cycle, so everything it needs to
  // decide must be readable synchronously from a ref.
  const seen = useRef<Map<string, number>>(new Map());
  const targetRef = useRef(targetId);
  targetRef.current = targetId;
  const vinilosRef = useRef(allVinilos);
  vinilosRef.current = allVinilos;
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  // read through a ref: if the callback's identity fed the camera effect, every
  // parent render would tear the video stream down and put it back up
  const saveRef = useRef(onSaveToList);
  saveRef.current = onSaveToList;

  const addedCount = scans.filter((s) => s.status === "added").length;

  const patch = useCallback(
    (key: string, next: Partial<Scan>) =>
      setScans((s) => s.map((x) => (x.key === key ? { ...x, ...next } : x))),
    [],
  );

  /** fetch the full release and put it on the shelf */
  const addMatch = useCallback(
    async (key: string, match: Match, listId: string) => {
      patch(key, { status: "looking", match });
      try {
        const res = await fetch("/api/discogs/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseId: match.id }),
        });
        const payload = await res.json();
        if (!payload.vinyl) return patch(key, { status: "error", match });
        const wasNew = !vinilosRef.current.some((v) => v.id === payload.vinyl.id);
        saveRef.current(payload.vinyl, listId);
        patch(key, {
          status: "added",
          match,
          listName: collectionsRef.current.find((c) => c.id === listId)?.name,
          saved: { vinylId: payload.vinyl.id, listId, wasNew },
        });
      } catch {
        patch(key, { status: "error", match });
      }
    },
    [patch],
  );

  const handleCode = useCallback(
    async (raw: string) => {
      const code = raw.replace(/\s/g, "");
      if (code.length < 8) return;
      // the camera reads the same sleeve 20 times a second; one scan per sleeve
      const last = seen.current.get(code) ?? 0;
      const now = performance.now();
      if (now - last < 4000) return;
      seen.current.set(code, now);

      navigator.vibrate?.(24);
      setFlash(true);
      setTimeout(() => setFlash(false), 260);

      const key = `${code}-${Math.round(now)}`;
      const listId = targetRef.current;
      const listName = collectionsRef.current.find((c) => c.id === listId)?.name;
      setScans((s) => [{ key, code, status: "looking", listName }, ...s]);

      try {
        const r = await fetch(`/api/discogs/barcode?code=${encodeURIComponent(code)}`);
        const data = await r.json();
        const match: Match | null = data.match ?? null;
        if (!match) return patch(key, { status: "notfound" });

        // Already on a shelf of yours: say so instead of silently adding a
        // second copy — the usual reason you are scanning is to find out.
        const known = vinilosRef.current.find((v) => v.discogsId === match.id);
        if (known && collectionsRef.current.some((c) => c.vinylIds.includes(known.id))) {
          return patch(key, { status: "duplicate", match });
        }

        await addMatch(key, match, listId);
      } catch {
        patch(key, { status: "error" });
      }
    },
    [addMatch, patch],
  );

  // camera + decoder
  useEffect(() => {
    if (!open) return;
    let dead = false;
    setError(null);

    (async () => {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
        });
      } catch {
        if (!dead) {
          setError("No pudimos abrir la cámara. Puedes teclear el código a mano.");
          setTyping(true);
        }
        return;
      }
      if (dead) return stream.getTracks().forEach((t) => t.stop());
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => {});

      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchable(Boolean(caps?.torch));

      // Chrome and Android ship a native detector that is faster and lighter
      // than anything we could bundle; ZXing covers iOS Safari and Firefox.
      const Native = (window as any).BarcodeDetector;
      if (Native) {
        try {
          const detector = new Native({ formats: FORMATS });
          const timer = setInterval(async () => {
            if (dead || video.readyState < 2) return;
            try {
              const hits = await detector.detect(video);
              if (hits?.[0]?.rawValue) void handleCode(hits[0].rawValue);
            } catch {}
          }, 250);
          stopFns.current.push(() => clearInterval(timer));
          return;
        } catch {}
      }

      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      if (dead) return;
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoElement(video, (result) => {
        if (result) void handleCode(result.getText());
      });
      stopFns.current.push(() => controls.stop());
    })();

    return () => {
      dead = true;
      stopFns.current.forEach((fn) => {
        try {
          fn();
        } catch {}
      });
      stopFns.current = [];
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open, handleCode]);

  // a fresh session starts empty; the tray is a record of *this* run
  useEffect(() => {
    if (!open) {
      setScans([]);
      setTyping(false);
      setTorchOn(false);
      seen.current.clear();
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] as any });
      setTorchOn(next);
    } catch {}
  };

  const undo = (s: Scan) => {
    if (!s.saved) return;
    if (s.saved.wasNew) onDeleteVinyl(s.saved.vinylId);
    else onRemoveFromList(s.saved.vinylId, s.saved.listId);
    setScans((list) => list.filter((x) => x.key !== s.key));
    seen.current.delete(s.code);
  };

  // "already yours" is information, not a wall: a second copy is a legitimate
  // thing to own, and adding it is one tap away
  const addAnyway = (s: Scan) => {
    if (s.match) void addMatch(s.key, s.match, targetRef.current);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-black/35" />

      {/* viewfinder */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 flex -translate-y-[60%] justify-center">
        <div
          className={`relative h-[150px] w-[270px] transition-colors duration-200 ${
            flash ? "bg-paper/15" : ""
          }`}
        >
          {(["-top-px -left-px border-t border-l", "-top-px -right-px border-t border-r",
             "-bottom-px -left-px border-b border-l", "-bottom-px -right-px border-b border-r"] as const).map(
            (pos) => (
              <span
                key={pos}
                className={`absolute h-6 w-6 border-paper/80 ${pos} ${flash ? "border-paper" : ""}`}
              />
            ),
          )}
          <span className="absolute inset-x-4 top-1/2 h-px bg-paper/50" />
        </div>
      </div>
      <p className="pointer-events-none absolute inset-x-0 top-1/2 mt-[40px] text-center text-[13px] text-paper/70">
        {error ? "" : "Apunta al código de barras de la contraportada"}
      </p>

      {/* top bar: leaving, destination, light */}
      <div className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/80 to-transparent px-4 pb-8 pt-[max(14px,env(safe-area-inset-top))]">
        <button
          onClick={onClose}
          aria-label="Cerrar el escáner"
          className="flex h-9 w-9 items-center justify-center text-paper/80 transition hover:text-paper"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.3" />
          </svg>
        </button>
        <div className="min-w-0">
          <DestinationBar
            collections={collections}
            targetId={targetId}
            onTargetChange={onTargetChange}
            onCreateList={onCreateList}
          />
        </div>
        <button
          onClick={toggleTorch}
          aria-label="Linterna"
          className={`flex h-9 w-9 items-center justify-center transition ${
            torchable ? (torchOn ? "text-paper" : "text-paper/50 hover:text-paper") : "invisible"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1 L3.5 9 H7.5 L6.5 15 L12.5 6.5 H8.5 Z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" fill={torchOn ? "currentColor" : "none"} />
          </svg>
        </button>
      </div>

      {/* the run so far: newest on top, each row still undoable */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/85 to-transparent pb-[max(14px,env(safe-area-inset-bottom))] pt-10">
        {error && (
          <p className="px-5 pb-3 text-[13px] text-paper/70">{error}</p>
        )}

        <div data-scrollable className="max-h-[38vh] overflow-y-auto px-4">
          {scans.slice(0, 8).map((s) => (
            <ScanRow
              key={s.key}
              scan={s}
              onUndo={() => undo(s)}
              onAddAnyway={() => addAnyway(s)}
              onManual={() => {
                onSearchManually(s.code);
                onClose();
              }}
            />
          ))}
        </div>

        {typing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("code") as HTMLInputElement);
              const value = input.value.trim();
              if (value) void handleCode(value);
              input.value = "";
            }}
            className="mx-4 mt-3 flex items-center gap-3 border-b border-paper/25"
          >
            <input
              name="code"
              autoFocus
              inputMode="numeric"
              placeholder="Teclea el código de barras…"
              className="flex-1 bg-transparent py-3 text-[15px] text-paper outline-none placeholder:text-paper/35"
            />
            <button type="submit" className="mono py-3 text-[10px] uppercase tracking-[0.2em] text-paper/60">
              Buscar
            </button>
          </form>
        ) : null}

        <div className="mt-3 flex items-center justify-between px-5">
          <button
            onClick={() => setTyping((v) => !v)}
            className="mono text-[10px] uppercase tracking-[0.2em] text-paper/45 transition hover:text-paper"
          >
            {typing ? "Volver a la cámara" : "Escribir el código"}
          </button>
          <button
            onClick={onClose}
            className="mono text-[10px] uppercase tracking-[0.2em] text-paper transition hover:text-paper/70"
          >
            {addedCount > 0
              ? `Listo · ${addedCount} ${addedCount === 1 ? "añadido" : "añadidos"}`
              : "Listo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ScanRow({
  scan,
  onUndo,
  onAddAnyway,
  onManual,
}: {
  scan: Scan;
  onUndo: () => void;
  onAddAnyway: () => void;
  onManual: () => void;
}) {
  const { match, status } = scan;
  return (
    <div className="flex items-center gap-3 border-b border-paper/10 py-2.5 last:border-b-0">
      {match?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={match.thumb} alt="" className="h-11 w-11 shrink-0 rounded-sm object-cover" />
      ) : (
        <div className="h-11 w-11 shrink-0 rounded-sm bg-paper/10" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] text-paper/90">
          {match?.title ?? (status === "notfound" ? "Sin ficha para ese código" : scan.code)}
        </div>
        <div className="mono mt-0.5 truncate text-[10px] uppercase tracking-[0.16em] text-paper/45">
          {status === "looking" && "Buscando…"}
          {status === "added" && `Añadido a ${scan.listName ?? "tu lista"}`}
          {status === "duplicate" && "Ya lo tienes"}
          {status === "notfound" && scan.code}
          {status === "error" && "No se pudo añadir"}
        </div>
      </div>
      {status === "added" && (
        <button onClick={onUndo} className="mono shrink-0 text-[10px] uppercase tracking-[0.18em] text-paper/50 transition hover:text-paper">
          Deshacer
        </button>
      )}
      {status === "duplicate" && (
        <button onClick={onAddAnyway} className="mono shrink-0 text-[10px] uppercase tracking-[0.18em] text-paper/50 transition hover:text-paper">
          Añadir igual
        </button>
      )}
      {(status === "notfound" || status === "error") && (
        <button onClick={onManual} className="mono shrink-0 text-[10px] uppercase tracking-[0.18em] text-paper/50 transition hover:text-paper">
          Buscar a mano
        </button>
      )}
    </div>
  );
}
