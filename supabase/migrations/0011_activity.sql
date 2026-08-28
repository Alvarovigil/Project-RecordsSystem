-- ============================================================================
-- Actividad: todo lo que se mueve alrededor de ti, en una sola consulta.
--
-- El flujo anterior (feed_for_me) solo sabía contar una cosa: discos añadidos
-- a listas que sigues. Eso deja fuera justo lo que da ganas de mirar — quién
-- ha empezado a seguir tu lista, a quién sigue ahora la gente que tú sigues,
-- qué listas nuevas ha publicado. Un flujo de un solo verbo no es un flujo.
--
-- Cuatro verbos, una tabla de salida, un solo viaje al servidor. Agrupar es
-- trabajo del cliente (lib/activity.ts): la base de datos dice qué pasó y
-- cuándo, y la interfaz decide cómo contarlo.
--
-- SECURITY INVOKER (el modo por defecto): hereda tus permisos, así que una
-- lista privada no aparece en la actividad de nadie por mucho que se siga a
-- su dueño. El grafo social sí es público — es lo que hace posible el cotilleo
-- y ya lo era en 0003_rls.sql.
--
-- `mine` marca los eventos cuyo objeto eres tú o algo tuyo. La interfaz los
-- cuenta al revés (agrupa por objeto, no por actor: "tres personas guardaron
-- tu lista") y les da más peso, porque son los que te implican.
-- ============================================================================

create or replace function public.activity_for_me(max_rows int default 160)
returns table (
  kind            text,
  at              timestamptz,
  actor_id        uuid,
  actor_name      text,
  actor_handle    citext,
  actor_avatar    text,
  list_id         uuid,
  list_title      text,
  list_slug       text,
  list_owner_id   uuid,
  list_owner_handle citext,
  target_id       uuid,
  target_name     text,
  target_handle   citext,
  target_avatar   text,
  release_slug    text,
  release_title   text,
  release_artist  text,
  release_cover   text,
  mine            boolean
)
language sql
stable
as $$
  with me as (select auth.uid() as id),
  -- a quién sigo: la mitad de las cláusulas de abajo preguntan por esto
  followed as (
    select following_id as id from public.follows, me
    where follower_id = me.id
  )

  -- ---------------------------------------------------- discos añadidos ----
  -- Un disco que entra en una lista pública de alguien a quien sigues, o en
  -- una lista concreta que sigues. Lo tuyo no: tu propia actividad no es
  -- noticia para ti.
  select 'added'::text,
         li.added_at,
         p.id, p.display_name, p.username, p.avatar_url,
         l.id, l.title, l.slug, l.owner_id, p.username,
         null::uuid, null::text, null::citext, null::text,
         r.slug, r.title, r.artist, r.cover_url,
         false
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.profiles p on p.id = l.owner_id
  join public.releases r on r.id = li.release_id, me
  where l.visibility = 'public'
    and l.owner_id <> me.id
    and (
      exists (select 1 from followed f where f.id = l.owner_id)
      or exists (
        select 1 from public.list_follows lf
        where lf.user_id = me.id and lf.list_id = l.id
      )
    )

  union all

  -- ----------------------------------------------------- listas nuevas ----
  -- Publicar una lista es el gesto más deliberado que hay aquí, y el que más
  -- se pierde: sin esto solo te enteras cuando alguien mete un disco en ella.
  select 'list-created',
         l.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
         l.id, l.title, l.slug, l.owner_id, p.username,
         null, null, null, null,
         null, null, null, null,
         false
  from public.lists l
  join public.profiles p on p.id = l.owner_id, me
  where l.visibility = 'public'
    and l.kind = 'custom'
    and l.owner_id <> me.id
    and exists (select 1 from followed f where f.id = l.owner_id)

  union all

  -- --------------------------------------------------- listas guardadas ----
  -- Dos motivos para verlo: es TU lista (te lo has ganado) o lo ha hecho
  -- alguien a quien sigues (una recomendación sin tener que escribirla).
  select 'list-saved',
         lf.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
         l.id, l.title, l.slug, l.owner_id, owner.username,
         null, null, null, null,
         null, null, null, null,
         l.owner_id = me.id
  from public.list_follows lf
  join public.lists l on l.id = lf.list_id
  join public.profiles p on p.id = lf.user_id
  join public.profiles owner on owner.id = l.owner_id, me
  where lf.user_id <> me.id
    and (
      l.owner_id = me.id
      or (l.visibility = 'public' and exists (select 1 from followed f where f.id = lf.user_id))
    )

  union all

  -- --------------------------------------------------- gente seguida ----
  -- "X te ha empezado a seguir" y "X ha empezado a seguir a Y". El segundo es
  -- el que abre la red: la gente que te interesa te enseña a quién mirar.
  select 'followed',
         f.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
         null, null, null, null, null,
         t.id, t.display_name, t.username, t.avatar_url,
         null, null, null, null,
         f.following_id = me.id
  from public.follows f
  join public.profiles p on p.id = f.follower_id
  join public.profiles t on t.id = f.following_id, me
  where f.follower_id <> me.id
    and (
      f.following_id = me.id
      or exists (select 1 from followed fo where fo.id = f.follower_id)
    )

  order by 2 desc
  limit max_rows;
$$;

comment on function public.activity_for_me is
  'Todo lo que se mueve alrededor de ti: añadidos, listas nuevas, listas '
  'guardadas y seguimientos. Agrupar es trabajo del cliente.';

-- El flujo viejo ya no lo llama nadie. Se queda por si un cliente antiguo
-- sigue en el aire, y se borrará cuando no queden.
comment on function public.feed_for_me is
  'OBSOLETA desde 0011: la sustituye activity_for_me, que cuenta cuatro verbos '
  'en vez de uno.';
