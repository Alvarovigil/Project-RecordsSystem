"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Page } from "@/components/app/AppShell";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonRackGrid } from "@/components/ui/Skeleton";
import FollowButton from "./FollowButton";
import PersonRow from "./PersonRow";
import ListCard from "./ListCard";
import EditProfileSheet from "./EditProfileSheet";
import { useRepository } from "@/hooks/useRepository";
import { useRelationship } from "@/hooks/useRelationship";
import type { ListWithRecord, Profile, ProfileStats, SavedList } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import { portraitOf, standoutsOf } from "@/lib/collection-portrait";
import { InCommon, PortraitCard, Regulars, Standouts } from "./ProfileShowcase";
import RecordSheet from "@/components/mobile/RecordSheet";
import { coverFor } from "@/lib/cover";
import Loading from "@/components/ui/Loading";
import Verified from "@/components/ui/Verified";

/**
 * One profile screen, for you and for everyone else.
 *
 * There used to be two — a server-rendered page for real accounts and a client
 * one for the placeholder community — and they had already drifted: different
 * headers, different empty states, one with a follow button and one without.
 * Two implementations of one screen always drift, and the drift is invisible
 * until someone reports that "the profile looks different from over here".
 *
 * What every consolidated version of this screen does (Instagram, Letterboxd,
 * Are.na all landed in the same place):
 *
 * - **Your profile is the same object as theirs**, with edit affordances swapped
 *   in where the follow button was. Seeing yourself as others see you is the
 *   whole point of having a public profile; a separate "my account" screen
 *   hides the thing you are asking people to publish.
 * - **The counts are the navigation.** Tapping "128 seguidores" is how you get
 *   to the people. Nobody looks for a menu item called "followers".
 * - **Followers and following open as sheets, not pages.** You are inspecting
 *   this profile, not leaving it — and coming back must not cost a page load or
 *   your scroll position.
 */
