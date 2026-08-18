-- ============================================================================
-- Actividad: qué han añadido las personas y las listas que sigues.
--
-- SECURITY INVOKER: hereda tus permisos, así que una lista privada nunca
-- aparece en el flujo de nadie.
-- ============================================================================

create or replace function public.feed_for_me(max_rows int default 40)
returns table (
  added_at     timestamptz,
  actor_id     uuid,
  actor_name   text,
  actor_handle citext,
  actor_avatar text,
  list_id      uuid,
  list_title   text,
  list_slug    text,
  release_slug text,
  release_title text,
  release_artist text,
  release_cover text
)
language sql
stable
as $$
  select li.added_at,
         p.id, p.display_name, p.username, p.avatar_url,
         l.id, l.title, l.slug,
         r.slug, r.title, r.artist, r.cover_url
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.profiles p on p.id = l.owner_id
  join public.releases r on r.id = li.release_id
  where l.visibility = 'public'
    and (
      -- personas que sigues
      exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = l.owner_id
      )
      -- o listas concretas que sigues
      or exists (
        select 1 from public.list_follows lf
        where lf.user_id = auth.uid() and lf.list_id = l.id
      )
    )
  order by li.added_at desc
  limit max_rows;
$$;
