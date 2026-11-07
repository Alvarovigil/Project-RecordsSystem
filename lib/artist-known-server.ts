import { headers } from "next/headers";
import data from "@/data/vinilos.json";
import type { Vinyl } from "@/lib/types";
import { findArtist } from "@/lib/artist";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import {
  catalogueFetch,
  catalogueWaitSeconds,
  clientCallWait,
  clientKey,
  spendClientCalls,
} from "@/lib/discogs-budget";
import {
  type ArtistVerdict,
  isPlainSlug,
  knownCacheFresh,
  likePatternForSlug,
  nameFromSlug,
  someNameMatches,
  verdictFromCatalogue,
} from "@/lib/artist-known";

/**
 * ¿Hay alguien detrás de `/artista/<slug>`? Solo en el servidor.
 *
 * De lo más barato a lo más caro, y parando en el primer «sí»:
 *
 * 1. La estantería de ejemplo que viaja con la aplicación.
 * 2. Los discos de la base: alguien tiene uno suyo.
 * 3. Lo que ya se averiguó otra vez (un sí vale un mes; un no, un día).
 * 4. Una búsqueda de artistas en el catálogo — una consulta, y solo si el
 *    minuto y la parte de quien pregunta dan para ella.
 *
 * Cualquier cosa que no sea un «no» claro del catálogo — un límite, un fallo,
 * una base que no contesta, un nombre parecido — es «doubt», y la página se
 * enseña como hasta ahora.
 */
export async function resolveArtistVerdict(slug: string): Promise<ArtistVerdict> {
  // «artista» es el slug de relleno de un nombre sin letras latinas («!!!»,
  // 坂本龍一): no dice quién es, así que no se le puede negar a nadie
  if (slug === "artista") return "doubt";
  // una dirección desmesurada no es un nombre: ni se consulta ni se niega
  if (slug.length > 80 || slug.split("-").filter(Boolean).length > 8) return "doubt";
  if (findArtist(data as Vinyl[], slug)) return "known";

  const sb = getSupabaseAdminClient();
  // sin base, la biblioteca vive solo en el navegador: aquí no se puede saber
  if (!sb) return "doubt";
  const pattern = likePatternForSlug(slug);
  if (pattern) {
    try {
      const { data: rows, error } = await sb
        .from("releases")
        .select("artist")
        .ilike("artist", pattern)
        .limit(200);
      if (error) return "doubt";
      if (someNameMatches((rows ?? []).map((r) => String(r.artist ?? "")), slug)) return "known";
    } catch {
      return "doubt";
    }
  }

  const cacheKey = `artistknown:${slug}`;
  {
    try {
      const { data: hit } = await sb
        .from("discogs_search_cache")
        .select("results, created_at")
        .eq("query", cacheKey)
        .maybeSingle();
      const known = (hit?.results as { known?: boolean } | null)?.known;
      if (typeof known === "boolean" && knownCacheFresh(known, hit!.created_at)) {
        return known ? "known" : "unknown";
      }
    } catch {
      /* sin caché se sigue preguntando */
    }
  }

  // sin catálogo, sin minuto o un slug que no salió de un enlace nuestro: duda
  if (!process.env.DISCOGS_TOKEN || !isPlainSlug(slug)) return "doubt";
  if (catalogueWaitSeconds() > 0) return "doubt";
  const who = clientKey(await headers());
  if (clientCallWait(who) > 0) return "doubt";
  spendClientCalls(who);

  const url = new URL("https://api.discogs.com/database/search");
  url.searchParams.set("type", "artist");
  url.searchParams.set("per_page", "25");
  url.searchParams.set("q", nameFromSlug(slug));
  // la página espera por esto: si el catálogo tarda, se enseña sin saberlo
  const r = await catalogueFetch(url, { revalidate: 3600, signal: AbortSignal.timeout(3000) });
  if (r.kind !== "ok") return "doubt";
  const titles = ((r.data as { results?: { title?: string }[] })?.results ?? []).map((x) =>
    String(x.title ?? ""),
  );
  const verdict = verdictFromCatalogue(titles, slug);

  if (verdict !== "doubt") {
    void sb
      .from("discogs_search_cache")
      .upsert(
        { query: cacheKey, results: { known: verdict === "known" }, created_at: new Date().toISOString() },
        { onConflict: "query" },
      )
      .then(
        () => {},
        () => {},
      );
  }
  return verdict;
}
