"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import dynamic from "next/dynamic";
import type { VinylShelfHandle } from "@/components/VinylShelf3D";
import MiniVinyl from "@/components/MiniVinyl";
import VinylGrid from "@/components/VinylGrid";
import SearchOverlay from "@/components/SearchOverlay";
import CollectionsOverlay from "@/components/CollectionsOverlay";
import VinylEditOverlay from "@/components/VinylEditOverlay";
import CommunityBridge from "@/components/CommunityBridge";
import MarqueeText from "@/components/MarqueeText";
import DemoNotice from "@/components/DemoNotice";
import { setAuthenticated, type ListWithRecord } from "@/lib/data";
import { useRepository } from "@/hooks/useRepository";
import { useLibrary } from "@/hooks/useLibrary";
import { usePlaybackContext } from "@/lib/playback-context";
import TopNav from "@/components/app/TopNav";
import { BarcodeIcon, useCanScan } from "@/components/BarcodeScanner";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";
import { type Collection, type SortMode, sortedVinylIds } from "@/lib/collections";
import { useDevice } from "@/hooks/useDevice";
import MobileShelf from "@/components/mobile/MobileShelf";
import RecordSheet from "@/components/mobile/RecordSheet";
import MobileSearch from "@/components/mobile/MobileSearch";
import { useToast, ToastIcon } from "@/components/ui/Toast";
import type { SavedList } from "@/lib/data/types";
import { useSearchParams } from "next/navigation";

/**
 * The 3D shelf, fetched only if it is going to be shown.
 *
 * three.js, react-three-fiber and drei are roughly 380 kB of the ~476 kB this
 * route used to ship — and a phone never renders any of it, because the phone
 * gets the crate stack instead. A static import would have made every mobile
 * visitor download a renderer for a canvas that is never mounted, over the
 * connection least able to afford it.
 *
 * `ssr: false` because it needs a WebGL context, which the server does not have.
 */
const VinylShelf = dynamic(() => import("@/components/VinylShelf3D"), { ssr: false });

