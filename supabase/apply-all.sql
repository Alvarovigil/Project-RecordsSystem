-- ============================================================================
-- Rackr — esquema inicial
--
-- Principios que sostienen todo lo demás:
--   1. El catálogo (releases) es compartido: un disco existe una sola vez para
--      toda la red. Es lo que permite preguntar "¿en qué listas ajenas está?".
--   2. Las listas tienen dueño y visibilidad propia; los permisos se aplican
--      con RLS, nunca confiando en la interfaz.
--   3. "Mi Colección" es derivada (biblioteca menos deseados) y la lista de
--      deseos es excluyente. Esa regla vive en un trigger, no en el cliente.
-- ============================================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "pg_trgm";

-- ---------------------------------------------------------------- enums ----
create type list_kind as enum ('collection', 'wishlist', 'custom');
create type list_visibility as enum ('public', 'unlisted', 'private');
create type sort_mode as enum (
  'custom', 'added', 'year', 'artist_az', 'artist_za', 'title_az', 'title_za'
);

-- ------------------------------------------------------------- profiles ----
create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  username     citext not null unique
                 check (username ~ '^[a-z0-9_]{3,24}$'),
  display_name text not null default '',
  bio          text not null default '',
  avatar_url   text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil público. Una fila por usuario autenticado, creada por trigger.';

-- ------------------------------------------------------------- releases ----
create table public.releases (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  discogs_id  bigint unique,
  title       text not null,
  artist      text not null,
  year        int,
  genre       text,
  label       text,
  country     text,
  cover_url   text,
  preview_url text,
  palette     jsonb not null default '[]'::jsonb,
  tracklist   jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  created_by  uuid references public.profiles(id) on delete set null
);

comment on table public.releases is
  'Catálogo canónico y compartido. Solo se escribe desde el servidor.';

create index releases_artist_idx on public.releases (artist);
create index releases_title_trgm_idx on public.releases using gin (title gin_trgm_ops);

-- ---------------------------------------------------------------- lists ----
create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  slug        text not null,
  description text not null default '',
  kind        list_kind not null default 'custom',
  visibility  list_visibility not null default 'public',
  sort_by     sort_mode not null default 'custom',
  position    int not null default 0,
  item_count  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (owner_id, slug)
);

-- una sola colección y una sola lista de deseos por persona
create unique index lists_one_primary_per_kind
  on public.lists (owner_id, kind)
  where kind in ('collection', 'wishlist');

create index lists_owner_idx on public.lists (owner_id, position);

-- ----------------------------------------------------------- list_items ----
create table public.list_items (
  list_id    uuid not null references public.lists(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  position   int not null default 0,
  note       text not null default '',
  added_at   timestamptz not null default now(),
  primary key (list_id, release_id)
);

-- EL PUENTE: dado un disco, qué listas lo contienen. Es la consulta que
-- sostiene el descubrimiento, así que tiene su propio índice.
create index list_items_release_idx on public.list_items (release_id);
create index list_items_order_idx on public.list_items (list_id, position);

-- -------------------------------------------------------------- social ----
create table public.follows (
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index follows_following_idx on public.follows (following_id);

create table public.list_follows (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  list_id    uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index list_follows_list_idx on public.list_follows (list_id);
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
-- ============================================================================
-- Row Level Security
--
-- Cada tabla niega por defecto. Una lista privada no puede filtrarse ni aunque
-- la interfaz se equivoque, porque el filtro vive en la base de datos.
-- ============================================================================

alter table public.profiles     enable row level security;
alter table public.releases     enable row level security;
alter table public.lists        enable row level security;
alter table public.list_items   enable row level security;
alter table public.follows      enable row level security;
alter table public.list_follows enable row level security;

-- Función auxiliar: ¿puede quien pregunta ver esta lista? SECURITY DEFINER
-- para no reevaluar la política de lists dentro de la de list_items.
create or replace function public.can_read_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lists l
    where l.id = target
      and (l.visibility <> 'private' or l.owner_id = auth.uid())
  );
$$;

create or replace function public.owns_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lists l
    where l.id = target and l.owner_id = auth.uid()
  );
$$;

-- ------------------------------------------------------------- profiles ----
create policy "perfiles visibles para todos"
  on public.profiles for select using (true);

create policy "solo tú editas tu perfil"
  on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ------------------------------------------------------------- releases ----
create policy "catálogo de lectura pública"
  on public.releases for select using (true);
-- Sin políticas de escritura: el catálogo solo se alimenta desde el servidor
-- (service_role), que ignora RLS. Así nadie puede falsear un disco.

-- ---------------------------------------------------------------- lists ----
create policy "listas no privadas o propias"
  on public.lists for select
  using (visibility <> 'private' or owner_id = auth.uid());

create policy "creas listas para ti"
  on public.lists for insert with check (owner_id = auth.uid());

create policy "editas tus listas"
  on public.lists for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "borras tus listas"
  on public.lists for delete using (owner_id = auth.uid());

-- ----------------------------------------------------------- list_items ----
create policy "contenido de listas que puedes ver"
  on public.list_items for select using (public.can_read_list(list_id));

create policy "añades a tus listas"
  on public.list_items for insert with check (public.owns_list(list_id));

create policy "editas el contenido de tus listas"
  on public.list_items for update
  using (public.owns_list(list_id)) with check (public.owns_list(list_id));

create policy "quitas de tus listas"
  on public.list_items for delete using (public.owns_list(list_id));

-- -------------------------------------------------------------- social ----
create policy "el grafo es público"
  on public.follows for select using (true);

create policy "solo sigues tú"
  on public.follows for insert with check (follower_id = auth.uid());

create policy "solo dejas de seguir tú"
  on public.follows for delete using (follower_id = auth.uid());

create policy "seguidores de listas públicos"
  on public.list_follows for select using (true);

create policy "sigues listas que puedes ver"
  on public.list_follows for insert
  with check (user_id = auth.uid() and public.can_read_list(list_id));

create policy "dejas de seguir tus listas seguidas"
  on public.list_follows for delete using (user_id = auth.uid());
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
