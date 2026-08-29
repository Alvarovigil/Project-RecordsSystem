-- ============================================================================
-- Verificado.
--
-- Una marca que dice "esta cuenta es quien dice ser". La pone y la quita una
-- persona desde el panel, a mano, y por eso no hay política de escritura: el
-- panel entra con la clave de servicio, que se salta RLS, y todo lo demás —
-- incluida la propia cuenta — solo puede leerla. Un verificado que su dueño
-- pueda activarse no verifica nada.
--
-- Columna en profiles y no una tabla: es un sí o un no por cuenta, sin fecha,
-- sin motivo y sin histórico. El día que haga falta saber quién lo concedió y
-- cuándo, eso será otra cosa con su propia tabla.
-- ============================================================================

alter table public.profiles
  add column if not exists verified boolean not null default false;

comment on column public.profiles.verified is
  'Marca manual del panel de administración. Solo la escribe service_role.';

-- La cuenta oficial del proyecto, que es la única razón por la que esto existe
-- hoy: cuando alguien ve una lista firmada por Rackr Club tiene que poder
-- saber que es la nuestra y no la de alguien con el mismo nombre.
update public.profiles set verified = true where username = 'rackrclub';
