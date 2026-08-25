/**
 * The preview: what someone sees when they choose "ver sin cuenta".
 *
 * Not an empty product with a banner on top — a collector who already exists.
 * A visitor should be able to walk in, put a record on, open a list, follow a
 * thread into someone else's shelf, and understand what this is for before
 * being asked for anything.
 *
 * Everything here is placeholder data and disappears the moment there is a
 * real account behind the app.
 */
import type { Profile } from "@/lib/data/types";

/** Whoever is browsing borrows this identity while they look around. */
export const DEMO_PROFILE: Profile = {
  // the id stays "local" because that is what the local backend calls itself
  id: "local",
  username: "vera",
  displayName: "Vera Ontañón",
  bio: "Treinta discos, ninguno por casualidad. Bandas sonoras, soul y lo que traigo de los mercadillos del domingo.",
  avatarUrl: null,
};

/** People from the placeholder community this collector already follows. */
export const DEMO_FRIENDS = ["u-marta", "u-teo", "u-ines", "u-luci"];

export type DemoList = {
  id: string;
  name: string;
  description: string;
  vinylIds: string[];
};

/**
 * Lists with a point of view. A shelf sorted alphabetically teaches nothing;
 * a list called "El turno de noche" tells you what the product is for.
 */
export const DEMO_LISTS: DemoList[] = [
  {
    id: "demo-noche",
    name: "El turno de noche",
    description: "Para cuando la casa ya está en silencio y no hay prisa.",
    vinylIds: [
      "tame-impala-currents-7252111",
      "billie-eilish-when-we-all-fall-asleep-where-do-we-go-14405981",
      "gorillaz-demon-days-36145336",
      "noga-erez-the-vandalist-31803860",
      "billie-eilish-hit-me-hard-and-soft-34773263",
    ],
  },
  {
    id: "demo-domingo",
    name: "Domingos largos",
    description: "Los que pongo enteros mientras cocino y no toco el brazo.",
    vinylIds: [
      "fleetwood-mac-rumours-526351",
      "eagles-hotel-california-1571555",
      "etta-james-at-last-5466884",
      "dire-straits-brothers-in-arms-2462721",
      "led-zeppelin-led-zeppelin-iv-1015465",
    ],
  },
  {
    id: "demo-bandas",
    name: "Bandas sonoras que aguantan solas",
    description: "Sin la película delante siguen siendo discos, que no es poco.",
    vinylIds: [
      "various-pulp-fiction-music-from-the-motion-picture-376354",
      "hans-zimmer-dune-part-two-original-motion-picture-soundtrack-29970571",
      "maurice-jarre-original-soundtrack-recording-lawrence-of-arabia-18754147",
      "john-williams-star-wars-the-last-jedi-original-motion-picture-soundtrack-11713857",
      "various-guardians-of-the-galaxy-awesome-mix-vol-1-6149924",
      "various-guardians-of-the-galaxy-awesome-mix-vol-2-28363360",
      "hans-zimmer-live-26069311",
    ],
  },
  {
    id: "demo-rosalia",
    name: "Rosalía, los tres",
    description: "Un artista contado en orden: el disco de tesis, el ruido y la calma.",
    vinylIds: [
      "rosalia-el-mal-querer-12746598",
      "rosalia-motomami-23206178",
      "rosalia-lux-35578378",
    ],
  },
  {
    id: "demo-mercadillo",
    name: "Rarezas de mercadillo",
    description: "Tres euros la pieza. Alguno no lo pondría con gente delante.",
    vinylIds: [
      "vanilla-ice-to-the-extreme-2720530",
      "guru-josh-infinity-the-remix-177348",
      "elvis-presley-el-rock-and-roll-de-elvis-25793236",
      "estopa-estopa-9267144",
      "various-the-many-faces-of-elton-john-14200924",
    ],
  },
];

/** Records wished for, not owned — the wishlist has to mean something too. */
export const DEMO_WISHLIST = [
  "bad-bunny-debi-tirar-mas-fotos-35474179",
  "cypress-hill-black-sunday-12387973",
  "elvis-presley-hits-in-red-10634709",
];
