"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import type { Vinyl } from "@/lib/types";
import { DEFAULT_ID, type Collection } from "@/lib/collections";
import Sheet from "./ui/Sheet";
import { useToast } from "./ui/Toast";

type Match = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string;
  thumb?: string;
  format?: string[];
};

/**
 * One pass of the camera over one sleeve.
 *
 * Note what is *not* here any more: a `saved` field. Reading a code no longer
 * writes anything, so there is nothing to undo and nothing to reverse — a scan
 * is a proposal sitting in the tray until you commit the run.
 */
type Scan = {
  key: string;
  code: string;
  /** looking → asking Discogs · ready → staged · known → already on a shelf */
  status: "looking" | "ready" | "known" | "notfound" | "error";
  /** every edition the code could be; `pick` is the one the tray shows */
  results: Match[];
  pick: number;
  /** which of your racks already holds it, when status is "known" */
  knownIn?: string;
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
  /**
   * Skip the destination step. Set it when the camera is opened from inside a
   * rack you are already looking at — asking "where does this go" when the
   * answer is on screen behind the sheet is a question with one answer.
   */
  lockTarget?: boolean;
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

/** "1969 · UK · LP" — whatever of it Discogs actually knows. */
function edition(m: Match) {
  const fmt = (m.format ?? []).find((f) => /LP|12"|10"|7"|Album/i.test(f));
  return [m.year, m.country, fmt].filter(Boolean).join(" · ");
}

/**
 * Adding records with the camera.
 *
 * The scanner exists for three errands, and they are not the same errand:
 * one record you just bought, the whole shelf you are registering for the
 * first time, and a sleeve you are holding in a shop that you want to
 * remember. What separates them is not the speed — it is **where the record
 * ends up**, and getting that wrong is not a small mistake: a run of scans in
 * a shop silently landing in your collection means the app now claims you own
 * records you held for ten seconds.
 *
 * So the flow has two beats instead of one.
 *
 * **First, the destination**, on its own screen, before the camera. It is one
 * tap, it is never inherited in silence from a session two weeks ago, and once
 * chosen it stays in the header as an opaque bar you cannot miss while
 * scanning. (`lockTarget` skips it when the answer is already on screen.)
 *
 * **Then, the tray.** Reading a code stages a proposal; it does not save. The
 * run is committed with one press at the end — one tap for one record and one
 * tap for eighty, so the shop and the shelf get the same rhythm without a mode
 * switch to explain. Two things fall out of that for free: swiping a card away
 * is now honestly a *discard* rather than the reversal-that-isn't-an-undo the
 * old notification stack had to keep apologising for, and there is a moment
 * where you can see what was matched before it is yours.
 *
 * That last part matters more than it sounds. A barcode is printed on a
 * sleeve, not on a release: the same digits list the reissue, the box set and
 * often the CD. The old scanner took the first result and said "Añadido", so
 * the wrong pressing entered your collection with no trace. The tray shows the
 * edition it chose and says how many others there were.
 */
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
  lockTarget = false,
}: Props) {
  const toast = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const stopFns = useRef<Array<() => void>>([]);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchable, setTorchable] = useState(false);
  const [typing, setTyping] = useState(false);
  const [scans, setScans] = useState<Scan[]>([]);
  const [flash, setFlash] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [naming, setNaming] = useState(false);

  // The scan loop lives outside React's render cycle, so everything it needs to
  // decide must be readable synchronously from a ref.
  const seen = useRef<Map<string, number>>(new Map());
  const vinilosRef = useRef(allVinilos);
  vinilosRef.current = allVinilos;
  const collectionsRef = useRef(collections);
  collectionsRef.current = collections;
  const targetChangeRef = useRef(onTargetChange);
  targetChangeRef.current = onTargetChange;

  const target = collections.find((c) => c.id === targetId) ?? collections[0];
  const staged = useMemo(() => scans.filter((s) => s.status === "ready"), [scans]);

  const patch = useCallback(
    (key: string, next: Partial<Scan>) =>
      setScans((s) => s.map((x) => (x.key === key ? { ...x, ...next } : x))),
    [],
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
      setScans((s) => [{ key, code, status: "looking", results: [], pick: 0 }, ...s]);

      try {
        const r = await fetch(`/api/discogs/barcode?code=${encodeURIComponent(code)}`);
        const data = await r.json();
        const results: Match[] = data.results ?? [];
        if (results.length === 0) return patch(key, { status: "notfound" });

        // Already on a shelf of yours: say so instead of quietly queueing a
        // second copy — the usual reason you are scanning is to find out.
        const known = vinilosRef.current.find((v) => v.discogsId === results[0].id);
        const holder =
          known && collectionsRef.current.find((c) => c.vinylIds.includes(known.id));
        if (holder) return patch(key, { status: "known", results, knownIn: holder.name });

        patch(key, { status: "ready", results });
      } catch {
        patch(key, { status: "error" });
      }
    },
    [patch],
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

  /**
   * Every run starts with an empty tray, and starts pointed at your collection.
   *
   * The destination used to be inherited from whatever list you happened to be
   * looking at, which is wrong twice over: scanning is its own errand — you
   * arrive with a sleeve in your hand, not from the rack you were browsing —
   * and the overwhelmingly common answer is "this is mine now". Anything else
   * is one tap on the bubble, and the bubble is the loudest thing on screen.
   */
  useEffect(() => {
    if (!open) return;
    if (!lockTarget) {
      const mine = collectionsRef.current.find(
        (c) => c.kind === "collection" || c.id === DEFAULT_ID,
      );
      if (mine) targetChangeRef.current(mine.id);
    }
    setScans([]);
    setTyping(false);
    setTorchOn(false);
    setEditing(null);
    setLeaving(false);
    setNaming(false);
    setPicking(false);
    seen.current.clear();
  }, [open, lockTarget]);

  const askToLeave = useCallback(() => {
    // Never drop a run on the floor. Closing with a full tray is much more
    // often a mis-tap than a decision to throw away forty scans.
    if (scans.some((s) => s.status === "ready")) setLeaving(true);
    else onClose();
  }, [scans, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === "Escape") {
        e.stopPropagation();
        askToLeave();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, askToLeave]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] as any });
      setTorchOn(next);
    } catch {}
  };

  /**
   * The one write in the whole screen.
   *
   * Everything staged goes to the destination at once, and the acknowledgement
   * carries a single undo for the whole run — because a run is what you did,
   * not eighty separate things you did.
   */
  const commit = async () => {
    const list = staged;
    if (list.length === 0) return onClose();
    const listId = targetId;
    const listName = target?.name ?? "tu colección";
    setCommitting(true);

    const done: Array<{ vinylId: string; wasNew: boolean }> = [];
    const failed: string[] = [];
    for (const s of list) {
      const match = s.results[s.pick];
      try {
        const res = await fetch("/api/discogs/release", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ releaseId: match.id }),
        });
        const payload = await res.json();
        if (!payload.vinyl) throw new Error("no vinyl");
        const wasNew = !vinilosRef.current.some((v) => v.id === payload.vinyl.id);
        onSaveToList(payload.vinyl, listId);
        done.push({ vinylId: payload.vinyl.id, wasNew });
      } catch {
        failed.push(match?.title ?? s.code);
      }
    }

    setCommitting(false);
    onClose();

    if (done.length === 0) {
      return toast.show("No se pudo añadir ninguno de los discos.", { tone: "error" });
    }
    const what =
      done.length === 1
        ? `${list[0].results[list[0].pick]?.title ?? "El disco"} → ${listName}`
        : `${done.length} discos → ${listName}`;
    toast.undo(
      failed.length ? `${what} · ${failed.length} sin añadir` : what,
      () =>
        done.forEach((d) =>
          // brand new to the library → undo takes it out entirely
          d.wasNew ? onDeleteVinyl(d.vinylId) : onRemoveFromList(d.vinylId, listId),
        ),
      { media: { src: list[0].results[list[0].pick]?.thumb } },
    );
  };

  /**
   * Dropping a card throws away a proposal, and that is all it does. The code
   * stays in `seen`, so the camera doesn't immediately re-read the sleeve that
   * is still sitting in front of it.
   */
  const drop = (key: string) => setScans((l) => l.filter((x) => x.key !== key));

  /** "already yours" is information, not a wall: a second copy is legitimate. */
  const stageAnyway = (key: string) => patch(key, { status: "ready" });

  if (!open) return null;

  const editingScan = scans.find((s) => s.key === editing) ?? null;

  /**
   * The destination, as a bubble in the header.
   *
   * It used to be a step of its own before the camera, and that was one screen
   * too many: the camera has to come out fast, and a question you answer the
   * same way nine times out of ten is not worth a screen. So the answer is
   * simply *visible* instead — an opaque pill across the header, stating the
   * rack by name, rather than the hairline of underlined text it was before.
   * Tapping it picks another without leaving the viewfinder.
   */
  const primaries = collections.filter((c) => (c.kind ?? "custom") !== "custom");
  const customs = collections.filter((c) => (c.kind ?? "custom") === "custom");

  const choose = (id: string) => {
    onTargetChange(id);
    setPicking(false);
  };

  const DestRow = ({ c }: { c: Collection }) => (
    <button
      onClick={() => choose(c.id)}
      className="pressable flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-paper/[0.05]"
    >
      <span
        className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border transition ${
          c.id === targetId ? "border-content" : "border-line-strong"
        }`}
      >
        {c.id === targetId && <span className="h-2 w-2 rounded-full bg-content" />}
      </span>
      <span className="min-w-0 flex-1 truncate text-body text-content">{c.name}</span>
      <span className="shrink-0 text-caption text-content-faint">{c.vinylIds.length}</span>
    </button>
  );

  // -------------------------------------------------------------- the camera
  // Only the newest few stay open. A tray that never collapses is a list, and a
  // list over a viewfinder is a wall — the run's total lives in the button.
  const OPEN = 3;
  const visible = scans.slice(0, OPEN);
  const buried = Math.max(0, scans.length - OPEN);

  return (
    /**
     * A column, not a pile of absolutely-positioned pieces: the header takes
     * what it needs, the cards take what they need, and the viewfinder takes
     * what is left. Overlap stops being something to tune and becomes
     * impossible.
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
        className="relative z-10 flex shrink-0 items-center gap-2 bg-gradient-to-b from-black/85 to-transparent px-3 pb-10"
        style={{ paddingTop: "max(12px, var(--safe-top))" }}
      >
        <button
          onClick={askToLeave}
          aria-label="Cerrar el escáner"
          className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white/10 text-paper backdrop-blur-md"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
            <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>

        {/* The destination, in the same glass as the two round buttons beside
            it — one material across the header, so the row reads as three
            controls rather than a white slab with two buttons stuck to it. It
            gets the width because the rack's name is the one thing here you
            must not get wrong; X and the torch already say what they are with
            a glyph. */}
        <button
          onClick={() => !lockTarget && setPicking(true)}
          disabled={lockTarget}
          className="pressable flex h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-full bg-white/10 px-4 text-paper backdrop-blur-md disabled:opacity-100"
        >
          <span className="min-w-0 truncate text-sub font-medium">
            {target?.name ?? "Rack"}
          </span>
          {!lockTarget && (
            <svg width="9" height="9" viewBox="0 0 8 8" fill="none" aria-hidden className="shrink-0 text-paper/60">
              <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </button>

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

      {/* --------------------------------------------------------- the tray */}
      {/* Newest on top, floating over the camera, never pushing the viewfinder.
          Capped at three because the fourth is already history. */}
      <div className="relative z-20 shrink-0 px-3">
        {buried > 0 && (
          <p className="pb-2 text-center text-caption text-paper/40">y {buried} antes</p>
        )}
        <AnimatePresence initial={false}>
          {visible.map((s, i) => (
            <ScanCard
              key={s.key}
              scan={s}
              depth={i}
              onDrop={() => drop(s.key)}
              onStageAnyway={() => stageAnyway(s.key)}
              onEditions={() => setEditing(s.key)}
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
          {/* The commit. It says the number and the destination together,
              because those are exactly the two things you are agreeing to. */}
          <button
            onClick={() => void commit()}
            disabled={committing}
            className="pressable h-12 flex-[1.6] truncate rounded-control bg-paper text-sub font-semibold text-ink disabled:opacity-60"
          >
            {committing
              ? "Añadiendo…"
              : staged.length === 0
                ? "Listo"
                : `Añadir ${staged.length} a ${target?.name ?? "tu rack"}`}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------- the destination */}
      <Sheet
        open={picking}
        onClose={() => {
          setPicking(false);
          setNaming(false);
        }}
        title="¿Dónde van los discos?"
        subtitle="Todo lo que escanees se guarda aquí."
        size="tall"
      >
        <div className="pb-4">
          {primaries.map((c) => (
            <DestRow key={c.id} c={c} />
          ))}
          {primaries.length > 0 && customs.length > 0 && (
            <div className="my-1.5 h-px bg-line" />
          )}
          {customs.map((c) => (
            <DestRow key={c.id} c={c} />
          ))}
          {naming ? (
            <form
              className="px-4 pt-3"
              onSubmit={async (e) => {
                e.preventDefault();
                const input = e.currentTarget.elements.namedItem("name") as HTMLInputElement;
                const name = input.value.trim();
                if (!name) return;
                setNaming(false);
                choose(await onCreateList(name));
              }}
            >
              <input
                name="name"
                autoFocus
                placeholder="Nombre del rack"
                className="h-12 w-full rounded-control bg-fill-subtle px-3 text-body text-content outline-none placeholder:text-content-faint"
              />
            </form>
          ) : (
            <button
              onClick={() => setNaming(true)}
              className="pressable flex w-full items-center gap-3 px-4 py-3 text-left text-body text-content-muted transition hover:bg-paper/[0.05] hover:text-content"
            >
              <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-content-faint">
                +
              </span>
              Rack nuevo
            </button>
          )}
        </div>
      </Sheet>

      {/* ------------------------------------------------------- the editions */}
      <Sheet
        open={Boolean(editingScan)}
        onClose={() => setEditing(null)}
        title="¿Cuál de estas tienes?"
        subtitle={editingScan?.code}
        size="tall"
      >
        <div className="pb-4">
          {editingScan?.results.map((m, i) => (
            <button
              key={m.id}
              onClick={() => {
                patch(editingScan.key, { pick: i });
                setEditing(null);
              }}
              className="pressable flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-paper/[0.05]"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {m.thumb ? (
                <img src={m.thumb} alt="" className="h-11 w-11 shrink-0 rounded-md object-cover" />
              ) : (
                <span className="h-11 w-11 shrink-0 rounded-md bg-paper/10" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sub text-content">{m.title}</span>
                <span className="mt-0.5 block truncate text-caption text-content-muted">
                  {edition(m) || m.label}
                </span>
              </span>
              {i === editingScan.pick && (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-content" />
              )}
            </button>
          ))}
        </div>
      </Sheet>

      {/* --------------------------------------------------- leaving with a tray */}
      <Sheet
        open={leaving}
        onClose={() => setLeaving(false)}
        title={`Tienes ${staged.length} sin añadir`}
        subtitle={`Si sales ahora no se guardan en ${target?.name ?? "tu rack"}.`}
        size="auto"
      >
        <div className="flex flex-col gap-2 px-4 pb-4">
          <button
            onClick={() => {
              setLeaving(false);
              void commit();
            }}
            className="pressable h-12 w-full rounded-control bg-content text-sub font-semibold text-surface"
          >
            Añadirlos y salir
          </button>
          <button
            onClick={onClose}
            className="pressable h-12 w-full rounded-control text-sub font-medium text-content-muted"
          >
            Descartar la pasada
          </button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * One scan, as a proposal.
 *
 * The card is still shaped like an iOS notification — it arrives while your
 * attention is on the camera, it must be readable without taking over, and you
 * must be able to get rid of it with the thumb already holding the phone. What
 * changed is what it means: nothing behind it has been written yet, so a swipe
 * is a discard and needs no apology, and the card can afford to say which
 * pressing it matched and offer the others.
 */
function ScanCard({
  scan,
  depth,
  onDrop,
  onStageAnyway,
  onEditions,
  onManual,
}: {
  scan: Scan;
  depth: number;
  onDrop: () => void;
  onStageAnyway: () => void;
  onEditions: () => void;
  onManual: () => void;
}) {
  const { status, results, pick } = scan;
  const match = results[pick];
  const others = Math.max(0, results.length - 1);

  const action =
    status === "known"
      ? { label: "Añadir igual", run: onStageAnyway }
      : status === "notfound" || status === "error"
        ? { label: "Buscar a mano", run: onManual }
        : null;

  const line =
    status === "looking"
      ? "Buscando…"
      : status === "known"
        ? `Ya está en ${scan.knownIn}`
        : status === "notfound"
          ? scan.code
          : status === "error"
            ? "No se pudo leer la ficha"
            : [edition(match) || match?.label, others > 0 && `+${others} ediciones`]
                .filter(Boolean)
                .join(" · ");

  const onDragEnd = (_: unknown, info: PanInfo) => {
    // distance or a flick: a fast throw is a decision even when it is short
    if (Math.abs(info.offset.x) > 110 || Math.abs(info.velocity.x) > 500) onDrop();
  };

  // Tapping a staged card is how you get at the other pressings — the only
  // place in the run where the match is still yours to correct.
  const tappable = status === "ready" && others > 0;

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
      onClick={tappable ? onEditions : undefined}
      style={{ transformOrigin: "bottom center" }}
      className={`mb-2 flex touch-pan-y items-center gap-3 rounded-lg px-3 py-2.5 backdrop-blur-2xl last:mb-0 ${
        status === "ready" ? "bg-white/[0.16]" : "bg-white/[0.10]"
      }`}
    >
      {match?.thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={match.thumb}
          alt=""
          className={`h-11 w-11 shrink-0 rounded-md object-cover ${
            status === "known" ? "opacity-45" : ""
          }`}
        />
      ) : (
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-white/10 text-paper/40">
          <BarcodeIcon size={16} />
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sub font-medium text-paper">
          {match?.title ?? (status === "notfound" ? "Sin ficha para ese código" : scan.code)}
        </span>
        <span className="mt-0.5 flex items-center gap-1 truncate text-caption text-paper/55">
          <span className="truncate">{line}</span>
          {tappable && (
            <svg width="7" height="7" viewBox="0 0 8 8" fill="none" aria-hidden className="shrink-0">
              <path d="M2.5 1 L5.5 4 L2.5 7" stroke="currentColor" strokeWidth="1.2" />
            </svg>
          )}
        </span>
      </span>

      {action && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            action.run();
          }}
          className="pressable shrink-0 rounded-full bg-white/15 px-3 py-1.5 text-caption font-medium text-paper"
        >
          {action.label}
        </button>
      )}
    </motion.div>
  );
}
