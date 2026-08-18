-- ============================================================================
-- El puente: consultas de descubrimiento a partir de un disco.
--
-- Son funciones SECURITY INVOKER a propósito: heredan las políticas de quien
-- pregunta, así que una lista privada nunca aparece aquí por accidente.
-- ============================================================================

-- Listas de la comunidad que contienen un disco, las más seguidas primero.
create or replace function public.lists_with_release(
  target_release uuid,
  max_rows int default 12
)
returns table (
  list_id     uuid,
  title       text,
  description text,
  owner_id    uuid,
  owner_name  text,
  owner_handle citext,
  item_count  int,
  followers   bigint,
  updated_at  timestamptz
)
language sql
stable
as $$
  select l.id, l.title, l.description, l.owner_id, p.display_name, p.username,
         l.item_count,
         (select count(*) from public.list_follows lf where lf.list_id = l.id),
         l.updated_at
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.profiles p on p.id = l.owner_id
  where li.release_id = target_release
    and l.visibility = 'public'
    and l.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by 8 desc, l.updated_at desc
  limit max_rows;
$$;

-- Personas a las que sigues que tienen el disco, y en qué lista suya está.
create or replace function public.friends_with_release(target_release uuid)
returns table (
  user_id     uuid,
  display_name text,
  username    citext,
  avatar_url  text,
  list_id     uuid,
  list_title  text
)
language sql
stable
as $$
  select distinct on (p.id)
         p.id, p.display_name, p.username, p.avatar_url, l.id, l.title
  from public.follows f
  join public.profiles p on p.id = f.following_id
  join public.lists l on l.owner_id = p.id and l.visibility <> 'private'
  join public.list_items li on li.list_id = l.id
  where f.follower_id = auth.uid()
    and li.release_id = target_release
  order by p.id, l.item_count desc;
$$;

-- Buscar personas por nombre o usuario.
create or replace function public.search_profiles(q text, max_rows int default 20)
returns setof public.profiles
language sql
stable
as $$
  select * from public.profiles
  where username ilike '%' || q || '%'
     or display_name ilike '%' || q || '%'
  order by display_name
  limit max_rows;
$$;
