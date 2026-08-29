-- ============================================================================
-- La marca de verificado, hasta las sugerencias.
--
-- Misma función que 0016 con una columna más: si la tarjeta enseña el nombre,
-- tiene que poder enseñar al lado si la cuenta es quien dice ser. Y otra vez
-- drop + create, porque añadir una columna al resultado cambia el tipo de
-- retorno y Postgres no lo hace de otra forma.
--
-- Un disco, una vez (de 0016).
--
-- Cuando alguien no ha elegido sus tres, la tarjeta cae a lo último que añadió
-- — y eso salía de list_items, que tiene una fila por disco Y POR LISTA. Quien
-- tenga el mismo vinilo en dos listas públicas aparecía con la misma portada
-- dos veces en su presentación, que es exactamente lo que una carta de
-- presentación no puede hacer.
--
-- `distinct on (r.id)` se queda con la aparición más reciente de cada disco;
-- el orden por fecha se hace después, porque distinct on obliga a ordenar
-- primero por aquello sobre lo que distingue.
--
-- Las elegidas nunca tuvieron el problema: profile_picks lleva unique
-- (user_id, release_id) y es la base de datos la que se niega.
-- ============================================================================

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
  chosen       boolean,
  verified     boolean
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
               select c, added
               from (
                 select distinct on (r.id)
                        r.cover_url as c,
                        li.added_at as added
                 from public.list_items li
                 join public.lists l2 on l2.id = li.list_id
                 join public.releases r on r.id = li.release_id
                 where l2.owner_id = p.id
                   and l2.visibility = 'public'
                   and r.cover_url is not null
                 order by r.id, li.added_at desc
               ) u
               order by added desc
               limit 3
             ) t
           )
         ),
         pk.covers is not null,
         p.verified
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
