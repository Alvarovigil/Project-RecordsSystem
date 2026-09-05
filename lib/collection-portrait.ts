import type { Vinyl } from "@/lib/types";

/**
 * El retrato de una colección: lo que dice de alguien lo que tiene.
 *
 * Un perfil que enseña «38 discos · 6 racks · 12 seguidores» está contando
 * inventario. Nadie sigue a nadie por su inventario: se sigue a quien tiene un
 * gusto reconocible, y el gusto está en los propios discos — en que se repita
 * un sello, en que casi todo sea de los setenta, en que haya un país que
 * aparece más de la cuenta.
 *
 * Todo esto se calcula de los discos que ya están en pantalla, sin pedir nada
 * a nadie y sin guardar nada nuevo. Y sale solo cuando hay material suficiente
 * para que signifique algo: un sello que aparece dos veces entre cuarenta
 * discos no es una manía, es una coincidencia, y presentarla como un rasgo es
 * inventarle una personalidad a alguien.
 */
export type Portrait = {
  genre: { name: string; share: number } | null;
  decade: { label: string; count: number } | null;
  label: { name: string; count: number } | null;
  country: { name: string; count: number } | null;
  /** de cuándo es lo más antiguo y lo más nuevo: el arco de la colección */
  span: { from: number; to: number } | null;
};

function top(values: (string | null | undefined)[], min: number) {
  const tally = new Map<string, number>();
  for (const raw of values) {
    const v = (raw ?? "").split(",")[0]?.trim();
    if (v) tally.set(v, (tally.get(v) ?? 0) + 1);
  }
  const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return best && best[1] >= min ? { name: best[0], count: best[1] } : null;
}

/**
 * «los 70», «los 2010».
 *
 * En español el siglo XX se nombra por sus dos últimas cifras y el XXI no: «los
 * 10» no significa nada y «los 1970» suena a inventario. La regla es la del
 * idioma, no la del dato.
 */
function decadeLabel(start: number) {
  return start < 2000 ? `los ${String(start).slice(2)}` : `los ${start}`;
}

/**
 * El reparto por géneros y por décadas, para dibujarlo.
 *
 * Un dato suelto — «sobre todo rock» — es una etiqueta. El reparto entero es
 * una forma: se ve de un vistazo si alguien es monotemático o si tiene tres
 * mundos, y eso no hay manera de decirlo con una frase sin escribir un
 * párrafo. Devuelve porcentajes ya calculados porque quien lo pinta no tiene
 * por qué saber dividir.
 */
export type Slice = { name: string; count: number; share: number };

export function distribution(
  values: (string | null | undefined)[],
  max = 5,
): Slice[] {
  const tally = new Map<string, number>();
  let total = 0;
  for (const raw of values) {
    const v = (raw ?? "").split(",")[0]?.trim();
    if (!v) continue;
    tally.set(v, (tally.get(v) ?? 0) + 1);
    total += 1;
  }
  if (total === 0) return [];
  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({ name, count, share: Math.round((count / total) * 100) }));
}

/**
 * Las décadas, todas y en orden, incluidas las vacías.
 *
 * Sin los huecos no es un histograma, es un ranking: «los 70, los 90, los 60»
 * no dice que haya un agujero en los ochenta, y ese agujero es información
 * sobre alguien. Se dibujan de la primera a la última que tiene algo.
 */
export function decades(records: { year?: number | null }[]) {
  const years = records
    .map((r) => r.year)
    .filter((y): y is number => typeof y === "number" && y > 1900);
  if (years.length < 3) return [];
  const from = Math.floor(Math.min(...years) / 10) * 10;
  const to = Math.floor(Math.max(...years) / 10) * 10;
  const out: { decade: number; count: number }[] = [];
  for (let d = from; d <= to; d += 10)
    out.push({ decade: d, count: years.filter((y) => y >= d && y < d + 10).length });
  return out;
}

/** los artistas que más se repiten, que es de quién no se baja alguien */
export function topArtists(records: { artist: string }[], max = 6) {
  const tally = new Map<string, number>();
  for (const r of records) {
    const a = (r.artist ?? "").trim();
    if (a) tally.set(a, (tally.get(a) ?? 0) + 1);
  }
  return [...tally.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({ name, count }));
}

export function portraitOf(records: Vinyl[]): Portrait {
  const n = records.length;
  // Por debajo de cinco discos no hay retrato que hacer, hay una anécdota.
  if (n < 5) return { genre: null, decade: null, label: null, country: null, span: null };

  /* El umbral sube con el tamaño: en una colección de doscientos discos, tres
     del mismo sello no dicen nada. Un diez por ciento sí. */
  const min = Math.max(2, Math.round(n * 0.1));

  const genre = top(records.map((r) => r.genre), Math.max(2, Math.round(n * 0.15)));
  const label = top(records.map((r) => r.label), min);
  const country = top(records.map((r) => r.country), min);

  const years = records.map((r) => r.year).filter((y): y is number => Boolean(y) && y > 1900);
  const decade = top(
    years.map((y) => String(Math.floor(y / 10) * 10)),
    Math.max(2, Math.round(n * 0.2)),
  );

  return {
    genre: genre ? { name: genre.name, share: Math.round((genre.count / n) * 100) } : null,
    decade: decade ? { label: decadeLabel(Number(decade.name)), count: decade.count } : null,
    label,
    country,
    span: years.length >= 4 ? { from: Math.min(...years), to: Math.max(...years) } : null,
  };
}

/**
 * Los destacados, sin pedirle a nadie que los elija.
 *
 * Lo ideal serían tres discos elegidos a mano, y eso llegará. Mientras tanto
 * hay una señal que ya está en los datos y que además es más honesta que una
 * elección: **qué discos ha colocado en más racks**. Un disco que alguien ha
 * puesto en tres cajones distintos es un disco que le importa — lo ha vuelto a
 * pensar tres veces — y eso no se puede fingir rellenando un formulario.
 *
 * Con empate, el más reciente primero: entre dos discos igual de queridos, el
 * que dice algo de ahora.
 */
export function standoutsOf(
  records: Vinyl[],
  timesFiled: Map<string, number>,
  n = 3,
): Vinyl[] {
  return [...records]
    .sort((a, b) => {
      const d = (timesFiled.get(b.id) ?? 0) - (timesFiled.get(a.id) ?? 0);
      if (d !== 0) return d;
      return (b.year ?? 0) - (a.year ?? 0);
    })
    .slice(0, n);
}
