"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

/**
 * What just happened, and how to take it back.
 *
 * The undo is the point. Most "are you sure?" dialogs in a collection app are
 * asking the wrong question: removing a record from a list is not dangerous,
 * it is just annoying to redo. Gmail settled this argument years ago — act
 * immediately, then offer a few seconds to reverse it. You get a fast
 * interface AND a forgiving one, instead of trading one for the other.
 *
 * Confirmation is reserved for what undo genuinely cannot reach: deleting a
 * list, leaving a shared one, removing a record from the library entirely.
 *
 * Positioned above the tab bar and the player on a phone, bottom-left on a
 * desktop — never centred over content, and never where the thumb rests.
 */

type Toast = {
  id: number;
  message: string;
  action?: { label: string; onClick: () => void };
  tone?: "default" | "error";
};

type ToastApi = {
  /** say what happened, in the past tense, from the user's point of view */
  show: (message: string, options?: { action?: Toast["action"]; tone?: Toast["tone"] }) => void;
  /** the shorthand this app uses most: an action plus its reversal */
  undo: (message: string, onUndo: () => void) => void;
};

const Ctx = createContext<ToastApi | null>(null);

const LIFETIME = 5200; // long enough to read and decide; short enough to forget

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id));
    timers.current.delete(id);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, options) => {
      const id = ++seq.current;
      // One at a time. A stack of toasts is a log, and nobody reads a log —
      // the newest message is the only one anyone acts on.
      setItems([{ id, message, ...options }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFETIME),
      );
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      undo: (message, onUndo) =>
        show(message, {
          action: {
            label: "Deshacer",
            onClick: onUndo,
          },
        }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 z-[80] flex justify-center px-4 sm:justify-start sm:px-6"
        style={{ bottom: "calc(var(--tabbar-h) + var(--player-h) + 12px)" }}
      >
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.98 }}
              transition={{ type: "spring", damping: 30, stiffness: 400 }}
              className={`pointer-events-auto flex w-full max-w-[440px] items-center gap-3 rounded-md border px-4 py-3 shadow-[0_16px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl ${
                t.tone === "error"
                  ? "border-[#ff6b57]/30 bg-[#1a0f0d]/95"
                  : "border-line-strong bg-surface-overlay/95"
              }`}
            >
              <span className="min-w-0 flex-1 text-sub text-paper">{t.message}</span>
              {t.action && (
                <button
                  onClick={() => {
                    t.action?.onClick();
                    dismiss(t.id);
                  }}
                  className="pressable shrink-0 text-sub font-semibold text-paper underline-offset-4 hover:underline"
                >
                  {t.action.label}
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

/**
 * Safe outside a provider on purpose: a component that shows a toast should
 * not crash a page that hasn't mounted one. It just says nothing.
 */
export function useToast(): ToastApi {
  return (
    useContext(Ctx) ?? {
      show: () => {},
      undo: () => {},
    }
  );
}