export default function ShelfApp({ authenticated = false }: { authenticated?: boolean }) {
  // set synchronously, before any data hook reads the backend
  if (typeof window !== "undefined") setAuthenticated(authenticated);

  // Data lives behind one repository (localStorage today, Supabase once you
  // sign in). This page only orchestrates: it never touches storage.
  const lib = useLibrary();
  const allVinilos = lib.releases;
  const activeCollectionId = lib.activeListId;

  /**
   * A list you kept that somebody else made, opened here rather than sent away.
   *
   * It used to be a link out to the owner's page: you saved a list into your
   * collection and then had to leave your collection to look at it. Which is
   * the wrong shape — you kept it, so it lives here, and it should arrive as
   * the same shelf everything else arrives as, in 3D or in the grid.
   *
   * What changes is only what it is not: it is not yours, so nothing in it can
   * be edited, and the corner says whose it is instead of offering to rename
   * it.
   */
  const [foreign, setForeign] = useState<{ list: SavedList; items: Vinyl[] } | null>(null);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [collectionFading, setCollectionFading] = useState(false);
  const [view, setView] = useState<"shelf" | "grid">("shelf");

  // remember the last used view
  useEffect(() => {
    const v = localStorage.getItem("vinilos:view");
    if (v === "grid" || v === "shelf") setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem("vinilos:view", view);
  }, [view]);

  // fade everything when the active collection changes
  useEffect(() => {
    setCollectionFading(true);
    const t = setTimeout(() => setCollectionFading(false), 380);
    return () => clearTimeout(t);
  }, [activeCollectionId]);

  // The overlays speak the older Collection shape; adapting here keeps them
  // untouched while the data underneath moves to the repository.
  const resolvedCollections = useMemo<Collection[]>(
    () =>
      lib.lists.map((l) => ({
        id: l.id,
        name: l.title,
        vinylIds: lib.idsOf(l.id),
        sortBy: l.sortBy,
        kind: l.kind,
        visibility: l.visibility,
        sharedBy: l.sharedBy,
      })),
    [lib.lists, lib.idsOf],
  );
  const activeCollection =
    resolvedCollections.find((c) => c.id === activeCollectionId) ?? null;
  const activeListKind = activeCollection?.kind ?? "custom";
  const ownVinilos = useMemo(
    () =>
      activeCollection
        ? sortedVinylIds(activeCollection, allVinilos)
            .map((id) => allVinilos.find((v) => v.id === id))
            .filter((v): v is Vinyl => !!v)
        : allVinilos,
    [activeCollection, allVinilos],
  );
  // one shelf, two sources: yours, or the one you kept
  const vinilos = foreign ? foreign.items : ownVinilos;
  const readOnly = Boolean(foreign);

  // Hold the loading card until the first covers have actually decoded, so the
  // shelf never appears as a row of empty sleeves. Floors at 420ms (a card that
  // blinks feels broken) and caps at 3.5s (a slow network shouldn't block).
  const bootedRef = useRef(false);
  useEffect(() => {
    if (bootedRef.current || !lib.ready) return;
    bootedRef.current = true;
    const started = performance.now();
    let settled = false;
    const reveal = () => {
      if (settled) return;
      settled = true;
      clearTimeout(cap);
      const wait = Math.max(0, 420 - (performance.now() - started));
      setTimeout(() => setHydrated(true), wait);
    };
    const cap = setTimeout(reveal, 3500);
    const urls = vinilos.slice(0, 10).map(coverFor);
    let left = urls.length;
    if (!left) return reveal();
    urls.forEach((u) => {
      const img = new Image();
      const tick = () => {
        if (--left === 0) reveal();
      };
      img.onload = tick;
      img.onerror = tick;
      img.src = u;
    });
  }, [lib.ready, vinilos]);

  // The side info must never sit on the cover. The shelf measures how wide the
  // centred sleeve really is (it depends on fov, camera distance and viewport)
  // and we store it as a CSS variable, so layout follows the actual artwork
  // instead of a hardcoded percentage. Written straight to the DOM: this
  // changes every frame of the open animation and must not re-render React.
  const sideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const handleCoverHalfWidth = useCallback((px: number) => {
    document.documentElement.style.setProperty("--cover-half", `${Math.round(px)}px`);
    // no room left for a readable column? then don't show one
    // below this the column is too narrow for "Sony Music" to stay on one
    // line, and a cramped, wrapping label reads worse than no label
    const space = window.innerWidth / 2 - px - 40;
    for (const el of sideRefs.current) {
      if (el) el.style.visibility = space < 130 ? "hidden" : "";
    }
  }, []);

  // lists made by other people that you follow: shown apart in the panel
  const repo = useRepository();
  const [followed, setFollowed] = useState<ListWithRecord[]>([]);
  // the covers that let a kept list wear the same row as one of your own
  const [followedCovers, setFollowedCovers] = useState<Record<string, string[]>>({});
  const loadFollowed = useCallback(() => {
    repo
      .followedLists()
      .then((all) => {
        setFollowed(all);
        if (all.length) {
          repo
            .coversOfLists(all.map((l) => l.id))
            .then(setFollowedCovers)
            .catch(() => {});
        }
      })
      .catch(() => setFollowed([]));
  }, [repo]);
  useEffect(loadFollowed, [loadFollowed]);
  // following happens elsewhere (a record's bridge, a list page), so refresh
  // whenever the panel is opened rather than trusting a stale snapshot
  useEffect(() => {
    if (collectionsOpen) loadFollowed();
  }, [collectionsOpen, loadFollowed]);

  const [saved, setSaved] = useState<SavedList[]>([]);
  // ?lista=<id> opens one straight away, which is what the toast's "Ver" and
  // any shared link need in order to land somewhere rather than near it
  const params = useSearchParams();
  const wanted = params.get("lista");
  useEffect(() => {
    if (!wanted) return;
    let alive = true;
    (async () => {
      const all = await repo.savedLists();
      const found = all.find((l) => l.id === wanted);
      if (!found || !alive) return;
      const items = await repo.releasesOfList(found.id);
      if (alive) setForeign({ list: found, items });
    })();
    return () => {
      alive = false;
    };
  }, [wanted, repo]);

  const openForeign = useCallback(
    async (list: SavedList) => {
      setForeign({ list, items: [] });
      const items = await repo.releasesOfList(list.id);
      setForeign((cur) => (cur?.list.id === list.id ? { list, items } : cur));
    },
    [repo],
  );

  const [myProfileId, setMyProfileId] = useState("");
  useEffect(() => {
    repo
      .getCurrentProfile()
      .then((p) => setMyProfileId(p?.id ?? ""))
      .catch(() => {});
  }, [repo]);
  useEffect(() => {
    repo
      .savedLists()
      .then(setSaved)
      .catch(() => setSaved([]));
  }, [repo]);

  const [searchOpen, setSearchOpen] = useState(false);
  // scanning is its own errand — you arrive with a sleeve in your hand, not
  // with something to type — so the shelf opens the camera directly
  const [searchScanning, setSearchScanning] = useState(false);
  const canScan = useCanScan();
  const openSearch = (scan = false) => {
    setSearchScanning(scan);
    setSearchOpen(true);
  };
  const [open, setOpen] = useState<Vinyl | null>(null);
  const [fullyOpen, setFullyOpen] = useState(false); // true after the open animation finishes
  const [active, setActive] = useState<Vinyl | null>(allVinilos[0] ?? null);

  // delay the edit overlay until the open animation is done (~1600ms in shelf)
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => setFullyOpen(true), 1600);
      return () => clearTimeout(t);
    }
    setFullyOpen(false);
  }, [open]);

  // ensure active is always one from the current collection (or first if empty)
  useEffect(() => {
    if (vinilos.length === 0) {
      setActive(null);
      return;
    }
    if (!active || !vinilos.some((v) => v.id === active.id)) {
      setActive(vinilos[0]);
    }
  }, [vinilos, active]);

  // Accepts an updater so operations that chain in the same tick — creating a
  // list and immediately saving a record into it — both see fresh state.
  /** returns the new list's id, so the caller can save into it right away */
  /**
   * Every action confirms itself here, once.
   *
   * These handlers are the single place both the desktop overlays and the phone
   * sheets pass through, so saying it here means saying it exactly once — and
   * the surfaces that had no feedback at all (creating a list, deleting a
   * record) get the same treatment as the ones that did.
   */
  const handleCreateCollection = async (name: string) => {
    const id = await lib.createList(name);
    toast.show(`«${name}» creada`, { media: { icon: ToastIcon.list } });
    return id;
  };

  const handleRenameCollection = (id: string, name: string) => void lib.renameList(id, name);
  const handleDeleteCollection = (id: string) => void lib.deleteList(id);

  const handleActivateCollection = (id: string) => {
    // choosing one of yours is how you come back from somebody else's
    setForeign(null);
    // close any open vinyl when switching list so the detail view doesn't
    // linger over a vinyl that no longer exists in the new collection
    if (open) handleClose();
    lib.activate(id);
  };

  const handleAddVinylTo = (colId: string, vinylId: string) => {
    const release = allVinilos.find((v) => v.id === vinylId);
    if (!release) return;
    void lib.saveToList(release, colId);
    const name = lib.lists.find((l) => l.id === colId)?.title;
    toast.show(`Guardado en ${name ?? "tu colección"}`, { media: { src: coverFor(release) } });
  };

  const handleRemoveVinylFromActive = (vinylId: string) => {
    const v = allVinilos.find((x) => x.id === vinylId);
    void lib.removeFromList(activeCollectionId, vinylId);
    if (v) {
      toast.undo(`${v.title} fuera de la lista`, () => void lib.saveToList(v, activeCollectionId), {
        media: { src: coverFor(v) },
      });
    }
  };

  const handleDeleteVinylPermanently = (vinylId: string) => {
    const v = allVinilos.find((x) => x.id === vinylId);
    void lib.deleteRelease(vinylId);
    // Undo-able even though it is the destructive one: putting it back is a
    // save, and a delete you cannot take back for five seconds is a delete
    // people are afraid to use.
    if (v) {
      toast.undo(`${v.title} fuera de tu colección`, () => void lib.saveToList(v, activeCollectionId), {
        media: { src: coverFor(v) },
      });
    }
  };

  const handleSetSort = (colId: string, sortBy: SortMode) => void lib.setListSort(colId, sortBy);

  const handleReorderVinyl = (colId: string, fromIdx: number, toIdx: number) =>
    void lib.reorderList(colId, fromIdx, toIdx);

  const handleToggleVinyl = (colId: string, vinylId: string) => {
    const inList = lib.idsOf(colId).includes(vinylId);
    if (inList) void lib.removeFromList(colId, vinylId);
    else handleAddVinylTo(colId, vinylId);
  };

  /** Save a record — new to the library or already in it — into a list. */
  const handleSaveToList = (v: Vinyl, listId: string) => void lib.saveToList(v, listId);

  // sound is its own concern, in its own hook
  const audio = usePlaybackContext();
  const toast = useToast();
  const { nowPlaying, playing } = audio;
  const loadingPreview = audio.loading;
  const playPreview = audio.play;
  const shelfRef = useRef<VinylShelfHandle>(null);

  // a record picked in the grid opens once the shelf has mounted
  const pendingOpenRef = useRef<string | null>(null);
  useEffect(() => {
    if (view !== "shelf" || !pendingOpenRef.current) return;
    const id = pendingOpenRef.current;
    pendingOpenRef.current = null;
    const idx = vinilos.findIndex((x) => x.id === id);
    if (idx < 0) return;
    const t = setTimeout(() => {
      shelfRef.current?.goTo(idx);
      setOpen(vinilos[idx]);
      shelfRef.current?.open(idx);
    }, 60);
    return () => clearTimeout(t);
  }, [view, vinilos]);

  const handleVinylClick = useCallback(
    (v: Vinyl) => {
      const idx = vinilos.findIndex((x) => x.id === v.id);
      if (idx < 0) return;
      setOpen(v);
      shelfRef.current?.open(idx);
    },
    [vinilos],
  );

  const handleClose = useCallback(() => {
    // closing the detail view doesn't stop the music — only Play does
    setOpen(null);
    shelfRef.current?.close();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
      if ((e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key === "k")) && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          setSearchOpen(true);
        }
      }
      // arrows navigate prev/next while a vinyl is opened
      if (open && !searchOpen) {
        if (e.key === "ArrowRight") goNext();
        else if (e.key === "ArrowLeft") goPrev();
      }
      // space toggles play/pause for the active preview
      if (e.code === "Space" && !searchOpen) {
        const tag = (e.target as HTMLElement)?.tagName;
        if (tag !== "INPUT" && tag !== "TEXTAREA") {
          e.preventDefault();
          togglePlay();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleClose, searchOpen, open]);

  // Paused and you keep browsing? Then the paused record stops being "yours":
  // the transport re-syncs with the shelf, so Play always means the one in
  // front of you. While it PLAYS, browsing never touches it.
  useEffect(() => {
    if (!nowPlaying || playing || loadingPreview || !audio.pausedByUser) return;
    if (view !== "shelf" || !active || active.id === nowPlaying.id) return;
    audio.stop();
  }, [active, nowPlaying, playing, loadingPreview, audio, view]);

  // if the record that sounds leaves the current collection, stop
  useEffect(() => {
    if (nowPlaying && !vinilos.some((v) => v.id === nowPlaying.id)) audio.stop();
  }, [vinilos, nowPlaying, audio]);

  // The transport always acts on one record: the one centred in the shelf, or
  // — in the grid, where nothing is "in front" — the one that sounds.
  const transportTarget = view === "grid" ? nowPlaying ?? vinilos[0] ?? null : active;
  const activeIsSounding =
    playing && !!transportTarget && nowPlaying?.id === transportTarget.id;
  // you scrolled away from what's sounding: the two actions (pause THAT one /
  // play THIS one) stop being the same action, so the transport splits in two
  const soundingElsewhere =
    view === "shelf" && !!nowPlaying && nowPlaying.id !== active?.id;
  // A skip moves the shelf AND the playback, so they are briefly out of sync
  // while the shelf travels. Waiting a beat before showing the extra control
  // keeps it from blinking on every Next/Previous.
  const [showSounding, setShowSounding] = useState(false);
  useEffect(() => {
    if (!soundingElsewhere) {
      setShowSounding(false);
      return;
    }
    const t = setTimeout(() => setShowSounding(true), 500);
    return () => clearTimeout(t);
  }, [soundingElsewhere]);

  /** the small satellite: pause or resume whatever is sounding elsewhere */
  const toggleSounding = () => audio.toggleCurrent();

  /** the main circle: the music's play/pause, or start the record in front */
  const toggleTransport = () => {
    if (nowPlaying) audio.toggleCurrent();
    else audio.toggle(transportTarget);
  };

  const togglePlay = () => audio.toggle(transportTarget);

  // Transport skip: plays the record next to the one that SOUNDS (falling back
  // to the one on screen if nothing has played yet), and brings the shelf along
  // so what you see is what you hear. Records without a preview are stepped
  // over — a skip that lands on silence isn't a skip.
  const skip = (dir: 1 | -1) => {
    const N = vinilos.length;
    if (N === 0) return;
    const from = nowPlaying ?? transportTarget ?? active;
    const fromIdx = from ? vinilos.findIndex((v) => v.id === from.id) : -1;
    for (let step = 1; step <= N; step++) {
      const idx = ((fromIdx + dir * step) % N + N) % N;
      const candidate = vinilos[idx];
      if (!candidate.previewUrl) continue;
      shelfRef.current?.goTo(idx);
      playPreview(candidate);
      return;
    }
  };

  // which chrome this session gets; read here because the effect below is
  // desktop-only behaviour, not just desktop-only rendering
  const { isPhone } = useDevice();

  /**
   * While opened, the side panel follows the centred record.
   *
   * Desktop only, and the reason is the whole bug it caused: there, opening a
   * sleeve also brings it to the middle, so "what is open" and "what is
   * centred" are the same record and this only keeps them together while you
   * step through with the arrows. On a phone you tap a sleeve without turning
   * the wheel — and this effect then replaced what you had just chosen with
   * whatever happened to be in the middle. Every record you tapped opened the
   * same one.
   */
  useEffect(() => {
    if (isPhone) return;
    if (open && active && open.id !== active.id) setOpen(active);
  }, [active, open, isPhone]);

  const goPrev = () => skip(-1);
  const goNext = () => skip(1);

  /**
   * The fork.
   *
   * Not a breakpoint that rearranges this layout — a different implementation
   * of the same screen. The 3D shelf, the flanking metadata columns and the
   * three-corner transport are a desktop composition; a phone gets a crate you
   * flick through and a sheet you throw away, built from the same data and the
   * same actions. Deciding here, at the top, is what keeps either version from
   * carrying dead code for the other.
   */

  if (isPhone) {
    return (
      <>
        <MobileShelf
          vinilos={vinilos}
          allVinilos={allVinilos}
          collections={resolvedCollections}
          activeListId={activeCollectionId}
          // a kept list open on the shelf names itself, and says whose it is
          activeName={foreign ? foreign.list.title : activeCollection?.name ?? "Mi Colección"}
          savedLists={saved}
          nowPlayingId={nowPlaying?.id}
          isPlaying={playing}
          onOpen={setOpen}
          onActivate={handleActivateCollection}
          onSearch={() => openSearch()}
          onPlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : playPreview(v))}
          onCreateList={handleCreateCollection}
          onRenameList={handleRenameCollection}
          onDeleteList={handleDeleteCollection}
          onSetSort={handleSetSort}
          onSetVisibility={(id, visibility) => {
            void repo.setListVisibility(id, visibility).then(() => void lib.refresh());
          }}
          visibilityOf={(id) => lib.lists.find((l) => l.id === id)?.visibility ?? "public"}
          myId={myProfileId}
          // the handler already confirms it, with the same undo a swipe deserves
          onRemoveFromList={(v) => handleRemoveVinylFromActive(v.id)}
          onOpenSaved={(l) => void openForeign(l)}
          onRemoveRecordFromList={(listId, vinylId) => handleToggleVinyl(listId, vinylId)}
          readOnly={readOnly}
          onUnsaveList={(id) => {
            // both lists of kept lists: the phone reads `saved`, the desktop
            // panel reads `followed`, and one of them going stale is how a
            // list you removed comes back when you rotate the phone
            setSaved((prev) => prev.filter((l) => l.id !== id));
            setFollowed((prev) => prev.filter((l) => l.id !== id));
            void repo.unsaveList(id);
          }}
        />

        <RecordSheet
          vinyl={open}
          onClose={() => setOpen(null)}
          collections={resolvedCollections}
          activeListId={activeCollectionId}
          playing={playing && nowPlaying?.id === open?.id}
          onTogglePlay={(v) => (nowPlaying?.id === v.id ? audio.toggleCurrent() : playPreview(v))}
          onAddTo={(listId, v) => handleSaveToList(v, listId)}
          onRemoveFromActive={(v) => handleRemoveVinylFromActive(v.id)}
          onDelete={(v) => handleDeleteVinylPermanently(v.id)}
        />

        <MobileSearch
          open={searchOpen}
          autoScan={searchScanning}
          onClose={() => {
            setSearchOpen(false);
            setSearchScanning(false);
          }}
          collections={resolvedCollections}
          activeCollectionId={activeCollectionId}
          allVinilos={allVinilos}
          localVinilos={vinilos}
          onJumpTo={setOpen}
          onCreateList={handleCreateCollection}
          onSaveToList={handleSaveToList}
          onRemoveFromList={(vinylId, listId) => handleToggleVinyl(listId, vinylId)}
          onDeleteVinyl={handleDeleteVinylPermanently}
        />
      </>
    );
  }

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-ink text-paper">
      {/* loading card — fades out when hydrated */}
      <div
        className={`absolute inset-0 z-50 flex items-center justify-center bg-ink transition-opacity duration-700 ${
          hydrated ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <div className="w-[320px] border border-paper/10">
          <div className="flex items-center justify-between border-b border-paper/10 px-4 py-2 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
            <span>Sistema · v0.1</span>
            <span className="loading-dot">●</span>
          </div>
          <div className="px-5 pt-5 pb-3">
            <div className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
              Estado
            </div>
            <div className="mt-1.5 text-[14px] text-paper/85">
              Cargando ficheros
            </div>
          </div>
          <div className="px-5 pb-5">
            <div className="h-px bg-paper/10 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1/3 bg-paper/40 loading-bar" />
            </div>
          </div>
        </div>
      </div>

      {/* everything else fades IN when hydrated, and fades briefly on
          collection change for a smooth swap */}
      <div
        className={`transition-opacity duration-500 ${
          !hydrated || collectionFading ? "opacity-0" : "opacity-100"
        }`}
      >
      {vinilos.length > 0 && view === "shelf" && (
        <VinylShelf
          handleRef={shelfRef}
          vinilos={vinilos}
          onOpen={handleVinylClick}
          onActiveChange={setActive}
          onCoverHalfWidth={handleCoverHalfWidth}
        />
      )}

      {vinilos.length > 0 && view === "grid" && (
        <VinylGrid
          vinilos={vinilos}
          activeId={active?.id}
          playingId={nowPlaying?.id}
          isPlaying={playing}
          onPlay={(v: Vinyl) => {
            if (nowPlaying?.id === v.id) togglePlay();
            else playPreview(v);
          }}
          onSelect={(v) => {
            // jump back to the 3D shelf with that record centred + opened
            pendingOpenRef.current = v.id;
            setActive(v);
            setView("shelf");
          }}
        />
      )}

      {/* invisible backdrop while opened — click anywhere outside the vinyl closes */}
      {open && (
        <div
          onClick={handleClose}
          className="absolute inset-0 z-10"
          aria-label="close detail"
        />
      )}

      {/* side info that flanks the centred vinyl when opened — placed at the
          far edges of the viewport so it sits on the black background, never
          on top of the vinyl */}
      {open && (
        <>
          {/* containers are bounded so they NEVER cross the vinyl on screen.
              vinyl occupies the central ~42% horizontally → reserve 29% for each side. */}
          <motion.div
            key={`l-${open.id}`}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            ref={(el) => {
              sideRefs.current[0] = el;
            }}
            data-side="left"
            style={{ right: "calc(50% + var(--cover-half, 21vw) + 32px)" }}
            className="pointer-events-none absolute left-6 top-[42%] -translate-y-1/2 z-10 text-right text-paper/80"
          >
            <Field label="Artist" value={open.artist} />
            <Field label="Year" value={String(open.year)} />
            <Field label="Genre" value={open.genre} />
          </motion.div>
          <motion.div
            key={`r-${open.id}`}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            ref={(el) => {
              sideRefs.current[1] = el;
            }}
            data-side="right"
            style={{ left: "calc(50% + var(--cover-half, 21vw) + 32px)" }}
            className="pointer-events-none absolute right-6 top-[42%] -translate-y-1/2 z-10 text-left text-paper/80"
          >
            <Field label="Label" value={open.label} />
            <Field label="Country" value={open.country} />
            <Field label="Tracks" value={String(open.tracklist.length)} />
          </motion.div>

          {/* edit icon over the cover — appears only once the open animation
              has finished, and on hover */}
          {fullyOpen && (
            <motion.button
              onClick={handleClose}
              initial={{ opacity: 0, x: "-50%", y: -4 }}
              animate={{ opacity: 1, x: "-50%", y: 0 }}
              transition={{ duration: 0.4 }}
              aria-label="Cerrar"
              className="absolute left-1/2 top-[78%] z-20 flex h-6 w-6 items-center justify-center text-paper/50 hover:text-paper transition"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2 L12 12 M12 2 L2 12" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
              </svg>
            </motion.button>
          )}
          {fullyOpen && (
            <CommunityBridge
              vinyl={open}
              allVinilos={allVinilos}
              onOpenOwn={(v) => {
                const idx = vinilos.findIndex((x) => x.id === v.id);
                if (idx >= 0) {
                  setOpen(v);
                  shelfRef.current?.open(idx);
                }
              }}
              onSave={(v) => handleSaveToList(v, activeCollectionId)}
            />
          )}
          {fullyOpen && (
            <VinylEditOverlay
              preview={!authenticated}
              vinyl={open}
              collections={resolvedCollections}
              activeCollectionId={activeCollectionId}
              isInWishlist={activeListKind === "wishlist"}
              activeIsLibrary={activeListKind === "collection"}
              onAddTo={(cid) => handleAddVinylTo(cid, open.id)}
              onMoveToCollection={() => {
                // "lo he comprado": moving it to the collection is what takes
                // it out of the wishlist, and the id of that list depends on
                // whether you're signed in
                const collectionId = lib.lists.find((l) => l.kind === "collection")?.id;
                if (collectionId) handleAddVinylTo(collectionId, open.id);
              }}
              onRemoveFromActive={() => {
                handleRemoveVinylFromActive(open.id);
                handleClose();
              }}
              onDeletePermanently={() => {
                handleDeleteVinylPermanently(open.id);
                handleClose();
              }}
            />
          )}
        </>
      )}

      {/* the shared bar, with the shelf's own controls in the same row */}
      <TopNav
        transparent
        // Scanning used to sit here as its own control, and search as a second
        // button in this row. Search is now the bar's own, in the same corner
        // on every screen; the shelf only says what search means here.
        onSearch={() => openSearch()}
        right={
          <div className="flex items-center gap-5">
          {/* view switch: 3D shelf ↔ grid */}
          <div className="flex items-center border border-paper/20">
            {(["shelf", "grid"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-label={v === "shelf" ? "Vista colección" : "Vista cuadrícula"}
                aria-pressed={view === v}
                className={`flex h-[26px] w-[30px] items-center justify-center transition ${
                  view === v
                    ? "bg-paper/90 text-ink"
                    : "text-paper/50 hover:text-paper"
                }`}
              >
                {v === "shelf" ? (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1" />
                    <circle cx="6" cy="6" r="1.3" fill="currentColor" />
                  </svg>
                ) : (
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path
                      d="M1 1h4v4H1zM7 1h4v4H7zM1 7h4v4H1zM7 7h4v4H7z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>
          </div>
        }
      />

      {/* active title — moves up + shrinks when a vinyl is opened so it never
          overlaps the centred cover */}
      {active && view === "shelf" && (
        <div
          className={`pointer-events-none absolute inset-x-0 z-10 flex flex-col items-center text-center transition-all ease-out ${
            open
              ? "top-[10%] duration-500"
              : "top-[18%] duration-[1100ms] delay-[1100ms]"
          }`}
        >
          <div className="px-6">
            <div className="text-[11px] uppercase tracking-[0.22em] text-paper/50">
              {active.genre} · {active.year}
            </div>
            <h1
              className={`mt-2 font-medium leading-none text-paper transition-all ease-out ${
                open
                  ? "text-2xl md:text-3xl duration-500"
                  : "text-4xl md:text-5xl duration-[1100ms] delay-[1100ms]"
              }`}
            >
              {active.title}
            </h1>
            {!open && (
              <div className="mt-2 text-[13px] text-paper/60">{active.artist}</div>
            )}
          </div>
        </div>
      )}

      {/* subtle bottom gradient to improve readability of the bottom UI */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-ink via-ink/60 to-transparent" />

      {/* bottom-left: the whole block opens the lists panel. The old circular
          switcher cycled lists blindly and was too faint to read as a control. */}
      <div className="absolute bottom-0 left-0 z-20 px-8 py-6">
        <button
          onClick={() => setCollectionsOpen(true)}
          aria-label="Abrir listas"
          className="group flex items-center gap-3 text-left"
        >
          {/* Somebody else's list wears their face here; yours wears the
              lists icon. It is the same control either way — it opens the
              panel — but the corner has to answer "whose shelf am I looking
              at" without being asked, because in 3D nothing else does. */}
          {foreign ? (
            <span className="relative shrink-0">
              <span className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] text-paper/60">
                {foreign.list.owner.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={foreign.list.owner.avatarUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  foreign.list.owner.displayName.slice(0, 2).toUpperCase()
                )}
              </span>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#151515] ring-[1.5px] ring-ink">
                <svg width="9" height="9" viewBox="0 0 20 20" fill="none" aria-hidden className="text-paper/70">
                  <circle cx="10" cy="6.6" r="3" stroke="currentColor" strokeWidth="2" />
                  <path d="M4.2 16.6 C4.8 13.5 7.1 11.8 10 11.8 C12.9 11.8 15.2 13.5 15.8 16.6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
            </span>
          ) : (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-paper/25 text-paper/60 transition group-hover:border-paper/70 group-hover:text-paper">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden>
                <path
                  d="M2 3.5 H12 M2 7 H12 M2 10.5 H8"
                  stroke="currentColor"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          )}
          <span>
            <span className="block text-[20px] font-medium leading-none text-paper">
              {foreign ? foreign.list.title : activeCollection?.name ?? "Mi Colección"}
            </span>
            <span className="mt-1.5 block text-[11px] uppercase tracking-[0.18em] text-paper/50 transition group-hover:text-paper/75">
              {foreign ? `de ${foreign.list.owner.displayName} · ` : ""}
              {vinilos.length} {vinilos.length === 1 ? "disco" : "discos"}
            </span>
          </span>
        </button>
      </div>

      {/* bottom-center: controls — the main button is the music's play/pause;
          the satellite plays the record you're looking at.
          Everything here animates with CSS transforms on purpose: the 3D shelf
          owns the main thread, and JS-driven tweens stuttered against it. */}
      <div className="pointer-events-none absolute bottom-0 left-1/2 z-20 -translate-x-1/2 py-7">
        <div
          className={`pointer-events-auto relative flex items-center gap-10 transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            showSounding ? "-translate-x-[29px]" : "translate-x-0"
          }`}
        >
          <button
            onClick={goPrev}
            className="-m-3 p-3 text-paper/70 hover:text-paper transition"
            aria-label="Previous"
          >
            <Skip dir="prev" />
          </button>

          {/* play / pause of what sounds */}
          <button
            onClick={toggleTransport}
            disabled={!nowPlaying && !transportTarget?.previewUrl}
            title={playing ? "Pausar" : "Reproducir"}
            className="flex h-12 w-12 items-center justify-center rounded-full border border-paper/30 text-paper hover:border-paper/80 transition disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="3" y="2" width="3" height="10" fill="currentColor" />
                <rect x="8" y="2" width="3" height="10" fill="currentColor" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 2 L12 7 L3 12 Z" fill="currentColor" />
              </svg>
            )}
          </button>

          {/* play THIS record. Always mounted so its cover is decoded long
              before it shows — mounting it on demand made the artwork pop in. */}
          {/* the wrapper must never take clicks: it overlaps the Next arrow,
              and while the button was hidden it silently ate them */}
          <div
            className="pointer-events-none absolute left-1/2 top-1/2 ml-[34px] -translate-y-1/2"
            aria-hidden={!showSounding}
          >
            <button
              onClick={() => active && playPreview(active)}
              disabled={!active?.previewUrl || !showSounding}
              tabIndex={showSounding ? 0 : -1}
              title="Reproducir este disco"
              aria-label="Reproducir este disco"
              className={`relative flex h-12 w-12 items-center justify-center overflow-hidden rounded-full border border-paper/25 bg-ink text-paper transition-[opacity,transform,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-paper/70 ${
                showSounding
                  ? "pointer-events-auto scale-100 opacity-100"
                  : "pointer-events-none scale-75 opacity-0"
              }`}
            >
              {active && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverFor(active)}
                    alt=""
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                  />
                  <span className="absolute inset-0 rounded-full bg-ink/40" />
                  <svg
                    className="relative drop-shadow-[0_1px_2px_rgba(0,0,0,0.65)]"
                    width="13"
                    height="13"
                    viewBox="0 0 14 14"
                    fill="none"
                  >
                    <path
                      d="M3 2 L12 7 L3 12 Z"
                      fill="#fff"
                      stroke="#fff"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                    />
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* the next arrow steps aside to make room for the satellite */}
          <button
            onClick={goNext}
            className={`-m-3 p-3 text-paper/70 hover:text-paper transition-[transform,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
              showSounding ? "translate-x-[36px]" : "translate-x-0"
            }`}
            aria-label="Next"
          >
            <Skip dir="next" />
          </button>
        </div>
      </div>

      {/* bottom-right: now viewing */}
      {/* now playing — tied to the audio, not to what you're browsing */}
      {nowPlaying && (
        <motion.button
          key={nowPlaying.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onClick={() => {
            if (view === "grid") {
              document
                .getElementById(`grid-${nowPlaying.id}`)
                ?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            const idx = vinilos.findIndex((v) => v.id === nowPlaying.id);
            if (idx >= 0) shelfRef.current?.goTo(idx);
          }}
          aria-label="Ir al disco que suena"
          className="absolute bottom-0 right-0 z-20 px-8 py-6 text-right"
        >
          <div className="flex items-center gap-3">
            <div className="max-w-[320px]">
              <div className="text-[11px] uppercase tracking-[0.18em] text-paper/50">
                {loadingPreview ? "Cargando" : playing ? "Ahora escuchando" : "En pausa"}
              </div>
              <MarqueeText className="mt-1 font-medium text-[15px]">
                {nowPlaying.title}
              </MarqueeText>
            </div>
            <MiniVinyl coverUrl={coverFor(nowPlaying)} spinning={playing} />
          </div>
        </motion.button>
      )}

      {/* empty state — archive card aesthetic */}
      {vinilos.length === 0 && (
        <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto w-[420px] max-w-[90vw] border border-paper/10 bg-ink/40 backdrop-blur-sm">
            {/* top stamp row */}
            <div className="flex items-center justify-between border-b border-paper/10 px-5 py-2 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
              <span>Ficha · 000</span>
              <span>Vacía</span>
            </div>
            {/* body */}
            <div className="px-7 pt-7 pb-6">
              <div className="mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
                Estado
              </div>
              <div className="mt-1.5 text-[15px] text-paper/90">
                Tu colección no tiene vinilos
              </div>

              <div className="mt-5 mono text-[10px] uppercase tracking-[0.22em] text-paper/40">
                Siguiente paso
              </div>
              <div className="mt-1.5 text-[13px] text-paper/55 leading-relaxed">
                Añade el primer disco desde el buscador. Se descargará su portada
                y un preview de audio cuando estén disponibles.
              </div>
            </div>
            {/* footer action */}
            <div className="flex items-stretch border-t border-paper/10">
              <button
                onClick={() => openSearch()}
                className="flex-1 px-5 py-3 text-left text-[14px] text-paper hover:bg-paper/[0.04] transition flex items-center justify-between"
              >
                <span>Buscar vinilos</span>
                <span className="text-paper/40">→</span>
              </button>
              {canScan ? (
                <button
                  onClick={() => openSearch(true)}
                  className="flex items-center gap-2 border-l border-paper/10 px-5 py-3 text-[14px] text-paper transition hover:bg-paper/[0.04]"
                >
                  <BarcodeIcon size={15} />
                  <span>Escanear</span>
                </button>
              ) : (
                <div className="px-5 py-3 mono text-[10px] uppercase tracking-[0.22em] text-paper/30 border-l border-paper/10 flex items-center">
                  Tecla /
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Demo mode says so, once, quietly. Everything works — it just lives in
          this browser, and that is worth knowing before you build a shelf. */}
      {!authenticated && <DemoNotice />}

      <SearchOverlay
        open={searchOpen}
        autoScan={searchScanning}
        onClose={() => {
          setSearchOpen(false);
          setSearchScanning(false);
        }}
        collections={resolvedCollections}
        activeCollectionId={activeCollectionId}
        allVinilos={allVinilos}
        localVinilos={vinilos}
        onJumpTo={(v) => {
          const idx = vinilos.findIndex((x) => x.id === v.id);
          if (idx >= 0) shelfRef.current?.goTo(idx);
        }}
        onCreateList={handleCreateCollection}
        onSaveToList={handleSaveToList}
        onRemoveFromList={(vinylId, listId) => handleToggleVinyl(listId, vinylId)}
        onDeleteVinyl={handleDeleteVinylPermanently}
      />

      <CollectionsOverlay
        preview={!authenticated}
        open={collectionsOpen}
        onClose={() => setCollectionsOpen(false)}
        collections={resolvedCollections}
        activeId={activeCollectionId}
        onActivate={handleActivateCollection}
        onCreate={handleCreateCollection}
        onRename={handleRenameCollection}
        onDelete={handleDeleteCollection}
        onToggleVinyl={handleToggleVinyl}
        onDeleteVinyl={handleDeleteVinylPermanently}
        onSetSort={handleSetSort}
        onReorder={handleReorderVinyl}
        onSetVisibility={(id, visibility) => {
          void repo.setListVisibility(id, visibility).then(() => void lib.refresh());
        }}
        visibilityOf={(id) => lib.lists.find((l) => l.id === id)?.visibility ?? "public"}
        myId={myProfileId}
        followed={followed}
        followedCovers={followedCovers}
        onOpenFollowed={(l: ListWithRecord) => void openForeign(l as SavedList)}
        onUnfollowList={(id) => {
          setFollowed((prev) => prev.filter((l) => l.id !== id));
          void repo.unfollow("list", id);
        }}
        allVinilos={allVinilos}
      />
      </div>
    </main>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="text-[9px] uppercase tracking-[0.22em] text-paper/35">{label}</div>
      <div className="mt-1 text-[13px] tracking-tight">{value || "—"}</div>
    </div>
  );
}

function Skip({ dir }: { dir: "prev" | "next" }) {
  const flip = dir === "prev" ? "scale(-1, 1)" : undefined;
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" style={{ transform: flip }}>
      <path d="M2 2 L11 7 L2 12 Z" fill="currentColor" />
      <rect x="13" y="2" width="2" height="10" fill="currentColor" />
    </svg>
  );
}
