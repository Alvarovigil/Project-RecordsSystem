"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";

import RetryImg from "@/components/ui/RetryImg";
/**
 * What just happened, and how to take it back.
 *
 * The undo is the point. Most "are you sure?" dialogues in a collection app are
 * asking the wrong question: removing a record from a list is not dangerous,
 * it is just annoying to redo. Gmail settled this argument years ago — act
 * immediately, then offer a few seconds to reverse it. You get a fast interface
 * AND a forgiving one, instead of trading one for the other. Confirmation is
 * reserved for what undo genuinely cannot reach.
 *
 * It arrives from the top, as a capsule on blurred material — on a computer.
 *
 * On a phone it arrives from below, just over the tab bar (F5). From above it
 * landed on the search field and on «Cancelar», and on the record sheet's ←
 * and ⋮: the one thing you wanted to touch next was under an offer to undo
 * what you had just done. The paragraph below is the desktop's reasoning.
 *
 * Bottom-of-screen is where a phone puts its own furniture — the tab bar, the
 * player, the home indicator — and anything that lands there is competing with
 * a thumb that is already busy. The top is empty, it is where the system's own
 * notifications appear, and a message that drops in from above reads as coming
 * *from the app* rather than from the thing you just pressed.
 *
 * The capsule is deliberately small and never full width: this is an
 * acknowledgement, not an announcement. It carries the artwork of whatever it
 * is talking about, because "Guardado" over a thumbnail of the sleeve is a
 * complete sentence, and "Guardado" alone is a question.
 */

type Media = { src?: string | null; icon?: React.ReactNode };

type Toast = {
  id: number;
  message: string;
  media?: Media;
  action?: { label: string; onClick: () => void };
  tone?: "default" | "error";
};

type ShowOptions = {
  media?: Media;
  action?: Toast["action"];
  tone?: Toast["tone"];
};

type ToastApi = {
  /** say what happened, in the past tense, from the user's point of view */
  show: (message: string, options?: ShowOptions) => void;
  /** the shorthand this app uses most: an action plus its reversal */
  undo: (message: string, onUndo: () => void, options?: ShowOptions) => void;
};

const Ctx = createContext<ToastApi | null>(null);

const LIFETIME = 4200;          // long enough to read; short enough to forget
const LIFETIME_ACTION = 8000;   // an offer to undo has to outlast the reading
                                // — and the finding of the button, at 70

