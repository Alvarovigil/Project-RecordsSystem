/**
 * PLACEHOLDER community layer.
 *
 * Everything here is generated locally so the social surfaces can be designed
 * and tested before there is a backend. It is deterministic — the same record
 * always shows the same friends and lists — so the UI can be reasoned about,
 * screenshotted and demoed without a database.
 *
 * When Supabase lands (see docs/ARQUITECTURA.md) these functions become
 * queries: friendsWithRecord → follows ⋈ list_items, listsWithRecord → the
 * list_items(release_id) index, which is the whole point of the bridge.
 */

import { DEMO_FRIENDS } from "@/lib/demo";

const FOLLOW_KEY = "vinilos.community.follows.v1";

export type CommunityUser = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  initials: string;
};

export type CommunityList = {
  id: string;
  title: string;
  ownerId: string;
  description: string;
  vinylIds: string[];
  /** cuánta gente la tiene en su estantería */
  saves: number;
  /** cuánta gente pasó por delante y le gustó — siempre más que las guardadas */
  likes: number;
  updated: string;
};

/** friend + the list of theirs that holds the record */
export type FriendWithRecord = {
  user: CommunityUser;
  viaListId: string;
  viaListTitle: string;
};

// ---------------------------------------------------------------- seeded rng
function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function rng(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(r: () => number, arr: T[]) => arr[Math.floor(r() * arr.length)];

// ---------------------------------------------------------------- fake people
const PEOPLE: Omit<CommunityUser, "initials">[] = [
  { id: "u-marta", name: "Marta Ferrán", handle: "martaferran", bio: "Colecciono ediciones españolas de los 90 y bandas sonoras raras." },
  { id: "u-nacho", name: "Nacho Beltrán", handle: "nachobeltran", bio: "Hip hop, funk y todo lo que suene a sampler." },
  { id: "u-luci", name: "Luci Arroyo", handle: "luciarroyo", bio: "Discos que suenan mejor de noche." },
  { id: "u-teo", name: "Teo Vidal", handle: "teovidal", bio: "Prensados originales o nada. Tienda los sábados." },
  { id: "u-ines", name: "Inés Camarena", handle: "inescamarena", bio: "Jazz, kraut y una debilidad por las portadas feas." },
  { id: "u-bruno", name: "Bruno Sáez", handle: "brunosaez", bio: "Archivo sonoro personal. 12 años, 900 discos." },
  { id: "u-alba", name: "Alba Ferreiro", handle: "albaferreiro", bio: "Pop de cámara y ediciones limitadas." },
];

const USERS: CommunityUser[] = PEOPLE.map((p) => ({
  ...p,
  initials: p.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
}));

const LIST_TITLES = [
  "Domingos de resaca",
  "Prensados que valen la pena",
  "Sonido de sótano",
  "Portadas antes que canciones",
  "Lo que pongo cuando cocino",
  "Rarezas de mercadillo",
  "Para escuchar con auriculares",
  "Segunda mano, primera fila",
  "El turno de noche",
  "Traído de Lisboa",
  "Novedades que aguantan",
  "Cara B",
];

const LIST_NOTES = [
  "Sin orden ni criterio, solo discos que vuelvo a poner.",
  "Voy añadiendo lo que encuentro en tiendas de barrio.",
  "Un rack que empezó como broma y ya va por 40 discos.",
  "Lo que suena en casa entre semana.",
  "Ediciones que me costó encontrar más de lo razonable.",
];

/**
 * Every list handed out gets remembered, so a list can later be looked up by
 * id alone (the generator needs a seed otherwise, and the same list is reached
 * from two different seeds: a record's bridge and its owner's profile).
 *
 * Persisted so a followed list survives a reload. Placeholder data only —
 * this whole registry disappears when the real backend answers.
 */
const REGISTRY_KEY = "vinilos.community.registry.v1";
const REGISTRY = new Map<string, CommunityList>(loadRegistry());

function loadRegistry(): [string, CommunityList][] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(REGISTRY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function remember(list: CommunityList) {
  REGISTRY.set(list.id, list);
  if (typeof window === "undefined") return;
  try {
    // bounded: this is a cache of make-believe, not a database
    const entries = [...REGISTRY.entries()].slice(-300);
    localStorage.setItem(REGISTRY_KEY, JSON.stringify(entries));
  } catch {}
}

export function getGeneratedList(id: string): CommunityList | undefined {
  return REGISTRY.get(id);
}

/** The whole placeholder roster, for search and listings. */
export function allUsers(): CommunityUser[] {
  return USERS;
}

export function getUserByHandle(handle: string): CommunityUser | undefined {
  return USERS.find((u) => u.handle === handle);
}

export function getUser(id: string): CommunityUser | undefined {
  return USERS.find((u) => u.id === id);
}

/**
 * Lists in the community that contain a given record. This is the bridge: a
 * record is the doorway into other people's collections.
 */
export function listsWithRecord(vinylId: string, allVinylIds: string[]): CommunityList[] {
  const r = rng(hash(`lists:${vinylId}`));
  const howMany = 3 + Math.floor(r() * 4); // 3–6
  const others = allVinylIds.filter((id) => id !== vinylId);
  const used = new Set<string>();

  return Array.from({ length: howMany }, (_, i) => {
    let title = pick(r, LIST_TITLES);
    while (used.has(title)) title = pick(r, LIST_TITLES);
    used.add(title);

    const owner = pick(r, USERS);
    const size = 6 + Math.floor(r() * 20);
    const members = [vinylId];
    for (let k = 0; k < size && others.length; k++) {
      const cand = others[Math.floor(r() * others.length)];
      if (!members.includes(cand)) members.push(cand);
    }
    const list: CommunityList = {
      id: `cl-${hash(`${vinylId}:${title}:${i}`).toString(36)}`,
      title,
      ownerId: owner.id,
      description: pick(r, LIST_NOTES),
      vinylIds: members,
      saves: Math.floor(r() * 380),
      // un me gusta cuesta un gesto y guardar cuesta sitio en tu estantería,
      // así que el corazón siempre va por delante; los datos de mentira que
      // no respetan esa proporción hacen diseñar la tarjeta contra un mundo
      // que no existe
      likes: Math.floor(r() * 380) * 3 + 12,
      updated: pick(r, ["hace 2 días", "hace una semana", "hace un mes", "ayer", "hace 3 días"]),
    };
    remember(list);
    return list;
  });
}

/** People you follow who own this record, and the list it sits in. */
export function friendsWithRecord(
  vinylId: string,
  allVinylIds: string[],
): FriendWithRecord[] {
  const r = rng(hash(`friends:${vinylId}`));
  const lists = listsWithRecord(vinylId, allVinylIds);
  const howMany = Math.floor(r() * 4); // 0–3, so the empty state is real
  const seen = new Set<string>();
  const out: FriendWithRecord[] = [];
  for (let i = 0; i < howMany; i++) {
    const l = lists[Math.floor(r() * lists.length)];
    const u = getUser(l.ownerId);
    if (!u || seen.has(u.id)) continue;
    seen.add(u.id);
    out.push({ user: u, viaListId: l.id, viaListTitle: l.title });
  }
  return out;
}

/** Everything this person has published. */
export function listsOfUser(userId: string, allVinylIds: string[]): CommunityList[] {
  const r = rng(hash(`profile:${userId}`));
  const howMany = 2 + Math.floor(r() * 4);
  const used = new Set<string>();
  return Array.from({ length: howMany }, (_, i) => {
    let title = pick(r, LIST_TITLES);
    while (used.has(title)) title = pick(r, LIST_TITLES);
    used.add(title);
    const size = 5 + Math.floor(r() * 18);
    const members: string[] = [];
    for (let k = 0; k < size && allVinylIds.length; k++) {
      const cand = allVinylIds[Math.floor(r() * allVinylIds.length)];
      if (!members.includes(cand)) members.push(cand);
    }
    const list: CommunityList = {
      id: `cl-${hash(`${userId}:${title}:${i}`).toString(36)}`,
      title,
      ownerId: userId,
      description: pick(r, LIST_NOTES),
      vinylIds: members,
      saves: Math.floor(r() * 380),
      // un me gusta cuesta un gesto y guardar cuesta sitio en tu estantería,
      // así que el corazón siempre va por delante; los datos de mentira que
      // no respetan esa proporción hacen diseñar la tarjeta contra un mundo
      // que no existe
      likes: Math.floor(r() * 380) * 3 + 12,
      updated: pick(r, ["hace 2 días", "hace una semana", "hace un mes", "ayer"]),
    };
    remember(list);
    return list;
  });
}

// ------------------------------------------------------------ follow (local)
/**
 * Nobody follows anybody on their first visit, and a feed that opens empty
 * reads as a broken product rather than a new one. The preview arrives with a
 * few people already followed — and unfollowing them sticks, because the empty
 * state is then a choice you made.
 */
export function loadFollows(): string[] {
  if (typeof window === "undefined") return DEMO_FRIENDS;
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    if (raw === null) return DEMO_FRIENDS;
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveFollows(ids: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(FOLLOW_KEY, JSON.stringify(ids));
}
