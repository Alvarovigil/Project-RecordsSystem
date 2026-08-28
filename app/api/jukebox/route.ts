/**
 * The record the landing puts on.
 *
 * A hand-picked stack of songs that anybody who owns a turntable will
 * recognise in two bars. Preview URLs are resolved against iTunes at request
 * time rather than hardcoded: Apple's CDN paths rot, and a dead link here
 * means a silent front door.
 *
 * Cached for a day, so this is one upstream round trip per song per day, not
 * one per visitor.
 */

// iTunes, not Discogs: same courtesy of identifying ourselves, different host.
const UA = "Rackr/1.0 +https://rackr.club";



/** artist, song — the only two things needed to find a preview */
const JUKEBOX: [string, string][] = [
  ["Fleetwood Mac", "Dreams"],
  ["Stevie Wonder", "Superstition"],
  ["The Rolling Stones", "Gimme Shelter"],
  ["David Bowie", "Heroes"],
  ["Marvin Gaye", "What's Going On"],
  ["Talking Heads", "Once in a Lifetime"],
  ["Nirvana", "Smells Like Teen Spirit"],
  ["Daft Punk", "Get Lucky"],
  ["Amy Winehouse", "Back to Black"],
  ["Gorillaz", "Feel Good Inc."],
  ["The Strokes", "Last Nite"],
  ["Queen", "Another One Bites the Dust"],
  ["Héroes del Silencio", "Entre dos tierras"],
  ["Rosalía", "Malamente"],
  ["Camarón de la Isla", "Volando voy"],
  ["Michael Jackson", "Billie Jean"],
  ["Etta James", "At Last"],
  ["Radiohead", "Karma Police"],
  ["Los Planetas", "Segundo premio"],
  ["The Beatles", "Come Together"],
  ["Pink Floyd", "Wish You Were Here"],
  ["The Clash", "Should I Stay or Should I Go"],
  ["Blondie", "Heart of Glass"],
  ["Aretha Franklin", "Respect"],
  ["The Velvet Underground", "Sunday Morning"],
  ["Kraftwerk", "The Model"],
  ["Massive Attack", "Teardrop"],
  ["Portishead", "Glory Box"],
  ["Nina Simone", "Feeling Good"],
  ["Curtis Mayfield", "Move On Up"],
  ["Bob Marley & The Wailers", "Three Little Birds"],
  ["Joy Division", "Love Will Tear Us Apart"],
  ["Tame Impala", "Let It Happen"],
  ["Arctic Monkeys", "Do I Wanna Know?"],
  ["LCD Soundsystem", "Dance Yrself Clean"],
  ["Bomba Estéreo", "Soy yo"],
  ["Extremoduro", "So Payaso"],
  ["Vetusta Morla", "Copenhague"],
  ["Kase.O", "Esto no para"],
];

type Track = {
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  cover: string | null;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

async function resolve(artist: string, song: string): Promise<Track | null> {
  try {
    const url = new URL("https://itunes.apple.com/search");
    url.searchParams.set("term", `${artist} ${song}`);
    url.searchParams.set("entity", "song");
    url.searchParams.set("limit", "8");
    const r = await fetch(url, { headers: { "User-Agent": UA }, next: { revalidate: 86400 } });
    if (!r.ok) return null;
    const data = await r.json();

    const wantedSong = norm(song);
    const wantedArtist = norm(artist);
    const all = (data.results ?? []).filter((t: any) => t.previewUrl);

    // Apple happily answers with covers, karaoke and club remixes by other
    // people — matching the title alone once put a Mau P edit where Tame
    // Impala should have been. The artist has to agree too.
    const byArtist = all.filter((t: any) => {
      const got = norm(t.artistName);
      return got.includes(wantedArtist) || wantedArtist.includes(got);
    });
    // No hit by the right artist means Apple does not carry the original here
    // (it happens by region). Dropping the song beats putting a stranger's
    // club edit on the front page under a name people know.
    if (!byArtist.length) return null;

    const best =
      byArtist.find((t: any) => norm(t.trackName) === wantedSong) ??
      byArtist.find((t: any) => norm(t.trackName).startsWith(wantedSong)) ??
      byArtist[0];

    return {
      title: best.trackName,
      artist: best.artistName,
      album: best.collectionName ?? "",
      previewUrl: best.previewUrl,
      cover: best.artworkUrl100?.replace("100x100", "300x300") ?? null,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  const tracks = (await Promise.all(JUKEBOX.map(([a, s]) => resolve(a, s)))).filter(
    (t): t is Track => t !== null,
  );

  return Response.json(
    { tracks },
    { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
  );
}
