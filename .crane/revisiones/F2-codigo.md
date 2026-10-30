# F2 · Permisos — revisión de código (Weaver)

Rama `fix/permisos` contra `main`, con 0020 sin seguimiento. `npx tsc --noEmit`: limpio (exit 0).
`next lint` no tiene configuración (pide el asistente interactivo): ya pasaba antes de esta fase.

```
VEREDICTO: BLOQUEADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- app/auth/callback/route.ts:17 — la vuelta del login sigue siendo una redirección abierta. "/\evil.com"
  empieza por "/" y no por "//", así que pasa el filtro, y new URL("/\evil.com", origin) resuelve a
  https://evil.com/ porque el parser WHATWG trata "\" como "/" (comprobado con node; "/\/evil.com" igual).
  Basta con que la víctima termine un login con next=/%5Cevil.com en el redirect_to. Debería resolverse
  y compararse el origen:
    const target = new URL(asked || "/coleccion", req.nextUrl.origin);
    const next = target.origin === req.nextUrl.origin
      ? target.pathname + target.search + target.hash : "/coleccion";
    ... NextResponse.redirect(new URL(next, req.nextUrl.origin))
MEJORA:
- supabase/migrations/0020_permisos.sql:17-18 — el comentario dice que los triggers «corren como dueños
  de las tablas». No es así en Postgres: corren con los permisos de quien escribe, salvo SECURITY DEFINER.
  Hoy funciona porque sync_list_item_count, sync_list_like_count y sync_list_save_count son SECURITY
  DEFINER, y touch_updated_at solo toca NEW en un BEFORE (eso no pasa por privilegios de columna). Hay
  que corregir el comentario y dejar escrito que todo trigger que escriba una columna protegida en OTRA
  fila tiene que ser SECURITY DEFINER; si no, el siguiente contador se rompe en silencio.
- list_collaborators INSERT (0007_collaboration.sql:92-94, sin tocar en 0020): el dueño puede insertar la
  invitación ya con status='accepted' y meter a alguien de editor sin su consentimiento (le llegan avisos y
  sale como coautor). Mismo patrón que lo que cierra esta fase: grant insert (list_id, user_id, invited_by)
  y nada más. De paso, guard_invitation_answer deja pasar declined→accepted cuando quiera el invitado;
  decidir si una invitación rechazada se puede reabrir.
- Columnas futuras: con privilegios por columna, toda columna que se añada a profiles/lists/list_items
  nace sin escritura del cliente, y un «grant all» en una migración futura lo reabre todo. Apuntarlo en
  docs/equipo/arquitectura.md (sección de seguridad) como regla.
- components/AccountMenu.tsx:98 — el enlace al panel sigue decidiéndose por username === "rackrclub". No es
  un agujero (la puerta la guarda isAdmin en el servidor), pero ya no es la misma regla: exponer el id del
  admin (o un flag desde el servidor) para que las dos digan lo mismo.
- lib/admin/auth.ts:70 — ADMIN_USER_ID no está en .env.example, y el uuid por defecto es el de producción:
  documentarlo y confirmar en producción que d2b6968d-… es de verdad @rackrclub antes de desplegar, o el
  panel se queda sin dueño.
- Comportamiento nuevo, correcto pero que conviene saber: con stamp_added_by, notify_on_collab_add vuelve a
  disparar (antes added_by llegaba null y no avisaba nunca). En racks no compartidos no inserta nada.
  enforce_wishlist_exclusivity y la política de borrado no cambian; un editor ya puede quitar lo que él puso.
  Las filas antiguas siguen con added_by null.
- npm audit --omit=dev: nanoid (high), fflate y colord (moderate), con arreglo disponible. Previo a esta
  fase; una pasada de npm audit fix en una rama aparte.
```

Comprobado y bien: todas las escrituras del cliente (lib/data/supabase.ts, components/Onboarding.tsx,
lib/migrate.ts vía el repositorio) usan solo columnas con permiso; el único upsert sobre las tablas tocadas
(addToList) es ahora ON CONFLICT DO NOTHING y no necesita UPDATE; duplicateList manda added_by pero el
trigger lo pisa; bump_discogs_cache solo se llama con getSupabaseAdminClient (service_role conserva
EXECUTE); verified solo lo escribe app/api/admin/actions con la clave de servicio; «Salir» por POST sin
rastro del GET antiguo; isAdmin compara el id que devuelve getUser.

DICE: Las columnas quedan bien cosidas; queda un hilo suelto: «/\evil.com» todavía saca a la gente de rackr.club al volver del login.

---

## Re-revisión

```
VEREDICTO: APROBADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (ninguno)
MEJORA:
- app/auth/callback/route.ts:17 — new URL lanza con un next malformado ("http://[", "https://a b"):
  la vuelta del login da un 500 en vez de ir a /coleccion. No deja salir de la web; envolverlo en
  try/catch con "/coleccion" de respaldo.
- Siguen abiertos, como se acordó, para otra fase: AccountMenu.tsx:98 (enlace al panel por username),
  ADMIN_USER_ID sin documentar en .env.example y npm audit (nanoid high).
```

Comprobado: el callback compara el origen después de resolver la URL; 0020 corrige el comentario y deja la
regla de SECURITY DEFINER y de columnas nuevas; el insert de list_collaborators queda en (list_id, user_id,
invited_by) y la única inserción de la app (lib/data/supabase.ts:1000-1001) manda exactamente esas tres
columnas. `npx tsc --noEmit` limpio. No he tocado el contenedor rackr-pg.

DICE: Costura cerrada: la vuelta del login ya no sale de casa y las invitaciones nacen pendientes. APROBADO.
