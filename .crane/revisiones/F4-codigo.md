# F4 · La puerta — revisión de código (Weaver)

Rama `feat/la-puerta` contra `main` (sin commitear, 45 archivos). `npx tsc --noEmit`: limpio (exit 0).

```
VEREDICTO: BLOQUEADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- data/vinilos.json (+192 líneas), public/covers/fleetwood-mac-rumours-live-28183648.jpg — no son de esta fase:
  son discos (Radiohead «OK Computer», Fleetwood Mac…) que entraron al probar en local; las rutas
  /api/vinyl y /api/discogs/release escriben en ese archivo en dev. Es el catálogo de muestra que ven todos los
  visitantes y lo importa app/not-found.tsx. Fuera del diff: git checkout main -- data/vinilos.json y borrar la
  portada (o, si se quieren, una fase propia que lo diga).
- tsconfig.json:37 y .next-sesion/ — un directorio de build local metido en el include de tsconfig, y
  .next-sesion/ sin ignorar (.gitignore solo cubre .next y .next-verify). Un `git add -A` sube un build entero.
  Quitar la línea del include y añadir .next-sesion (o mejor .next-*) a .gitignore.
MEJORA:
- hooks/useSession.ts:12-26 — el JSDoc de useSession («Who is using the app») ha quedado encima del de
  useIsVisitor, y useSession se queda sin documentación. Mover useIsVisitor debajo de useSession.
- components/app/TabBar.tsx:37 y TopNav.tsx:49 — preview = available && !user es true mientras se lee la
  sesión: un usuario con cuenta que toque Colección o Perfil en ese instante va a /entrar, y de ahí a
  /coleccion (también desde Perfil). Usar la misma regla que useIsVisitor (con !loading), o directamente
  useIsVisitor. useIsVisitor está bien así: false mientras carga evita el parpadeo al que tiene cuenta, y el
  visitante solo ve un instante el texto de «tu colección».
- app/(app)/entrar/page.tsx:19 — con NEXT_PUBLIC_FAKE_SESSION=1 no rompe (las pestañas ya no llevan aquí porque
  el usuario falso cuenta como sesión), pero visitar /entrar a mano enseña la puerta. Para que se comporte como
  app/(app)/coleccion/page.tsx: if (FAKE_SESSION) redirect("/coleccion").
- components/landing/SoundGate.tsx:74 — con entered=true desde el principio, toda la puerta (desenfoque, «Vamos
  allá», «Entrar en silencio», el retraso de llegada) es código muerto que se conserva «por si vuelve». Que se
  quede en git y fuera del archivo. stopPropagation en los dos botones de la píldora está bien: sin él, el
  primer toque llamaría a toggle dos veces. El clic del div no es accesible por teclado, pero el botón de
  dentro sí y lleva aria-label «Poner música»: suficiente.
- components/Onboarding.tsx:80-89 — orden de hooks correcto: useState y useEffect nuevos van antes del return
  temprano. El tour se abre con un evento global, «rackr:tour», que es un contrato sin tipo entre Ajustes y el
  layout. Que el nombre viva en una constante compartida (lib/events.ts o similar) para que no se rompa al
  renombrarlo en un solo lado.
- Tailwind: ninguna opacidad fuera de la escala (todas múltiplos de 5), ningún text-[9|10|11px] que quede, y
  las clases condicionales son literales completos (cursor-pointer). Quedan muchos text-[12px] y text-[13px]
  sueltos donde hay tokens (text-caption, text-sub): la pasada ha subido el tamaño pero no ha llevado los
  valores a los tokens. Pendiente para /tidy.
- Visitantes: ArtistView y ExploreView tienen bien el «tuyo / te falta». InstallScreen esconde «Entrar con
  Google» en el navegador de otra app, y EntryDoor queda cubierto por data-no-install. Bien.
```

DICE: La puerta ya se abre desde todas partes; antes del commit, fuera el catálogo de prueba y el build que se coló.

---

## Re-revisión

