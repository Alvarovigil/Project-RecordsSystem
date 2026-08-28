-- ============================================================================
-- Rackr — el paso de bienvenida, y con quién empiezas
--
-- Dos cosas que no pueden vivir en el navegador:
--
--   1. Si ya has pasado por la pantalla de «¿cómo te llamas?». Estaba en
--      localStorage, y Safari borra el localStorage de los sitios que no
--      visitas en siete días —su protección antiseguimiento, que no distingue
--      entre una cookie de rastreo y una preferencia tuya—. El resultado es
--      que a la semana la app volvía a preguntarte tu nombre como si fueras
--      nuevo. Cambiar de móvil hacía lo mismo.
--
--   2. A quién sigues al entrar. Una red social vacía el primer día no se
--      entiende: sin nadie a quien seguir, el feed está en blanco y la mitad
--      del producto parece rota. Todo el mundo empieza siguiendo a la cuenta
--      oficial, que es la que tiene listas que enseñar.
-- ============================================================================

-- --------------------------------------------------------------- onboarding
alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'Cuándo completó (o saltó) la bienvenida. Vive aquí y no en el navegador '
  'porque el navegador la olvida: Safari purga localStorage a los 7 días.';

-- Las cuentas que ya existen han pasado por ahí; no volver a preguntarles.
update public.profiles
   set onboarded_at = created_at
 where onboarded_at is null;

-- Es tu propia fila: la política de UPDATE de 0003 ya te deja escribirla.

-- ---------------------------------------------------- seguir a la oficial
-- Buscada por nombre de usuario y no por uuid: el identificador cambia si el
-- proyecto se recrea, el handle no.
create or replace function public.follow_official_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  official uuid;
begin
  select id into official from public.profiles where username = 'rackrclub';

  -- y nunca a sí misma, que es lo que pasaría al crear la propia cuenta
  if official is not null and official <> new.id then
    insert into public.follows (follower_id, following_id)
    values (new.id, official)
    on conflict do nothing;
  end if;

  return new;
end;
$$;

-- AFTER, no BEFORE: la fila del perfil tiene que existir antes de que una
-- clave ajena pueda apuntar a ella.
create trigger profiles_follow_official
  after insert on public.profiles
  for each row execute function public.follow_official_account();

-- Que los que ya están registrados también la sigan. on conflict do nothing
-- respeta a quien ya la siguiera por su cuenta.
insert into public.follows (follower_id, following_id)
select p.id, o.id
  from public.profiles p
 cross join (select id from public.profiles where username = 'rackrclub') o
 where p.id <> o.id
on conflict do nothing;
