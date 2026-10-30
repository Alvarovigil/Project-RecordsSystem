-- ============================================================================
-- Lo que cada uno puede escribir, columna a columna.
--
-- Las políticas de 0003 y 0007 dicen QUÉ FILAS puedes tocar, pero no QUÉ
-- COLUMNAS de esas filas. Y en cuatro sitios esa diferencia era un agujero:
--
--   · profiles: tu fila es tuya, así que podías ponerte `verified = true`.
--   · lists: tu rack es tuyo, así que podías escribir sus contadores de
--     guardadas y me gusta, que son con lo que se ordena Explorar.
--   · list_items: como editor de un rack ajeno podías reescribir `added_by`
--     de un disco del dueño y, con eso, borrarlo.
--   · list_collaborators: tu invitación es tuya, así que al «aceptarla» podías
--     cambiarle el `list_id` y entrar en cualquier rack, privados incluidos.
--
-- Los tres primeros se cierran con privilegios por columna: Postgres deja
-- escribir solo las columnas que se nombran. Lo que mantiene la propia base de
-- datos sigue funcionando: los contadores los escriben triggers SECURITY
-- DEFINER (corren como dueños de la tabla), y `updated_at` lo pone un trigger
-- BEFORE en la misma fila, que no pasa por los permisos de columna.
--
-- REGLA desde aquí: un trigger que escriba una columna protegida en OTRA fila
-- tiene que ser SECURITY DEFINER. Y toda columna nueva en estas tablas nace sin
-- escritura del cliente; si la app la necesita, se le da con su propio grant.
-- Un «grant all» sobre ellas en una migración futura lo reabre todo.
--
-- El cuarto necesita comparar el antes y el después, y eso solo lo hace un
-- trigger.
--
-- Nada de esto borra ni cambia datos.
-- ============================================================================

-- ------------------------------------------------------------- profiles ----
revoke insert, update on public.profiles from anon, authenticated;
grant update (username, display_name, bio, avatar_url, onboarded_at)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------- lists ----
revoke insert, update on public.lists from anon, authenticated;
grant insert (owner_id, title, slug, description, kind, visibility, sort_by, position)
  on public.lists to authenticated;
grant update (title, slug, description, visibility, sort_by, position)
  on public.lists to authenticated;

-- ----------------------------------------------------------- list_items ----
-- Ni al insertar se elige la fecha: `added_at` ordena la actividad de quien te
-- sigue, y una fecha en 2099 te dejaría arriba para siempre. (`added_by` se
-- acepta porque el trigger de abajo la pisa con la sesión.)
revoke insert, update on public.list_items from anon, authenticated;
grant insert (list_id, release_id, position, note, added_by) on public.list_items to authenticated;
grant update (position, note) on public.list_items to authenticated;

-- Quitar lo que pusiste es cosa de quien sigue siendo editor. Hasta ahora no se
-- notaba porque `added_by` llegaba vacío; con el trigger de abajo siempre va
-- relleno, y un editor expulsado podía seguir quitando lo suyo.
drop policy if exists "quitas lo tuyo, o cualquier cosa si es tu lista" on public.list_items;
create policy "quitas lo tuyo, o cualquier cosa si es tu lista"
  on public.list_items for delete
  using (public.owns_list(list_id) or (added_by = auth.uid() and public.can_write_list(list_id)));

-- ---------------------------------------------- seguir, guardar, me gusta --
-- Lo mismo con las fechas de seguir, guardar y dar me gusta.
revoke insert, update on public.follows from anon, authenticated;
grant insert (follower_id, following_id) on public.follows to authenticated;
revoke insert, update on public.list_follows from anon, authenticated;
grant insert (user_id, list_id) on public.list_follows to authenticated;
revoke insert, update on public.list_likes from anon, authenticated;
grant insert (user_id, list_id) on public.list_likes to authenticated;

-- Un me gusta a un rack que no puedes ver subía su contador y avisaba al dueño.
drop policy if exists "das me gusta como tú" on public.list_likes;
create policy "das me gusta como tú"
  on public.list_likes for insert
  with check (user_id = auth.uid() and public.can_read_list(list_id));

-- --------------------------------------------- listas predefinidas a salvo --
-- La colección y los deseos no se borran a mano, pero sí con su dueño: al
-- eliminar una cuenta, el borrado en cascada llegaba aquí y lo paraba todo, y
-- «Eliminar cuenta» del panel no funcionaba para nadie.
create or replace function public.protect_primary_lists()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.kind in ('collection', 'wishlist')
     and exists (select 1 from public.profiles where id = old.owner_id) then
    raise exception 'Las listas predefinidas no se pueden eliminar';
  end if;
  if tg_op = 'UPDATE' and old.kind <> new.kind then
    raise exception 'La naturaleza de una lista no se puede cambiar';
  end if;
  return coalesce(new, old);
end;
$$;

-- Quién puso un disco lo dice la sesión, no quien escribe la fila. Así la
-- autoría no se puede falsear al insertar, y además queda siempre apuntada:
-- hasta ahora la app no la mandaba, y sin ella ni llegaban los avisos de un
-- rack compartido ni un editor podía quitar lo que él mismo había puesto.
create or replace function public.stamp_added_by()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if auth.uid() is not null then
    new.added_by := auth.uid();
  end if;
  return new;
end;
$$;

drop trigger if exists list_items_stamp_added_by on public.list_items;
create trigger list_items_stamp_added_by
  before insert on public.list_items
  for each row execute function public.stamp_added_by();

-- --------------------------------------------------- list_collaborators ----
-- Invitar es proponer: la invitación nace pendiente y solo la acepta el
-- invitado. Sin esto, el dueño podía meter a alguien de editor directamente.
revoke insert on public.list_collaborators from anon, authenticated;
grant insert (list_id, user_id, invited_by) on public.list_collaborators to authenticated;

-- Responder a una invitación cambia su estado y nada más. (Cambiar de idea —
-- aceptar una que rechazaste— se permite: sigue siendo su invitación.)
create or replace function public.guard_invitation_answer()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- `invited_by` puede quedarse vacío: es lo que hace la base de datos sola
  -- cuando se borra la cuenta de quien invitó, y eso no es manipular nada.
  if new.list_id    is distinct from old.list_id
  or new.user_id    is distinct from old.user_id
  or new.role       is distinct from old.role
  or new.created_at is distinct from old.created_at
  or (new.invited_by is distinct from old.invited_by and new.invited_by is not null) then
    raise exception 'Una invitación solo se acepta o se rechaza.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists list_collaborators_guard on public.list_collaborators;
create trigger list_collaborators_guard
  before update on public.list_collaborators
  for each row execute function public.guard_invitation_answer();

-- --------------------------------------------------- funciones internas ----
-- La caché del catálogo la usan solo las rutas del servidor, con la clave de
-- servicio. Desde fuera nadie tiene por qué inflar sus contadores ni vaciarla.
revoke execute on function public.bump_discogs_cache(text) from public, anon, authenticated;
revoke execute on function public.purge_discogs_cache() from public, anon, authenticated;
