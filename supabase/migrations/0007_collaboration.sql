-- ============================================================================
-- Rackr — colaboración y avisos
--
-- Dos ideas nuevas, y las dos cambian quién puede escribir dónde:
--
--   1. Una lista puede tener editores además de dueño. El dueño sigue siendo
--      uno solo (borra, renombra, invita); un editor solo añade y quita discos.
--      Esa asimetría es deliberada: "colaborar" no puede significar "puede
--      borrarte la lista", porque entonces nadie invita a nadie.
--   2. Lo que te pasa a ti no es lo mismo que lo que pasa a tu alrededor. El
--      feed se deriva de la actividad; los avisos se escriben, porque hay que
--      saber cuáles has leído y cuáles esperan una respuesta tuya.
--
-- Todo el permiso vive aquí, en RLS. La interfaz esconde botones; la base de
-- datos es la que impide de verdad.
-- ============================================================================

create type collaborator_role as enum ('editor');
create type invite_status as enum ('pending', 'accepted', 'declined');

-- ------------------------------------------------------- list_collaborators
create table public.list_collaborators (
  list_id    uuid not null references public.lists(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       collaborator_role not null default 'editor',
  status     invite_status not null default 'pending',
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (list_id, user_id)
);

comment on table public.list_collaborators is
  'Quién puede escribir en una lista que no es suya. El dueño NO aparece aquí: '
  'su permiso viene de lists.owner_id y no se puede revocar por accidente.';

create index list_collaborators_user_idx
  on public.list_collaborators (user_id, status);

-- ¿Puede quien pregunta escribir en esta lista? Dueño o editor aceptado.
-- SECURITY DEFINER para no reevaluar la política de lists desde list_items.
create or replace function public.can_write_list(target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.lists l
    where l.id = target and l.owner_id = auth.uid()
  ) or exists (
    select 1 from public.list_collaborators c
    where c.list_id = target
      and c.user_id = auth.uid()
      and c.status = 'accepted'
  );
$$;

-- Una lista compartida también se puede LEER aunque sea privada: te invitaron.
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
  ) or exists (
    select 1 from public.list_collaborators c
    where c.list_id = target
      and c.user_id = auth.uid()
      and c.status = 'accepted'
  );
$$;

-- Quién metió cada disco. Sin esto, una lista colaborativa es un montón
-- anónimo y no se puede responder a "¿esto quién lo ha puesto?".
alter table public.list_items
  add column if not exists added_by uuid references public.profiles(id) on delete set null;

alter table public.list_collaborators enable row level security;

-- Ver a los colaboradores de una lista que puedes leer.
create policy "collaborators readable with the list"
  on public.list_collaborators for select
  using (public.can_read_list(list_id));

-- Solo el dueño invita.
create policy "owner invites"
  on public.list_collaborators for insert
  with check (public.owns_list(list_id) and invited_by = auth.uid());

-- El dueño quita a cualquiera; tú puedes irte de una lista ajena.
create policy "owner removes, you can leave"
  on public.list_collaborators for delete
  using (public.owns_list(list_id) or user_id = auth.uid());

-- Aceptar o rechazar es cosa tuya, y solo sobre tu propia invitación.
create policy "you answer your invitation"
  on public.list_collaborators for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ------------------------------------------------------------ notifications
create type notification_kind as enum (
  'follow', 'invite', 'added-to-list', 'saved-list'
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  actor_id   uuid not null references public.profiles(id) on delete cascade,
  kind       notification_kind not null,
  list_id    uuid references public.lists(id) on delete cascade,
  release_id uuid references public.releases(id) on delete cascade,
  -- una invitación es una bifurcación: no se archiva, se responde
  actionable boolean not null default false,
  read_at    timestamptz,
  created_at timestamptz not null default now(),
  -- que nadie te avise dos veces de lo mismo
  check (user_id <> actor_id)
);

create index notifications_inbox_idx
  on public.notifications (user_id, created_at desc);
create index notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;

create policy "your inbox is yours"
  on public.notifications for select
  using (user_id = auth.uid());

-- Marcar como leído es lo único que puedes cambiar de un aviso.
create policy "you mark your own as read"
  on public.notifications for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nadie escribe avisos a mano: los generan los triggers de abajo.
revoke insert on public.notifications from authenticated;

-- ---------------------------------------------------------------- triggers
-- Los avisos se derivan de hechos. Escribirlos desde el cliente significaría
-- confiar en que la interfaz no se olvide, y se olvidaría.

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

create or replace function public.notify_on_invite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind, list_id, actionable)
    values (new.user_id, coalesce(new.invited_by, new.user_id), 'invite', new.list_id, true);
  end if;
  return new;
end;
$$;

create trigger list_collaborators_notify
  after insert on public.list_collaborators
  for each row execute function public.notify_on_invite();

create or replace function public.notify_on_list_save()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  select owner_id into owner from public.lists where id = new.list_id;
  -- guardarte tu propia lista no es una noticia
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, list_id)
    values (owner, new.user_id, 'saved-list', new.list_id);
  end if;
  return new;
end;
$$;

create trigger list_follows_notify
  after insert on public.list_follows
  for each row execute function public.notify_on_list_save();

-- Alguien añadió un disco a una lista colaborativa: avisa al resto, nunca a
-- quien lo añadió.
create or replace function public.notify_on_collab_add()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid;
begin
  if new.added_by is null then
    return new;
  end if;
  select owner_id into owner from public.lists where id = new.list_id;

  insert into public.notifications (user_id, actor_id, kind, list_id, release_id)
  select p, new.added_by, 'added-to-list', new.list_id, new.release_id
  from (
    select owner as p
    union
    select c.user_id from public.list_collaborators c
      where c.list_id = new.list_id and c.status = 'accepted'
  ) people
  where p is not null and p <> new.added_by;

  return new;
end;
$$;

create trigger list_items_notify_collab
  after insert on public.list_items
  for each row execute function public.notify_on_collab_add();

-- ------------------------------------------------- permisos de escritura ---
-- Las políticas de 0003 daban por hecho que escribir en una lista es cosa del
-- dueño. Ahora también lo es de un editor aceptado, así que se reescriben
-- contra can_write_list() en vez de contra owns_list().
drop policy if exists "añades a tus listas" on public.list_items;
drop policy if exists "editas el contenido de tus listas" on public.list_items;
drop policy if exists "quitas de tus listas" on public.list_items;

create policy "añades a listas donde puedes escribir"
  on public.list_items for insert
  with check (public.can_write_list(list_id));

create policy "editas el contenido de listas donde puedes escribir"
  on public.list_items for update
  using (public.can_write_list(list_id))
  with check (public.can_write_list(list_id));

-- Un editor quita lo que él puso; el dueño quita lo que sea. Que un invitado
-- pueda vaciar la lista de otro es justo lo que hace que no se invite a nadie.
create policy "quitas lo tuyo, o cualquier cosa si es tu lista"
  on public.list_items for delete
  using (public.owns_list(list_id) or added_by = auth.uid());
