export type Track = {
  position: string;
  title: string;
  duration: string;
};

export type Vinyl = {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  label: string;
  country: string;
  palette: string[];
  discogsId: number | null;
  cover: string | null;
  previewUrl: string | null;
  tracklist: Track[];
};

/**
 * What a record shop puts on the shelf talker.
 *
 * Not stored: read from Discogs when somebody opens the card. See
 * `app/api/discogs/specs/route.ts` for why it is not a column.
 */
export type RecordSpecs = {
  label: string | null;
  /** the catalogue number — the one thing that identifies a pressing */
  catno: string | null;
  /** "LP, Album, Reissue, 180 g", already written as one line */
  formats: string[];
  country: string | null;
  released: string | null;
  genres: string[];
  styles: string[];
  pressedBy: string | null;
  barcode: string | null;
  /** what is etched in the run-out groove */
  matrix: string | null;
  credits: { role: string; names: string[] }[];
  notes: string | null;
  have: number | null;
  want: number | null;
  rating: number | null;
  ratingCount: number | null;
  lowestPrice: number | null;
  forSale: number | null;
  url: string;
};
