-- ============================================================================
-- Tus tres.
--
-- Los tres discos que alguien elige para representarse. No son sus favoritos
-- ni los últimos que compró: son con lo que se presenta, y por eso los eligen
-- ellos y no un algoritmo. Salen en su tarjeta, en su perfil y en la ficha que
-- se abre cuando alguien pasa por encima de su nombre.
--
-- Tabla y no un array en profiles, por una razón concreta: el orden importa
-- (el primero es el que se ve entero en la tarjeta) y un array de uuids no
-- puede tener clave foránea, así que un disco borrado del catálogo dejaría un
-- hueco silencioso en la presentación de alguien.
-- ============================================================================

create table if not exists public.profile_picks (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  position   int  not null check (position between 0 and 2),
  created_at timestamptz not null default now(),
  primary key (user_id, position),
  unique (user_id, release_id)
);

comment on table public.profile_picks is
  'Los tres discos con los que alguien se presenta. Elegidos, no calculados.';

create index profile_picks_user_idx on public.profile_picks (user_id, position);

alter table public.profile_picks enable row level security;

-- Públicos a propósito: una carta de presentación que solo ve su dueño no
-- presenta a nadie.
create policy "las elecciones son públicas"
  on public.profile_picks for select using (true);

create policy "solo eliges por ti"
  on public.profile_picks for insert with check (user_id = auth.uid());

create policy "solo cambias las tuyas"
  on public.profile_picks for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "solo borras las tuyas"
  on public.profile_picks for delete using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Las sugerencias enseñan lo elegido cuando existe.
--
-- Antes devolvía las seis portadas más recientes de cada perfil, que es lo que
-- alguien tiene, no lo que quiere enseñar. Con tres elegidas manda la
-- elección; sin ellas se cae a lo reciente, y sin nada la interfaz dibuja el
-- hueco (un cuadrado con la marca) en vez de fingir una estantería vacía.
-- ---------------------------------------------------------------------------
-- Añadir una columna al resultado cambia el tipo de retorno, y eso Postgres no
-- lo hace con "create or replace": hay que tirar la función y volver a
-- escribirla. Es una función de lectura sin permisos concedidos a nadie más,
-- así que el hueco entre el drop y el create dura lo que dure la transacción.
drop function if exists public.people_for_me(int);

create function public.people_for_me(max_rows int default 24)
returns table (
  id           uuid,
  username     citext,
  display_name text,
  avatar_url   text,
  bio          text,
  shared       int,
  mutuals      int,
  followers    int,
  covers       text[],
  chosen       boolean
)
language sql
stable
as $$
  with me as (select auth.uid() as id),

  mine as (
    select distinct li.release_id
    from public.list_items li
    join public.lists l on l.id = li.list_id, me
    where l.owner_id = me.id
  ),

  followed as (
    select following_id as id from public.follows, me where follower_id = me.id
  ),

  shared as (
    select l.owner_id as id, count(distinct li.release_id)::int as n
    from public.list_items li
    join public.lists l on l.id = li.list_id
    where l.visibility = 'public'
      and li.release_id in (select release_id from mine)
    group by l.owner_id
  ),

  mutual as (
    select f.following_id as id, count(*)::int as n
    from public.follows f
    where f.follower_id in (select id from followed)
    group by f.following_id
  ),

  pop as (
    select following_id as id, count(*)::int as n
    from public.follows
    group by following_id
  ),

  picks as (
    select pp.user_id as id, array_agg(r.cover_url order by pp.position) as covers
    from public.profile_picks pp
    join public.releases r on r.id = pp.release_id
    where r.cover_url is not null
    group by pp.user_id
  )

  select p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         p.bio,
         coalesce(s.n, 0),
         coalesce(m.n, 0),
         coalesce(pop.n, 0),
         coalesce(
           pk.covers,
           (
             select array_agg(c)
             from (
               select r.cover_url as c
               from public.list_items li
               join public.lists l2 on l2.id = li.list_id
               join public.releases r on r.id = li.release_id
               where l2.owner_id = p.id
                 and l2.visibility = 'public'
                 and r.cover_url is not null
               order by li.added_at desc
               limit 3
             ) t
           )
         ),
         pk.covers is not null
  from public.profiles p
  left join shared s on s.id = p.id
  left join mutual m on m.id = p.id
  left join pop on pop.id = p.id
  left join picks pk on pk.id = p.id, me
  where p.id is distinct from me.id
    and not exists (select 1 from followed f where f.id = p.id)
  order by coalesce(s.n, 0) * 5
         + coalesce(m.n, 0) * 3
         + least(coalesce(pop.n, 0), 20) desc,
           p.created_at desc
  limit max_rows;
$$;

-- ---------------------------------------------------------------------------
-- Y las de una persona concreta, para su perfil y su ficha.
-- ---------------------------------------------------------------------------
create or replace function public.picks_of(profile uuid)
returns table (slug text, title text, artist text, cover_url text)
language sql
stable
as $$
  select r.slug, r.title, r.artist, r.cover_url
  from public.profile_picks pp
  join public.releases r on r.id = pp.release_id
  where pp.user_id = profile
  order by pp.position;
$$;
