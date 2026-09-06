import { NextRequest } from "next/server";
import { DISCOGS_UA } from "@/lib/discogs";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * Todas las portadas que existen de un disco.
 *
 * Un disco tiene una portada y a la vez no: la edición española de 1979 lleva
 * otra foto, la reedición de 2015 le cambia el color, y el catálogo elige por
 * su cuenta cuál enseña. Cuando la que sale no es la que tienes en las manos,
 * la ficha está describiendo un objeto que no es el tuyo — y hasta ahora no
 * había manera de arreglarlo.
 *
 * Esto reúne tres fuentes y las devuelve en el orden en el que valen la pena:
 *
 * 1. **Las fotos de esta edición.** Son literalmente este objeto: la portada,
 *    la contraportada, la carpeta abierta. Si la buena está en alguna parte,
 *    está aquí.
 * 2. **Las otras ediciones del mismo álbum.** El catálogo las agrupa bajo un
 *    «master», y sus miniaturas son exactamente el muestrario que hace falta
 *    para reconocer la tuya entre veinte prensadas.
 * 3. **La carátula de la tienda de música**, que es la que está limpia y a
 *    buena resolución cuando las escaneadas están torcidas o con brillos.
 *
 * Todas pasan por nuestro proxy: el catálogo no sirve sus imágenes a otro
 * sitio, y una lista de portadas rotas es peor que no ofrecer nada.
 */
const token = () => process.env.DISCOGS_TOKEN;

async function discogs(path: string) {
  const r = await fetch(`https://api.discogs.com${path}`, {
    headers: { "User-Agent": DISCOGS_UA, Authorization: `Discogs token=${token()}` },
    next: { revalidate: 3600 },
  });
  if (!r.ok) return null;
  return r.json();
}

const proxied = (url: string) => `/api/cover?url=${encodeURIComponent(url)}`;

export type CoverOption = { url: string; label: string };

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")?.trim();
  const artist = req.nextUrl.searchParams.get("artist")?.trim();
  const album = req.nextUrl.searchParams.get("album")?.trim();
  if (!id && !(artist && album))
    return Response.json({ error: "id or artist+album required" }, { status: 400 });

  const key = id ? `covers:v1:${id}` : `covers:v1:${artist}|${album}`.toLowerCase();
  const sb = getSupabaseAdminClient();
  if (sb) {
    const { data } = await sb
      .from("discogs_search_cache")
      .select("results, created_at")
      .eq("query", key)
      .maybeSingle();
    if (data && Date.now() - new Date(data.created_at).getTime() < 30 * 864e5) {
      return Response.json({ ...data.results, cached: true });
    }
  }

  const covers: CoverOption[] = [];
  const seen = new Set<string>();
  const add = (url: string | null | undefined, label: string) => {
    if (!url || seen.has(url)) return;
    seen.add(url);
    covers.push({ url: proxied(url), label });
  };

  if (id && token()) {
    const release = await discogs(`/releases/${encodeURIComponent(id)}`);
    for (const img of (release?.images ?? []) as { uri?: string; type?: string }[]) {
      add(img.uri, img.type === "primary" ? "Esta edición" : "De esta edición");
    }

    /* Las otras prensadas, que es lo que se está buscando casi siempre: la
       misma música con otra funda. Veinticinco es de sobra para reconocer la
       tuya y no tanto como para tener que buscarla en una cuadrícula. */
    const masterId = release?.master_id;
    if (masterId) {
      const versions = await discogs(`/masters/${masterId}/versions?per_page=25&sort=released`);
      for (const v of (versions?.versions ?? []) as {
        thumb?: string;
        cover_image?: string;
        country?: string;
        released?: string;
        format?: string;
      }[]) {
        const year = (v.released ?? "").slice(0, 4);
        add(v.cover_image ?? v.thumb, [year, v.country].filter(Boolean).join(" · ") || "Otra edición");
      }
    }
  }

  /* La tienda de música, al final y sin condiciones: es la más limpia cuando
     las escaneadas están torcidas, y la peor cuando lo que tienes es una
     prensada rara que allí no existe. Quien elige lo ve. */
  if (artist && album) {
    try {
      const q = encodeURIComponent(`${artist} ${album}`);
      const r = await fetch(
        `https://itunes.apple.com/search?term=${q}&entity=album&limit=3`,
        { next: { revalidate: 86400 } },
      );
      if (r.ok) {
        const d = (await r.json()) as { results?: { artworkUrl100?: string }[] };
        for (const row of d.results ?? []) {
          const big = row.artworkUrl100?.replace(/100x100bb/, "1000x1000bb");
          if (big) {
            if (seen.has(big)) continue;
            seen.add(big);
            covers.push({ url: big, label: "Carátula digital" });
          }
        }
      }
    } catch {
      /* sin carátula de tienda: quedan las del catálogo */
    }
  }

  const payload = { covers: covers.slice(0, 40) };
  if (sb && covers.length > 0) {
    void sb
      .from("discogs_search_cache")
      .upsert({ query: key, results: payload }, { onConflict: "query" })
      .then(
        () => {},
        () => {},
      );
  }
  return Response.json(payload);
}
