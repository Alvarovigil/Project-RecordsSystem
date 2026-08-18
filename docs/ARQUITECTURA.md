# Rackr — arquitectura objetivo

Red social de colecciones de vinilos: cada usuario tiene sus listas, sigue a otras
personas y a listas concretas, y usa cada disco como **puente** para descubrir en qué
listas ajenas aparece (el mecanismo de are.na).

Stack acordado: **Next.js 14 (App Router) + Supabase** (Postgres, Auth, Storage, RLS).

Estado actual: app cliente pura. Catálogo en `data/vinilos.json`, listas en
`localStorage`. Nada de esto se tira; se migra.

---

## 1. Modelo de datos

La decisión estructural es que **el catálogo de discos es global y compartido**, no una
copia por usuario. Sin eso no existe la pregunta "¿en qué listas está este disco?",
que es el corazón del producto.

```
profiles          id (=auth.users.id), username (único, citext), display_name,
                  bio, avatar_url, created_at

releases          id, slug (único), discogs_id (único, nullable), title, artist,
                  year, genre, label, country, cover_url, palette jsonb,
                  preview_url, tracklist jsonb, created_at
                  → catálogo canónico, escritura solo vía servidor

lists             id, owner_id → profiles, title, slug, description,
                  kind ('collection' | 'wishlist' | 'custom'),
                  visibility ('public' | 'unlisted' | 'private'),
                  sort_by, position, item_count, created_at
                  único (owner_id, slug)

list_items        list_id, release_id, position, note, added_at
                  PK (list_id, release_id)

follows           follower_id, following_id        PK (follower_id, following_id)
list_follows      user_id, list_id                 PK (user_id, list_id)
```

Índices que sostienen las vistas clave:

- `list_items (release_id)` → **el puente**: dado un disco, qué listas lo contienen.
- `list_items (list_id, position)` → render de una lista en orden.
- `lists (owner_id)`, `follows (following_id)`, `profiles (username)`.

`item_count` en `lists` se mantiene con trigger: contar en cada render de un perfil con
muchas listas es el primer sitio donde esto se hace lento.

### RLS (el motivo principal de elegir Supabase)

- `profiles`: lectura pública; escritura solo del propio `id`.
- `lists`: lectura si `visibility <> 'private'` **o** `owner_id = auth.uid()`; escritura solo del dueño.
- `list_items`: hereda la visibilidad de su lista vía subconsulta; escritura solo del dueño.
- `releases`: lectura pública; escritura solo con `service_role` (rutas de servidor).
- `follows` / `list_follows`: lectura pública, escritura solo de la propia fila.

Con esto, una consulta desde el cliente nunca puede filtrar listas privadas aunque el
código de la UI se equivoque.

---

## 2. Rutas

```
/                         tu estantería (3D / cuadrícula)      [sesión]
/u/[username]             perfil: listas, contadores, seguir
/u/[username]/[list]      una lista pública
/disco/[slug]             ficha del disco + "aparece en N listas"  ← el puente
/buscar                   discos, usuarios y listas
/feed                     novedades de a quién sigues
/ajustes                  cuenta, username, avatar, privacidad por defecto

/api/discogs/*            ya existe — búsqueda e importación al catálogo
/api/preview              ya existe — proxy de audio (arregla el MIME de Apple)
```

La ficha de `/disco/[slug]` es la pieza nueva de descubrimiento: info del disco,
listas que lo contienen (excluyendo privadas, ordenadas por seguidores), y desde ahí
saltas a la lista o al perfil.

---

## 2 bis. Qué existe ya

