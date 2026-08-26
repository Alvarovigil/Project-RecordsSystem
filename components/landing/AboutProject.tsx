"use client";

import { useEffect, useRef, useState } from "react";

/**
 * The small print, in the corner where small print goes.
 *
 * Who made this and why is worth saying plainly somewhere, but not in the
 * middle of the page: someone who has just arrived wants to know what the
 * thing does, not who is behind it. Whoever does want to know goes looking,
 * and this is where they look.
 */
export default function AboutProject() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="landing-hides fixed bottom-5 left-5 z-[70] text-[13px] uppercase tracking-[0.04em] text-paper transition hover:text-paper/60 sm:text-[15px]"
      >
        Sobre el proyecto
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sobre el proyecto"
          className="fixed inset-0 z-[90] flex items-end justify-center px-4 pb-4 sm:items-center sm:p-6"
        >
          <button
            aria-label="Cerrar"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
          />

          <div className="relative w-full max-w-[560px] border border-paper/15 bg-[#0d0d0d] px-6 py-7 shadow-[0_30px_90px_rgba(0,0,0,0.75)] sm:px-9 sm:py-9">
            <div className="flex items-start justify-between gap-6">
              <p className="mono text-[10px] uppercase tracking-[0.24em] text-paper/35">
                Sobre el proyecto
              </p>
              <button
                ref={closeRef}
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="-mt-1 text-paper/40 transition hover:text-paper"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path d="M3 3 L13 13 M13 3 L3 13" stroke="currentColor" strokeWidth="1.3" />
                </svg>
              </button>
            </div>

            <p className="mt-6 text-[20px] leading-[1.3] text-paper md:text-[23px]">
              Rackr Club no es una empresa. Es un proyecto sin ánimo de lucro,
              hecho por un amante de los vinilos para los amantes de los
              vinilos.
            </p>

            <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
              Nadie ha puesto dinero aquí esperando sacarlo. Por eso no hay
              anuncios, ni datos que vender, ni un algoritmo contando cuánto
              rato aguantas mirando la pantalla.
            </p>

            <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
              Lo que sí hay es una manía: que los que coleccionamos dejemos de
              hacerlo cada uno en su casa. Que un disco tuyo lleve a la
              estantería de alguien, y esa estantería a un disco que no
              conocías. Descubrir música por la vía de siempre, que es alguien
              poniéndotela.
            </p>

            <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
              Si te sirve, úsalo. Si le falta algo, dilo: seguro que le falta.
            </p>

          </div>
        </div>
      )}
    </>
  );
}
