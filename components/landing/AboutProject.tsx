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

  /**
   * Opened from anywhere, without anybody holding a handle to it.
   *
   * The phone's trigger lives inside the hero, three components away from this
   * one. Threading state up and back down for a panel that opens once is more
   * plumbing than the feature is worth; an event names the intention and both
   * doors are equal.
   */
  useEffect(() => {
    const onAsk = () => setOpen(true);
    window.addEventListener("rackr:about", onAsk);
    return () => window.removeEventListener("rackr:about", onAsk);
  }, []);

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
      {/* The corner trigger is a desktop object: on a phone there is no
          spare corner, so this link lives in the flow under the index and asks
          for the panel by name. Same panel, two doors, one of which is not
          fighting the player for the bottom of the screen. */}
      <button
        onClick={() => setOpen(true)}
        className="landing-hides fixed bottom-5 left-5 z-[70] hidden text-[13px] uppercase tracking-[0.05em] text-paper/80 transition hover:text-paper sm:block"
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

          {/* Long enough now that it has to scroll — and on a phone it has to
              scroll from the bottom, where the thumb is. Capped against the
              dynamic viewport so the browser's disappearing toolbar can never
              hide the sign-off. */}
          <div className="relative flex w-full max-w-[560px] flex-col border border-paper/15 bg-[#0d0d0d] shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
               style={{ maxHeight: "min(88dvh, 760px)" }}>
            <div className="flex shrink-0 items-start justify-between gap-6 px-6 pt-7 sm:px-9 sm:pt-9">
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

            <div data-scrollable className="scroll-y min-h-0 flex-1 px-6 pb-8 pt-6 sm:px-9 sm:pb-9">
              <p className="text-[20px] leading-[1.3] text-paper md:text-[23px]">
                Rackr Club no es una empresa. Es un proyecto sin ánimo de lucro,
                hecho por un amante de los vinilos para los amantes de los
                vinilos.
              </p>

              {/* The question is the premise of the whole thing, so it is the
                  one sentence in the body at full strength. Everything after
                  it is an answer to it. */}
              <p className="mt-6 text-[14px] leading-relaxed text-paper/60">
                Todo empezó con una idea bastante simple:{" "}
                <span className="text-paper">
                  si coleccionar discos también es una forma de descubrir
                  música, ¿por qué nuestras colecciones viven aisladas?
                </span>
              </p>

              <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
                Así que me puse a construir el sitio que me gustaría usar.
              </p>

              <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
                Un lugar donde tener tu colección organizada y siempre a mano,
                pero sobre todo donde encontrarte con las de otros
                coleccionistas.
              </p>

              <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
                Ver qué tiene alguien con gustos parecidos a los tuyos.
                Descubrir qué tiene él que tú no. Entrar por un disco, saltar a
                otro y acabar escuchando algo que ni siquiera sabías que
                buscabas.
              </p>

              <p className="mt-5 text-[14px] leading-relaxed text-paper/60">
                Porque tu colección puede ser una forma de descubrir las de los
                demás. Y las de los demás, una forma de seguir construyendo la
                tuya.
              </p>

              {/* The line the whole product is named after, on its own and in
                  full-strength paper. It is the turn of the text — where it
                  stops explaining itself and states what it is — so it gets
                  the weight and the silence around it that a turn deserves. */}
              <p className="mt-6 text-[17px] leading-snug text-paper">
                Tu colección, más allá de tu estantería.
              </p>

              <p className="mt-6 text-[14px] leading-relaxed text-paper/60">
                Rackr es un proyecto independiente que todavía está creciendo.
                Entra, sube tu colección, curiosea y hazlo un poco más tuyo.
              </p>

              {/* Three parallel lines that rhyme. Written as separate lines
                  rather than as one wrapped paragraph, because the repetition
                  IS the argument and prose flow would bury it. */}
              <ul className="mt-5 space-y-1 text-[14px] leading-relaxed text-paper/60">
                <li>Si algo no funciona, dímelo.</li>
                <li>Si echas algo de menos, pídelo.</li>
                <li>Si tienes una idea mejor, todavía mejor.</li>
              </ul>

              {/* A letter is signed, and a signature sits apart from the body.
                  The thanks belong on this side of the rule: it is addressed
                  to the reader, not part of the description. The address is a
                  real mailto — an email you have to copy by hand is an
                  invitation nobody accepts. */}
              <div className="mt-8 border-t border-paper/10 pt-6">
                <p className="text-[15px] leading-relaxed text-paper">
                  Gracias por sumar tu colección a todas las demás.
                </p>
                <p className="mt-5 text-[14px] text-paper">Álvaro</p>
                <a
                  href="mailto:rackr.club@gmail.com"
                  className="mono mt-1 inline-block text-[12px] text-paper/45 underline-offset-4 transition hover:text-paper hover:underline"
                >
                  rackr.club@gmail.com
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
