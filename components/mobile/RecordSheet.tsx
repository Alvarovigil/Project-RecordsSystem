"use client";

import { useEffect, useState } from "react";
import LayerLink from "@/components/ui/LayerLink";
import { useEntryGate, useIsVisitor } from "@/hooks/useSession";
import Sheet, { SheetRow } from "@/components/ui/Sheet";
import Avatar from "@/components/ui/Avatar";
import Confirm from "@/components/ui/Confirm";
import RecordSpecsCard from "@/components/RecordSpecsCard";
import {
  CrateIcon,
  IconButton,
  RecordGround,
  RecordHero,
} from "@/components/record/RecordHero";
import RecordScreen, {
  RecordTopBar,
  useScrolledPast,
} from "@/components/record/RecordScreen";
import SaveSheet from "./SaveSheet";
import CoverPicker from "./CoverPicker";
import Tracklist from "./Tracklist";
import Card from "@/components/ui/Card";
import RackRow from "@/components/community/RackRow";
import { rackOfList } from "@/lib/rack";
import ShareSheet from "@/components/ShareSheet";
import { SITE_URL } from "@/lib/site";
import { useToast } from "@/components/ui/Toast";
import { useRepository } from "@/hooks/useRepository";
import { coverFor } from "@/lib/cover";
import { artistSlug, cleanArtist } from "@/lib/artist";
import { warmArtist } from "@/lib/artist-cache";
import type { FriendWithRecord, ListWithRecord } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import { findCollection, findWishlist, isWished, type Collection } from "@/lib/collections";

/**
 * A record, on a phone.
 *
 * On a desktop this is the 3D sleeve opening in place, with metadata flanking
 * it. None of that survives a 390px screen, and cramming it in is how you get
 * the reflowed-website feeling. So the phone gets its own thing: a full-height
 * sheet you throw away downward, artwork at the top, actions where the thumb
 * is, and the community bridge — "quién más tiene este disco" — at the bottom
 * where it belongs, as an invitation rather than an interruption.
 *
 * Actions are ordered by how often they are wanted, not by importance:
 * escuchar, guardar en una lista, and only then the destructive end of the
 * menu. The two ways of removing something are deliberately worded apart —
 * "Quitar de esta lista" is reversible bookkeeping, "Borrar de mi colección"
 * is not — because a single "Eliminar" that means either one is how people
 * lose records.
 */
