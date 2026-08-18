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
