# Base de datos

Todo está escrito y versionado; solo falta un proyecto donde aplicarlo.

## Arrancar el proyecto

1. Crea un proyecto en [supabase.com](https://supabase.com) (región Europa).
2. Copia `.env.example` a `.env.local` y rellena `NEXT_PUBLIC_SUPABASE_URL` y
   `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Project Settings → API).
   `SUPABASE_SERVICE_ROLE_KEY` solo hace falta para importar discos al catálogo.
3. Aplica las migraciones, en orden:

   ```bash
   npx supabase link --project-ref <ref-del-proyecto>
   npx supabase db push
   ```

   O pégalas a mano en el SQL Editor, de la 0001 a la 0004.

4. Activa Google en Authentication → Providers, con la URL de retorno
   `https://<tu-dominio>/auth/callback` (y `http://localhost:3000/auth/callback`
   para desarrollo).

Mientras no existan esas variables, la app funciona sobre `localStorage`
exactamente igual que hasta ahora: `lib/data/index.ts` elige el backend.

## Qué hay en cada migración

| Fichero | Contenido |
|---|---|
| `0001_init.sql` | Tablas, tipos e índices. Incluye `list_items(release_id)`, el índice que sostiene el descubrimiento. |
| `0002_rules.sql` | Reglas que no pueden vivir en el cliente: alta de usuario (perfil + listas predefinidas), exclusividad de deseos, contadores, protección de listas predefinidas. |
| `0003_rls.sql` | Row Level Security. Todo niega por defecto; una lista privada no se filtra ni con un fallo en la interfaz. |
| `0004_bridge.sql` | El puente: `lists_with_release`, `friends_with_release` y búsqueda de personas. |
| `0005_catalogue_writes.sql` | Quién amplía el catálogo: con sesión puedes añadir un disco nuevo, nadie puede modificarlo después. |

## Decisiones que conviene no deshacer

- **El catálogo es compartido y solo se escribe desde el servidor.** Si cada
  usuario tuviera su copia de cada disco, la pregunta "¿quién más lo tiene?"
  dejaría de tener respuesta.
- **Mi Colección es derivada** (biblioteca menos deseados) y no se almacena:
  no puede desincronizarse de lo que realmente tienes.
- **Las reglas de negocio están en triggers**, no en el cliente: cualquier
  cliente futuro (app móvil, script de importación) las hereda gratis.

## Panel de administración

Vive en `/admin`, detrás de una contraseña única (`ADMIN_PASSWORD`, mínimo 8
caracteres). La cookie de sesión guarda una firma HMAC, no la contraseña, es
`httpOnly` y caduca a las 8 horas.

Las lecturas del panel usan `SUPABASE_SERVICE_ROLE_KEY` porque tiene que ver
también lo privado para poder moderarlo. Sin esa variable, el panel entra pero
avisa de que no puede leer.
