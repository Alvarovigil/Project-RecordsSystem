/**
 * ¿Hay una sesión guardada en este navegador? La respuesta sin red.
 *
 * La usan dos sitios que tienen que decir lo mismo: el repositorio de datos
 * (`lib/data`, para elegir el backend antes de que conteste nadie) y el guion
 * que el armazón de Explorar pinta en el HTML del servidor (`ExploreFrame`,
 * para poner el título con sesión o sin ella antes del primer fotograma). Si
 * cada uno lo resolviera a su manera, el relevo entre los dos cambiaría el
 * título y movería la pantalla.
 */

/** El nombre de la cookie (y de la clave de localStorage) de la sesión. */
export function authTokenName(supabaseUrl: string): string | null {
  try {
    return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Si `cookie` (un `document.cookie`) o `stored` (lo guardado en localStorage
 * con ese nombre) dicen que hay sesión.
 *
 * @supabase/ssr guarda la sesión en cookies y la parte en `…auth-token.0`,
 * `.1` cuando no cabe en una; cualquier trozo cuenta. El token o uno de sus
 * trozos, nunca un prefijo: el PKCE deja `…auth-token-code-verifier` cuando
 * alguien empieza a entrar con Google y se echa atrás, y eso no es sesión.
 * localStorage es para clientes antiguos y el adaptador de localStorage.
 *
 * Autosuficiente a propósito: sin imports ni ayudas, porque `ExploreFrame` la
 * convierte en texto (`toString`) y la mete tal cual en un `<script>`.
 */
export function storedSessionIn(name: string, cookie: string, stored: string | null): boolean {
  const chunk = new RegExp("^" + name + "(\\.\\d+)?=");
  const parts = cookie ? cookie.split("; ") : [];
  for (let i = 0; i < parts.length; i++) if (chunk.test(parts[i])) return true;
  return Boolean(stored);
}
