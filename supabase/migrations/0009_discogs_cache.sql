-- ============================================================================
-- Rackr — memoria de las búsquedas en Discogs
--
-- Discogs permite 60 peticiones por minuto para TODA la red, y una sola
-- búsqueda nuestra gasta doce de media: prueba por artista, por título, como
-- texto libre, contra masters, y parte la frase en cada palabra. Esa amplitud
-- es la razón de que encuentre las cosas, y también la razón de que el techo
-- real sean cinco búsquedas por minuto entre todos los usuarios.
--
-- Peor aún es cómo falla: cuando Discogs corta, devuelve una lista vacía en
-- lugar de un error, y en pantalla se lee «nada para Nevermind». Le decimos a
-- alguien que un disco no existe.
--
-- Quinientas personas buscan los mismos doscientos discos. Guardando la
-- respuesta, la segunda persona que busque «Rumours» no gasta ni una petición,
-- y el techo pasa a ser cinco búsquedas NUEVAS por minuto.
-- ============================================================================

create table public.discogs_search_cache (
  -- la consulta normalizada: sin acentos, en minúsculas y sin puntuación, de
  -- modo que «Rosalía — El Mal Querer» y «rosalia el mal querer» son la misma
  query      text primary key,
  results    jsonb not null,
  hits       int not null default 0,
  created_at timestamptz not null default now()
);

comment on table public.discogs_search_cache is
  'Respuestas de búsqueda de Discogs. Solo la escribe el servidor con la '
  'service key; nadie más la lee ni la toca.';

-- Para barrer lo caducado sin recorrer la tabla entera.
create index discogs_search_cache_age_idx
  on public.discogs_search_cache (created_at);

-- Nadie salvo el servidor. Sin políticas, RLS lo niega todo, que es lo que
-- queremos: la service key se salta RLS por definición.
alter table public.discogs_search_cache enable row level security;

-- Un mes. El catálogo de un disco de 1977 no cambia, pero las reediciones
-- aparecen, y una caché que no caduca nunca es una caché que miente despacio.
create or replace function public.purge_discogs_cache()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.discogs_search_cache
   where created_at < now() - interval '30 days';
$$;
