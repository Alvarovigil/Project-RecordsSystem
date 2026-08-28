"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
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

  /**
   * Clearing a card is not undoing what it did.
   *
   * Swiping away a notification on a phone dismisses the message, it does not
   * reverse the event — and a scanner where a careless swipe silently removed a
   * record from your shelf would be unusable. The code stays in `seen`, so the
   * camera doesn't immediately re-scan the sleeve still in front of it.
   */
  const dismiss = (key: string) => setScans((list) => list.filter((x) => x.key !== key));

  if (!open) return null;

  // Only the newest few stay open. A notification centre that never collapses
  // is a list, and a list over a viewfinder is a wall.
  const OPEN = 3;
  const visible = scans.slice(0, OPEN);
  const buried = Math.max(0, scans.length - OPEN);

  return (
    /**
     * A column, not a pile of absolutely-positioned pieces.
     *
     * The old layout put the viewfinder at top-1/2 and grew the results upward
     * from the bottom to 38vh; with a few scans they sat on top of each other,
     * and on a short screen the hint text landed inside the frame. Nothing here
     * is positioned against the viewport any more — the header takes what it
     * needs, the cards take what they need, and the viewfinder takes what is
     * left. Overlap stops being something to tune and becomes impossible.
     */
    <div className="fixed inset-0 z-[70] flex flex-col bg-black">
      <video
        ref={videoRef}
        playsInline
        muted
        className="absolute inset-0 h-full w-full object-cover opacity-90"
      />
      <div className="absolute inset-0 bg-black/35" />

      {/* ------------------------------------------------------------ header */}
      <div
        className="relative z-10 flex shrink-0 items-center gap-3 bg-gradient-to-b from-black/85 to-transparent px-3 pb-10"
        style={{ paddingTop: "max(12px, var(--safe-top))" }}
      >
        <button
          onClick={onClose}
          aria-label="Cerrar el escáner"
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur-md"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* the destination gets the middle and is allowed to truncate; the two
            round controls beside it never move, so nothing can collide */}
        <div className="flex min-w-0 flex-1 justify-center">
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
          aria-pressed={torchOn}
          className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition ${
            !torchable ? "invisible" : torchOn ? "bg-paper text-ink" : "bg-white/10 text-paper"
          }`}
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M8 1 L3.5 9 H7.5 L6.5 15 L12.5 6.5 H8.5 Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill={torchOn ? "currentColor" : "none"} />
          </svg>
        </button>
      </div>

      {/* -------------------------------------------------------- viewfinder */}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center px-6">
        <div
          className={`relative aspect-[9/5] w-full max-w-[300px] transition-colors duration-200 ${
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
        <p className="mt-5 text-center text-sub text-paper/70">
          {error ?? "Apunta al código de barras de la contraportada"}
        </p>
      </div>

      {/* ------------------------------------------------- the notifications */}
      {/* Newest on top, floating over the camera, never pushing the viewfinder.
          Capped at three because the fourth is already history — the run's
          total lives in the button below. */}
      <div className="relative z-20 shrink-0 px-3">
        {buried > 0 && (
          <p className="pb-2 text-center text-caption text-paper/40">
            y {buried} {buried === 1 ? "más" : "más"} antes
          </p>
        )}
        <AnimatePresence initial={false}>
          {visible.map((s, i) => (
            <ScanCard
              key={s.key}
              scan={s}
              depth={i}
              onUndo={() => undo(s)}
              onAddAnyway={() => addAnyway(s)}
              onDismiss={() => dismiss(s.key)}
              onManual={() => {
                onSearchManually(s.code);
                onClose();
              }}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* ----------------------------------------------------------- controls */}
      <div
        className="relative z-10 shrink-0 bg-gradient-to-t from-black via-black/85 to-transparent px-3 pt-8"
        style={{ paddingBottom: "max(12px, var(--safe-bottom))" }}
      >
        {typing && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const input = (e.currentTarget.elements.namedItem("code") as HTMLInputElement);
              const value = input.value.trim();
              if (value) void handleCode(value);
              input.value = "";
            }}
            className="mb-3 flex items-center gap-2 rounded-control bg-white/10 px-3 backdrop-blur-md"
          >
            <input
              name="code"
              autoFocus
              inputMode="numeric"
              placeholder="Teclea el código de barras"
              className="h-12 flex-1 bg-transparent text-body text-paper outline-none placeholder:text-paper/35"
            />
            <button type="submit" className="pressable shrink-0 px-2 py-3 text-sub font-medium text-paper">
              Buscar
            </button>
          </form>
        )}

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTyping((v) => !v)}
            className="pressable h-12 flex-1 rounded-control bg-white/10 text-sub font-medium text-paper backdrop-blur-md"
          >
            {typing ? "Volver a la cámara" : "Escribir el código"}
          </button>
          <button
            onClick={onClose}
            className="pressable h-12 flex-1 rounded-control bg-paper text-sub font-semibold text-ink"
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

