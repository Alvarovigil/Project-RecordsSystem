import { NextRequest } from "next/server";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import { catalogueFetch, catalogueRoom, rateLimitedResponse } from "@/lib/discogs-budget";

/**
 * Read at request time, never at module scope.
 *
 * `const TOKEN = process.env.DISCOGS_TOKEN` runs once, when the module is first
 * loaded — and whatever it saw then is what this route believes forever. On
 * Vercel that captured an undefined, and every Discogs call in production
 * failed with "DISCOGS_TOKEN missing": no search, no barcode, no way to add a
 * record at all. A function call costs nothing and cannot go stale.
 */
const token = () => process.env.DISCOGS_TOKEN;


type DiscogsResult = {
  id: number;
  title: string;
  year?: number;
  country?: string;
  label?: string | string[];
  genre?: string | string[];
  cover_image?: string;
  thumb?: string;
  format?: string[];
  community?: { want?: number; have?: number };
  master_id?: number;
  type?: string;
};

function stripAccents(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function norm(s: string) {
  return stripAccents(s).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * How this request went upstream, so the interface can say so.
 *
 * Discogs allows sixty queries a minute for the whole application. When it
 * starts refusing them this route used to return an empty list —
 * indistinguishable, from the outside, from "that record does not exist". The
 * counting is cheap; the honesty is not optional.
 */
type Health = { ok: number; failed: number; rateLimited: boolean; retryAfter: number };

async function discogsSearch(
  params: Record<string, string>,
  health: Health,
  signal?: AbortSignal,
) {
  const url = new URL("https://api.discogs.com/database/search");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("per_page", "100");
  const r = await catalogueFetch(url, { signal, revalidate: 60 });
  if (r.kind === "rate_limited") {
    health.failed += 1;
    health.rateLimited = true;
    health.retryAfter = Math.max(health.retryAfter, r.retryAfter);
    return [] as DiscogsResult[];
  }
  if (r.kind === "failed") {
    health.failed += 1;
    return [] as DiscogsResult[];
  }
  health.ok += 1;
  return ((r.data as { results?: DiscogsResult[] })?.results ?? []) as DiscogsResult[];
}

/** a partir de cuántas filas útiles se da la búsqueda por buena y no se pregunta más */
const ENOUGH = 8;

export async function GET(req: NextRequest) {
  if (!token()) {
    return Response.json({ error: "DISCOGS_TOKEN missing" }, { status: 500 });
  }
  /**
   * An artist page asks a narrower question than the search box does.
   *
   * The box fans out into a dozen queries because it does not know whether
   * you typed a title, a name, or both. `?artist=` knows, so it asks twice —
   * releases and masters — which matters: Discogs allows sixty requests a
   * minute for this whole application, and spending twelve of them to answer
   * "what else did Rosalía put out" would price the feature out of existence.
   */
  const artistOnly = req.nextUrl.searchParams.get("artist")?.trim();
  const raw = artistOnly ?? req.nextUrl.searchParams.get("q")?.trim();
  if (!raw) return Response.json({ results: [] });
  // una o dos letras no son una búsqueda: no se gasta el minuto en ellas
  if (!artistOnly && norm(raw).length < 2) return Response.json({ results: [] });

  /**
   * The cache is checked before a single upstream request is made.
   *
   * Keyed on the normalised query, so "Rosalía — El Mal Querer" and "rosalia
   * el mal querer" are one entry rather than two. A hit costs one row read and
   * nothing at Discogs, which is the whole point: the second person to look
   * for Rumours should not pay for it.
   */
  const sb = getSupabaseAdminClient();
  // a separate cache namespace: the same words asked two different ways are
  // two different answers
  /* La versión va en la clave. v2: las filas guardadas se filtraron con la
     regla blanda anterior (los VHS). v3: hasta aquí se guardaban también las
     respuestas a medias por el límite, y alguna se quedaría un mes. */
  const cacheKey = artistOnly ? `artist:v3:${norm(raw)}` : `v3:${norm(raw)}`;
  if (sb && cacheKey) {
    const { data } = await sb
      .from("discogs_search_cache")
      .select("results, created_at")
      .eq("query", cacheKey)
      .maybeSingle();
    const fresh =
      data && Date.now() - new Date(data.created_at).getTime() < 30 * 864e5;
    if (fresh) {
      // counted, not ignored: which searches repeat is what will tell us
      // later whether the twelve-query fan-out is worth what it costs
      void sb.rpc("bump_discogs_cache", { q: cacheKey }).then(
        () => {},
        () => {},
      );
      return Response.json({ results: data.results, cached: true });
    }
  }

  const stripped = stripAccents(raw);
  const hasAccents = raw !== stripped;
  const normQ = norm(raw);
  const signal = req.signal;

  /**
   * La cascada, por etapas y solo hasta donde haga falta.
   *
   * Antes cada búsqueda lanzaba de golpe cinco consultas, más dos por cada
   * hueco entre palabras, y el doble si había tildes: «fleetwood mac rumours»
   * eran nueve, y escribir la frase entera costaba más que el minuto entero
   * del catálogo. Casi siempre la primera pareja ya trae lo que se busca.
   *
   * 1. Texto libre, ediciones y masters: 2 consultas.
   * 2. Si salen menos de ocho filas útiles: por artista, por título y, si hay
   *    tildes, el texto libre sin ellas. 3 o 4 más.
   * 3. Si sigue corto y son varias palabras: artista + título partiendo la
   *    frase (como mucho por dos sitios). Hasta 4 más.
   *
   * Antes de cada etapa se mira si cabe en el presupuesto del minuto; si no
   * cabe, se para y se dice que la respuesta va a medias.
   */
  const stages: Record<string, string>[][] = [];
  if (artistOnly) {
    stages.push([
      { artist: raw, type: "release" },
      { artist: raw, type: "master" },
    ]);
    if (hasAccents)
      stages.push([
        { artist: stripped, type: "release" },
        { artist: stripped, type: "master" },
      ]);
  } else {
    stages.push([
      { query: raw, type: "release" },
      { query: raw, type: "master" },
    ]);
    const second: Record<string, string>[] = [
      { artist: raw, type: "release" },
      { artist: raw, type: "master" },
      { release_title: raw, type: "release" },
    ];
    if (hasAccents) second.push({ query: stripped, type: "release" });
    stages.push(second);
    // "etta james at last" → artist=etta james + title=at last, …
    // Discogs's q= does not always tokenise an artist and a title together.
    const tokens = stripped.split(/\s+/).filter(Boolean);
    if (tokens.length >= 2) {
      const splits: Record<string, string>[] = [];
      const cuts = tokens.length === 2 ? [1] : [1, 2];
      for (const i of cuts) {
        const artist = tokens.slice(0, i).join(" ");
        const title = tokens.slice(i).join(" ");
        splits.push({ artist, release_title: title, type: "release" });
        splits.push({ artist, release_title: title, type: "master" });
      }
      stages.push(splits);
    }
  }

  const health: Health = { ok: 0, failed: 0, rateLimited: false, retryAfter: 0 };
  const flat: DiscogsResult[] = [];
  for (const [i, stage] of stages.entries()) {
    if (signal.aborted) return new Response(null, { status: 499 });
    if (i > 0 && usefulCount(flat) >= ENOUGH) break;
    if (catalogueRoom() < stage.length) {
      // no cabe: mejor decir que va a medias que chocar con el 429
      health.rateLimited = true;
      health.retryAfter = Math.max(health.retryAfter, 10);
      break;
    }
    const got = await Promise.all(stage.map((q) => discogsSearch(q, health, signal)));
    flat.push(...got.flat());
    if (health.rateLimited) break;
  }
  if (signal.aborted) return new Response(null, { status: 499 });

  // dedupe by master_id, preferring RELEASES over masters (releases carry
  // format / cover / year info we need; masters are sparser).
  const byKey = new Map<string, DiscogsResult>();
  for (const r of flat) {
    const key = r.master_id ? `m${r.master_id}` : `r${r.id}-${r.type ?? ""}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, r);
    } else if (prev.type === "master" && r.type === "release") {
      // upgrade: master → release
      byKey.set(key, r);
    } else if (
      prev.type === "release" &&
      r.type === "release" &&
      (r.format ?? []).some((f) => /vinyl|lp/i.test(f)) &&
      !(prev.format ?? []).some((f) => /vinyl|lp/i.test(f))
    ) {
      // upgrade: non-vinyl release → vinyl release (same master)
      byKey.set(key, r);
    }
  }
  const merged = Array.from(byKey.values());

  /**
   * Esto es una aplicación de vinilos, así que lo que no es un vinilo no sale.
   *
   * El filtro era blando: dejaba pasar cualquier resultado sin formato y —
   * peor — cualquier «master», que es donde el catálogo agrupa todas las
   * ediciones de un disco. Un master de un recopilatorio que solo salió en CD
   * es un master, así que pasaba; y como el VHS ni siquiera estaba en la lista
   * de formatos descartados, buscar un grupo español devolvía cintas de vídeo.
   *
   * La regla ahora es al revés y es una sola: si el catálogo dice de qué
   * formato es, tiene que ser un disco. Solo cuando no dice nada se le concede
   * el beneficio de la duda, porque hay fichas antiguas sin ese campo y una
   * ficha incompleta no es lo mismo que un CD.
   *
   * Se nombran los soportes que sí son discos — 7", 10", 12", shellac, flexi,
   * acetato — porque la palabra «Vinyl» falta en unas cuantas fichas viejas
   * que sí lo son.
   */
  const isRecord = (r: DiscogsResult) =>
    (r.format ?? []).some((f) =>
      /vinyl|\blp\b|7"|10"|12"|shellac|flexi|acetate/i.test(f),
    );
  const vinylOnly = merged.filter((r) => (r.format ?? []).length === 0 || isRecord(r));
  const isVinylFmt = isRecord;

  const scored = vinylOnly.map((r) => {
    const title = norm(r.title ?? "");
    const startsWithArtist =
      title.startsWith(`${normQ} -`) || title.startsWith(`${normQ} `);
    const containsAll = normQ.split(" ").every((t) => t && title.includes(t));
    // exact phrase match → user probably wants the canonical release
    const containsPhrase = normQ.length > 3 && title.includes(normQ);
    // Exactly the thing asked for, with nothing after it. "Rumours Live" and
    // "Rumours In Concert" both contain the query and both start with the
    // artist, so every earlier signal ties — and the live album was winning on
    // the tiebreak. Being exactly right has to outweigh being merely adjacent.
    const isExact = title === normQ;
    // Words that turn an album into a different record. Only penalised when
    // the query did not ask for them: someone searching "rumours live" should
    // still find it.
    const VARIANT = /\b(live|in concert|concert|alternate|demos?|instrumental|karaoke|remix|remixes|acoustic|rehearsals?|outtakes?|sessions?|tribute|reimagined|orchestral)\b/;
    const isVariant = VARIANT.test(title) && !VARIANT.test(normQ);
    const fmts = r.format ?? [];
    const isVinyl = isVinylFmt(r);
    const isAlbum = fmts.some((f) => /\balbum\b/i.test(f));
    const isSingle = fmts.some((f) => /single|7"/i.test(f));
    const isCompilation = fmts.some((f) => /compilation/i.test(f));
    const isMaster = r.type === "master";
    let score = 0;
    if (startsWithArtist) score += 100;
    if (isExact) score += 150;
    if (isVariant) score -= 120;
    if (containsPhrase) score += 60;
    if (containsAll) score += 30;
    if (isVinyl) score += 40;
    if (isAlbum) score += 25; // prefer full albums
    if (isSingle) score -= 30; // demote 7" singles of theme songs
    if (isCompilation) score -= 5;
    if (isMaster) score += 10;
    score += Math.min(60, Math.log1p(r.community?.want ?? 0) * 6);
    if (r.year && r.year > 1950) score += 1;
    return { r, score };
  });
  scored.sort((a, b) => b.score - a.score);

  // Return up to 30 results so the user gets variety
  // strip Discogs' disambiguator suffixes like "Rosalía (3) - Lux" → "Rosalía - Lux"
  const cleanTitle = (s: string) => s.replace(/\s\(\d+\)/g, "");

  const results = scored.slice(0, 30).map(({ r }) => ({
    id: r.id,
    isMaster: r.type === "master",
    title: cleanTitle(r.title ?? ""),
    year: r.year,
    country: r.country,
    label: Array.isArray(r.label) ? r.label[0] : r.label,
    genre: Array.isArray(r.genre) ? r.genre[0] : r.genre,
    cover_image: r.cover_image,
    thumb: r.thumb,
    format: r.format,
  }));

  /**
   * Only a whole answer is stored.
   *
   * An empty result is far more often Discogs throttling us than a record that
   * does not exist, and a half answer — some queries in, others refused — is
   * worse: stored, it came back for a month with no word that it was missing
   * half the rows. So: something found, and nothing failed on the way.
   */
  const whole = !health.rateLimited && health.failed === 0;
  if (sb && cacheKey && results.length > 0 && whole) {
    void sb
      .from("discogs_search_cache")
      .upsert({ query: cacheKey, results, created_at: new Date().toISOString() })
      .then(
        () => {},
        () => {},
      );
  }

  /**
   * El límite se dice con su código: 429, `{ error: "rate_limited", retryAfter }`
   * y la cabecera Retry-After. Las filas que sí llegaron viajan también
   * (`results`, `degraded`), para que la interfaz pueda enseñarlas con el aviso.
   */
  if (health.rateLimited) {
    return rateLimitedResponse(health.retryAfter || 30, { results, degraded: "rate-limit" });
  }

  /**
   * `degraded` says the answer is incomplete and why. The interface turns it
   * into a sentence; nothing here decides what that sentence is.
   */
  const degraded =
    health.ok === 0 && health.failed > 0 ? "down" : health.failed > 0 ? "partial" : null;

  return Response.json({ results, degraded });
}

/** filas que acabarían en pantalla: las que son disco o no dicen qué son */
function usefulCount(rows: DiscogsResult[]) {
  const seen = new Set<string>();
  for (const r of rows) {
    const fmts = r.format ?? [];
    if (fmts.length && !fmts.some((f) => /vinyl|\blp\b|7"|10"|12"|shellac|flexi|acetate/i.test(f)))
      continue;
    seen.add(r.master_id ? `m${r.master_id}` : `r${r.id}`);
  }
  return seen.size;
}
