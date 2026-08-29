-- ============================================================================
-- Que alguien quiera tu lista es una noticia.
--
-- Un me gusta es el gesto barato, y por eso el aviso se reparte con cuidado:
--
--  * Al dueño, siempre. Es lo único que le devuelve el trabajo de hacer la
--    lista, y es la mitad de la razón por la que se hace otra.
--  * A nadie más. "A alguien a quien sigues le ha gustado una lista" es cierto
--    y es ruido: son gestos de un segundo y llenarían el flujo hasta tapar lo
--    que costó algo. Guardar sí se reparte (0011) precisamente porque cuesta.
--
-- La agrupación — "Marta y 4 más" en una sola línea — la hace el cliente en
-- lib/activity.ts, igual que con las guardadas.
-- ============================================================================

alter type notification_kind add value if not exists 'liked-list';

-- El enum nuevo no se puede usar en la misma transacción en la que se añade,
-- así que el trigger va en su propio bloque, después.
commit;

create or replace function public.notify_on_list_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select owner_id into owner from public.lists where id = new.list_id;
  -- darle al corazón en tu propia lista no es una noticia
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, list_id)
    values (owner, new.user_id, 'liked-list', new.list_id);
  end if;
  return new;
end;
$$;

drop trigger if exists list_likes_notify on public.list_likes;
create trigger list_likes_notify
  after insert on public.list_likes
  for each row execute function public.notify_on_list_like();

-- ------------------------------------------------------------- actividad ----
-- Un quinto verbo, y sólo para lo tuyo: `mine` es siempre true aquí porque la
-- consulta ni siquiera mira los me gusta de listas ajenas.
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
  followed as (
    select following_id as id from public.follows, me
    where follower_id = me.id
  )

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

  -- ------------------------------------------------------ me gusta ----
  select 'list-liked',
         ll.created_at,
         p.id, p.display_name, p.username, p.avatar_url,
         l.id, l.title, l.slug, l.owner_id, owner.username,
         null, null, null, null,
         null, null, null, null,
         true
  from public.list_likes ll
  join public.lists l on l.id = ll.list_id
  join public.profiles p on p.id = ll.user_id
  join public.profiles owner on owner.id = l.owner_id, me
  where ll.user_id <> me.id
    and l.owner_id = me.id

  union all

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
  'guardadas, me gusta en las tuyas y seguimientos. Agrupar es del cliente.';
