"use client";

import Link from "next/link";

/**
 * La cabecera de un disco. La misma para todos los discos.
 *
 * Había dos pantallas de disco: la del disco que tienes — portada grande sobre
 * su propio color, título centrado, chips, acciones — y la del disco que
 * acabas de encontrar buscando o escaneando, que era una miniatura de 104px,
 * un botón y una tabla. El mismo objeto, dos pantallas distintas, y la segunda
 * pareciendo el resultado de una consulta en vez de un disco.
 *
 * Que un disco sea tuyo o no es un estado, no otra clase de cosa. Así que la
 * estructura es una sola y lo único que cambia es lo que se puede hacer con él
 * y lo que la aplicación sabe de él: si no lo tienes, el botón dice guardar en
 * vez de decir dónde está, y las tarjetas que hablan de tus racks no aparecen
 * porque no hay nada que contar todavía.
 */

/**
 * El fondo: la propia portada, difuminada y llevada a negro.
 *
 * No cuesta nada — la imagen ya está descargada — y es lo que evita que una
 * página negra con un cuadrado en medio parezca un explorador de archivos. El
 * degradado sostiene la portada arriba y llega a negro bastante antes de las
 * palabras, para que todo lo que se lee esté sobre el fondo de la aplicación.
 *
 * Seis paradas en vez de tres, y el negro llega tarde: una rampa recta contra
 * una imagen difuminada tiene un centro visible — el ojo encuentra la altura
 * exacta donde «empieza a oscurecer». Estas están suavizadas.
 */
export function RecordGround({ cover }: { cover: string }) {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -top-16 h-[94svh] overflow-hidden"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cover} alt="" className="h-full w-full scale-125 object-cover blur-2xl" />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom," +
            "rgba(10,10,10,0) 0%," +
            "rgba(10,10,10,0.04) 30%," +
            "rgba(10,10,10,0.16) 46%," +
            "rgba(10,10,10,0.42) 60%," +
            "rgba(10,10,10,0.74) 73%," +
            "rgba(10,10,10,0.93) 84%," +
            "#0a0a0a 94%)",
        }}
      />
    </div>
  );
}

/**
 * La portada y su pie: título centrado, artista debajo, y los datos que sitúan
 * el disco de un vistazo como chips.
 *
 * Centrado porque el objeto que nombra está en el centro de la pantalla:
 * alineado a la izquierda se lee como el encabezado de un documento. Y los
 * chips van en el mismo bloque, porque un título centrado sobre una fila de
 * datos a la izquierda son dos decisiones donde debería haber una.
 */
export function RecordHero({
  cover,
  title,
  artist,
  artistHref,
  facts,
  onNavigate,
  sentinel,
}: {
  cover: string;
  title: string;
  artist?: string | null;
  /** el artista es una puerta cuando sabemos a dónde lleva; si no, un pie */
  artistHref?: string | null;
  /** año, género, sello, país: lo que sitúa el disco sin abrir la ficha */
  facts?: (string | number | null | undefined)[];
  onNavigate?: () => void;
  /** lo que el encabezado pegajoso vigila para saber si ya se ha pasado */
  sentinel?: React.Ref<HTMLDivElement>;
}) {
  const chips = (facts ?? []).filter(Boolean).map(String);

  return (
    <>
      <div className="relative mx-auto mt-3 w-[76%]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={cover}
          alt={`Portada de ${title}`}
          className="relative aspect-square w-full rounded-[3px] object-cover shadow-[0_26px_60px_rgba(0,0,0,0.62)]"
        />
      </div>

      <div ref={sentinel} aria-hidden />

      <div className="text-center">
        <h2 className="mt-7 text-title font-medium leading-tight text-paper">{title}</h2>

        {artist &&
          (artistHref ? (
            /* Sin flecha al lado: el subrayado al pulsar ya dice que lleva a
               algún sitio, y una flecha tras un nombre centrado desplaza toda
               la línea por su propio ancho. */
            <Link
              href={artistHref}
              onClick={onNavigate}
              className="pressable mt-1.5 inline-block text-body text-content-secondary underline-offset-4 transition hover:text-paper hover:underline"
            >
              {artist}
            </Link>
          ) : (
            <p className="mt-1.5 text-body text-content-secondary">{artist}</p>
          ))}

        {chips.length > 0 && (
          <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
            {chips.map((f) => (
              <li
                key={f}
                className="rounded-full bg-fill px-3 py-1 text-caption text-content-secondary"
              >
                {f}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/** La fila de acciones: un control redondo de 44px que es solo un icono. */
export function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-fill text-paper transition-colors hover:bg-fill-strong"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden>
        {children}
      </svg>
    </button>
  );
}

/** La caja de un rack, el objeto que esta aplicación dibuja para «guardado». */
export function CrateIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={`shrink-0 ${className}`}
    >
      <path
        d="M2.6 4.4h10.8l-.85 8.5a.7.7 0 0 1-.7.6H4.15a.7.7 0 0 1-.7-.6L2.6 4.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M6.3 7.1h3.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
