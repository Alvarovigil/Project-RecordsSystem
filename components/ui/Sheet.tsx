"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { useDevice } from "@/hooks/useDevice";

/**
 * The one way this app shows something on top of something else.
 *
 * On a phone it is a sheet that rises from the bottom and that you throw away
 * with your thumb; on a desktop it is a centred dialog. Same component, same
 * props, same call site — because the alternative is every feature growing its
 * own pair of overlays that drift apart.
 *
 * Why a sheet and not a modal on touch: it starts at the thumb, it keeps the
 * page visible behind it so you never lose your place, and the gesture that
 * dismisses it is the same one that scrolls it. That last part is the whole
 * trick — drag from the content when it is already scrolled to the top, and
 * the drag becomes a dismissal instead of a dead pull.
 *
 * Dismissal is by velocity OR distance, never distance alone: a fast flick is
 * a decision even if it only travelled 30px, and honouring it is most of what
 * makes a sheet feel attached to your hand.
 */

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  /** shown in the header and announced to screen readers */
  title?: string;
  /** small print under the title — a handle, a count, a source */
  subtitle?: React.ReactNode;
  /** a single action in the header's trailing corner */
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * How tall the sheet is on a phone. "auto" hugs its content (menus, confirms),
   * "tall" takes most of the screen (lists you browse), "full" takes all of it
   * (a flow you are inside of, like search).
   */
  size?: "auto" | "tall" | "full";
  /** desktop dialog width */
  width?: number;
  /** hide the header entirely; the content provides its own */
  bare?: boolean;
};

const SPRING = { type: "spring" as const, damping: 34, stiffness: 380, mass: 0.85 };

export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  action,
  children,
  size = "tall",
  width = 460,
  bare = false,
}: SheetProps) {
  const { isPhone } = useDevice();
  const titleId = useId();

  // Escape closes, and while anything is open the page behind must not scroll
  // — on iOS a scrolling background under a sheet is the clearest possible
  // tell that this is a web page.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.body.dataset.sheetOpen = "1";
    window.addEventListener("keydown", onKey);
    return () => {
      delete document.body.dataset.sheetOpen;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? titleId : undefined}
          className="fixed inset-0 z-[70] flex"
          style={{ alignItems: isPhone ? "flex-end" : "center", justifyContent: "center" }}
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
            className="absolute inset-0 bg-ink/70 backdrop-blur-[2px]"
          />
          {isPhone ? (
            <PhoneSheet size={size} onClose={onClose}>
              {!bare && <Header id={titleId} title={title} subtitle={subtitle} action={action} grabber />}
              {children}
            </PhoneSheet>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.99 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
              style={{ width, maxHeight: "min(78vh, 720px)" }}
              className="relative flex max-w-[92vw] flex-col overflow-hidden border border-line-overlay bg-surface-raised shadow-overlay"
            >
              {!bare && <Header id={titleId} title={title} subtitle={subtitle} action={action} onClose={onClose} />}
              {children}
            </motion.div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
}

/**
 * The phone half: a real gesture, not a modal with rounded corners.
 *
 * The sheet follows the finger 1:1 downward and resists upward (there is
 * nothing above it to reveal, so pulling up should feel like pulling on a
 * fixed object). The backdrop fades with the travel, so a half-finished drag
 * shows you exactly how far from dismissal you are and lets you change your
 * mind — the feedback a plain "swipe down to close" never gives.
 */
function PhoneSheet({
  size,
  onClose,
  children,
}: {
  size: "auto" | "tall" | "full";
  onClose: () => void;
  children: React.ReactNode;
}) {
  const y = useMotionValue(0);
  const dim = useTransform(y, [0, 260], [1, 0.4]);
  const scrollRef = useRef<HTMLDivElement>(null);
  // dragging is only allowed to start when the content is at its top; otherwise
  // the gesture belongs to the list and stealing it makes scrolling feel broken
  const [atTop, setAtTop] = useState(true);

  const onScroll = useCallback(() => {
    setAtTop((scrollRef.current?.scrollTop ?? 0) <= 0);
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const far = info.offset.y > 130;
    const fast = info.velocity.y > 520;
    if (far || fast) onClose();
  };

  const height =
    size === "full" ? "calc(100dvh - var(--safe-top) - 8px)" : size === "tall" ? "min(88dvh, 760px)" : undefined;

  return (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={SPRING}
      style={{ y, height, maxHeight: "calc(100dvh - var(--safe-top) - 8px)", opacity: dim }}
      drag={atTop ? "y" : false}
      dragDirectionLock
      // no travel upward, and a soft ceiling so a hard pull still shows life
      dragConstraints={{ top: 0, bottom: 0 }}
      dragElastic={{ top: 0.02, bottom: 0.9 }}
      onDragEnd={onDragEnd}
      className="relative flex w-full flex-col overflow-hidden rounded-t-sheet border-t border-line-overlay bg-surface-raised shadow-overlay"
    >
      <div ref={scrollRef} onScroll={onScroll} className="scroll-y flex min-h-0 flex-1 flex-col">
        {children}
        {/* the home indicator is not a place to put a button */}
        <div style={{ height: "var(--safe-bottom)" }} className="shrink-0" />
      </div>
    </motion.div>
  );
}

function Header({
  id,
  title,
  subtitle,
  action,
  onClose,
  grabber = false,
}: {
  id: string;
  title?: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
  grabber?: boolean;
}) {
  return (
    <div className="sticky top-0 z-10 shrink-0 bg-surface-raised/95 backdrop-blur-sm">
      {grabber && (
        <div className="flex justify-center pb-1 pt-2.5">
          <span className="sheet-grabber" aria-hidden />
        </div>
      )}
      {(title || action || onClose) && (
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div className="min-w-0">
            {title && (
              <h2 id={id} className="truncate text-[17px] font-medium leading-tight text-paper">
                {title}
              </h2>
            )}
            {subtitle && <div className="mt-0.5 text-sub text-content-muted">{subtitle}</div>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            {onClose && (
              <button
                onClick={onClose}
                aria-label="Cerrar"
                className="pressable -mr-1 flex h-8 w-8 items-center justify-center text-content-muted transition hover:text-content"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A row inside a sheet: the touch-sized unit every menu is built from. */
export function SheetRow({
  icon,
  label,
  detail,
  danger = false,
  onClick,
  href,
}: {
  icon?: React.ReactNode;
  label: string;
  detail?: React.ReactNode;
  danger?: boolean;
  onClick?: () => void;
  href?: string;
}) {
  const cls = `pressable flex w-full items-center gap-3.5 px-5 py-3.5 text-left text-body transition ${
    danger ? "text-[#ff6b57]" : "text-content/90"
  } hover:bg-fill-subtle`;
  const inner = (
    <>
      {icon && <span className="flex h-5 w-5 shrink-0 items-center justify-center text-content-muted">{icon}</span>}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {detail && <span className="shrink-0 text-sub text-content-muted">{detail}</span>}
    </>
  );
  if (href) {
    return (
      <a href={href} className={cls}>
        {inner}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {inner}
    </button>
  );
}