```
VEREDICTO: APROBADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (ninguno)
MEJORA:
- components/app/TabBar.tsx:39 — mientras carga la sesión de un visitante, Perfil apunta un instante a
  /u/<DEMO_PROFILE.username> (handle de respaldo). Es el caso contrario al que se ha arreglado, y menor.
  Mientras carga, mejor dejar el enlace en /entrar o desactivado.
- Para la fase de limpieza, como se acordó: el código muerto de la puerta de SoundGate y los text-[12px] y
  text-[13px] que deberían ser tokens.
```

Comprobado:
- data/vinilos.json, tsconfig.json y public/ ya no difieren de main.
- .next-* está en .gitignore y .next-sesion/ no aparece en git status.
- useIsVisitor está debajo de useSession.
- TabBar y TopNav usan !loading.
- /entrar redirige con FAKE_SESSION.
- TOUR_EVENT vive en lib/site.ts y lo usan Onboarding y Ajustes.
- `npx tsc --noEmit` limpio.

DICE: Diff limpio y la puerta sin sustos al cargar. APROBADO; lo que queda es limpieza, no costura.

---

## Re-revisión tras el frontend (60 archivos)

`npx tsc --noEmit`: limpio (exit 0).

```
VEREDICTO: BLOQUEADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- lib/data/supabase.ts:171-174 (userOrNull) — trata como «no hay nadie» CUALQUIER fallo de getUser().
  getUser pregunta al servidor de Auth. Sin red, por un corte o por un 5xx devuelve user null con un
  AuthRetryableFetchError, también para alguien con sesión. Antes eso lanzaba; ahora devuelve vacío, y vacío
  se escribe:
    · hooks/useLibrary.ts:62 y :124 — writeSnapshot guarda una estantería vacía. El siguiente arranque en frío
      abre vacío, y después de cualquier escritura (act) la estantería se queda en blanco.
    · lib/migrate.ts:39 — listLists() vacío hace que no encuentre ni colección ni deseos (continue), y aun así
      marca DONE_KEY (l.71). La biblioteca local no se vuelve a subir nunca. Antes lanzaba y se reintentaba.
  Debería distinguir «no hay sesión» de «no he podido preguntar»:
    import { isAuthSessionMissingError } from "@supabase/supabase-js";
    const userOrNull = async () => {
      const { data, error } = await sb.auth.getUser();
      if (data.user) return data.user.id;
      if (!error || isAuthSessionMissingError(error)) return null;
      throw error;
    };
  Con eso, el caso que se quería arreglar (cookie code-verifier, visitante) sigue devolviendo vacío, y el
  modo con sesión sigue fallando a la vista cuando falla de verdad. Las escrituras siguen con requireUser:
  bien.
MEJORA:
- components/landing/SoundGate.tsx:28-37 — la promesa a nivel de módulo está bien: un solo fetch por carga,
  compartido entre montajes, y se descarta si la red falla. Pero una respuesta no-ok (r.ok false → tracks [])
  se queda en caché hasta recargar: «Sin música ahora» para toda la visita aunque fuera un 503 pasajero.
  Tratar !r.ok como fallo (throw → jukebox = null). El desbloqueo de audio en el gesto (needle muted + Audio()
  vacío) y el efecto waiting → dropNeedle están bien ordenados (dropNeedle se declara en la l.244, antes de
  que la l.311 lo use).
- components/app/TabBar.tsx — `preview || !profile`: con sesión pero con el perfil sin cargar (o si falla su
  lectura), Perfil lleva a /entrar?desde=perfil y el servidor lo rebota a /coleccion. Mientras carga es
  aceptable. Si el perfil falla, Perfil queda roto sin aviso; mejor /u/<id> o desactivar la pestaña.
  Leer ?desde con window.location en un efecto, por no usar useSearchParams, está bien razonado.
- lib/data/index.ts:44 — hasStoredSession con la regex exacta (token o trozos .N) es correcto y cierra el
  falso positivo de -code-verifier, que es la causa real. Con eso, userOrNull es una red, no el arreglo.
```

DICE: Vacío no es lo mismo que «no he podido preguntar»: con la red caída, userOrNull borra la estantería del que sí tiene sesión.

---

## Re-revisión, 3ª vuelta de frontend

`npx tsc --noEmit`: limpio (exit 0).

