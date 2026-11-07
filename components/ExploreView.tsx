"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Link from "next/link";
import { Page, Section } from "@/components/app/AppShell";
import { Cover } from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import {
  Hold,
  SkeletonFindRail,
  SkeletonPersonRail,
  SkeletonRackRail,
} from "@/components/ui/Skeleton";
import CatalogueNotice from "@/components/ui/CatalogueNotice";
import WantedRail, { type WantedRow } from "@/components/explore/WantedRail";
import FromOthersRail from "@/components/explore/FromOthersRail";
import PulseRail from "@/components/explore/PulseRail";
import CatalogueSheet, { type CatalogueItem } from "@/components/CatalogueSheet";
import PersonRow from "@/components/community/PersonRow";
import PersonCard from "@/components/community/PersonCard";
import ListCard from "@/components/community/ListCard";
import { useRepository } from "@/hooks/useRepository";
import RecordSheet from "@/components/mobile/RecordSheet";
import { usePlaybackContext } from "@/lib/playback-context";
import { useLibrary } from "@/hooks/useLibrary";
import { useEntryGate, useSession } from "@/hooks/useSession";
import { layersBusy } from "@/hooks/useBackToClose";
import { useCatalogueSearch } from "@/hooks/useCatalogueSearch";
import { useToast } from "@/components/ui/Toast";
import { coverFor } from "@/lib/cover";
import type { ActivityEvent, ListWithRecord, SuggestedProfile } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";

import RetryImg from "@/components/ui/RetryImg";
import {
  OTHERS,
  RACKS,
  RECENTS_KEY,
  RecentChip,
  SearchBar,
  SearchField,
} from "@/components/explore/ExploreFrame";
import { isColdStartOn } from "@/lib/launch";
/** the sample shelf is nobody's, so for a visitor nothing counts as owned */
const NOTHING: Set<string> = new Set();

/**
 * Where you go when you don't know what you're looking for — and where you go
 * when you know exactly.
 *
 * Those are two different jobs and most apps build two screens for them. One
 * screen is better, and Spotify's Search is the proof: an empty field shows you
 * things to browse, and typing turns the same surface into results. You never
 * navigate to "search" — search is what this place does when you use it.
 *
 * The decisions inside it:
 *
 * - **Scopes, not separate searches.** Todo / Discos / Listas / Gente filter one
 *   query. Making someone pick the category *before* typing means guessing where
 *   the thing they want lives, and they are usually wrong.
 * - **Old results stay while new ones load.** Clearing to a spinner on every
 *   keystroke makes a fast connection feel broken and a slow one feel hostile.
 * - **Recent searches are the real feature.** Most searching is re-searching.
 *   Stored locally, removable one by one — a history you cannot edit is a
 *   liability, not a convenience.
 * - **One place to search for a record.** "Discos" used to mean only what you
 *   already own, while finding something to *add* lived in a different box on
 *   a different screen. Nobody holds that distinction in their head: you look
 *   for a record, and the app's job is to tell you whether you have it or can
 *   get it. Both answers now arrive here, in that order.
 */

type Scope = "all" | "records" | "lists" | "people";

const MAX_RECENTS = 8;

/**
 * Lo que el servidor ya pintó, si lo pintó: el armazón de `ExploreShell`.
 *
 * Solo existe en la primera carga, y solo mientras este componente se monta
 * encima por primera vez. Quien sustituye al armazón tiene que empezar
 * diciendo lo mismo que él — mismo título, mismas búsquedas recientes —, o
 * el relevo mueve la pantalla.
 */
function readShell(): { visitor: boolean } | null {
  if (typeof document === "undefined") return null;
  const el = document.querySelector("[data-explore-shell]");
  return el ? { visitor: el.hasAttribute("data-visitor") } : null;
}

