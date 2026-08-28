-- Contar los aciertos de caché sin carreras entre peticiones simultáneas.
-- Saber qué se busca mucho es lo que dirá más adelante si el abanico de doce
-- consultas por búsqueda merece lo que cuesta.
create or replace function public.bump_discogs_cache(q text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.discogs_search_cache set hits = hits + 1 where query = q;
$$;
