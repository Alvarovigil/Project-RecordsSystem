"use client";

import { SITE_NAME } from "@/lib/site";

/**
 * The two taps, drawn rather than described.
 *
 * Nobody discovers the "Añadir a pantalla de inicio" row on purpose — it is
 * halfway down a sheet, under things people actually use. So each step shows
 * the thing it is talking about at the size and in the colours it really has:
 * the share glyph as a chip, the menu row in white with its own icon, the home
 * screen with a gap where the icon is about to land. That turns "look for it"
 * into "recognise it", which is a different and much easier task.
 *
 * What is never drawn is *where* the button is. Safari puts share at the
 * bottom, Chrome on the same phone puts it at the top, and naming the wrong
 * corner is worse than naming none: it sends somebody looking where it is not.
 */

export function Step({
  n,
  title,
  detail,
  children,
}: {
  n: number;
  title: React.ReactNode;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="rounded-[14px] bg-fill-subtle p-4">
      <div className="flex items-start gap-3.5">
        <span className="mono mt-px flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-paper text-[11px] font-medium text-ink">
          {n}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-body leading-snug text-paper">{title}</span>
          {detail && (
            <span className="mt-1 block text-sub leading-relaxed text-content-muted">
              {detail}
            </span>
          )}
        </span>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </li>
  );
}

/** iOS's own share glyph, because "el icono de compartir" is not an instruction. */
export function ShareGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      aria-label="compartir"
      className="inline -translate-y-[1px]"
    >
      <path
        d="M7 9.2V1.6M7 1.6 4.6 4.1M7 1.6l2.4 2.5M2.7 7.6v4.8h8.6V7.6"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** the browser's bar, with the one button that matters lit up */
export function BrowserBar() {
  return (
    <div className="flex items-center gap-3 rounded-[10px] bg-ink/60 px-3 py-2.5">
      <span className="h-1.5 w-1.5 rounded-full bg-paper/20" />
      <span className="flex-1 truncate rounded-full bg-paper/[0.07] px-3 py-1 text-caption text-content-faint">
        rackr.club
      </span>
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-paper text-ink">
        <ShareGlyph size={13} />
      </span>
    </div>
  );
}

/** the row as it looks in the sheet, so it is recognised and not hunted */
export function SheetRow() {
  return (
    <div className="overflow-hidden rounded-[10px] bg-paper">
      <div className="flex items-center gap-3 px-3.5 py-2.5 opacity-25">
        <span className="flex-1 text-[15px] text-ink">Marcadores</span>
        <span className="h-4 w-4 rounded-[3px] border border-ink" />
      </div>
      <div className="h-px bg-ink/10" />
      <div className="flex items-center gap-3 bg-ink/[0.06] px-3.5 py-3">
        <span className="flex-1 text-[15px] font-medium text-ink">
          Añadir a pantalla de inicio
        </span>
        <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
          <rect x="1.4" y="1.4" width="15.2" height="15.2" rx="4" stroke="#0a0a0a" strokeWidth="1.3" />
          <path d="M9 5.4v7.2M5.4 9h7.2" stroke="#0a0a0a" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </div>
      <div className="h-px bg-ink/10" />
      <div className="flex items-center gap-3 px-3.5 py-2.5 opacity-25">
        <span className="flex-1 text-[15px] text-ink">Copiar</span>
        <span className="h-4 w-4 rounded-[3px] border border-ink" />
      </div>
    </div>
  );
}

/** the payoff: the icon, on a home screen, where it is going to live */
export function HomeScreenDrop() {
  return (
    <div className="rounded-[10px] bg-ink/60 p-4">
      <div className="grid grid-cols-4 gap-x-4 gap-y-3">
        {[0, 1, 2].map((n) => (
          <span key={n} className="aspect-square rounded-[11px] bg-paper/[0.07]" />
        ))}
        <span className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icon-512.png"
            alt=""
            className="aspect-square w-full rounded-[11px] shadow-[0_6px_18px_rgba(0,0,0,0.6)]"
          />
          <span className="absolute -inset-1 rounded-[14px] ring-2 ring-accent/70" />
        </span>
        {[3, 4, 5, 6].map((n) => (
          <span key={n} className="aspect-square rounded-[11px] bg-paper/[0.07]" />
        ))}
      </div>
      <p className="mt-3 text-center text-caption text-content-faint">{SITE_NAME}</p>
    </div>
  );
}
