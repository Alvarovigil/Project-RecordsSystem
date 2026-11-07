# F7 «Cimientos»: revisión de código y seguridad (Weaver)

Base: 8c3396a, más el diff sin commitear y los archivos nuevos (`eslint.config.mjs`, `lib/og/`).

Comprobado:
- **`tsc --noEmit`:** limpio.
- **`npm run lint` (`eslint .`):** limpio.
- **`NEXT_DIST_DIR=.next-rv-code next build`:** compila con Next 16.4.5 y Turbopack. Después he borrado `.next-rv-code` y he quitado de `tsconfig.json` solo mi línea. Las de `rv-art`, `rv-ux`, `rv-qa` y `rv-qa2`, y las `dev/types` que añade Next 16, se quedan.
- **`tsx --test lib/*.test.ts`:** 43 de 43.
- **`npm audit --omit=dev`:** **0 vulnerabilidades**. Antes eran 6, con 1 crítica.

## F7-A: migración

- **APIs asíncronas.** He buscado en todo `app/` y `lib/`:
  - `params` y `searchParams`: los 15 sitios hacen `await props.params` o `await props.searchParams`. Eso incluye las dos `opengraph-image` y el `DELETE /api/vinyl/[id]`.
  - `cookies()` y `headers()`: todas con `await`, en `lib/supabase/server.ts`, `lib/admin/auth.ts` y `lib/artist-known-server.ts`.
  - `getSupabaseServerClient()`: las 13 llamadas tienen `await`.
  - **Panel de administración.** Las cuatro llamadas a `isAdmin()` (`/admin`, `/admin/u/[id]`, `/admin/login` y `/api/admin/actions`) también tienen `await`. Una promesa sin `await` siempre cuenta como verdadera, y habría abierto el panel a cualquiera.
- **`layer-history` con Next 16.** He leído `next/dist/client/components/app-router.js` de la 16.4.5:
  - sigue marcando sus entradas con `__NA` y `__PRIVATE_NEXTJS_INTERNALS_TREE`, aunque el árbol ahora es `{ tree, renderedSearch }`;
  - el `pushState` y el `replaceState` parcheados siguen copiando los dos campos si faltan;
  - el `popstate` recarga la página solo si falta `__NA`.
  - Como el coordinador copia `history.state` entero y le añade `__rackrLayer` y `__rackrBase`, las entradas de las capas siguen siendo restaurables por Next. No hay que cambiar nada.
  - Lo nuevo de Next es repetir un «atrás» perdido antes de hidratar si la entrada tiene `__NA`. Encaja con `settle`, porque eso ocurre antes que nuestro efecto.
- **Caché en las rutas.**
  - Con Next 15 y 16, `fetch` y los `GET` ya no se guardan por defecto.
  - `catalogueFetch`, `specs`, `covers`, `trending` y `jukebox` declaran su `revalidate`.
  - `/api/cover` responde con `Cache-Control: public, max-age=31536000, immutable`, así que la CDN la cubre.
  - `/api/preview/album` mira primero su caché en Supabase.
  - `/api/discogs/release` es un `POST`, que tampoco se guardaba antes.
  - No se pierde nada que importe.
- **Fuente de las imágenes OG.**
  - Noto Sans está bajo la licencia OFL 1.1, que permite subirla al repositorio y redistribuirla, también en un repositorio público.
  - La tabla `name` del archivo conserva el copyright (Google LLC) y la URL de la OFL.
  - He comprobado que el `.ttf` llega a las funciones donde se usa: está en las trazas `.nft.json` de `/api/share/{record,list}` y de las dos `opengraph-image`, así que en Vercel se encuentra.
- **Node en Vercel.**
  - Next 16 pide Node 20.9 o superior. En local se ha usado la 22.22.
  - `package.json` no tiene `engines`, así que manda la configuración del proyecto en Vercel. Hay que confirmar allí que está en 22.x.
- **Resto de A.** `staleTimes.dynamic: 30` no deja ver datos de otra cuenta: entrar y salir hacen recarga completa (`window.location`). Están bien también `devIndicators: false`, `AGENTS.md` ignorado y `data-scroll-behavior`. `framer-motion` 11.18 admite React 19 entre sus dependencias compatibles.

## F7-B: interfaz

- **`RetryImg`.**
  - Se salta la comprobación al montar si el `src` empieza por `data:`.
  - El `fallback` en texto ya tiene su propia guardia: si también falla, pinta una superficie neutra. Así no vuelve nunca el icono de imagen rota.
  - La referencia en línea vuelve a llamarse en cada render con React 19, pero el bucle se corta, porque al marcar `deadFallback` cambia lo que se pinta.
- **`Hold` y los esqueletos.** Los `ResizeObserver` y el `IntersectionObserver` se desconectan al desmontar. Las medidas se toman antes de pintar (`useLayoutEffect`), así que el fotograma vacío no llega a verse. `onSettle` respeta `alive`. No he visto escuchas sin limpiar.

VEREDICTO: APROBADO

BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (nada)

MEJORA:
- **`lib/og/`.** La OFL pide que cada copia de la fuente vaya con el copyright y con la licencia. El archivo trae el copyright y la URL, pero no el texto de la licencia. Hay que añadir `lib/og/OFL.txt` antes de publicar: es barato y cierra la duda en un repositorio público.
- **`lib/og/font.ts`.** Declara `weight: 700` con un archivo de peso normal. Satori no inventa la negrita, así que donde el OG pide negrita sale normal. O se sube el `.ttf` en 700, o se declara 400.
- **`package.json`.** Añadir `"engines": { "node": "22.x" }`. Así Vercel no depende de lo que esté marcado en el panel, y Next 16 no arranca nunca con un Node 18.
- **Lint.** `eslint.config.mjs` apaga 14 reglas del React Compiler. Está bien mientras no haya compilador, pero que quede apuntado como encargo propio, porque varias (`refs`, `set-state-in-render`) avisan de problemas reales también sin compilador.
- **`tsconfig.json`.** Acumula diez líneas `.next-rv-*` de los revisores. Que no entren en el commit de F7: solo deben ir `jsx: react-jsx` y `.next/dev/types`.
- **`remotePatterns`.** Sigue en `next.config` aunque la app no usa `next/image`. Si se quita, la superficie del optimizador de imágenes desaparece del todo.

DICE: Next 16 y React 19 sin vulnerabilidades, todos los await en su sitio y las capas siguen siendo restaurables. Aprobado; falta el OFL.txt y fijar Node 22.
