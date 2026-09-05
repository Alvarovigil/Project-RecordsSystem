"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Sheet from "@/components/ui/Sheet";
import { useDevice } from "@/hooks/useDevice";

/**
 * La superficie sobre la que vive un disco. Cualquier disco.
 *
 * En el móvil es una pantalla: fija, a sangre, un solo scroll y ningún gesto
 * propio. Un disco no es una ojeada a algo que hay detrás, es aquello que has
 * ido a mirar — y la pantalla completa lo dice. En escritorio es el diálogo de
 * la aplicación, porque allí la estantería alrededor es el contexto y quitarla
 * entera sería un robo.
 *
 * Esto lo usan las dos pantallas de disco, la del que tienes y la del que
 * acabas de encontrar en el buscador, en el escáner o en Explorar. Aquella
 * abría una pestaña a media altura y esta una pantalla: el mismo objeto
 * entrando por dos puertas distintas, y la pestaña haciendo que un disco
 * encontrado pareciera una consulta.
 *
 * (El emparejamiento arrastrar-y-hacer-scroll es también lo que congelaba la
 * hoja anterior en iOS: el gesto de tirar y el de desplazar son el mismo hasta
 * que uno gana, y cuando ganaba el que no era la página dejaba de responder.)
 */
export default function RecordScreen({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { isPhone } = useDevice();

  if (!isPhone) {
    return (
      <Sheet open={open} onClose={onClose} size="tall" bare>
        {/* El diálogo es una caja fija con el desbordamiento oculto, así que el
            cuerpo tiene que hacer su propio scroll: si no, todo lo que pase de
            78vh sencillamente no se alcanza. */}
        <div className="scroll-y min-h-0 flex-1 overflow-y-auto">{children}</div>
      </Sheet>
    );
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          /* Por debajo de la capa de diálogos (70), no por encima: esto es una
             pantalla, y todo lo que se abre desde ella — guardar, compartir,
             confirmar un borrado — es una hoja que tiene que caer encima. */
          /* El marco y el scroller son dos elementos a propósito: el padding
             de las áreas seguras no retiene nada dentro de una caja que se
             desplaza, y el contenido acaba pintando bajo el reloj. El inset es
             del marco, que no se mueve. */
          /* Negro, no el gris elevado: esta pantalla no está encima de nada, y
             cualquier gris detrás compite con la portada. */
          className="fixed inset-0 z-[60] bg-ink"
          style={{ paddingTop: "var(--safe-top)", paddingBottom: "var(--safe-bottom)" }}
        >
          <div className="scroll-y h-full overflow-y-auto">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Si la portada ya se ha ido hacia arriba.
 *
 * Se lee con un observador sobre un centinela y no comparando desplazamientos:
 * un número contra un umbral parpadea justo en el momento en que un dedo lo
 * mantiene quieto en el punto de cruce. Y una banda en vez de una línea, por lo
 * mismo.
 */
export function useScrolledPast(active: boolean) {
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!active || !el) return;
    const io = new IntersectionObserver(
      ([e]) => setScrolled(e.boundingClientRect.top < 0 ? true : !e.isIntersecting),
      // la altura de la barra: llega exactamente cuando el centinela pasa bajo ella
      { rootMargin: "-64px 0px 0px 0px", threshold: [0, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [active]);

  return { sentinel, scrolled };
}

/**
 * La barra de arriba de un disco, y es la misma que el reproductor del pie.
 *
 * Había dos diseños para un mismo objeto: abajo una funda cuadrada con el
 * artista en versalitas mono y un círculo perfilado para reproducir; arriba una
 * miniatura redondeada, caja baja y un círculo relleno. Los dos estaban bien y
 * juntos decían que la aplicación la habían hecho dos personas.
 *
 * Altura fija desde el principio: nada crece, así que nada oscila, y el nombre
 * del disco llega al hueco que ya ocupaba el botón de volver en lugar de colgar
 * de una segunda barra. Cristal propio y no tinta plana, porque debajo se mueve
 * la portada y una barra sólida sería una tapa.
 */
export function RecordTopBar({
  onClose,
  cover,
  title,
  artist,
  scrolled,
  trailing,
}: {
  onClose: () => void;
  cover: string;
  title: string;
  artist?: string | null;
  scrolled: boolean;
  /** el transporte, donde hay algo que reproducir */
  trailing?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-30 h-16">
      <div
        className={`absolute inset-0 transition-opacity duration-base ease-out ${
          scrolled ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="absolute inset-0 bg-ink/88 backdrop-blur-2xl" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-line" />
      </div>

      <div className="relative flex h-16 items-center gap-3 px-4">
        <button
          onClick={onClose}
          aria-label="Cerrar"
          className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink/55 text-paper ring-1 ring-inset ring-paper/15 backdrop-blur-xl transition-colors hover:bg-ink/75"
        >
          <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
            <path
              d="M11.5 3.5 L5.5 9 L11.5 14.5"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        {/* Cuando la portada se ha ido, el título y el transporte vienen
            contigo: tener que subir hasta arriba para darle al play es la
            razón por la que la gente cierra estas pantallas. */}
        <div
          className={`flex min-w-0 flex-1 items-center gap-3 transition-[opacity,transform] duration-base ease-out ${
            scrolled ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-1.5 opacity-0"
          }`}
        >
          {/* cuadrada y sin redondear, como la del reproductor: una funda es cuadrada */}
          <span className="h-10 w-10 shrink-0 overflow-hidden bg-paper/[0.06]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cover} alt="" className="h-full w-full object-cover" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] text-paper">{title}</span>
            {artist && (
              <span className="mono block truncate text-[10px] uppercase tracking-[0.16em] text-paper/40">
                {artist}
              </span>
            )}
          </span>
          {trailing}
        </div>
      </div>
    </div>
  );
}