export default function ProfileView({
  profileId,
  /** rendered before the data arrives, so the name doesn't pop in */
  initialProfile,
}: {
  profileId: string;
  initialProfile?: Profile | null;
}) {
  const repo = useRepository();
  const { rel } = useRelationship(profileId);
  const [profile, setProfile] = useState<Profile | null>(initialProfile ?? null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [lists, setLists] = useState<ListWithRecord[] | null>(null);
  const [saved, setSaved] = useState<SavedList[]>([]);
  const [releases, setReleases] = useState<Vinyl[]>([]);
  const [covers, setCovers] = useState<Record<string, string[]>>({});
  const [people, setPeople] = useState<"followers" | "following" | null>(null);
  const [editing, setEditing] = useState(false);

  const isYou = rel?.isYou ?? false;

  const load = useCallback(() => {
    Promise.all([
      repo.getProfile(profileId),
      repo.profileStats(profileId),
      repo.listsOfProfile(profileId),
    ]).then(([p, s, l]) => {
      // never overwrite a profile the server already resolved with a null: a
      // failed lookup should leave the page as it was, not blank the name
      if (p) setProfile(p);
      setStats(s);
      setLists(l);
      // The mosaics used to be built by cross-referencing each list's ids
      // against your own library — which only exists for your own profile, and
      // only on the local backend. Everyone else got fourteen empty squares.
      if (l.length) {
        repo
          .coversOfLists(l.map((x) => x.id))
          .then(setCovers)
          .catch(() => {});
      }
    });
  }, [repo, profileId]);

  useEffect(load, [load]);

  // Only yours: someone else's saved lists and full library are a different
  // question, and answering it here would mean four requests on every visit.
  useEffect(() => {
    if (!isYou) return;
    repo
      .savedLists()
      .then((all) => {
        setSaved(all);
        if (all.length) {
          repo
            .coversOfLists(all.map((x) => x.id))
            .then((c) => setCovers((prev) => ({ ...prev, ...c })))
            .catch(() => {});
        }
      })
      .catch(() => {});
    repo.listReleases().then(setReleases).catch(() => {});
  }, [repo, isYou]);

  const coversOf = useCallback((l: ListWithRecord) => covers[l.id] ?? [], [covers]);

  /**
   * Los discos de esta persona, que es de lo que va todo lo demás.
   *
   * Para ti salen de la biblioteca, que ya está cargada. Para quien visitas
   * hay que leerlos de sus racks públicos — hasta ocho, que es de sobra para
   * hacer un retrato y acotado para no barrer la comunidad entera por una
   * visita. De paso se cuenta en cuántos racks aparece cada disco, que es de
   * donde salen los destacados: lo que alguien ha colocado tres veces le
   * importa tres veces.
   */
  const [theirs, setTheirs] = useState<Vinyl[] | null>(null);
  const [timesFiled, setTimesFiled] = useState<Map<string, number>>(new Map());

  const listKey = (lists ?? []).slice(0, 8).map((l) => l.id).join(",");
  useEffect(() => {
    if (!listKey) {
      if (lists !== null) setTheirs(isYou ? releases : []);
      return;
    }
    let alive = true;
    Promise.all(
      listKey.split(",").map((id) => repo.releasesOfList(id).catch(() => [] as Vinyl[])),
    ).then((buckets) => {
      if (!alive) return;
      const filed = new Map<string, number>();
      const byId = new Map<string, Vinyl>();
      for (const bucket of buckets)
        for (const v of bucket) {
          byId.set(v.id, v);
          filed.set(v.id, (filed.get(v.id) ?? 0) + 1);
        }
      setTimesFiled(filed);
      /* Tu propia biblioteca manda sobre tus racks: un disco tuyo que no está
         en ningún rack sigue siendo tuyo. */
      setTheirs(isYou ? mergeById(releases, [...byId.values()]) : [...byId.values()]);
    });
    return () => {
      alive = false;
    };
  }, [listKey, repo, isYou, releases, lists]);

  const portrait = useMemo(() => portraitOf(theirs ?? []), [theirs]);
  const standouts = useMemo(
    () => standoutsOf(theirs ?? [], timesFiled),
    [theirs, timesFiled],
  );

  /** lo que tenéis los dos, que es la razón de que esta pantalla exista */
  const [mineIds, setMineIds] = useState<Set<string> | null>(null);
  useEffect(() => {
    if (isYou) return setMineIds(null);
    repo
      .listReleases()
      .then((rs) => setMineIds(new Set(rs.map((v) => v.id))))
      .catch(() => setMineIds(new Set()));
  }, [repo, isYou]);

  const shared = useMemo(
    () => (mineIds ? (theirs ?? []).filter((v) => mineIds.has(v.id)) : []),
    [theirs, mineIds],
  );

  /** lo último que ha entrado, que es lo que hace que alguien vuelva */
  const latest = useMemo(() => (theirs ?? []).slice(-12).reverse(), [theirs]);

  const [openRecord, setOpenRecord] = useState<Vinyl | null>(null);

  /**
   * El fondo lo pone su propia estantería.
   *
   * La portada del disco que más ha colocado, difuminada: cada pantalla de la
   * aplicación se pinta con aquello de lo que habla, y una colección son sus
   * discos. Si no hay ninguno todavía, no se inventa nada — queda el relleno
   * de la aplicación, que es honesto: esa estantería está vacía.
   */
  const backdrop = standouts[0] ? coverFor(standouts[0]) : null;

  return (
    <Page width={900}>
      {/**
       * La misma cabecera que un disco o un artista, con una persona dentro.
       *
       * Fondo hecho con sus propias portadas, difuminado y llevado a negro, y
       * encima el retrato, el nombre y los datos. No es decoración: el fondo de
       * la ficha de un disco es su portada, el de un artista su foto, y el de
       * una colección son los discos que tiene. Cada pantalla se pinta con
       * aquello de lo que habla.
       */}
      <header
        className="relative -mx-5 mb-8 pb-2 sm:-mx-6"
        style={{ marginTop: "calc(-1 * max(1.5rem, var(--safe-top)))" }}
      >
        <div className="relative h-[34svh] max-h-[300px] w-full overflow-hidden">
          {backdrop ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={backdrop}
              alt=""
              className="h-full w-full scale-125 object-cover blur-2xl"
            />
          ) : (
            <div className="h-full w-full bg-fill-subtle" />
          )}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to bottom," +
                "rgba(10,10,10,0.45) 0%," +
                "rgba(10,10,10,0.30) 30%," +
                "rgba(10,10,10,0.48) 55%," +
                "rgba(10,10,10,0.80) 76%," +
                "rgba(10,10,10,0.95) 90%," +
                "#0a0a0a 100%)",
            }}
          />
        </div>

        <div className="relative -mt-24 px-5 text-center sm:px-6">
          <div className="mx-auto w-[104px]">
            <Avatar
              name={profile?.displayName ?? "?"}
              handle={profile?.username}
              src={profile?.avatarUrl}
              size="xl"
            />
          </div>

          <h1 className="mt-4 flex items-center justify-center gap-2 text-title font-medium text-paper">
            <span className="truncate">{profile?.displayName ?? "…"}</span>
            {profile?.verified && (
              <span className="shrink-0 text-accent">
                <Verified size={18} />
              </span>
            )}
          </h1>
          <p className="mono mt-1 truncate text-sub text-content-muted">
            @{profile?.username ?? ""}
          </p>

          {profile?.bio && (
            <p className="mx-auto mt-3 max-w-[46ch] text-sub leading-relaxed text-content-secondary">
              {profile.bio}
            </p>
          )}

          {/* Las cifras siguen siendo la navegación hacia la gente — nadie
              busca un menú llamado «seguidores» — pero ya no abren la pantalla:
              ahora son el pie de lo que hay arriba y no su titular. */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Stat n={stats?.records} label="discos" />
            <Stat n={stats?.lists} label="racks" />
            <Stat n={stats?.followers} label="seguidores" onClick={() => setPeople("followers")} />
            <Stat n={stats?.following} label="siguiendo" onClick={() => setPeople("following")} />
          </div>

          <div className="mx-auto mt-5 flex max-w-[420px] gap-2.5">
            {isYou ? (
              <>
                <Button variant="secondary" block onClick={() => setEditing(true)}>
                  Editar perfil
                </Button>
                <Button variant="secondary" block href="/ajustes">
                  Ajustes
                </Button>
              </>
            ) : (
              <FollowButton
                profileId={profileId}
                displayName={profile?.displayName ?? ""}
                block
              />
            )}
          </div>
        </div>
      </header>

      {/**
       * Dos caras de la misma pantalla, y la diferencia es a quién le habla.
       *
       * A quien visita se le enseña una vitrina: tres discos, qué tenéis en
       * común, cómo suena esa estantería, de quién no se baja nunca. Todo eso
       * responde a la única pregunta que trae a alguien aquí — «¿me interesa
       * esta persona?» — y ninguna de esas respuestas es un número.
       *
       * A ti se te enseña un panel: el retrato de lo que has reunido, lo
       * último que entró y tus racks. Tú ya sabes lo que tienes; lo que no
       * sabes es qué forma tiene, y eso es lo que esta pantalla puede darte
       * que ninguna otra da.
       *
       * Lo que desaparece de las dos: las pestañas Racks / Discos / Guardadas.
       * Eran tres nombres para una sola cosa — tu colección — y obligaban a
       * elegir una antes de enseñar nada.
       */}
      {!isYou && shared.length > 0 && (
        <InCommon records={shared} onOpen={setOpenRecord} />
      )}

      <Standouts
        records={standouts}
        onOpen={setOpenRecord}
        title={isYou ? "Los que más colocas" : "Los que más coloca"}
      />

      <PortraitCard portrait={portrait} records={(theirs ?? []).length} />

      <Regulars records={theirs ?? []} />

      {isYou && latest.length > 0 && (
        <section className="pb-10">
          <h2 className="text-caption uppercase tracking-label text-content-muted">
            Lo último que entró
          </h2>
          <ul className="rail rail-page mt-3.5 flex gap-3 pb-2">
            {latest.map((v) => (
              <li key={v.id} className="w-[112px] shrink-0 snap-start">
                <button
                  onClick={() => setOpenRecord(v)}
                  className="pressable block w-full text-left"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverFor(v)}
                    alt=""
                    loading="lazy"
                    className="aspect-square w-full rounded-[3px] object-cover"
                  />
                  <span className="mt-2 block truncate text-caption text-content-secondary">
                    {v.title}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="pb-10">
        <h2 className="text-caption uppercase tracking-label text-content-muted">
          {isYou ? "Tus racks" : "Sus racks"}
        </h2>
        <div className="mt-4">
          <ListGrid
            lists={lists}
            mine={isYou}
            coversOf={coversOf}
            empty={
              isYou ? (
                <EmptyState
                  title="Todavía no has publicado ningún rack"
                  body="Un rack es la forma de contar por qué estos discos están juntos. «El turno de noche» dice más que «Rock, 40 discos»."
                  action={{ label: "Ir a mi colección", href: "/coleccion" }}
                />
              ) : (
                <EmptyState
                  title={`${profile?.displayName ?? "Esta persona"} no tiene racks públicos`}
                  body="Cuando publique alguno aparecerá aquí. Mientras tanto, puedes seguirle para enterarte."
                  action={{ label: "Explorar otras colecciones", href: "/explorar" }}
                />
              )
            }
          />
        </div>
      </section>

      {/* Los racks de otra gente que has guardado son tuyos de otra manera —
          los usas, no los has hecho — así que van al final y con su nombre
          puesto, en vez de disputarle una pestaña a los tuyos. */}
      {isYou && saved.length > 0 && (
        <section className="pb-10">
          <h2 className="text-caption uppercase tracking-label text-content-muted">
            Guardados de otra gente
          </h2>
          <div className="mt-4">
            <ListGrid lists={saved} mine={false} coversOf={coversOf} empty={null} />
          </div>
        </section>
      )}

      <RecordSheet
        vinyl={openRecord}
        onClose={() => setOpenRecord(null)}
        canEdit={false}
        collections={[]}
        activeListId=""
        playing={false}
        onTogglePlay={() => {}}
        onAddTo={() => {}}
        onRemoveFromActive={() => {}}
        onDelete={() => {}}
      />

      <PeopleSheet
        which={people}
        profileId={profileId}
        displayName={profile?.displayName ?? ""}
        onClose={() => setPeople(null)}
      />

      {isYou && profile && (
        <EditProfileSheet
          open={editing}
          onClose={() => setEditing(false)}
          profile={profile}
          onSaved={(p) => {
            setProfile(p);
            load();
          }}
        />
      )}
    </Page>
  );
}

/** tus discos primero, y los de tus racks detrás, sin repetir */
function mergeById(a: Vinyl[], b: Vinyl[]) {
  const seen = new Set(a.map((v) => v.id));
  return [...a, ...b.filter((v) => !seen.has(v.id))];
}

function Stat({ n, label, onClick }: { n?: number; label: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="text-body font-semibold text-paper">{n ?? "—"}</span>{" "}
      <span className="text-sub text-content-muted">{label}</span>
    </>
  );
  if (!onClick) return <span>{body}</span>;
  return (
    <button onClick={onClick} className="pressable transition-opacity hover:opacity-70">
      {body}
    </button>
  );
}

function ListGrid({
  lists,
  mine,
  coversOf,
  empty,
}: {
  lists: ListWithRecord[] | null;
  mine: boolean;
  coversOf: (l: ListWithRecord) => string[];
  empty: React.ReactNode;
}) {
  if (lists === null) return <SkeletonRackGrid n={6} />;
  if (lists.length === 0) return <>{empty}</>;
  return (
    <ul className="appear grid grid-cols-2 gap-x-9 gap-y-14 sm:grid-cols-3 lg:grid-cols-4">
      {lists.map((l) => (
        <li key={l.id}>
          <ListCard list={l} mine={mine} covers={coversOf(l)} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Followers and following, in a sheet.
 *
 * Loaded when it opens rather than with the page: two lists of people nobody
 * asked for is a lot of requests for a screen whose job is the collection.
 */
function PeopleSheet({
  which,
  profileId,
  displayName,
  onClose,
}: {
  which: "followers" | "following" | null;
  profileId: string;
  displayName: string;
  onClose: () => void;
}) {
  const repo = useRepository();
  const [rows, setRows] = useState<Profile[] | null>(null);

  useEffect(() => {
    if (!which) return;
    setRows(null);
    const p = which === "followers" ? repo.followersOf(profileId) : repo.followingOf(profileId);
    p.then(setRows).catch(() => setRows([]));
  }, [which, repo, profileId]);

  return (
    <Sheet
      open={Boolean(which)}
      onClose={onClose}
      title={which === "followers" ? "Seguidores" : "Siguiendo"}
      subtitle={displayName}
      size="tall"
      width={420}
    >
      <div className="px-5 py-1">
        {rows === null && (
          <div className="flex justify-center py-8">
            <Loading size={40} />
          </div>
        )}
        {rows?.length === 0 && (
          <p className="py-6 text-sub text-content-muted">
            {which === "followers"
              ? "Todavía no le sigue nadie."
              : "Todavía no sigue a nadie."}
          </p>
        )}
        <ul>
          {(rows ?? []).map((p) => (
            <li key={p.id}>
              <PersonRow profile={p} />
            </li>
          ))}
        </ul>
      </div>
    </Sheet>
  );
}
