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