export default function RecordSheet({
  vinyl,
  onClose,
  collections,
  activeListId,
  playing,
  onTogglePlay,
  onAddTo,
  onRemoveFromActive,
  onDelete,
  onRemoveFromList,
  coverOf,
  onCreateList,
  onChangeCover,
  nowPlayingId,
  playLoading = false,
  anyPlaying = false,
  onPlayTrack,
  canEdit = true,
  pickOnOpen = false,
}: {
  vinyl: Vinyl | null;
  onClose: () => void;
  collections: Collection[];
  activeListId: string;
  playing: boolean;
  onTogglePlay: (v: Vinyl) => void;
  /** resuelve a si se ha guardado de verdad, cuando quien lo da lo sabe */
  onAddTo: (listId: string, v: Vinyl) => Promise<boolean> | void;
  onRemoveFromActive: (v: Vinyl) => void;
  onDelete: (v: Vinyl) => void;
  /**
   * False on somebody else's list.
   *
   * The two ways of removing a record act on YOUR shelf, and offering them
   * over a list you are only visiting is offering to do something to a place
   * you are not in. Everything else — listening, saving it into one of your
   * own lists — is exactly the same act wherever you found the record, which
   * is the point of this sheet being one sheet.
   */
  /** take it out of one particular rack — the save sheet needs this */
  onRemoveFromList?: (listId: string, v: Vinyl) => void;
  /** resolves a record id to a cover, so a rack can show what is inside it */
  coverOf?: (vinylId: string) => string | null;
  /** crear un rack desde la hoja de guardar, con este disco dentro */
  onCreateList?: (name: string) => Promise<string> | string;
  /** quedarse con otra portada: la que de verdad tiene en las manos */
  onChangeCover?: (v: Vinyl, cover: string) => void;
  /** which record — or which track of it — is sounding right now */
  nowPlayingId?: string;
  /** el fragmento pedido aún se está abriendo */
  playLoading?: boolean;
  /**
   * Si suena algo, sea lo que sea.
   *
   * `playing` dice si suena *este disco*, y un tema suelto no es este disco —
   * es un disco sintético con su propio id. Con esa bandera el medidor de la
   * canción que estaba sonando no se movía nunca. La lista necesita las dos
   * cosas: qué suena (`nowPlayingId`) y si está sonando o en pausa.
   */
  anyPlaying?: boolean;
  /** play one track: a synthetic record, so the player learns nothing new */
  onPlayTrack?: (v: Vinyl) => void;
  canEdit?: boolean;
  /** llega desde el catálogo recién guardado: la hoja de racks se despliega */
  pickOnOpen?: boolean;
}) {
  const repo = useRepository();
  const toast = useToast();
  const [elsewhere, setElsewhere] = useState<ListWithRecord[]>([]);
  /* la portada que va dentro del cajón de cada fila: sin ella la miniatura es
     una caja vacía, que es justo lo que no queremos enseñar de un rack lleno */
  const [rackCovers, setRackCovers] = useState<Record<string, string[]>>({});
  const [friends, setFriends] = useState<FriendWithRecord[]>([]);
  /**
   * «Quién más lo tiene» llegó tarde: va debajo de las canciones.
   *
   * La tarjeta va encima de la lista de canciones, y si aparece cuando ya
   * estás leyendo, todo lo de debajo baja y el dedo que iba a una pista cae
   * en otra. El sitio se decide una sola vez: a los 300 ms (mientras la ficha
   * aún está entrando), o antes si las dos respuestas ya han llegado. Si para
   * entonces hay algo que enseñar, arriba; si no, debajo de las canciones,
   * donde no empuja nada que se esté mirando. Después no se mueve: antes, con
   * los racks a los 200 ms y las personas a los 400, se pintaba arriba y a los
   * 300 saltaba abajo.
   */
  const [whoAt, setWhoAt] = useState<"pending" | "top" | "bottom">("pending");
  const [picking, setPicking] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickingCover, setPickingCover] = useState(false);
  const [toWishlist, setToWishlist] = useState(false);
  const { sentinel, scrolled } = useScrolledPast(Boolean(vinyl));
  /** the picker is doing double duty: "guardar en" and "lo tengo, ¿en qué rack?" */
  const [acquiring, setAcquiring] = useState(false);
  /* Sin sesión no hay racks propios: lo «tuyo» es la estantería de ejemplo,
     que no es de nadie. Guardar lleva a entrar, y la hoja nunca dice que el
     disco esté guardado ni se abre sola para colocarlo. */
  const visitor = useIsVisitor();
  const gate = useEntryGate();

  /* Un disco que acaba de entrar en casa se abre con la hoja de racks puesta:
     colocarlo es lo siguiente que se hace, y es la continuación del gesto que
     lo guardó, no una acción nueva. */
  const openId = vinyl?.id;
  useEffect(() => {
    if (openId && pickOnOpen && !visitor) setPicking(true);
  }, [openId, pickOnOpen, visitor]);

  /* Mientras se mira un disco, su artista se va pidiendo por detrás: el enlace
     está ahí y hay bastantes posibilidades de que se pulse. Si se pulsa, no
     queda nada que esperar; si no, ha costado una consulta ya cacheada. */
  useEffect(() => {
    if (vinyl?.artist) warmArtist(cleanArtist(vinyl.artist), vinyl.discogsId ?? null);
  }, [vinyl?.artist, vinyl?.discogsId]);

  useEffect(() => {
    if (!vinyl) return;
    let alive = true;
    setElsewhere([]);
    setFriends([]);
    setWhoAt("pending");
    /** si ya hay algo que enseñar en el momento de decidir */
    let has = false;
    let decided = false;
    const decide = () => {
      if (!alive || decided) return;
      decided = true;
      setWhoAt(has ? "top" : "bottom");
    };
    const late = setTimeout(decide, 300);
    const lists = repo
      .listsWithRelease(vinyl.id)
      .then((ls) => {
        if (!alive) return;
        if (ls.length) has = true;
        setElsewhere(ls);
        if (ls.length)
          repo
            .coversOfLists(ls.map((l) => l.id))
            .then((c) => alive && setRackCovers(c))
            .catch(() => {});
      })
      .catch(() => {});
    const people = repo
      .friendsWithRelease(vinyl.id)
      .then((f) => {
        if (!alive) return;
        if (f.length) has = true;
        setFriends(f);
      })
      .catch(() => {});
    void Promise.allSettled([lists, people]).then(() => {
      clearTimeout(late);
      decide();
    });
    return () => {
      alive = false;
      clearTimeout(late);
    };
  }, [repo, vinyl]);

  if (!vinyl) return null;

  const wished = isWished(collections, vinyl.id);
  /**
   * What the save control says, which is not simply a count.
   *
   * Every record you own is in Mi Colección, so counting containers would
   * print "En 1 rack" on everything and mean nothing. The two predefined
   * lists are states rather than racks — owned, or still wanted — and they
   * only get named when they are the whole answer. The moment a record is in
   * a rack somebody made, that is what the button is about, and the count is
   * of those alone.
   */
  const savedLabel = (() => {
    if (visitor) return null;
    const holding = collections.filter((c) => c.vinylIds.includes(vinyl.id));
    const racks = holding.filter((c) => (c.kind ?? "custom") === "custom");
    if (racks.length > 0) return `En ${racks.length} ${racks.length === 1 ? "rack" : "racks"}`;
    if (holding.some((c) => c.kind === "wishlist")) return "En deseos";
    if (holding.some((c) => c.kind === "collection")) return "En colección";
    return null;
  })();

  const mine = findCollection(collections);
  const wishlist = findWishlist(collections);

  /**
   * Acquiring is one write and its reversal, not a flow.
   *
   * The undo has to put it back in the wishlist explicitly — saving into a
   * list is what took it out, so "deshacer" cannot be "remove from the list
   * we just added to" or the record would end up owned and unwished, which is
   * neither of the two states it was ever in.
   */
  const acquire = async (listId?: string) => {
    const v = vinyl;
    if (!listId || !v) return;
    // «hecho» solo si está hecho: si falla, el aviso de error ya ha salido
    if ((await onAddTo(listId, v)) === false) return;
    const name = collections.find((c) => c.id === listId)?.name ?? "tu colección";
    toast.undo(
      `Añadido a ${name}`,
      () => wishlist && onAddTo(wishlist.id, v),
      { media: { src: coverFor(v) } },
    );
  };

  /**
   * A deseos, con la cuenta delante y el camino de vuelta detrás.
   *
   * Pasar a deseos saca el disco de tu colección y de todos sus racks (la
   * regla de 0021: o lo tienes o lo quieres). Desde «Guardar en» se hacía sin
   * avisar y sin deshacer. Ahora se confirma diciendo cuántos racks pierde, y
   * «Deshacer» lo vuelve a meter donde estaba: primero en la colección (que lo
   * saca de deseos) y después en cada rack, al final de cada uno.
   */
  const ownedIn = vinyl
    ? collections.filter(
        (c) => c.kind !== "wishlist" && !c.sharedBy && c.vinylIds.includes(vinyl.id),
      )
    : [];
  const racksHolding = ownedIn.filter((c) => (c.kind ?? "custom") === "custom").length;
  const moveToWishlist = async () => {
    const v = vinyl;
    if (!v || !wishlist) return;
    // la colección primero: es la que lo saca de deseos al volver
    const before = [...ownedIn].sort(
      (a, b) => Number((a.kind ?? "custom") === "custom") - Number((b.kind ?? "custom") === "custom"),
    );
    if ((await onAddTo(wishlist.id, v)) === false) return;
    toast.undo(
      "Movido a tus deseos",
      async () => {
        for (const c of before) {
          if ((await onAddTo(c.id, v)) === false) return;
        }
      },
      { media: { src: coverFor(v) } },
    );
  };

  /**
   * Sides and containers used to be worked out here. Both moved: the tracklist
   * knows about discs and sides now (it has to, to page between them), and
   * where a record is kept is answered by the save control and its sheet.
   */

  const whoCard = (friends.length > 0 || elsewhere.length > 0) && (
    <Card title="Quién más lo tiene" padded={false}>
      {friends.length > 0 &&
        (friends.length <= 3 ? (
          /**
           * Con dos o tres, filas; con más, carril.
           *
           * Un carril de círculos grandes con dos caras deja media
           * pantalla vacía y obliga a cortar el nombre del rack a
           * la mitad — «Prensados q…», que no dice nada. En fila,
           * cada persona se lleva el ancho entero: la cara, su
           * nombre y en qué rack lo tiene, sin recortar. El carril
           * empieza a tener sentido cuando hay bastantes caras
           * como para que la fila cortada signifique «hay más».
           */
          <ul className="px-2">
            {friends.map((f) => (
              <li key={f.user.id}>
                <LayerLink
                  href={`/u/${f.user.username}`}
                  onNavigate={onClose}
                  className="pressable flex items-center gap-3 rounded-md px-3 py-2.5 transition-colors hover:bg-fill-subtle"
                >
                  <Avatar
                    name={f.user.displayName}
                    handle={f.user.username}
                    src={f.user.avatarUrl}
                    size="md"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 break-words text-body text-paper">
                      {f.user.displayName}
                    </span>
                    <span className="line-clamp-2 break-words text-caption text-content-muted">
                      en {f.viaListTitle}
                    </span>
                  </span>
                </LayerLink>
              </li>
            ))}
          </ul>
        ) : (
          <ul className="rail flex gap-4 px-5 pb-1 pr-10" style={{ scrollPaddingLeft: "1.25rem" }}>
            {friends.slice(0, 12).map((f) => (
              <li key={f.user.id} className="w-[76px] shrink-0">
                <LayerLink
                  href={`/u/${f.user.username}`}
                  onNavigate={onClose}
                  className="pressable block text-center"
                >
                  <Avatar
                    name={f.user.displayName}
                    handle={f.user.username}
                    src={f.user.avatarUrl}
                    size="lg"
                  />
                  <span className="mt-2 block truncate text-caption text-paper">
                    {f.user.displayName}
                  </span>
                  <span className="block truncate text-caption text-content-faint">
                    {f.viaListTitle}
                  </span>
                </LayerLink>
              </li>
            ))}
          </ul>
        ))}

      {elsewhere.length > 0 && (
        <>
          {friends.length > 0 && (
            <h4 className="px-5 pb-1 pt-5 label text-content-faint">
              En estos racks
            </h4>
          )}
          <ul className="px-2">
            {elsewhere.slice(0, 6).map((l) => (
              <li key={l.id}>
                <RackRow
                  rack={rackOfList(l, (rackCovers[l.id] ?? [])[0] ?? null)}
                  density="compact"
                  showOwner
                  wrap
                  className="rounded-md px-3"
                  onClick={onClose}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );

  return (
    <>
      {/**
       * A screen on a phone, a dialog on a desktop.
       *
       * It was a sheet you could throw away, with a scrolling body inside it.
       * That pairing is where iOS gets confused: the drag and the scroll are
       * the same gesture until one of them wins, and when the wrong one does —
       * or when neither does — the page stops answering entirely. Which is
       * exactly the freeze this had, several lists and several records in.
       *
       * A record is not a peek at something behind, it is the thing you went
       * to look at. Full screen says that, and it costs nothing: the way back
       * is a button in the corner rather than a gesture that competes with
       * reading a tracklist.
       */}
      <RecordScreen
        open={Boolean(vinyl)}
        onClose={onClose}
        label={vinyl ? `${vinyl.title}, de ${vinyl.artist}` : undefined}
      >
        <RecordTopBar
          onClose={onClose}
          cover={coverFor(vinyl)}
          title={vinyl.title}
          artist={cleanArtist(vinyl.artist)}
          scrolled={scrolled}
          // sin nada que editar ni portada que guardar, el menú saldría vacío
          onMenu={canEdit || onChangeCover ? () => setMenuOpen(true) : undefined}
          trailing={
            <button
              onClick={() => onTogglePlay(vinyl)}
              disabled={!vinyl.previewUrl}
              aria-label={playing ? "Pausar" : `Escuchar ${vinyl.title}`}
              className="hit flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-paper/25 text-paper transition hover:border-paper/60 disabled:opacity-30"
            >
              {playing ? (
                <svg width="11" height="11" viewBox="0 0 14 14" aria-hidden>
                  <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                  <rect x="8" y="2" width="3" height="10" fill="currentColor" />
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 14 14" aria-hidden className="translate-x-[1px]">
                  <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
                </svg>
              )}
            </button>
          }
        />

        <div className="relative -mt-16 pb-10">
          {/* The sleeve behind the sleeve. It costs nothing — the image is
              already downloaded — and it is what stops a black page with a
              square in the middle from looking like a file browser. */}
          <RecordGround cover={coverFor(vinyl)} />

          {/* The wash starts at the very top of the screen — the column it
              lives in is pulled up under the header — so the content puts the
              header's height back, or the sleeve would begin under the back
              button. */}
          <div className="relative mx-auto w-full max-w-[440px] px-5 pt-16">
            <RecordHero
              cover={coverFor(vinyl)}
              title={vinyl.title}
              artist={cleanArtist(vinyl.artist)}
              artistHref={`/artista/${artistSlug(vinyl.artist)}`}
              facts={[vinyl.year, vinyl.genre, vinyl.label, vinyl.country]}
              onNavigate={onClose}
              sentinel={sentinel}
            />

            {/**
             * Play, as a play button.
             *
             * It was a wide capsule with the word "Escuchar" in it, which is
             * the shape a form's submit button has. Nothing else in music
             * labels this control: a filled circle with a triangle in it is
             * understood by everyone who has ever used a phone, it reads at a
             * glance instead of being read, and it stops the row from looking
             * like a toolbar of three equal things.
             *
             * Bigger than the two beside it on purpose. It stays the only
             * filled control on the screen — one thing here is the obvious
             * thing to do, and it should look like it — and the size is what
             * carries the hierarchy now that the word is gone.
             *
             * The label survives for anyone not looking at it, and it says
             * what will happen rather than what the button is.
             */}
            <div className="mt-6 flex items-center gap-3">
              <button
                onClick={() => onTogglePlay(vinyl)}
                disabled={!vinyl.previewUrl}
                aria-label={
                  playing
                    ? "Pausar"
                    : vinyl.previewUrl
                      ? `Escuchar ${vinyl.title}`
                      : "Este disco no tiene fragmento"
                }
                /* The same 44px as the controls beside it. It was 56 to carry
                   the hierarchy on its own; the save control next to it now
                   says what it is in words, so the row has a shape without
                   needing one button to shout. Filled is still what marks it
                   as the thing to press. */
                className="pressable flex h-tap w-tap shrink-0 items-center justify-center rounded-full bg-paper text-ink disabled:opacity-30"
              >
                {playing ? (
                  <svg width="15" height="15" viewBox="0 0 14 14" aria-hidden>
                    <rect x="3" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
                    <rect x="8" y="2" width="3" height="10" rx="0.6" fill="currentColor" />
                  </svg>
                ) : (
                  /* nudged right by a hair: a triangle centred on its bounding
                     box looks off-centre inside a circle, which is why every
                     play button ever drawn is offset */
                  <svg width="16" height="16" viewBox="0 0 14 14" aria-hidden className="translate-x-[1px]">
                    <path d="M3 1.8 L12 7 L3 12.2 Z" fill="currentColor" />
                  </svg>
                )}
              </button>

              {/**
               * The save control says what it knows.
               *
               * It was a bookmark glyph and nothing else, which asks you to
               * press it to find out whether you have already pressed it. The
               * answer was one tap away and there was no reason not to print
               * it: a record is either somewhere or it is not, and if it is,
               * how many places is the next thing anybody wants.
               *
               * It takes the width left over, so the row reads as one action
               * with two shortcuts beside it rather than as four equal icons.
               */}
              <button
                onClick={() => (gate() ? undefined : setPicking(true))}
                aria-label={
                  visitor
                    ? "Entra para guardarlo"
                    : savedLabel
                      ? `Guardado: ${savedLabel}. Cambiar.`
                      : "Guardar en un rack"
                }
                className={`pressable flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sub font-medium transition-colors ${
                  savedLabel
                    ? "bg-fill text-paper hover:bg-fill-strong"
                    : "border border-line-strong text-content hover:border-line-focus"
                }`}
              >
                {/* Una caja, no un marcador: es el objeto que dibuja el
                    resto de la aplicación para decir «guardado». */}
                <CrateIcon />
                <span className="truncate">
                  {visitor ? "Entra para guardarlo" : (savedLabel ?? "Guardar")}
                </span>
              </button>

              <IconButton label="Compartir" onClick={() => setSharing(true)}>
                <path
                  d="M8 10.5V2.6 M5 5.4 L8 2.4 L11 5.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M3.2 9.4v3.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V9.4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </IconButton>

            </div>

            {/* --------------------------------------------------- lo tengo */}
            {/**
             * The wishlist's one-way door.
             *
             * A wanted record has exactly one interesting thing that can
             * happen to it, and it is not "guardar en una lista" three taps
             * deep behind a bookmark icon — it is *you bought it*. So while a
             * record is wished, that gets a control of its own, full width,
             * under the row.
             *
             * Nothing here is a new concept in the data: owned and wished are
             * already mutually exclusive, and saving a record into any list
             * takes it out of the wishlist — `Mi Colección` is simply
             * everything you have that you are not still waiting for. This
             * button is that rule, said out loud.
             */}
            {wished && canEdit && !visitor && (
              <div className="mt-2.5 flex items-center gap-2.5">
                <button
                  onClick={() => acquire(mine?.id)}
                  className="pressable flex h-12 flex-1 items-center justify-center gap-2 rounded-full border border-line-strong text-body font-medium text-content"
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                    <path d="M2.5 7.4 L5.6 10.5 L11.5 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  Ya lo tengo
                </button>
                {/* the same act, aimed somewhere else — a rack you keep for
                    this, rather than the collection at large */}
                <button
                  onClick={() => {
                    setAcquiring(true);
                    setPicking(true);
                  }}
                  aria-label="Lo tengo, guardar en un rack"
                  className="pressable flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-line-strong text-content-muted"
                >
                  <svg width="10" height="10" viewBox="0 0 8 8" fill="none" aria-hidden>
                    <path d="M1 2.5 L4 5.5 L7 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}

            <div className="mt-7 space-y-2.5">
              {/* "Ya está en" used to sit here as a card of pills. The save
                  control says it now — "En 2 racks" — and the sheet behind it
                  shows which, so the card was the same answer given twice, the
                  second time without a way to act on it. */}
              {/**
               * The reason this app exists, on the screen where it happens.
               *
               * A record page that only describes the object is a catalogue
               * entry. What makes this Rackr is the answer to the two things
               * somebody wants right after "what is this": who that I follow
               * has it, and which racks it lives in.
               *
               * Faces rather than rows for the friends: a name in a list is a
               * string, and a photograph of somebody you follow is a person.
               * That difference is the whole feature.
               */}
              {whoAt === "top" && whoCard}

              {/* One disc at a time, its sides under it, and the titles
                  playable — see Tracklist. */}
              <Tracklist
                vinyl={vinyl}
                nowPlayingId={nowPlayingId}
                playing={anyPlaying}
                loading={playLoading}
                onPlayTrack={onPlayTrack ?? (() => {})}
              />

              {whoAt === "bottom" && whoCard}

              {/* Folded away under the songs, which is where the question
                  belongs in time: you decide to listen, you decide to keep it,
                  and only then — still holding the sleeve — do you wonder
                  which pressing this is. */}
              <RecordSpecsCard discogsId={vinyl.discogsId} />

            </div>
          </div>
        </div>

      </RecordScreen>

      {/**
       * The secondary verbs, and only the ones that are not already on screen.
       *
       * It had "Guardar en un rack" and "Compartir" in it, which are the two
       * controls sitting three centimetres above it — a menu whose first job
       * is to repeat the toolbar is a menu nobody trusts to hold anything
       * else. And it opened with the record's name, which you have just been
       * looking at, on a screen that is entirely about that record.
       *
       * What is left is the two things that change where a record lives, with
       * room around them: at this size a menu row is a target for a thumb, not
       * a line of a list.
       */}
      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} size="auto" width={380}>
        <div className="py-3">
          {/**
           * Corregir la portada, antes que nada de lo demás.
           *
           * Es lo único de este menú que arregla algo que está mal ahora
           * mismo delante de quien lo abre: el catálogo eligió una imagen y no
           * es la del disco que tiene en las manos. Lo demás son decisiones
           * sobre el disco; esto es una errata.
           *
           * Solo si quien abre la hoja sabe guardar la portada: sin
           * onChangeCover la elección no iba a ninguna parte y la fila
           * prometía un arreglo que no hacía.
           */}
          {onChangeCover && (
          <SheetRow
            icon={
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                <rect x="2.6" y="2.6" width="12.8" height="12.8" rx="1.4" stroke="currentColor" strokeWidth="1.3" />
                <circle cx="6.8" cy="6.8" r="1.3" stroke="currentColor" strokeWidth="1.2" />
                <path d="M3 12.4 6.9 9l3.1 2.6 2.3-1.9 2.7 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label="Cambiar la portada"
            onClick={() => {
              setMenuOpen(false);
              setPickingCover(true);
            }}
          />
          )}
          {canEdit && <div className="my-2 h-px bg-line" />}
          {canEdit && !wished && (
            <SheetRow
              icon={
                <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                  <path
                    d="M9 15.2S2.4 11.3 2.4 6.9a3.4 3.4 0 0 1 6.6-1.2 3.4 3.4 0 0 1 6.6 1.2c0 4.4-6.6 8.3-6.6 8.3Z"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                  />
                </svg>
              }
              label="Mover a deseos"
              onClick={() => {
                setMenuOpen(false);
                setToWishlist(true);
              }}
            />
          )}
          {canEdit && <div className="my-2 h-px bg-line" />}
          {canEdit && (
          <SheetRow
            icon={
              <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path
                  d="M3.6 5.2h10.8M7.2 5.2V3.6h3.6v1.6M5 5.2l.7 9.2h6.6l.7-9.2"
                  stroke="currentColor"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            label="Borrar de mi colección"
            danger
            onClick={() => {
              setMenuOpen(false);
              setDeleting(true);
            }}
          />
          )}
        </div>
      </Sheet>

      <CoverPicker
        open={pickingCover}
        onClose={() => setPickingCover(false)}
        vinyl={vinyl}
        onChoose={(url) => onChangeCover?.(vinyl, url)}
      />

      {/**
       * Moving to the wishlist is not a small edit, so it is confirmed.
       *
       * Owned and wanted are exclusive in this app: saving a record into the
       * wishlist takes it out of the collection *and* out of every rack you
       * had put it in. That is the correct behaviour and it is invisible from
       * the outside — somebody who has spent an evening sorting a record into
       * three racks would lose all three to one press. The same double step as
       * deleting, for the same reason: the consequence is not in the label.
       */}
      <Confirm
        open={toWishlist}
        onClose={() => setToWishlist(false)}
        title="Pasará a tus deseos"
        body={`Se quitará de tu colección${
          racksHolding > 0
            ? ` y de ${racksHolding} ${racksHolding === 1 ? "rack" : "racks"}`
            : ""
        }. Un disco o lo tienes o lo quieres: no puede estar en los dos sitios.`}
        confirmLabel="Mover a deseos"
        danger={false}
        onConfirm={() => {
          setToWishlist(false);
          void moveToWishlist();
        }}
      />

      {/* Sharing: its own sheet on top, so the record is still there behind
          it when the share is cancelled — which it often is. */}
      <ShareSheet
        open={sharing}
        onClose={() => setSharing(false)}
        image={`/api/share/record?slug=${encodeURIComponent(vinyl.id)}`}
        /* There is no page for a single record yet, so the link is the app
           itself — which is what somebody who liked the card wants anyway. */
        link={SITE_URL}
        title={`${vinyl.title} — ${vinyl.artist}`}
        filename={`${vinyl.id}.png`}
      />

      {/**
       * Where it lives, and everywhere it could — see SaveSheet.
       *
       * This used to be a menu of rack names with a tick beside the ones that
       * already held the record, and pressing one of those did nothing you
       * could see. It answered "which rack shall I add this to" and left the
       * two questions somebody actually opens it with — where is this, and
       * take it out of there — unanswerable.
       */}
      <SaveSheet
        onCreateList={onCreateList}
        open={picking}
        onClose={() => {
          setPicking(false);
          setAcquiring(false);
        }}
        vinyl={vinyl}
        collections={acquiring ? collections.filter((c) => c.id !== wishlist?.id) : collections}
        coverOf={coverOf}
        onAdd={(listId) => {
          setPicking(false);
          if (acquiring) {
            setAcquiring(false);
            return void acquire(listId);
          }
          // a deseos desde aquí también pasa por la confirmación, si lo tienes
          if (listId === wishlist?.id && ownedIn.length > 0) return setToWishlist(true);
          const name = collections.find((c) => c.id === listId)?.name ?? "tu rack";
          void (async () => {
            if ((await onAddTo(listId, vinyl)) === false) return;
            toast.show(`Añadido a ${name}`, { media: { src: coverFor(vinyl) } });
          })();
        }}
        onRemove={(listId) => {
          const name = collections.find((c) => c.id === listId)?.name ?? "ese rack";
          onRemoveFromList?.(listId, vinyl);
          toast.show(`Fuera de ${name}`, { media: { src: coverFor(vinyl) } });
        }}
      />

      <Confirm
        open={deleting}
        onClose={() => setDeleting(false)}
        title="Se borrará de toda tu colección"
        body={`${vinyl.title} desaparecerá de todos tus racks. Esto no se puede deshacer.`}
        confirmLabel="Borrar"
        onConfirm={() => {
          onDelete(vinyl);
          onClose();
        }}
      />
    </>
  );
}
