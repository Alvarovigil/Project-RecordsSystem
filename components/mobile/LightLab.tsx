"use client";

import { useEffect, useState } from "react";
import type { LightRig } from "@/components/VinylShelf3D";

/**
 * The lights, draggable, on the device they are for.
 *
 * Lighting a 3D scene by editing a constant, rebuilding and looking again is
 * how the shelf ended up right on a laptop and burnt out on a phone: the
 * feedback loop was thirty seconds long and ran on the wrong screen. Sliders
 * make it instant and put it in the hand holding the phone.
 *
 * Two decisions keep this from becoming debug furniture nobody removes:
 *
 * - **It only exists behind `?luces=1`.** Not `NODE_ENV`, because the whole
 *   point is tuning on a real phone against production — and not a permanent
 *   button, because a control panel that ships is a control panel someone
 *   opens by accident.
 * - **It ends in code, not in a database.** The values are not saved anywhere;
 *   the panel copies them as the literal block that goes into VinylShelf3D.
 *   Numbers that live in localStorage on one phone are numbers nobody else
 *   ever sees.
 *
 * The starting values are the current defaults, so the panel opens on what you
 * are already looking at rather than snapping the scene to something else.
 */

export const DEFAULT_RIG: LightRig = {
  ambient: 0.75,
  keyX: 4.5,
  keyY: -12,
  keyZ: 8,
  keyIntensity: 1.5,
  fillX: -4,
  fillY: 5,
  fillZ: 10,
  fillIntensity: 0.9,
  exposure: 0.64,
  coverRoughness: 0,
};

type Control = { key: keyof LightRig; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; controls: Control[] }[] = [
  {
    title: "General",
    controls: [
      { key: "ambient", label: "Ambiente", min: 0, max: 4, step: 0.05 },
      { key: "exposure", label: "Exposición", min: 0.4, max: 2, step: 0.02 },
      { key: "coverRoughness", label: "Mate ↔ brillo", min: 0, max: 1, step: 0.02 },
    ],
  },
  {
    title: "Luz principal",
    controls: [
      { key: "keyIntensity", label: "Fuerza", min: 0, max: 8, step: 0.1 },
      { key: "keyX", label: "Izq · der", min: -12, max: 12, step: 0.5 },
      { key: "keyY", label: "Alto", min: -12, max: 16, step: 0.5 },
      { key: "keyZ", label: "Cerca · lejos", min: -12, max: 20, step: 0.5 },
    ],
  },
  {
    title: "Relleno",
    controls: [
      { key: "fillIntensity", label: "Fuerza", min: 0, max: 8, step: 0.1 },
      { key: "fillX", label: "Izq · der", min: -12, max: 12, step: 0.5 },
      { key: "fillY", label: "Alto", min: -12, max: 16, step: 0.5 },
      { key: "fillZ", label: "Cerca · lejos", min: -12, max: 20, step: 0.5 },
    ],
  },
];

/** Whether the panel was asked for. `?luces=1`, and nothing else. */
export function useLightLab() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).get("luces") === "1");
  }, []);
  return on;
}

export default function LightLab({
  rig,
  onChange,
}: {
  rig: LightRig;
  onChange: (rig: LightRig) => void;
}) {
  const [open, setOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    // formatted as the block it replaces, so tuning ends in a commit
    const text = `const rig = ${JSON.stringify(rig, null, 2)};`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* nothing useful to do; the numbers are on screen */
    }
  };

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[90] border-t border-line-overlay bg-surface-overlay/95 backdrop-blur-xl"
      style={{ paddingBottom: "var(--safe-bottom)" }}
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="pressable flex-1 text-left text-caption uppercase tracking-label text-content-muted"
        >
          Luces {open ? "▾" : "▸"}
        </button>
        <button
          onClick={() => onChange(DEFAULT_RIG)}
          className="pressable text-caption uppercase tracking-label text-content-muted"
        >
          Reset
        </button>
        <button
          onClick={copy}
          className="pressable rounded-full bg-paper px-3 py-1.5 text-caption font-medium text-ink"
        >
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>

      {open && (
        // capped and scrollable: the panel is a tool, and a tool that covers
        // the thing it is tuning is useless
        <div className="scroll-y max-h-[46dvh] px-4 pb-4">
          {GROUPS.map((g) => (
            <div key={g.title} className="mt-3 first:mt-0">
              <p className="text-caption uppercase tracking-label text-content-faint">{g.title}</p>
              {g.controls.map((c) => (
                <label key={c.key} className="mt-2 flex items-center gap-3">
                  <span className="w-[104px] shrink-0 text-caption text-content-muted">
                    {c.label}
                  </span>
                  <input
                    type="range"
                    min={c.min}
                    max={c.max}
                    step={c.step}
                    value={rig[c.key]}
                    onChange={(e) => onChange({ ...rig, [c.key]: Number(e.target.value) })}
                    className="h-tap flex-1 accent-[color:var(--accent)]"
                  />
                  <span className="mono w-11 shrink-0 text-right text-caption text-content-secondary">
                    {rig[c.key].toFixed(2)}
                  </span>
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