```
VEREDICTO: BLOQUEADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- app/(app)/entrar/page.tsx:25-28 — /entrar redirige a `next` con el filtro de texto que ya tumbamos en F2:
  next.startsWith("/") && !next.startsWith("//"). "/\evil.com" lo pasa y redirect() lo manda tal cual en
  Location; el navegador lo lee como https://evil.com. Cualquiera con sesión que abra
  rackr.club/entrar?next=/%5Cevil.com sale de la web, y con FAKE_SESSION también. Ahora hay cuatro copias de
  la misma regla (callback, /entrar, signInWithGoogle, nextFromEntry) y solo la del callback está bien.
  Debería quedar una sola función, p. ej. lib/safe-next.ts:
    export function safeNext(raw: string | null | undefined, fallback = "/coleccion") {
      if (!raw) return fallback;
      try {
        const u = new URL(raw, "http://rackr.invalid");
        return u.origin === "http://rackr.invalid" ? u.pathname + u.search + u.hash : fallback;
      } catch { return fallback; }
    }
  y usarla en los cuatro sitios. Las dos del cliente no abren hueco hoy, porque acaban en el callback, que
  valida. Pero con una sola regla no se repite este fallo.
MEJORA:
- useIsVisitor da false mientras carga, así que un visitante que toque Seguir, Me gusta o Guardar en ese
  instante escribe en la estantería de ejemplo. La red de useCatalogueSearch tampoco lo cubre. Es una
  ventana corta y sin daño fuera del navegador del visitante, así que no bloquea. Si se quiere cerrar, que
  la puerta pregunte también por `loading`.
- Archivos que quedaron sin leer la vez pasada, ya leídos:
  · FollowButton, SaveListButton, ListMetrics y CatalogueSheet: el visitante nunca ve el estado como suyo
    («Sigues», corazón lleno, «Guardada») y el gesto lleva a entryHref() sin escribir. Bien.
  · RecordSheet: el `if (visitor) return null` está dentro del IIFE de savedLabel, no es un return temprano
    entre hooks. pickOnOpen respeta al visitante. El menú se oculta cuando no hay nada que editar. Bien.
  · ActivityView: estado vacío propio, y markRead no se llama sin sesión. Bien.
  · ProfileView: las cifras en dos parejas con whitespace-nowrap. Bien.
  · RecordSpecsCard releaseDate: cubre ISO, con 00 como desconocido, y «03 Apr 2026». Lo que no reconoce lo
    enseña entero. Bien.
- Verificado: userOrNull solo devuelve null con isAuthSessionMissingError y lanza lo demás (bloqueo anterior
  resuelto). SoundGate trata !r.ok como fallo. TabBar escucha popstate y lleva Perfil a /u/<id> sin perfil.
  .page-fade[data-arrived] lleva filter:none.
```

DICE: El mismo hilo suelto de F2 ha vuelto por /entrar: una sola safeNext para los cuatro sitios y no se repite.

---

## Re-revisión del bloqueo de /entrar

```
VEREDICTO: APROBADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (ninguno)
MEJORA:
- useEntryGate se traga el toque mientras carga la sesión. Es correcto (ni escribe ni rebota), pero no da
  ninguna señal: si la sesión tarda, el botón parece muerto. Basta con un estado de «un momento» en el
  botón si alguna vez se nota.
- Siguen para la fase de limpieza: el código muerto de SoundGate y los text-[12px] y [13px] que deberían ser
  tokens.
```

Comprobado:
- lib/safe-next.ts es la única regla. La usan callback, /entrar, signInWithGoogle y nextFromEntry, y no
  queda ninguna comprobación suelta (grep de startsWith("//") vacío).
- Probado con node: "/\evil.com", "//evil.com", "https://evil.com" y "javascript:alert(1)" van a /coleccion;
  "/u/vera?x=1#y" se conserva.
- useEntryGate y useWriteBlocked tienen en cuenta available, loading y user. Pasan por el portero
  FollowButton, SaveListButton, ListMetrics, CatalogueSheet, RecordSheet, ExploreView, SearchOverlay,
  MobileSearch, BarcodeScanner y ArtistView, y la red final de useCatalogueSearch usa useWriteBlocked.
- `npx tsc --noEmit` limpio.

DICE: Una sola regla para volver del login y un solo portero para escribir; F4 queda bien atada. APROBADO.
