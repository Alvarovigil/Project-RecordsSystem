-- ============================================================================
-- Quién puede ampliar el catálogo
--
-- Cualquiera con sesión puede AÑADIR un disco que no exista (viene de Discogs,
-- con su id, así que el duplicado lo impide el índice único). Nadie puede
-- modificarlo ni borrarlo después: el catálogo es común, y un disco que ya usan
-- otras listas no puede cambiarte debajo.
-- ============================================================================

create policy "con sesión puedes añadir discos al catálogo"
  on public.releases for insert
  to authenticated
  with check (created_by = auth.uid());

-- Sin políticas de update ni delete: el catálogo es inmutable desde el cliente.
-- Las correcciones se hacen desde el servidor con la clave de servicio.