| Superficie | Ruta | Estado |
|---|---|---|
| Landing | `/` | Hecha. Redirige a `/inicio` si hay sesión. |
| Inicio social | `/inicio` | Hecho: movimientos de quien sigues, tus listas, comunidad. |
| Tu colección | `/coleccion` | Hecha (3D + cuadrícula, reproducción, listas). |
| Demo sin cuenta | `/demo` | Hecha. Todo funciona contra `localStorage`. |
| Perfil público | `/u/[usuario]` | Hecho: listas, seguidores, siguiendo, seguir. |
| Lista pública | `/u/[usuario]/[lista]` | Hecha, con seguir lista y metadatos para compartir. |
| Explorar | `/explorar` | Hecha: listas destacadas y gente, con buscador. |
| Novedades | `/feed` | Hecha: lo que añaden quienes sigues. |
| Ajustes | `/ajustes` | Hechos: usuario, nombre, bio, sesión. |
| Panel admin | `/admin` | Hecho, tras contraseña. |

### La carcasa

Todo lo de dentro (`app/(app)/…`) comparte un mismo armazón: barra superior
fija —Inicio · Colección · Explorar · tu cuenta— y el reproductor, que vive en
el layout y por tanto **no se detiene al navegar**. Esa continuidad es lo que
convierte un conjunto de páginas en un sitio.

La estantería 3D no tiene barra propia: sus controles (vista y buscador) se
alojan en la misma fila que la navegación. Y su reproductor sigue estando en la
escena, así que ahí el mini reproductor se oculta: dos mandos para el mismo
sonido son peores que uno.

### Reglas sociales que ya están decididas

- **Seguir personas y seguir listas son cosas distintas.** Una lista ajena
  aparece en tu panel bajo su propio epígrafe, marcada con quién la hizo. No se
  mezcla con las tuyas: mezclarlas emborrona de quién es cada colección.
- **Cada lista es pública, con enlace o privada.** La de deseos nace privada.
- **El flujo agrupa por persona y lista**: "Marta añadió 4 discos a Sonido de
  sótano" es un hecho; cuatro líneas sueltas son ruido con fecha.
- **Lo público se renderiza en servidor** para poder compartirse; lo que ve
  cada visitante lo decide RLS, nunca el cliente.

## 3. Fases

**F0 — ahora (sin backend).** Seguimos puliendo la experiencia: estantería, cuadrícula,
reproducción, microinteracciones. Todo lo que se escriba aquí debe respetar las reglas
de la sección 4 para que la migración sea mecánica.

**F1 — cimientos.** Proyecto Supabase, esquema + RLS, seed de `releases` desde
`data/vinilos.json` (el `id` actual ya sirve como `slug`). Auth con email + OAuth.
Migración: al primer login, las listas de `localStorage` suben a la cuenta.

**F2 — identidad.** Perfil público, `/ajustes`, avatar en Storage, visibilidad por lista.

**F3 — social.** Follows de usuarios y de listas, `/disco/[slug]` con el puente de
listas, búsqueda de usuarios y listas.

**F4 — flujo.** Feed de a quién sigues, listas destacadas, notas por disco dentro de
una lista, contadores y descubrimiento.

---

## 4. Reglas para lo que toquemos en F0

Para que F1 sea una migración y no una reescritura:

1. **Un solo módulo de acceso a datos.** Todo lo que hoy lee o escribe `localStorage`
   vive en `lib/collections.ts`. Los componentes no tocan `localStorage` jamás; reciben
   datos por props y avisan por callbacks. En F1 ese módulo pasa a hablar con Supabase y
   los componentes no se enteran.
2. **Los ids se respetan.** `vinyl.id` (`tame-impala-currents-7252111`) será el `slug`
   de `releases`. No inventar ids nuevos ni cambiar el formato.
3. **Todo lo que sea "de usuario" se piensa en plural.** Una lista tiene dueño aunque
   hoy solo haya uno: nada de asumir "mi colección" como global.
4. **Los componentes de vista son tontos.** `VinylShelf3D`, `VinylGrid` y las overlays
   reciben `vinilos` y callbacks. Así sirven igual para tu estantería que para la de
   otra persona en `/u/[username]`.
5. **Las URLs remotas pasan por rutas de servidor** (como `/api/preview`), no se
   consumen directas desde el cliente. Evita sorpresas de CORS, MIME y claves.