export default function ExploreView() {
  const repo = useRepository();
  const lib = useLibrary();
  const audio = usePlaybackContext();
  const { nowPlaying, playing } = audio;
  const toast = useToast();
  const router = useRouter();
  const params = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);
  const [shell] = useState(readShell);

  /**
   * The search lives in the address as `?q=`, not only in this component.
   *
   * «Guardar» without a session goes to /entrar, and coming back — «atrás»,
   * or the `next` after signing in — remounts this screen: a search held only
   * in state came back empty, and the person had to type it again to find
   * the record they had just tried to keep.
   */
  const [query, setQuery] = useState(() => params.get("q") ?? "");
  /** the client has mounted: what only it knows (your shelf) can be drawn */
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  /** no network, or the last read failed: the skeleton gives way to a retry */
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState(false);
  /** solo la gente: los racks sí llegaron */
  const [peopleFailed, setPeopleFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  /**
   * Desde cuándo se espera una respuesta sin tener ninguna. El plazo de 8 s
   * cuenta desde ahí, no desde la última petición: con la red cortada, la
   * sesión rehace el repositorio una y otra vez, cada vez se volvía a pedir
   * todo y el plazo volvía a empezar — a los 35 s seguía el esqueleto (F8).
   */
  const waitingSince = useRef<number | null>(null);
  const waitingFor = useRef<string | null>(null);
  /** los racks (y la gente) ya han contestado, con algo o con nada */
  const [listsSettled, setListsSettled] = useState(false);
  /**
   * Leer otra vez. Lo que había contestado deja de contar: mientras vuelve la
   * respuesta, los huecos esperan con su esqueleto en vez de afirmar que no
   * hay nada (F8).
   */
  const reread = useCallback(() => {
    waitingSince.current = null;
    setFailed(false);
    setListsSettled(false);
    setPeopleFailed(false);
    setFindsFailed(false);
    setRetry((n) => n + 1);
  }, []);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    // the connection is back: read again, without anybody pressing anything
    const back = () => {
      setOffline(false);
      reread();
    };
    sync();
    window.addEventListener("online", back);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", sync);
    };
  }, [reread]);

  // the query into the address, replacing the entry (typing is not a place to
  // go back to). Not while a layer owns history: its entry has this address
  // and a different one would read as a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    const q = query.trim();
    if ((url.searchParams.get("q") ?? "") === q) return;
    if (layersBusy()) return;
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, [query]);
  const [scope, setScope] = useState<Scope>("all");
  const [lists, setLists] = useState<ListWithRecord[]>([]);
  /**
   * Suggestions carry their reason, search results do not.
   *
   * The same slot holds both — what to look at before you type, and who
   * matched after — so it keeps the richer shape and searching fills in zeros.
   * The card then simply has nothing to say about affinity, which is true.
   */
  const [people, setPeople] = useState<SuggestedProfile[]>([]);
  const [library, setLibrary] = useState<Vinyl[]>([]);
  const [loading, setLoading] = useState(false);
  // tras el armazón, las mismas que ya ha pintado; si no, al montar (abajo)
  const [recents, setRecents] = useState<string[]>(() => (shell ? readRecents() : []));
  /** the record whose sheet is open, opened from a result */
  const [openRecord, setOpenRecord] = useState<Vinyl | null>(null);
  /* recién guardado desde el catálogo: llega con la hoja de racks puesta */
  const [justSaved, setJustSaved] = useState(false);

  const searching = query.trim().length > 0;

  useEffect(() => {
    setRecents(readRecents());
    repo
      .listReleases()
      .then(setLibrary)
      .catch(() => {});
  }, [repo]);

  // The same searching the shelf does, so "¿lo tengo?" and "¿puedo tenerlo?"
  // are one question with one answer, wherever you happen to ask it.
  const catalogue = useCatalogueSearch({
    query,
    mode: "vinyls",
    localVinilos: library,
    allVinilos: library,
  });
  /**
   * The genre this shelf is mostly made of.
   *
   * It is what makes the second rail personal rather than a second chart: the
   * suggestion comes from what somebody actually owns, counted, instead of
   * from a guess about them. Below four records there is nothing to count and
   * the rail simply does not appear — a recommendation drawn from two albums
   * is a coin toss wearing a heading.
   */
  const topGenre = useMemo(() => {
    if (lib.releases.length < 4) return null;
    const tally = new Map<string, number>();
    for (const v of lib.releases) {
      const g = (v.genre ?? "").trim();
      if (g) tally.set(g, (tally.get(g) ?? 0) + 1);
    }
    const best = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return best && best[1] >= 2 ? best[0] : null;
  }, [lib.releases]);

  /** lo que ya está en tu estantería, por id de disco */
  const ownedIds = useMemo(() => new Set(lib.releases.map((v) => v.id)), [lib.releases]);
  /* Sin sesión o con ella. Mientras se lee, lo que dijo el armazón del
     servidor (que lo miró antes del primer pintado); sin armazón, como
     `useIsVisitor`: «con sesión» hasta saberlo. */
  const session = useSession();
  const visitor = session.loading
    ? Boolean(shell?.visitor)
    : session.available && !session.user;
  const gate = useEntryGate();

  // sin sesión la estantería de ejemplo no es de nadie: no se quita nada de
  // las listas del catálogo por estar en ella
  const ownedDiscogsIds = useMemo(
    () =>
      visitor
        ? new Set<number>()
        : new Set(lib.releases.map((v) => v.discogsId).filter(Boolean) as number[]),
    [lib.releases, visitor],
  );

  const [wantedSaving, setWantedSaving] = useState<number | null>(null);
  const [wantedSaved, setWantedSaved] = useState<Set<number>>(new Set());

  /** the same door every catalogue row uses, so a save here behaves like a
   *  save anywhere else — including the undo the library hands back */
  const saveWanted = async (row: WantedRow) => {
    if (gate()) return null;
    setWantedSaving(row.id);
    const v = await catalogue.addFromCatalogue(row, lib.activeListId, (vinyl, listId) =>
      void lib.saveToList(vinyl, listId),
    );
    setWantedSaving(null);
    if (!v)
      return toast.show(catalogue.lastError.current ?? "No hemos podido añadir ese disco.", {
        tone: "error",
      });
    setWantedSaved((s) => new Set(s).add(row.id));
    toast.show(`${v.title} · guardado`, { media: { src: row.thumb ?? coverFor(v) } });
    return v;
  };

  const records = catalogue.localResults;
  const addable = catalogue.addable;

  /** Un solo carril de resultados: primero los tuyos, después el catálogo. */
  const found = useMemo(
    () => [
      ...records.map((v) => ({ kind: "mine" as const, v })),
      ...addable.map((r) => ({ kind: "add" as const, r })),
    ],
    [records, addable],
  );

  /** el disco del catálogo que se está mirando, si hay alguno */
  const [looking, setLooking] = useState<CatalogueItem | null>(null);
  /* el pulso de la comunidad: lo que alguien acaba de colocar en su estantería */
  const [pulse, setPulse] = useState<ActivityEvent[] | null>(null);
  /**
   * Dónde va el pulso: arriba si llega a tiempo, al final si no.
   *
   * Es la única sección que va encima de todo y la que más a menudo sale
   * vacía (quien no sigue a nadie no tiene pulso). Reservarle sitio dejaría
   * un agujero arriba del todo; no reservarlo y meterlo cuando llega empuja
   * la pantalla entera hacia abajo. Así que lo de debajo del buscador espera
   * a saberlo, con un plazo muy corto (300 ms, lo que tarda en contestar
   * casi siempre): si contesta antes, va arriba; si no, la pantalla se monta
   * sin él con sus esqueletos y, si luego trae algo, se pone al final, donde
   * no mueve nada de lo que ya se ve. Más plazo era una pantalla en blanco.
   */
  /* En frío no se espera: el servidor ya ha pintado los esqueletos (ver
     `ExploreShell`) y el pulso, si llega, va al final, donde no mueve nada. */
  const [pulseAt, setPulseAt] = useState<"top" | "end" | null>(() =>
    isColdStartOn("/explorar") ? "end" : null,
  );
  const pulseLate = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      pulseLate.current = true;
      setPulseAt((at) => at ?? "end");
    }, 300);
    return () => clearTimeout(t);
  }, []);
  /** cuántos discos de otros han salido; null mientras se buscan */
  const [findsCount, setFindsCount] = useState<number | null>(null);
  /** no se pudo leer ninguno de esos racks: no es que estén vacíos */
  const [findsFailed, setFindsFailed] = useState(false);
  /** discos que ha enseñado «Lo que todo el mundo busca» (del catálogo) */
  const [wantedRows, setWantedRows] = useState(0);

  /** guardar desde la esquina de la portada, sin abrir nada */
  const saveRow = async (r: (typeof addable)[number]) => {
    // el «+» de la portada: sin cuenta, lleva a entrar en vez de guardar
    if (gate()) return null;
    remember(query);
    const v = await catalogue.addFromCatalogue(r, lib.activeListId, (vinyl, listId) =>
      void lib.saveToList(vinyl, listId),
    );
    if (!v)
      return toast.show(catalogue.lastError.current ?? "No hemos podido añadir ese disco.", {
        tone: "error",
      });
    toast.show(`${v.title} · guardado`, { media: { src: r.thumb ?? coverFor(v) } });
    repo.listReleases().then(setLibrary).catch(() => {});
    return v;
  };

  // arriving from the bar's search puts the cursor where you expect it
  useEffect(() => {
    if (params.get("buscar")) inputRef.current?.focus();
  }, [params]);

  useEffect(() => {
    let alive = true;
    const q = query.trim();
    /* A read that never answers (offline, the session refreshing against no
       network) is a failure too: past this, it says so instead of pulsing.
       Una lectura repetida no borra el error de la anterior: lo borra la
       respuesta buena, o «Reintentar». Si no, el aviso parpadeaba con cada
       repetición y, entre medias, el hueco volvía a decir «Todavía no hay». */
    if (waitingSince.current === null || waitingFor.current !== q) {
      waitingSince.current = Date.now();
      waitingFor.current = q;
    }
    const left = Math.max(0, 8000 - (Date.now() - waitingSince.current));
    const slow = setTimeout(() => alive && setFailed(true), left);
    const done = () => {
      clearTimeout(slow);
      waitingSince.current = null;
    };
    const fail = () => {
      clearTimeout(slow);
      if (!alive) return;
      waitingSince.current = null;
      setLoading(false);
      setFailed(true);
    };

    if (!q) {
      setLoading(true);
      /* Lo que contestó una lectura anterior no vale para esta: si falló y
         luego se volvió a leer, el hueco se quedaba con «ya ha contestado»
         sin error y decía «Todavía no hay racks» mientras la nueva lectura
         seguía en el aire (F8). Con racks ya en pantalla no cambia nada. */
      setListsSettled(false);
      const placePulse = (e: ActivityEvent[]) => {
        setPulse(e);
        setPulseAt((at) => at ?? (pulseLate.current ? "end" : "top"));
      };
      repo
        .activity()
        .then((e) => placePulse(e.filter((x) => !x.mine)))
        .catch(() => placePulse([]));
      /* Cada mitad por su lado: si fallan los racks, se dice; si solo
         fallan las personas, los racks se enseñan igual. */
      Promise.allSettled([repo.popularLists(), repo.suggestedProfiles()])
        .then(([l, p]) => {
          if (!alive) return;
          if (l.status === "rejected") {
            setListsSettled(true);
            return fail();
          }
          done();
          setFailed(false);
          setLists(l.value);
          setPeople(p.status === "fulfilled" ? p.value : []);
          setPeopleFailed(p.status === "rejected");
          setListsSettled(true);
          setLoading(false);
        })
        // without this a failed read leaves the skeleton pulsing for ever,
        // which is the one state that never resolves itself
        .catch(fail);
      return () => {
        alive = false;
        clearTimeout(slow);
      };
    }

    setLoading(true);
    // 220ms is roughly the gap between words when someone types a title; below
    // it you fire a request per letter, above it the results feel detached
    const t = setTimeout(() => {
      Promise.all([repo.searchLists(q), repo.searchProfiles(q)])
        .then(([l, p]) => {
          if (!alive) return;
          done();
          setFailed(false);
          setLists(l);
          setPeople(
            p.map((x) => ({ ...x, shared: 0, mutuals: 0, followers: 0, covers: [], chosen: false })),
          );
          setLoading(false);
        })
        .catch(() => {
          // lo que hubiera (los racks de portada, otra frase) no es la respuesta
          if (alive) {
            setLists([]);
            setPeople([]);
          }
          fail();
        });
    }, 220);

    return () => {
      alive = false;
      clearTimeout(t);
      clearTimeout(slow);
    };
    // `library` (tu estantería) no entra: esta lectura no la usa, y cuando
    // llegaba volvía a lanzarla, borrando el error de la anterior
  }, [repo, query, retry]);

  const remember = useCallback((q: string) => {
    const clean = q.trim();
    if (clean.length < 2) return;
    const next = [clean, ...readRecents().filter((r) => r !== clean)].slice(
      0,
      MAX_RECENTS,
    );
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    setRecents(next);
  }, []);

  const forget = (q: string) => {
    const next = readRecents().filter((r) => r !== q);
    localStorage.setItem(RECENTS_KEY, JSON.stringify(next));
    setRecents(next);
  };

  /**
   * Covers come from the backend, not from your own shelf.
   *
   * This used to cross-reference each list's record ids against `library` —
   * which is *your* collection, and which on Supabase never carries those ids
   * for somebody else's list anyway. Every crate on this page came out empty.
   */
  const [covers, setCovers] = useState<Record<string, string[]>>({});
  const coversOf = useCallback(
    (l: ListWithRecord) => covers[l.id] ?? [],
    [covers],
  );

  useEffect(() => {
    if (lists.length === 0) return;
    let alive = true;
    // one request for every crate on the page, not one per crate
    repo
      .coversOfLists(lists.map((l) => l.id))
      .then((c) => alive && setCovers((prev) => ({ ...prev, ...c })))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [repo, lists]);

  const counts = useMemo(
    () => ({
      records: records.length + addable.length,
      lists: lists.length,
      people: people.length,
    }),
    [records, addable, lists, people],
  );
  const total = counts.records + counts.lists + counts.people;
  const loadingAnything = loading || catalogue.loading;
  /**
   * Buscar pregunta a dos sitios: a la comunidad (racks y personas) y al
   * catálogo. Si uno no contesta, de esa parte no se sabe nada — ni «nada
   * para…» ni un «0» en su pestaña. Lo que sí llegó se enseña, con una nota
   * corta para lo que falta (F8).
   */
  const communityDown = searching && (offline || failed) && !loading;
  const catalogueDown = catalogue.degraded === "down" || catalogue.degraded === "rate-limit";
  /** alguna de las dos todavía no ha contestado a esta frase */
  const waitingAny = loadingAnything || catalogue.pending;
  const retrySearch = () => {
    reread();
    catalogue.retry();
  };
  /** el número de una pestaña, solo si su fuente ha contestado */
  const tabCount = {
    records:
      catalogueDown || (counts.records === 0 && (catalogue.pending || catalogue.loading))
        ? null
        : counts.records,
    lists: communityDown || (counts.lists === 0 && loading) ? null : counts.lists,
    people: communityDown || (counts.people === 0 && loading) ? null : counts.people,
  };
  const show = (s: Scope) => scope === "all" || scope === s;
  /** sin red o con la lectura caída tampoco va a llegar nada más */
  const listsDone = listsSettled || offline || failed;
  /**
   * La lectura no ha llegado: ni se sabe si hay racks ni si no los hay.
   *
   * «Todavía no hay…» es una afirmación sobre la comunidad, y solo se puede
   * hacer con una respuesta buena y vacía delante. Sin red, o con la lectura
   * caída, lo dice un solo aviso bajo el buscador, con un solo «Reintentar»
   * que lo vuelve a pedir todo; las secciones que dependen de esa lectura se
   * cierran enteras, sin título (F8). Tres avisos iguales, uno por sección,
   * hacían dudar de cuál tocar y parecía que lo demás sí había cargado.
   */
  const listsFailed = (offline || failed) && lists.length === 0;
  /** algo de la portada no ha llegado: el aviso único lo dice */
  const homeDown = listsFailed || peopleFailed || findsFailed;
  /** …y algo sí: entonces es «parte de Explorar», no Explorar entero */
  const somethingLoaded =
    lists.length > 0 || people.length > 0 || wantedRows > 0 || (pulse?.length ?? 0) > 0;
  const others = visitor ? OTHERS.visitor : OTHERS.member;
  const othersTitle = others.title;
  const pulseSection = pulse !== null && pulse.length > 0 && (
    <Section
      title="Se está moviendo"
      note="Lo que otros acaban de colocar en sus estanterías."
      href="/actividad"
      linkLabel="Ver todo"
    >
      <PulseRail events={pulse} />
    </Section>
  );

  return (
    <Page width="full">
      {/* Sin título visible (ver abajo), pero quien recorre la página por
          títulos con el lector de pantalla sí necesita uno. */}
      <h1 className="sr-only">Explorar</h1>
      {/**
       * The field is the top of the page, because it is the page.
       *
       * There was a title above it saying "Explorar" over a subtitle saying
       * what could be searched — under a navigation bar with the word
       * Explorar in it, marked as the place you are. A heading that repeats
       * the tab you just pressed is a line of type that costs the screen its
       * first eighty pixels and tells you something you already knew. The
       * placeholder says what can be typed; the bar says where you are.
       *
       * It is a field now rather than an underline. A rule under some grey
       * placeholder text is a typographic idea of a search box; people look
       * for something with edges, and on a page this wide a lone line does not
       * read as a place to type at all.
       */}
      {/* La barra y el campo son los mismos que pinta el servidor antes de
          que llegue este código (ver ExploreFrame): no se mueven al relevarlo. */}
      <SearchBar>
        <SearchField
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onBlur={() => remember(query)}
          after={
            searching && (
              <button
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                aria-label="Borrar búsqueda"
                className="pressable -mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center text-content-faint transition-colors hover:text-paper sm:absolute sm:right-0 sm:top-1/2 sm:mr-0 sm:-translate-y-1/2"
              >
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M2 2 L12 12 M12 2 L2 12"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            )
          }
        />

        {/**
         * The scopes as a line of words, not as a switch.
         *
         * A segmented pill is a control you press; these are the four shapes
         * one answer can take, and they read better as a caption under the
         * question — the same mono micro-type that names every region on
         * every other screen. It also stops the two most prominent objects
         * on the page from both being rounded rectangles fighting for the
         * middle of the screen.
         *
         * The counts do the work the pill was doing: they say where the
         * answers are before you choose, so choosing is informed rather than
         * exploratory.
         */}
        {/* Una sola fila, siempre: con letra grande (360 al 130 %) se
            partía en dos y «Personas» quedaba sola debajo. Si no cabe, se
            desliza de lado (`rail`); si cabe, centrada (`w-max mx-auto`). */}
        {searching && (
          <div className="rail mt-4">
          <div className="mx-auto flex w-max items-baseline gap-x-6 whitespace-nowrap">
            {(
              [
                ["all", "Todo", null],
                ["records", "Discos", tabCount.records],
                ["lists", "Racks", tabCount.lists],
                ["people", "Personas", tabCount.people],
              ] as const
            ).map(([value, label, n]) => {
              const active = scope === value;
              return (
                <button
                  key={value}
                  onClick={() => setScope(value)}
                  aria-pressed={active}
                  className={`pressable label transition-colors ${
                    active ? "text-paper" : "text-content-faint hover:text-content-secondary"
                  }`}
                >
                  {label}
                  {n !== null && (
                    <span className={`ml-1.5 ${active ? "text-content-muted" : "text-content-faint"}`}>
                      {n}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          </div>
        )}
      </SearchBar>

      {/* ------------------------------------------------ nothing typed yet */}
      {!searching && (
        <>
          {homeDown && (
            <div className="mt-6">
              <EmptyState
                compact
                title={
                  offline
                    ? "Sin conexión"
                    : somethingLoaded
                      ? "No hemos podido cargar parte de Explorar"
                      : "No hemos podido cargar Explorar"
                }
                body={
                  offline
                    ? "Cuando vuelva la conexión, esto se carga solo."
                    : "Puede ser la conexión. Prueba otra vez en un momento."
                }
                action={{ label: "Reintentar", onClick: reread }}
              />
            </div>
          )}

          {recents.length > 0 && (
            <Section title="Búsquedas recientes">
              <ul className="flex flex-wrap gap-2">
                {recents.map((r) => (
                  <RecentChip
                    key={r}
                    text={r}
                    onPick={() => setQuery(r)}
                    onForget={() => forget(r)}
                  />
                ))}
              </ul>
            </Section>
          )}

          {/**
           * El orden de esta pantalla es el orden de lo que promete la
           * aplicación.
           *
           * Empezaba por una lista de los discos más deseados del año: un dato
           * de mercado, correcto y de nadie, que podría estar en cualquier
           * aplicación de discos. Rackr existe para lo contrario — para que las
           * colecciones dejen de estar aisladas —, así que arriba va la gente:
           * lo que alguien acaba de colocar en su estantería, y lo que hay en
           * las estanterías de otros que no está en la tuya. Las tendencias
           * siguen ahí, abajo, que es donde responden a «¿y qué más hay?».
           */}
          {/* hasta saber dónde va el pulso no se monta nada: ver `pulseAt` */}
          {pulseAt !== null && (
          <>
          {pulseAt === "top" && pulseSection}

          {/**
           * Su sitio está guardado desde el primer fotograma.
           *
           * Solo existía cuando llegaban los racks, y entonces aparecía de
           * golpe con su esqueleto debajo: casi cuatrocientos píxeles que
           * empujaban todo lo que ya estaba a la vista (CLS 0,62 en el móvil).
           * Ahora el esqueleto ocupa lo mismo que el carril desde el principio
           * y, si al final no hay nada que enseñar, Hold lo cierra sin mover
           * lo que se está mirando.
           */}
          {/* si su lectura falló, fuera entera: el aviso de arriba ya lo dice */}
          <Closing open={!listsFailed && !findsFailed}>
          <Hold
            empty={listsDone && (lists.length === 0 || findsCount === 0)}
            fallback={
              <EmptySlot
                title={othersTitle}
                note={
                  lists.length === 0
                    ? "Todavía no hay racks de otros que mirar."
                    : visitor
                      ? "Ahora mismo no hay discos que enseñar aquí."
                      : "Ahora mismo no hay nada en esos racks que no tengas ya."
                }
                action={
                  lists.length > 0
                    ? {
                        label: "Abrir un rack",
                        onClick: () =>
                          document
                            .getElementById("racks")
                            ?.scrollIntoView({ behavior: "smooth", block: "start" }),
                      }
                    : undefined
                }
              />
            }
          >
            <Section
              title={othersTitle}
              // sin sesión el título ya dice de dónde salen: la nota no lo repite
              note={others.note}
            >
              {lists.length > 0 ? (
                <FromOthersRail
                  /* si no se pudo leer ninguno, «Reintentar» lo monta de nuevo
                     para que los vuelva a pedir, aunque los racks sean los
                     mismos; si salió bien, no se toca */
                  key={findsFailed ? `fallo-${retry}` : "bien"}
                  lists={lists}
                  ownedIds={visitor ? NOTHING : ownedIds}
                  onOpen={(f) => setOpenRecord(f.vinyl)}
                  onSettle={setFindsCount}
                  onFail={() => setFindsFailed(true)}
                />
              ) : (
                <SkeletonFindRail />
              )}
            </Section>
          </Hold>
          </Closing>

          {/* Sin red el esqueleto latía para siempre. Ahora, si la lectura
              cae, la sección se va y lo dice el aviso de arriba; al volver
              la conexión se vuelve a pedir sola. */}
          <Closing open={!listsFailed}>
          <Section id="racks" title={RACKS.title} note={RACKS.note}>
            {(loading || !listsSettled) && lists.length === 0 ? (
              <SkeletonRackRail n={5} />
            ) : lists.length === 0 ? (
              /* A heading with nothing under it is the worst of both: it does
                 not say "there is nothing here" and it does not say "something
                 went wrong" — it just looks like the page stopped loading. */
              <EmptyState
                compact
                title="Todavía no hay racks que enseñarte"
                body="O nadie ha publicado un rack público, o no hemos podido leerlos. Prueba a recargar; si sigue vacío, busca algo concreto."
                /* se vuelve a pedir aquí mismo: recargar la página entera
                   tiraba lo que ya estaba escrito en el buscador */
                action={{ label: "Reintentar", onClick: reread }}
              />
            ) : (
              /* one line, sliding sideways: the community is something you
                 skim past, not a wall you have to get through before the rest
                 of the page starts. It bleeds to both edges so the last card
                 is cut off — the only honest way to say "there is more". */
              // Padding on both ends — and scroll-padding to match it.
              //
              // The margin was there and the rail ignored it: snapping aligns
              // an item to the container's snapport, which starts at its edge
              // unless scroll-padding says otherwise. So the browser scrolled
              // twenty pixels on load to put the first crate flush against the
              // screen, and the row looked mis-indented against the heading
              // above it. scroll-pl teaches the snap where the content
              // actually begins.
              <ul className="rail rail-page flex gap-9 pb-2">
                {lists.slice(0, 12).map((l) => (
                  <li
                    key={l.id}
                    className="w-[44vw] shrink-0 snap-start sm:w-[200px]"
                  >
                    <ListCard list={l} covers={coversOf(l)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          </Closing>

          {/* Si su lectura cayó, fuera entera, sin título. Mientras carga, su
              esqueleto; si se queda vacía de verdad, Hold la cierra sin
              empujar nada. */}
          <Closing open={!listsFailed && !peopleFailed}>
          <Hold
            empty={listsDone && people.length === 0}
            fallback={
              <EmptySlot
                title={visitor ? "Gente con la que empezar" : "Coleccionan como tú"}
                note={
                  visitor
                    ? "Todavía no hay colecciones que enseñar."
                    : "Todavía no hay nadie con una colección parecida a la tuya."
                }
              />
            }
          >
          <Section
            /* Sin sesión no hay un «tú» con el que comparar: la estantería
               de la que saldría el parecido es la de ejemplo. */
            title={visitor ? "Gente con la que empezar" : "Coleccionan como tú"}
            note={
              visitor
                ? "Colecciones que mirar antes de montar la tuya."
                : "Puede que os solapéis más de lo que crees."
            }
          >
            {/* The same rail as the crates above, for the same reason: this is
                something to skim past, not a directory to work through. And
                the cards are shelves rather than faces — see PersonCard. */}
            {people.length === 0 ? (
              <SkeletonPersonRail />
            ) : (
              <ul className="rail rail-page flex gap-4 pb-2 sm:gap-5">
                {people.slice(0, 12).map((p) => (
                  <li
                    key={p.id}
                    className="w-[46vw] shrink-0 snap-start sm:w-[196px] lg:w-[212px]"
                  >
                    <PersonCard profile={p} />
                  </li>
                ))}
              </ul>
            )}
          </Section>
          </Hold>
          </Closing>

          {/**
           * Las dos listas del catálogo, debajo del club y no encima.
           *
           * Explorar es primero la gente que hay aquí: lo que acaban de colocar,
           * lo que tienen y tú no, sus cajones y quiénes son. Una lista de lo
           * más deseado del mundo es correcta y no es de nadie — si abriera la
           * pantalla, la aplicación diría que va de discos cuando va de
           * colecciones. Al final, en cambio, responde a «¿y qué más hay?»,
           * que en una semana tranquila es justo por lo que alguien ha
           * llegado hasta aquí abajo.
           */}
          <WantedRail
            // la lista se pide una vez al montar: si la sesión se resuelve
            // después, se vuelve a pedir con el filtro que toca
            // y otra vez si vuelve la conexión
            key={`${visitor ? "visitor" : "member"}-${retry}`}
            title="Lo que todo el mundo busca"
            onRows={setWantedRows}
            subtitle={`Los vinilos de ${new Date().getFullYear()} más perseguidos ahora mismo.${
              visitor ? "" : " Sin lo que ya tienes."
            }`}
            ownedIds={ownedDiscogsIds}
            targetName={lib.activeList?.title ?? "Mi Colección"}
            onSave={saveWanted}
            onSaved={(v) => {
              setJustSaved(true);
              setOpenRecord(v);
            }}
            savingId={wantedSaving}
            savedIds={wantedSaved}
          />

          {/* sin sesión el género saldría de la estantería de ejemplo */}
          {/* tu estantería solo existe en el cliente: en el servidor y en la
              hidratación no hay género, o React pinta dos árboles distintos */}
          {mounted && topGenre && !visitor && (
            <WantedRail
              key={retry}
              title={`Tu estantería tira a ${topGenre.toLowerCase()}`}
              genre={topGenre}
              subtitle="Lo más perseguido del género, sin lo que ya tienes."
              ownedIds={ownedDiscogsIds}
              targetName={lib.activeList?.title ?? "Mi Colección"}
              onSave={saveWanted}
            onSaved={(v) => {
              setJustSaved(true);
              setOpenRecord(v);
            }}
              savingId={wantedSaving}
              savedIds={wantedSaved}
            />
          )}

          {/* llegó tarde: al final, donde no empuja nada de lo que se ve */}
          {pulseAt === "end" && pulseSection}
          </>
          )}
        </>
      )}

      {/* ---------------------------------------------------------- results */}
      {searching && (
        <div className="mt-6">
          {/* said before the results, not after: someone who reads "nada para
              «x»" and then scrolls past a note explaining why has already
              drawn their conclusion */}
          {total === 0 && !waitingAny && (communityDown || catalogueDown) ? (
            /* «Nada para…» es una respuesta; sin ella delante, no se dice */
            <EmptyState
              title={offline ? "Sin conexión" : "No hemos podido buscar"}
              body={
                offline
                  ? "Cuando vuelva la conexión, esto se carga solo."
                  : "Puede ser la conexión. Prueba otra vez en un momento."
              }
              action={{ label: "Reintentar", onClick: retrySearch }}
              secondary={{ label: "Borrar búsqueda", onClick: () => setQuery("") }}
            />
          ) : total === 0 && !waitingAny ? (
            <EmptyState
              title={`Nada para «${query}»`}
              body="Prueba con menos palabras, o solo con el nombre del artista. Para un disco que todavía no tienes, el código de barras acierta más que el título."
              action={{ label: "Escanear un código", href: "/coleccion" }}
              secondary={{
                label: "Borrar búsqueda",
                onClick: () => setQuery(""),
              }}
            />
          ) : (
            <div className="space-y-9">
              {/* Llegó una parte: lo que falta lo dice una nota corta, antes
                  de los resultados y no después (quien lee una lista sin
                  aviso ya ha sacado su conclusión). */}
              {(catalogueDown || communityDown) && !waitingAny && (
                <div className="space-y-3">
                  {catalogueDown && (
                    <CatalogueNotice
                      degraded={catalogue.degraded}
                      empty={addable.length === 0}
                      onRetry={catalogue.retry}
                    />
                  )}
                  {communityDown && (
                    <PartNote onRetry={reread}>
                      {offline
                        ? "Sin conexión: faltan racks y personas."
                        : "No hemos podido buscar racks ni personas."}
                    </PartNote>
                  )}
                </div>
              )}
              {catalogue.degraded === "partial" && <CatalogueNotice degraded="partial" />}
              {/**
               * Un solo resultado por disco, lo tengas o no.
               *
               * Estaban en dos bloques — «En tu colección» arriba y «Añadir a
               * tu colección» debajo — y eso convertía una pregunta («¿está
               * esto?») en dos listas que hay que recorrer enteras para
               * responderla. Quien busca un disco busca el disco; que ya lo
               * tengas es un dato sobre él, no otra categoría de cosa.
               *
               * Así que una rejilla, los tuyos primero porque son la respuesta
               * más probable, y una marca en la esquina de la portada para los
               * que ya están en casa. La misma esquina es el botón de guardar
               * en los que no: se ve de un vistazo qué falta y se añade sin
               * abrir nada, y tocando la portada se abre la ficha.
               */}
              {show("records") && found.length > 0 && (
                <ResultBlock
                  title="Discos"
                  onAll={() => setScope("records")}
                  showAll={scope === "all"}
                >
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
                    {(scope === "all" ? found.slice(0, 12) : found.slice(0, 48)).map((row) =>
                      row.kind === "mine" ? (
                        <li key={row.v.id} className="relative">
                          <button
                            onClick={() => {
                              remember(query);
                              setOpenRecord(row.v);
                            }}
                            className="pressable block w-full text-left"
                          >
                            <Cover vinyl={row.v} alt={row.v.title} />
                            <span className="mt-2 block truncate text-sub text-paper">
                              {row.v.title}
                            </span>
                            <span className="block truncate text-sub text-content-muted">
                              {row.v.artist}
                            </span>
                          </button>
                          <span
                            aria-label="En tu colección"
                            className="pointer-events-none absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur-md"
                          >
                            <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                              <path
                                d="M2.5 7.4 L5.6 10.5 L11.5 3.8"
                                stroke="currentColor"
                                strokeWidth="1.8"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        </li>
                      ) : (
                        <li key={`d${row.r.id}`} className="relative">
                          <button
                            onClick={() => {
                              remember(query);
                              setLooking(row.r);
                            }}
                            className="pressable block w-full text-left"
                          >
                            <span className="block aspect-square w-full overflow-hidden rounded-[3px] bg-fill-subtle">
                              {row.r.thumb && (
                                <RetryImg
                                  src={row.r.cover_image ?? row.r.thumb}
                                  alt=""
                                  loading="lazy"
                                  className="h-full w-full object-cover"
                                />
                              )}
                            </span>
                            <span className="mt-2 block truncate text-sub text-paper">
                              {row.r.title}
                            </span>
                            <span className="block truncate text-caption text-content-muted">
                              {[row.r.year, row.r.country].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                          <button
                            onClick={() => void saveRow(row.r)}
                            disabled={catalogue.adding === row.r.id}
                            aria-label={`Guardar ${row.r.title}`}
                            className="pressable hit absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ink/70 text-paper backdrop-blur-md transition-colors hover:bg-ink/90 disabled:opacity-50"
                          >
                            {catalogue.adding === row.r.id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-current border-t-transparent" />
                            ) : (
                              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                                <path
                                  d="M7 2 V12 M2 7 H12"
                                  stroke="currentColor"
                                  strokeWidth="1.7"
                                  strokeLinecap="round"
                                />
                              </svg>
                            )}
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </ResultBlock>
              )}

              {show("lists") && lists.length > 0 && (
                <ResultBlock
                  title="Racks"
                  onAll={() => setScope("lists")}
                  showAll={scope === "all"}
                >
                  <ul className="grid grid-cols-2 gap-x-9 gap-y-14 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                    {(scope === "all" ? lists.slice(0, 4) : lists).map((l) => (
                      <li key={l.id}>
                        <ListCard list={l} covers={coversOf(l)} />
                      </li>
                    ))}
                  </ul>
                </ResultBlock>
              )}

              {show("people") && people.length > 0 && (
                <ResultBlock
                  title="Personas"
                  onAll={() => setScope("people")}
                  showAll={scope === "all"}
                >
                  <ul className="grid gap-x-8 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line">
                    {(scope === "all" ? people.slice(0, 4) : people).map(
                      (p) => (
                        <li key={p.id}>
                          <PersonRow
                            profile={p}
                            subtitle={p.bio || `@${p.username}`}
                          />
                        </li>
                      ),
                    )}
                  </ul>
                </ResultBlock>
              )}

              {/* A scope with nothing in it still has to say something — but
                  not while it is still being fetched. "Aquí no hay resultados"
                  shown for the second before the answer lands is the same
                  mistake as an empty shelf on a cold start: saying something
                  false quickly is worse than saying nothing slowly. */}
              {scope !== "all" &&
                !waitingAny &&
                ((scope === "records" && found.length === 0) ||
                  (scope === "lists" && lists.length === 0) ||
                  (scope === "people" && people.length === 0)) &&
                (((scope === "lists" || scope === "people") && communityDown) ||
                (scope === "records" && catalogueDown) ? (
                  /* racks y usuarios vienen de la misma lectura: si cayó, no
                     se sabe si los hay */
                  <EmptyState
                    compact
                    title={offline ? "Sin conexión" : "No hemos podido buscar"}
                    body={
                      offline
                        ? "Cuando vuelva la conexión, esto se carga solo."
                        : "Puede ser la conexión. Prueba otra vez en un momento."
                    }
                    action={{ label: "Reintentar", onClick: retrySearch }}
                  />
                ) : (
                  <EmptyState
                    compact
                    title="Aquí no hay resultados"
                    body="Puede que lo que buscas esté en otra pestaña."
                    action={{
                      label: "Buscar en todo",
                      onClick: () => setScope("all"),
                    }}
                  />
                ))}
            </div>
          )}
        </div>
      )}
      {/* The same sheet as everywhere else: listen, read, put it in a list.
          Editing rows are hidden — a search result is not a place you can
          take something out of. */}
      <CatalogueSheet
        item={looking}
        onClose={() => setLooking(null)}
        targetName={lib.activeList?.title ?? "Mi Colección"}
        saved={Boolean(looking && catalogue.savedIn[`d${looking.id}`])}
        busy={catalogue.adding === looking?.id}
        onSave={() => (looking ? saveRow(looking) : null)}
        onSaved={(v) => {
          setJustSaved(true);
          setOpenRecord(v);
        }}
      />

      <RecordSheet
        vinyl={openRecord}
        onClose={() => {
          setOpenRecord(null);
          setJustSaved(false);
        }}
        pickOnOpen={justSaved}
        canEdit={false}
        collections={lib.lists.map((l) => ({
          id: l.id,
          name: l.title,
          vinylIds: lib.idsOf(l.id),
          kind: l.kind,
        }))}
        activeListId=""
        playing={playing && nowPlaying?.id === openRecord?.id}
        onTogglePlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : audio.play(v))}
        onAddTo={(listId, v) => lib.saveToList(v, listId)}
        onRemoveFromActive={() => {}}
        onDelete={() => {}}
      />
    </Page>
  );
}

function ResultBlock({
  title,
  children,
  onAll,
  showAll,
}: {
  title: string;
  children: React.ReactNode;
  onAll: () => void;
  showAll: boolean;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-line pb-2">
        <h2 className="label text-content-muted">
          {title}
        </h2>
        {showAll && (
          <button
            onClick={onAll}
            className="label text-content-faint transition-colors hover:text-paper"
          >
            Ver todo
          </button>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Una sección que se ha quedado vacía estando a la vista.
 *
 * Hold le guarda el alto para no mover nada, y ese alto en negro parecía una
 * pantalla a medio cargar. Aquí lo ocupa la superficie de siempre (la de
 * `Card` y `EmptyState`, sin contorno) con la frase que dice por qué no hay
 * nada y, si la hay, una salida; lo tenue lo pone la frase, no la caja.
 *
 * No es `EmptyState`: ese trae su propio título, que repetiría el de la
 * sección, y una acción obligatoria que el hueco de la gente no tiene.
 */
/**
 * Lo que falta de una búsqueda que llegó a medias: una línea y su reintento,
 * con la misma superficie que el aviso del catálogo.
 */
function PartNote({ children, onRetry }: { children: React.ReactNode; onRetry: () => void }) {
  return (
    <div role="status" className="rounded-lg bg-fill-subtle px-4 py-3 text-sub text-content-muted">
      <p className="leading-snug">{children}</p>
      <button
        type="button"
        onClick={onRetry}
        className="pressable hit mt-2 font-medium text-paper underline underline-offset-4"
      >
        Reintentar
      </button>
    </div>
  );
}

/**
 * Una sección cuya lectura ha fallado se cierra entera, en 200 ms de alto (y
 * sin transición si se ha pedido menos movimiento): desaparecer de golpe
 * hacía saltar todo lo de debajo en un solo fotograma. Lleva el margen de la
 * sección, para que también se cierre.
 */
function Closing({ open, children }: { open: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          key="abierta"
          className="mt-9 first:mt-0 [overflow-y:clip]"
          exit={{ height: 0, marginTop: 0, opacity: 0 }}
          transition={{ duration: reduce ? 0 : 0.2, ease: [0.2, 0, 0, 1] }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function EmptySlot({
  title,
  note,
  action,
}: {
  title: string;
  note: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Section title={title} fill>
      {/* A partir de 1024 la losa es muy ancha: la frase va a la izquierda,
          en la línea de los títulos, no flotando en el centro de 1400 px. */}
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-lg bg-fill-subtle px-6 py-8 text-center lg:items-start lg:text-left">
        <p className="max-w-[32ch] text-sub text-content-muted">{note}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="pressable hit text-sub font-medium text-content-secondary transition-colors hover:text-paper"
          >
            {action.label}
          </button>
        )}
      </div>
    </Section>
  );
}

function readRecents(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENTS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
}