/**
 * One scan, as a notification.
 *
 * The model is the iOS notification and it is the right one here: something
 * happened while your attention was on the camera, it needs to be seen without
 * taking over, and you should be able to get rid of it with the thumb already
 * holding the phone.
 *
 * What that means concretely:
 *
 * - **A card on a blurred material**, not a row with a rule under it. It reads
 *   as floating over the viewfinder rather than as a list the camera is sitting
 *   on top of.
 * - **Swipe either way to clear it**, and clearing is not undoing — a careless
 *   swipe must never remove a record from your shelf. Undo stays an explicit
 *   button, exactly as it was.
 * - **The stack recedes.** The second and third cards sit slightly smaller and
 *   dimmer, so the newest one is obviously the newest without needing a label.
 * - **It arrives from below and leaves sideways**, so the two motions never
 *   read as the same event.
 */
function ScanCard({
  scan,
  depth,
  onUndo,
  onAddAnyway,
  onDismiss,
  onManual,
}: {
  scan: Scan;
  depth: number;
  onUndo: () => void;
  onAddAnyway: () => void;
  onDismiss: () => void;
  onManual: () => void;
}) {
  const { match, status } = scan;

  const action =
    status === "added"
      ? { label: "Deshacer", run: onUndo }
      : status === "duplicate"
        ? { label: "Añadir igual", run: onAddAnyway }
        : status === "notfound" || status === "error"
          ? { label: "Buscar a mano", run: onManual }
          : null;

  const line =
    status === "looking"
      ? "Buscando…"
      : status === "added"
        ? `Añadido a ${scan.listName ?? "tu lista"}`
        : status === "duplicate"
          ? "Ya lo tienes"
          : status === "notfound"
            ? scan.code
            : "No se pudo añadir";

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // distance or a flick: a fast throw is a decision even when it is short
    if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 500) onDismiss();
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: 1 - depth * 0.22, y: 0, scale: 1 - depth * 0.035 }}
      exit={{ opacity: 0, scale: 0.94, transition: { duration: 0.16 } }}
      transition={{ type: "spring", damping: 30, stiffness: 420 }}
      drag="x"
      dragDirectionLock
      dragSnapToOrigin
      dragElastic={0.5}
      onDragEnd={onDragEnd}
      style={{ transformOrigin: "bottom center" }}
      className="mb-2 flex touch-pan-y items-center gap-3 rounded-lg bg-white/[0.14] px-3 py-2.5 backdrop-blur-2xl last:mb-0"
    >
      {match?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={match.thumb} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-paper/40">
          <BarcodeIcon size={16} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sub font-medium text-paper">
          {match?.title ?? (status === "notfound" ? "Sin ficha para ese código" : scan.code)}
        </span>
        <span className="mt-0.5 block truncate text-caption text-paper/55">{line}</span>
      </span>

      {action && (
        <button
          onClick={action.run}
          className="pressable shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-caption font-medium text-paper"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
