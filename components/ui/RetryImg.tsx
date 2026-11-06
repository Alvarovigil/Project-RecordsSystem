"use client";

import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { COVER_RETRY_MS } from "@/lib/cover";

/**
 * Una imagen que no se rinde al primer bache.
 *
 * Una portada que falla una vez (un túnel, un ascensor, una cobertura que va
 * y viene) dejaba el icono roto del navegador y el texto alternativo pintado
 * encima de la funda para el resto de la sesión: el navegador no vuelve a
 * pedir una imagen que falló. Aquí se vuelve a pedir con la misma espera que
 * el estante 3D (`COVER_RETRY_MS`), cada vez con un elemento nuevo — poner el
 * mismo `src` en el que falló no hace una petición nueva.
 *
 * Mientras espera, la imagen fallida no se ve (ni el icono roto ni el `alt`):
 * se ve lo que haya debajo, que en una portada es su cuadrado. Si se agotan
 * los intentos, se pinta el `fallback`: otra dirección (la funda dibujada con
 * los colores del disco), un nodo, o por defecto una superficie neutra del
 * tamaño de la imagen. Nunca el icono roto.
 */
export function useImgRetry(src: string | null | undefined) {
  const [attempt, setAttempt] = useState(0);
  const [broken, setBroken] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  // otra imagen, otra cuenta
  const seen = useRef(src);
  useEffect(() => {
    if (seen.current === src) return;
    seen.current = src;
    clearTimeout(timer.current);
    setAttempt(0);
    setBroken(false);
    setGaveUp(false);
  }, [src]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** devuelve true cuando ya no quedan intentos */
  const fail = () => {
    setBroken(true);
    if (attempt < COVER_RETRY_MS.length) {
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setAttempt((n) => n + 1);
        setBroken(false);
      }, COVER_RETRY_MS[attempt]);
      return false;
    }
    setGaveUp(true);
    return true;
  };

  return { attempt, broken, gaveUp, fail };
}

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string | null;
  /** qué se pinta si no hay manera: otra dirección o un nodo */
  fallback?: string | ReactNode;
};

const RetryImg = forwardRef<HTMLImageElement, Props>(function RetryImg(
  { src, fallback, onError, alt = "", className, style, ...rest },
  ref,
) {
  const r = useImgRetry(src);

  /**
   * Un error que llegó antes que React.
   *
   * Una imagen pintada en el servidor puede fallar antes de que la página se
   * hidrate, y entonces su `onError` no se entera nunca: se quedaba el icono
   * roto para siempre. Al montar se mira si ya está terminada y vacía.
   */
  const own = useRef<HTMLImageElement | null>(null);
  const setRef = (el: HTMLImageElement | null) => {
    own.current = el;
    if (typeof ref === "function") ref(el);
    else if (ref) ref.current = el;
  };
  const fail = r.fail;
  useEffect(() => {
    const el = own.current;
    if (el && el.complete && el.naturalWidth === 0 && el.getAttribute("src")) fail();
    // solo al montar cada intento
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [r.attempt]);

  if (!src || r.gaveUp) {
    if (typeof fallback === "string")
      // eslint-disable-next-line @next/next/no-img-element
      return <img ref={ref} src={fallback} alt={alt} className={className} style={style} {...rest} />;
    if (fallback !== undefined && fallback !== null) return <>{fallback}</>;
    return <span aria-hidden className={`block bg-fill-subtle ${className ?? ""}`} style={style} />;
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      key={r.attempt}
      ref={setRef}
      src={src}
      alt={alt}
      className={className}
      style={r.broken ? { ...style, visibility: "hidden" } : style}
      {...rest}
      onError={(e) => {
        if (r.fail()) onError?.(e);
      }}
    />
  );
});

export default RetryImg;
