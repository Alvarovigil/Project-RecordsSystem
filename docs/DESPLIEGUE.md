# Poner Rackr en rackr.club

Next.js con renderizado en servidor y nueve rutas de API. **No puede correr en
hosting compartido**: necesita Node ejecutándose, no Apache sirviendo ficheros.
Hostinger se queda como dueño del dominio; Vercel ejecuta la aplicación.

El orden importa. Cada paso deja algo que el siguiente necesita.

---

## 1 · Terminar la base de datos

El proyecto `bokrdlsqnwfqijpsiytn` ya tiene aplicadas las migraciones 0001–0006.
Falta la **0007** (colaboradores, avisos y las políticas de escritura
reescritas). Sin ella, invitar a una lista y la bandeja «Para ti» fallan.

```bash
npx supabase login                                  # abre el navegador, una vez
npx supabase link --project-ref bokrdlsqnwfqijpsiytn  # pide la contraseña de la BD
```

> **Ojo con el historial.** Si las 0001–0006 se aplicaron pegando SQL en el panel
> —y todo apunta a que sí, porque para eso existe `supabase/apply-all.sql`— la
> CLI no lo sabe: su tabla de historial está vacía e intentará aplicarlas otra
> vez, fallando con «type already exists». Se le dice que ya están:
>
> ```bash
> npx supabase migration repair --status applied 0001 0002 0003 0004 0005 0006
> npx supabase db push        # ahora solo corre la 0007
> ```

**Camino alternativo, sin CLI:** pegar `supabase/migrations/0007_collaboration.sql`
en el editor SQL del panel. `supabase/apply-all.sql` contiene el esquema entero
por si algún día hay que levantar un proyecto desde cero.

Comprobación de que ha entrado:

```bash
curl -s -o /dev/null -w '%{http_code}\n' \
  "https://bokrdlsqnwfqijpsiytn.supabase.co/rest/v1/notifications?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
# 404 = la tabla no existe todavía · 200 o 401 = existe
```

---

## 2 · Desplegar en Vercel

1. Entrar en vercel.com con la cuenta de GitHub e importar
   `Alvarovigil/Project-RecordsSystem`.
2. No hay nada que configurar en el build: Vercel detecta Next.js y acierta.
3. Las variables de entorno, antes del primer despliegue:

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://bokrdlsqnwfqijpsiytn.supabase.co` | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | la de `.env.local` | pública por diseño; RLS es quien protege |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | **hoy está vacía**. Sin ella no se importan discos al catálogo |
| `DISCOGS_TOKEN` | la de `.env.local` | |
| `ADMIN_PASSWORD` | una nueva, larga | no reutilizar la de desarrollo |
| `NEXT_PUBLIC_SITE_URL` | `https://rackr.club` | sin esto, los enlaces compartidos apuntan a localhost |

`NEXT_PUBLIC_FAKE_SESSION` **no se pone en Vercel**. Aunque se colara, es inerte
en un build de producción (ver `lib/dev-session.ts`), pero no hay razón para
tenerla ahí.

---

## 3 · Apuntar el dominio

Hoy `rackr.club` está aparcado: resuelve a `204.69.207.1` con los nameservers
`ns1/ns2.dns-parking.com` de Hostinger.

En Vercel, Settings → Domains → añadir `rackr.club` y `www.rackr.club`. Vercel
dará los registros exactos; normalmente son:

| Tipo | Nombre | Valor |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com` |

Se ponen en Hostinger → Dominios → DNS, **sustituyendo** el registro A del
parking. Los nameservers se quedan en Hostinger.

> **Antes de tocar el DNS:** si `rackr.club` tiene correo (registros MX), no se
> tocan. Cambiar solo el A y el CNAME. Borrar los MX por accidente deja el correo
> caído sin avisar y sin error visible.

El certificado HTTPS lo emite Vercel solo, unos minutos después de que el DNS
propague.

---

## 4 · El login de Google

Ahora mismo la única forma de entrar. Hay que decirle a los dos lados que el
dominio existe:

- **Supabase** → Authentication → URL Configuration
  - Site URL: `https://rackr.club`
  - Redirect URLs: `https://rackr.club/auth/callback`
- **Google Cloud Console** → el cliente OAuth → orígenes autorizados
  - `https://rackr.club`
  - y como URI de redirección, la de Supabase:
    `https://bokrdlsqnwfqijpsiytn.supabase.co/auth/v1/callback`

Sin esto, entrar devuelve a `/?auth=error&reason=…` y no dice por qué de forma
útil, que es el fallo más habitual del primer despliegue.

---

## 5 · Comprobar que está vivo

```bash
for u in "" coleccion feed explorar u/vera robots.txt sitemap.xml; do
  printf "%-16s %s\n" "/$u" "$(curl -s -o /dev/null -w '%{http_code}' -L https://rackr.club/$u)"
done
```

Y a mano, porque no sale en un `curl`:

- Entrar con Google y volver a `/coleccion` con la sesión puesta.
- Buscar un disco y añadirlo: prueba a la vez Discogs, la service role y RLS.
- Invitar a alguien a una lista: prueba la 0007.
- Abrirlo en el móvil y añadirlo a la pantalla de inicio: debe arrancar sin la
  barra del navegador y respetar el notch.

---

## Lo que se romperá antes que nada

No es el servidor. Con 500 usuarios el techo son otras dos cosas:

1. **El token de Discogs.** Es uno solo para toda la red y Discogs permite 60
   peticiones por minuto *en total*. La búsqueda solo cachea 60 segundos
   (`app/api/discogs/search/route.ts`). Cuando empiecen los 429, la salida es
   cachear los resultados en Supabase, no cambiar de hosting.
2. **El audio pasa por el servidor.** `/api/preview` transmite los previews a
   través de la app, así que cada reproducción es transferencia tuya. Con 500
   usuarios son unos 14 GB al mes, cómodo dentro de los 100 GB del plan gratis.

Sobre el plan: en Hobby no hay factura sorpresa —Vercel limita o pausa, no
cobra excedentes—. El límite que sí aplica es que **Hobby prohíbe el uso
comercial**: el día que Rackr cobre o lleve publicidad, son 20 $/mes de Pro.
