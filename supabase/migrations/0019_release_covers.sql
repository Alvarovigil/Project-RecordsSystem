-- ============================================================================
-- La portada de TU copia.
--
-- El catálogo de discos es compartido a propósito: una fila por edición, y por
-- eso se puede responder «quién más tiene este disco». Pero la portada que
-- enseña esa fila es la que eligió el catálogo, y no siempre es la que tiene
-- alguien en las manos — la edición española llevaba otra foto, la reedición
-- cambió el color, o el escaneo de la ficha está torcido.
--
-- Cambiarla en la fila compartida arreglaría la de una persona y cambiaría la
-- de todas las demás, que es exactamente lo que no se quiere: no hay una
-- portada correcta, hay la de cada cual. Así que la elección vive aparte, por
-- persona, y se superpone al leer.
--
-- Sin fila aquí, manda el catálogo. Es decir: esto solo existe para quien ha
-- dicho que no.
-- ============================================================================

create table if not exists public.release_covers (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  release_id uuid not null references public.releases(id) on delete cascade,
  cover_url  text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, release_id)
);

comment on table public.release_covers is
  'La portada que ha elegido una persona para su copia de un disco.';

alter table public.release_covers enable row level security;

-- Públicas para leer: la portada elegida es parte de cómo se ve la estantería
-- de alguien, y esa estantería se enseña.
create policy "las portadas elegidas son públicas"
  on public.release_covers for select using (true);

create policy "solo eliges la tuya"
  on public.release_covers for insert with check (user_id = auth.uid());

create policy "solo cambias la tuya"
  on public.release_covers for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "solo borras la tuya"
  on public.release_covers for delete using (user_id = auth.uid());
