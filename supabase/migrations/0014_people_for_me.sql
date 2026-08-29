-- ============================================================================
-- Gente que podría interesarte, y por qué.
--
-- Antes: los doce perfiles creados más recientemente. Eso no es una sugerencia,
-- es un orden de llegada — y le enseña a todo el mundo la misma lista, que es
-- justo lo contrario de lo que hace que alguien siga a alguien.
--
-- Tres señales, y cada una dice algo distinto:
--
--   1. DISCOS EN COMÚN. La más fuerte con diferencia, y la única que este
--      producto tiene y una red social genérica no: si diez de tus discos
--      están en las listas públicas de alguien, esa persona colecciona como
--      tú. No hace falta saber nada más.
--   2. A QUIÉN SIGUE LA GENTE QUE SIGUES. El camino por el que se ensancha una
--      red pequeña: la gente en la que ya confías te enseña a quién mirar.
--   3. CUÁNTA GENTE LE SIGUE. Solo como desempate, y con tope: sin él, los
--      cuatro perfiles más seguidos salen en la pantalla de todo el mundo para
--      siempre y la comunidad se convierte en un ranking.
--
-- Se devuelven los números además del orden porque la tarjeta los enseña: una
-- sugerencia que dice "5 discos en común" es una razón, y una que no lo dice es
-- un anuncio.
--
-- SECURITY INVOKER: solo cuenta lo que quien pregunta puede ver.
-- ============================================================================

create or replace function public.people_for_me(max_rows int default 24)
returns table (
  id           uuid,
  username     citext,
  display_name text,
  avatar_url   text,
  bio          text,
  shared       int,
  mutuals      int,
  followers    int,
  covers       text[]
)
language sql
stable
as $$
  with me as (select auth.uid() as id),

  -- lo que tengo yo, sea en la lista que sea
  mine as (
    select distinct li.release_id
    from public.list_items li
    join public.lists l on l.id = li.list_id, me
    where l.owner_id = me.id
  ),

  followed as (
    select following_id as id from public.follows, me where follower_id = me.id
  ),

  -- discos míos que aparecen en listas públicas de otra gente
  shared as (
    select l.owner_id as id, count(distinct li.release_id)::int as n
    from public.list_items li
    join public.lists l on l.id = li.list_id
    where l.visibility = 'public'
      and li.release_id in (select release_id from mine)
    group by l.owner_id
  ),

  -- a quién sigue la gente que yo sigo
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
  )

  select p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         p.bio,
         coalesce(s.n, 0),
         coalesce(m.n, 0),
         coalesce(pop.n, 0),
         -- seis portadas suyas, las últimas que metió: la tarjeta es su
         -- estantería, no su cara
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
             limit 6
           ) t
         )
  from public.profiles p
  left join shared s on s.id = p.id
  left join mutual m on m.id = p.id
  left join pop on pop.id = p.id, me
  where p.id is distinct from me.id
    and not exists (select 1 from followed f where f.id = p.id)
  order by coalesce(s.n, 0) * 5
         + coalesce(m.n, 0) * 3
         + least(coalesce(pop.n, 0), 20) desc,
           p.created_at desc
  limit max_rows;
$$;

comment on function public.people_for_me is
  'Sugerencias de gente: discos en común, a quién sigue quien sigues, y '
  'popularidad como desempate. Devuelve los números para que la interfaz '
  'pueda decir por qué.';
