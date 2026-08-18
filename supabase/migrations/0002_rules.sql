-- ============================================================================
-- Reglas de negocio que NO pueden vivir en el cliente
-- ============================================================================

-- ------------------------------------------------- alta de usuario nuevo ----
-- Cada cuenta nace con su perfil y sus dos listas predefinidas. Hacerlo en el
-- cliente dejaría cuentas a medio construir si falla la segunda llamada.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := regexp_replace(
    lower(coalesce(new.raw_user_meta_data->>'user_name',
                   split_part(new.email, '@', 1),
                   'usuario')),
    '[^a-z0-9_]', '', 'g'
  );
  if length(base_username) < 3 then
    base_username := 'usuario';
  end if;
  base_username := left(base_username, 20);

  final_username := base_username;
  while exists (select 1 from public.profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := left(base_username, 20) || suffix::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'full_name', final_username),
    new.raw_user_meta_data->>'avatar_url'
  );

  insert into public.lists (owner_id, title, slug, kind, visibility, position)
  values
    (new.id, 'Mi Colección', 'coleccion', 'collection', 'public', 0),
    (new.id, 'Lista de deseos', 'deseos', 'wishlist', 'private', 1);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- --------------------------------------------------- deseos excluyentes ----
-- Un disco está en propiedad O deseado, nunca ambos. Se aplica al insertar,
-- para cualquier cliente presente o futuro.
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

create trigger list_items_wishlist_exclusivity
  after insert on public.list_items
  for each row execute function public.enforce_wishlist_exclusivity();

-- ------------------------------------------------------ contadores y ts ----
-- item_count se mantiene solo: contar en cada render de un perfil con muchas
-- listas es el primer sitio donde esto se vuelve lento.
create or replace function public.sync_list_item_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.lists
       set item_count = item_count + 1, updated_at = now()
     where id = new.list_id;
  elsif tg_op = 'DELETE' then
    update public.lists
       set item_count = greatest(item_count - 1, 0), updated_at = now()
     where id = old.list_id;
  end if;
  return null;
end;
$$;

create trigger list_items_count
  after insert or delete on public.list_items
  for each row execute function public.sync_list_item_count();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger lists_touch_updated_at
  before update on public.lists
  for each row execute function public.touch_updated_at();

-- ------------------------------------------- listas predefinidas a salvo ----
-- Ni la colección ni los deseos se pueden borrar ni cambiar de naturaleza.
create or replace function public.protect_primary_lists()
returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' and old.kind in ('collection', 'wishlist') then
    raise exception 'Las listas predefinidas no se pueden eliminar';
  end if;
  if tg_op = 'UPDATE' and old.kind <> new.kind then
    raise exception 'La naturaleza de una lista no se puede cambiar';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger lists_protect_primary
  before update or delete on public.lists
  for each row execute function public.protect_primary_lists();
