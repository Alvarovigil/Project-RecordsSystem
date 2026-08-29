-- ============================================================================
-- Las dos medidas de una lista: guardadas y me gusta.
--
-- Son dos cosas distintas a propósito. Guardar es un compromiso — la lista
-- entra en tu estantería y la sigues viendo cada día; hay poca gente que
-- guarde muchas listas. Un me gusta no cuesta nada y por eso mide otra cosa:
-- cuánta gente pasó por delante y le pareció bien. Con las dos se puede
-- ordenar la comunidad con criterio (mucho gusto y poca guardada = bonita
-- pero no útil; al revés = útil y poco vistosa); con una sola, no.
--
-- Los contadores viven en `lists`, como item_count: ordenar la portada de
-- Explorar por un count(*) sobre dos tablas es el primer sitio donde esto se
-- vuelve lento, y es el sitio que más se mira.
-- ============================================================================

create table if not exists public.list_likes (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  list_id    uuid not null references public.lists(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, list_id)
);
create index if not exists list_likes_list_idx on public.list_likes (list_id);

alter table public.lists
  add column if not exists like_count int not null default 0,
  add column if not exists save_count int not null default 0;

-- ------------------------------------------------------------ contadores ----
create or replace function public.sync_list_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.lists set like_count = like_count + 1 where id = new.list_id;
  else
    update public.lists set like_count = greatest(like_count - 1, 0) where id = old.list_id;
  end if;
  return null;
end;
$$;

drop trigger if exists list_likes_count on public.list_likes;
create trigger list_likes_count
  after insert or delete on public.list_likes
  for each row execute function public.sync_list_like_count();

create or replace function public.sync_list_save_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.lists set save_count = save_count + 1 where id = new.list_id;
  else
    update public.lists set save_count = greatest(save_count - 1, 0) where id = old.list_id;
  end if;
  return null;
end;
$$;

drop trigger if exists list_follows_count on public.list_follows;
create trigger list_follows_count
  after insert or delete on public.list_follows
  for each row execute function public.sync_list_save_count();

-- Nota: los contadores no tocan updated_at. "Actualizada hace 2 minutos"
-- tiene que seguir queriendo decir que entró un disco, no que alguien pasó
-- por delante y pulsó un corazón.

-- backfill: lo que ya había guardado antes de existir el contador
update public.lists l
   set save_count = (select count(*) from public.list_follows lf where lf.list_id = l.id),
       like_count = (select count(*) from public.list_likes  ll where ll.list_id = l.id);

-- ------------------------------------------------------------------ RLS ----
alter table public.list_likes enable row level security;

drop policy if exists "los me gusta se ven" on public.list_likes;
create policy "los me gusta se ven"
  on public.list_likes for select using (true);

drop policy if exists "das me gusta como tú" on public.list_likes;
create policy "das me gusta como tú"
  on public.list_likes for insert
  with check (user_id = auth.uid());

drop policy if exists "quitas tu me gusta" on public.list_likes;
create policy "quitas tu me gusta"
  on public.list_likes for delete using (user_id = auth.uid());

-- --------------------------------------------------------------- puente ----
-- El puente ordenaba por guardadas contando a mano; ahora lee el contador y
-- devuelve las dos medidas, que es lo que la tarjeta enseña.
drop function if exists public.lists_with_release(uuid, int);
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
  saves       int,
  likes       int,
  updated_at  timestamptz
)
language sql
stable
as $$
  select l.id, l.title, l.description, l.owner_id, p.display_name, p.username,
         l.item_count, l.save_count, l.like_count, l.updated_at
  from public.list_items li
  join public.lists l on l.id = li.list_id
  join public.profiles p on p.id = l.owner_id
  where li.release_id = target_release
    and l.visibility = 'public'
    and l.owner_id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
  order by (l.save_count * 3 + l.like_count) desc, l.updated_at desc
  limit max_rows;
$$;
