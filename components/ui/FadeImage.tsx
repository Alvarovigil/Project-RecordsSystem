"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Una imagen que cambia por otra sin dar un salto.
 *
 * El caso es el de la cabecera de un artista: primero no se sabe qué foto va
 * ahí, así que se pone la portada de uno de sus discos, y cuando el catálogo
 * contesta llega la cara. Con un `<img src>` normal eso es un parpadeo — la
 * imagen vieja desaparece, hay un fotograma de nada, y la nueva entra de golpe
 * a medio descodificar.
 *
 * Aquí la anterior se queda puesta hasta que la siguiente está descodificada y
 * lista para pintar, y entonces se funden. Nunca hay un hueco, y nunca aparece
 * nada a medias: es lo mismo que hace una aplicación nativa cuando cambia la
 * portada de lo que está sonando.
 */
export default function FadeImage({
  src,
  alt = "",
  className = "",
  imgClassName = "",
  eager = false,
}: {
  src: string;
  alt?: string;
  /** la caja: tiene que tener tamaño propio, las capas se posicionan dentro */
  className?: string;
  /** lo que se le pide a cada capa — object-cover, blur, escala… */
  imgClassName?: string;
  eager?: boolean;
}) {
  const [shown, setShown] = useState(src);
  const [next, setNext] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  const asked = useRef(src);

  useEffect(() => {
    if (src === asked.current) return;
    asked.current = src;
    let alive = true;

    const img = new Image();
    img.src = src;
    // decode() promete que el mapa de bits está listo para pintar; onload solo
    // promete que han llegado los bytes, que es un fotograma antes de tiempo
    img.decode().then(
      () => {
        if (!alive) return;
        setNext(src);
        // un fotograma de margen para que la capa nueva exista a opacidad cero
        // antes de que empiece la transición, o el navegador se salta el fundido
        requestAnimationFrame(() => alive && setOver(true));
      },
      () => alive && setShown(src),
    );

    return () => {
      alive = false;
    };
  }, [src]);

  return (
    <span className={`relative block overflow-hidden ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={shown}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        draggable={false}
        className={`absolute inset-0 h-full w-full ${imgClassName}`}
      />
      {next && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={next}
          alt=""
          draggable={false}
          onTransitionEnd={() => {
            // cuando termina, la nueva pasa a ser la única y la capa se retira
            setShown(next);
            setNext(null);
            setOver(false);
          }}
          className={`absolute inset-0 h-full w-full transition-opacity duration-500 ease-out ${
            over ? "opacity-100" : "opacity-0"
          } ${imgClassName}`}
        />
      )}
    </span>
  );
}
