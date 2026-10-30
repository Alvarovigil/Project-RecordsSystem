# F3 · Una sola «Mi Colección» y sin callejones — revisión de código (Weaver)

Rama `fix/coleccion-y-callejones` contra `main` (sin commitear; 0021, keepalive y vercel.json sin seguimiento).
`npx tsc --noEmit`: limpio (exit 0). No he tocado el contenedor rackr-pg.

```
VEREDICTO: BLOQUEADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- supabase/migrations/0021_coleccion.sql:72-89 — el backfill contradice la regla del trigger. El trigger
  (l.36-38) no mete en la colección del dueño lo que pone un invitado; el backfill mete en la colección del
  dueño TODO lo que hay en sus racks 'custom', compartidos incluidos. Es una escritura única sobre datos de
  producción y luego no se sabe qué entró por aquí. Además, antes de 0020 added_by llegaba siempre null, así
  que en los racks con editores no se puede saber quién puso cada disco. Debería quedar así:
    and (li.added_by = l.owner_id
         or (li.added_by is null and not exists (
               select 1 from public.list_collaborators lc
               where lc.list_id = l.id and lc.status = 'accepted')))
  Es decir: entra lo que puso el dueño, y lo que no tiene autor solo si el rack nunca fue compartido.
MEJORA:
- lib/activity.ts:108-110 — withoutEchoes reconoce la colección por slug === "coleccion", pero la colección
  se puede renombrar (CollectionsOverlay/ListEditSheet → renameList hace slug = slugify(title)). Tras un
  renombre vuelven los ecos. Que activity_for_me devuelva list_kind y comparar con kind === "collection".
- lib/data/supabase.ts:607 — el filtro va después del límite de 160 filas: con muchos racks, la mitad del
  presupuesto se va en ecos y la actividad enseña menos de lo que podría. Además, un eco cuya pareja cae fuera
  de las 160 se cuela. Lo sólido es quitarlos en activity_for_me (en SQL) y dejar withoutEchoes como red.
  Lo que se come de verdad (añadir a la colección y luego, en menos de 5 min, a un rack) cuenta como un solo
  gesto: aceptable.
- Semántica que conviene que Producto confirme: cualquier rack 'custom' del dueño ahora significa «lo
  tengo». Un rack tipo «Para comprar» llena la colección. Hasta ahora la respuesta del producto a eso es la
  lista de deseos; que quede dicho en el blueprint.
- lib/data/supabase.ts duplicateList (sin uso hoy en la UI): con el trigger nuevo, duplicar el rack de otra
  persona metería todos sus discos en tu colección. Si se conecta, que no pase por keep_in_collection o que se
  limite a racks propios.
- lib/migrate.ts:58-63 — la colección se sube disco a disco con dos idas y vueltas por disco (count +
  upsert), en serie: cientos de discos tardan. Sacar el find de WISHLIST_ID fuera del filter y, en otra fase,
  subir en lote. Idempotente gracias al ON CONFLICT, bien.
- components/Landing.tsx (AuthFailed): usa tokens (surface-overlay, text-sub, shadow-toast, content-*,
  --safe-top). Quedan z-[90] (el repo no tiene escala de z; mismo patrón que el resto) y el 16px dentro del
  calc: mejor un token de espaciado. El ?auth=error se queda en la URL y el aviso vuelve al recargar;
  router.replace("/") al cerrarlo.
- app/api/keepalive/route.ts — correcto y barato; vercel.json "0 6 * * *" vale en Hobby (una vez al día, con
  hasta una hora de holgura en la hora de disparo). Opcional: comprobar CRON_SECRET para que solo lo llame
  Vercel; hoy es una consulta pública igual que cualquier página.
```

Comprobado y bien:
- keep_in_collection es SECURITY DEFINER y cumple la regla de 0020.
- Orden de los AFTER INSERT (alfabético): count → keep_in_collection → notify_collab → wishlist_exclusivity.
  - La fila anidada en la colección dispara sus propios triggers: suma item_count, la exclusividad la saca
    de deseos y el aviso no encuentra a nadie.
  - stamp_added_by sigue viendo auth.uid() dentro del SECURITY DEFINER.
  - El ON CONFLICT de addToList no dispara nada.
- Backfill sin duplicados: group by (colección, disco) más ON CONFLICT. Posiciones al final, a partir de
  item_count y en orden de fecha. Conserva la added_at original.
- lists_with_release devuelve slug, igual que su versión de 0012 (sin grants propios, como entonces).
- /explorar existe en app/(app)/explorar.

DICE: La colección ya se teje sola; antes de correr el backfill, que no cosa al dueño los discos que puso un invitado.

---

## Re-revisión

```
VEREDICTO: APROBADO
BLOQUEA (archivo:línea, qué falla y cómo debería quedar):
- (ninguno)
MEJORA:
- Quedan para otra fase, como se acordó: ecos por kind y en SQL (lib/activity.ts, activity_for_me),
  «rack = lo tengo» (decisión de Álvaro), duplicateList con el trigger nuevo y migrate en lote.
- Nota: con «accepted» como condición, un rack cuyos editores se fueron (fila borrada) cuenta como nunca
  compartido y sus discos sin autor entran en la colección del dueño. No hay rastro con que distinguirlo;
  es la mejor aproximación posible.
```

Comprobado:
- 0021:82-88 aplica la condición del trigger (dueño, o sin autor y sin editores aceptados).
- AuthFailed limpia ?auth=error con history.replaceState al cerrar.
- `npx tsc --noEmit` limpio. No he tocado rackr-pg.

DICE: El backfill ya sigue la misma regla que el trigger: la colección solo recoge lo que el dueño puso. APROBADO.
