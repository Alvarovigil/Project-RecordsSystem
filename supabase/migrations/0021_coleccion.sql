-- ============================================================================
-- «Mi Colección» es lo que tienes.
--
-- En el navegador siempre fue así: la colección se calculaba (todo lo tuyo
-- menos los deseos). Con cuenta es una lista guardada, y nadie la mantenía:
-- guardar un disco en «Jazz para el domingo» lo dejaba en ese rack y fuera de
-- tu colección. El perfil decía 105 discos y la estantería enseñaba 106, y
-- subir tu colección del navegador perdía los que no estaban en ningún rack.
--
-- Desde aquí, meter un disco en uno de tus racks lo mete también en tu
-- colección (si no estaba en deseos: entonces el propio trigger de deseos lo
-- saca de ahí, porque ya lo tienes). Quitarlo de un rack no lo saca de la
-- colección: sigue siendo tuyo.
--
-- Y el puente devuelve la dirección real de cada rack: inventarla a partir del
-- título fallaba con «Mi Colección», cuya dirección es «coleccion».
-- ============================================================================

-- ------------------------------------------------------ la colección -------
create or replace function public.keep_in_collection()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rack public.lists%rowtype;
  collection uuid;
begin
  select * into rack from public.lists where id = new.list_id;
  if rack.kind <> 'custom' then
    return new;
  end if;
  -- Un rack compartido es de su dueño: lo que mete un invitado no pasa a ser
  -- de la colección de nadie.
  if new.added_by is not null and new.added_by <> rack.owner_id then
    return new;
  end if;

  select id into collection
  from public.lists
  where owner_id = rack.owner_id and kind = 'collection';
  if collection is null then
    return new;
  end if;

  insert into public.list_items (list_id, release_id, position, added_at, added_by)
  values (
    collection,
    new.release_id,
    (select count(*) from public.list_items where list_id = collection),
    new.added_at,
    new.added_by
  )
  on conflict (list_id, release_id) do nothing;

  return new;
end;
$$;

drop trigger if exists list_items_keep_in_collection on public.list_items;
create trigger list_items_keep_in_collection
  after insert on public.list_items
  for each row execute function public.keep_in_collection();

-- Lo que ya estaba en un rack y no en la colección, a la colección, con la
-- fecha en que entró en el rack (no la de hoy: si no, la actividad de todos
-- diría que esta tarde se añadieron cien discos). Lo que está en deseos se
-- queda en deseos.
insert into public.list_items (list_id, release_id, position, added_at, added_by)
select c.id,
       li.release_id,
       c.item_count + row_number() over (partition by c.id order by min(li.added_at)) - 1,
       min(li.added_at),
       l.owner_id
from public.list_items li
join public.lists l on l.id = li.list_id and l.kind = 'custom'
join public.lists c on c.owner_id = l.owner_id and c.kind = 'collection'
where not exists (
        select 1 from public.list_items x where x.list_id = c.id and x.release_id = li.release_id
      )
  -- La misma regla que el trigger: solo lo que puso el dueño. Antes de 0020 la
  -- autoría llegaba vacía, así que un disco sin autor solo cuenta como suyo si
  -- el rack nunca tuvo editores.
  and (li.added_by = l.owner_id
       or (li.added_by is null and not exists (
             select 1 from public.list_collaborators lc
             where lc.list_id = l.id and lc.status = 'accepted')))
  and not exists (
        select 1 from public.list_items w
        join public.lists wl on wl.id = w.list_id and wl.kind = 'wishlist'
        where wl.owner_id = l.owner_id and w.release_id = li.release_id
      )
group by c.id, c.item_count, li.release_id, l.owner_id
on conflict (list_id, release_id) do nothing;

-- ------------------------------------------------- deseos de su dueño ------
-- Lo que mete un invitado en un rack compartido no es de nadie (arriba), así
-- que tampoco puede sacarle un deseo al dueño: antes salía de sus deseos sin
-- entrar en su colección, y lo perdía. Solo el dueño mueve sus discos entre
-- deseos y lo que tiene.
create or replace function public.enforce_wishlist_exclusivity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_kind list_kind;
  target_owner uuid;
begin
  select kind, owner_id into target_kind, target_owner
  from public.lists where id = new.list_id;

  if new.added_by is not null and new.added_by <> target_owner then
    return new;
  end if;

  if target_kind = 'wishlist' then
    -- entra en deseos: sale de todas las demás listas del dueño
    delete from public.list_items li
    using public.lists l
    where li.list_id = l.id
      and l.owner_id = target_owner
      and l.kind <> 'wishlist'
      and li.release_id = new.release_id;
  else
    -- entra en cualquier otra: sale de deseos
    delete from public.list_items li
    using public.lists l
    where li.list_id = l.id
      and l.owner_id = target_owner
      and l.kind = 'wishlist'
      and li.release_id = new.release_id;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------- el puente -------
drop function if exists public.lists_with_release(uuid, int);
create or replace function public.lists_with_release(
  target_release uuid,
  max_rows int default 12
)
returns table (
  list_id     uuid,
  title       text,
  slug        text,
  description text,
  owner_id    uuid,
  owner_name  text,
  owner_handle citext,
  item_count  int,
  saves       int,
  likes       int,
  updated_at  timestamptz
)
language sql
stable
as $$
  select l.id, l.title, l.slug, l.description, l.owner_id, p.display_name, p.username,
         l.item_count, l.save_count, l.like_count, l.updated_at
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.profiles p on p.id = l.owner_id
  where li.release_id = target_release
    and l.visibility = 'public'
    and l.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by (l.save_count * 3 + l.like_count) desc, l.updated_at desc
  limit max_rows;
$$;