/** el teléfono: el aviso sube desde abajo en vez de caer desde arriba */
const PHONE = "(max-width: 767px)";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const seq = useRef(0);
  /* cada aviso con su reloj: lo que le queda, y desde cuándo corre. Se para
     mientras hay un dedo (o el ratón, o el foco) encima: nadie quiere que el
     botón se le escape justo cuando va a tocarlo */
  const timers = useRef(
    new Map<number, { handle?: ReturnType<typeof setTimeout>; left: number; since: number }>(),
  );

  // al desmontarse no deja relojes sueltos que llamen a un estado que ya no está
  useEffect(() => {
    const all = timers.current;
    return () => {
      all.forEach((t) => clearTimeout(t.handle));
      all.clear();
    };
  }, []);

  const dismiss = useCallback((id: number) => {
    clearTimeout(timers.current.get(id)?.handle);
    timers.current.delete(id);
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pause = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (!t || !t.handle) return;
    clearTimeout(t.handle);
    t.handle = undefined;
    t.left = Math.max(0, t.left - (performance.now() - t.since));
  }, []);

  const resume = useCallback(
    (id: number) => {
      const t = timers.current.get(id);
      if (!t || t.handle) return;
      // lo que quedaba, y nunca menos de un respiro para leerlo otra vez
      t.left = Math.max(t.left, 1500);
      t.since = performance.now();
      t.handle = setTimeout(() => dismiss(id), t.left);
    },
    [dismiss],
  );

  const [fromBelow, setFromBelow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PHONE);
    const read = () => setFromBelow(mq.matches);
    read();
    mq.addEventListener("change", read);
    return () => mq.removeEventListener("change", read);
  }, []);

  const show = useCallback<ToastApi["show"]>(
    (message, options) => {
      const id = ++seq.current;
      // One at a time. A stack of toasts is a log, and nobody reads a log —
      // the newest message is the only one anyone acts on.
      timers.current.forEach((t) => clearTimeout(t.handle));
      timers.current.clear();
      setItems([{ id, message, ...options }]);
      const left = options?.action ? LIFETIME_ACTION : LIFETIME;
      timers.current.set(id, {
        left,
        since: performance.now(),
        handle: setTimeout(() => dismiss(id), left),
      });
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({
      show,
      undo: (message, onUndo, options) =>
        show(message, { ...options, action: { label: "Deshacer", onClick: onUndo } }),
    }),
    [show],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        /* teléfono: encima de la barra de pestañas y del reproductor (que ya
           llevan la zona segura), o sobre la zona segura en una capa a pantalla
           completa (--toast-bottom); ordenador: arriba, como siempre */
        className="pointer-events-none fixed inset-x-0 bottom-[var(--toast-bottom)] z-[90] flex justify-center px-4 md:bottom-auto md:top-[calc(var(--safe-top)+12px)]"
      >
        <AnimatePresence>
          {items.map((t) => (
            <ToastCard
              key={t.id}
              toast={t}
              fromBelow={fromBelow}
              onDismiss={() => dismiss(t.id)}
              onHold={() => pause(t.id)}
              onRelease={() => resume(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

function ToastCard({
  toast,
  fromBelow,
  onDismiss,
  onHold,
  onRelease,
}: {
  toast: Toast;
  /** en el teléfono sube desde abajo, y se tira hacia abajo para quitarlo */
  fromBelow: boolean;
  onDismiss: () => void;
  onHold: () => void;
  onRelease: () => void;
}) {
  const dir = fromBelow ? 1 : -1;
  /* En el teléfono el mensaje puede ir a dos líneas (con la letra al 130 %,
     «No se ha guard…» no decía nada). A dos líneas la píldora pasa a un
     radio que no pellizca el texto. */
  const textRef = useRef<HTMLSpanElement>(null);
  const [wrapped, setWrapped] = useState(false);
  /**
   * Apilado: el mensaje no cabe en dos líneas junto al botón (letra al 130 %
   * en un teléfono de 360, «Tusk añadido a Mi Colección» + «Deshacer»).
   * Entonces el mensaje se queda con todo el ancho, hasta tres líneas, y el
   * botón baja a su propia fila, a la derecha. Se decide midiendo si el texto
   * desborda, antes de pintar, y no se deshace mientras dure el aviso: al
   * apilar el texto cabe, y volver atrás lo haría parpadear.
   */
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    setStacked(false);
  }, [toast.message]);
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el || !fromBelow) {
      setWrapped(false);
      setStacked(false);
      return;
    }
    const measure = () => {
      const line = parseFloat(getComputedStyle(el).lineHeight) || 20;
      setWrapped(el.clientHeight > line * 1.5);
      if (el.scrollHeight > el.clientHeight + 1) setStacked(true);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fromBelow, toast.message, stacked]);
  const onDragEnd = (_: unknown, info: PanInfo) => {
    // flick it back where it came from
    if (info.offset.y * dir > 30 || info.velocity.y * dir > 400) onDismiss();
    onRelease();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 22 * dir, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 14 * dir, scale: 0.96, transition: { duration: 0.18 } }}
      transition={{ type: "spring", damping: 26, stiffness: 380, mass: 0.7 }}
      drag="y"
      dragDirectionLock
      dragSnapToOrigin
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={fromBelow ? { top: 0.02, bottom: 0.6 } : { top: 0.6, bottom: 0.02 }}
      onDragEnd={onDragEnd}
      // el reloj se para con el dedo, el ratón o el foco encima
      onPointerEnter={onHold}
      onPointerDown={onHold}
      onPointerLeave={onRelease}
      onPointerCancel={onRelease}
      onFocus={onHold}
      onBlur={onRelease}
      className={`pointer-events-auto flex max-w-[min(92vw,420px)] items-center ${
        stacked ? "flex-wrap gap-x-3 gap-y-1" : "gap-3"
      } ${wrapped || stacked ? "rounded-capsule" : "rounded-full"} border py-2 pl-2 pr-3 shadow-toast backdrop-blur-2xl ${
        toast.tone === "error"
          ? "border-danger/20 bg-danger-surface/85"
          : "border-line-overlay bg-surface-overlay/85"
      }`}
    >
      <Thumb media={toast.media} error={toast.tone === "error"} />

      <span
        ref={textRef}
        className={`min-w-0 flex-1 py-0.5 text-sub leading-snug text-paper ${
          fromBelow ? (stacked ? "line-clamp-3" : "line-clamp-2") : "truncate"
        }`}
      >
        {toast.message}
      </span>

      {toast.action && (
        /* apilado: el botón en su propia fila, a la derecha */
        <div className={stacked ? "flex basis-full justify-end" : "contents"}>
          {/* 44 px de objetivo, el mismo dibujo: el botón crece hacia el relleno
           de la cápsula y la píldora visible sigue siendo la de dentro */}
          <button
            onClick={() => {
              toast.action?.onClick();
              onDismiss();
            }}
            className="pressable group -my-1.5 -mr-1 flex min-h-tap min-w-tap shrink-0 items-center justify-center"
          >
            <span className="rounded-full bg-fill-strong px-3 py-1.5 text-sub font-medium text-paper transition-colors group-hover:bg-paper group-hover:text-ink">
              {toast.action.label}
            </span>
          </button>
        </div>
      )}
    </motion.div>
  );
}

/**
 * The artwork if there is any, an icon if there isn't — but never nothing.
 *
 * A capsule with only words in it has no anchor for the eye and reads as a
 * system error. The circle on the left is what makes it feel like an object.
 */
function Thumb({ media, error }: { media?: Media; error?: boolean }) {
  if (media?.src) {
    return (
      <RetryImg
        src={media.src}
        alt=""
        className="h-8 w-8 shrink-0 rounded-full object-cover ring-1 ring-line-strong"
      />
    );
  }
  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        error ? "bg-danger/15 text-danger" : "bg-fill-strong text-paper"
      }`}
    >
      {media?.icon ?? (error ? <IconAlert /> : <IconCheck />)}
    </span>
  );
}

function IconCheck() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.6 7.4 L5.6 10.4 L11.4 3.6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconAlert() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M7 3.4 V7.8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <circle cx="7" cy="10.4" r="0.9" fill="currentColor" />
    </svg>
  );
}

/** The icons a toast can carry when there is no artwork to show. */
export const ToastIcon = {
  person: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="6.6" r="3.1" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 16.6 C4.6 13.4 7 11.6 10 11.6 C13 11.6 15.4 13.4 16 16.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  list: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4 5.5 H16 M4 10 H16 M4 14.5 H11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
  trash: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M4.5 5.5 H15.5 M8 5.5 V4 H12 V5.5 M6 5.5 L6.8 16 H13.2 L14 5.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  link: (
    <svg width="15" height="15" viewBox="0 0 20 20" fill="none" aria-hidden>
      <path d="M8.4 11.6 A3.2 3.2 0 0 1 8.4 7.1 L10.6 4.9 A3.2 3.2 0 0 1 15.1 9.4 L14 10.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M11.6 8.4 A3.2 3.2 0 0 1 11.6 12.9 L9.4 15.1 A3.2 3.2 0 0 1 4.9 10.6 L6 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

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
