"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Page } from "@/components/app/AppShell";
import Link from "next/link";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import EmptyState from "@/components/ui/EmptyState";
import { SkeletonCovers, SkeletonRackGrid } from "@/components/ui/Skeleton";
import FollowButton from "./FollowButton";
import PersonRow from "./PersonRow";
import ListCard from "./ListCard";
import EditProfileSheet from "./EditProfileSheet";
import { useRepository } from "@/hooks/useRepository";
import { useRelationship } from "@/hooks/useRelationship";
import type { ListWithRecord, Profile, ProfileStats, SavedList } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";
import { standoutsOf } from "@/lib/collection-portrait";
import { InCommon, Standouts } from "./ProfileShowcase";
import ProfileCharts from "./ProfileCharts";
import PickThreeSheet from "./PickThreeSheet";
import { cleanArtist } from "@/lib/artist";
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
  const router = useRouter();
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

  /**
   * Los tres elegidos, con red de seguridad.
   *
   * Si alguien no ha elegido ninguno todavía, se enseñan los que más ha
   * colocado — un perfil sin nada arriba es un perfil que no presenta a nadie,
   * y la adivinanza es razonable mientras no haya decisión. En el tuyo no: ahí
   * el hueco es una invitación a elegir, porque es lo único de esta pantalla
   * que merece pedirse.
   */
  const [picks, setPicks] = useState<string[]>([]);
  useEffect(() => {
    repo
      .picksOf(profileId)
      .then(setPicks)
      .catch(() => setPicks([]));
  }, [repo, profileId]);

  const standouts = useMemo(
    () => standoutsOf(theirs ?? [], timesFiled),
    [theirs, timesFiled],
  );
  const picked = useMemo(() => {
    const chosen = picks
      .map((id) => (theirs ?? []).find((v) => v.id === id))
      .filter((v): v is Vinyl => Boolean(v));
    if (chosen.length > 0) return chosen;
    return isYou ? [] : standouts;
  }, [picks, theirs, standouts, isYou]);

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
  const [tab, setTab] = useState<"perfil" | "coleccion" | "racks">("perfil");
  const [picking, setPicking] = useState(false);


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
        {/* La vuelta atrás, como en la ficha de un disco y en la de un
            artista: en el perfil de otra persona has entrado desde algún sitio
            y tiene que haber salida. En el tuyo no — es una pestaña, no un
            destino al que se llega. */}
        {!isYou && (
          <button
            onClick={() => router.back()}
            aria-label="Atrás"
            className="pressable absolute left-4 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-ink/38 text-paper backdrop-blur-xl transition-colors hover:bg-ink/60"
            style={{ top: "calc(max(1.5rem, var(--safe-top)) + 0.25rem)" }}
          >
            <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path
                d="M11.5 3.5 L5.5 9 L11.5 14.5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        <div className="relative h-[26svh] max-h-[230px] w-full overflow-hidden">
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

        <div className="relative -mt-[86px] px-5 text-center sm:px-6">
          <div className="mx-auto w-[132px]">
            <Avatar
              name={profile?.displayName ?? "?"}
              handle={profile?.username}
              src={profile?.avatarUrl}
              size="xl"
            />
          </div>

          <h1 className="mt-3.5 flex items-center justify-center gap-2 text-title font-medium text-paper">
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

          {/**
           * Un solo botón en el tuyo.
           *
           * «Editar perfil» y «Ajustes» abrían dos sitios que pedían lo mismo:
           * nombre, usuario y bio, en una hoja y en una página. Dos formularios
           * para un dato es dos sitios donde arreglarlo y uno donde olvidarse.
           * Aquí se edita el perfil; Ajustes se queda con lo que es de la
           * cuenta y no de la persona — la sesión, el correo, la aplicación —
           * y se llega desde allí.
           */}
          <div className="mx-auto mt-5 flex max-w-[420px] gap-2.5">
            {isYou ? (
              <>
                <Button variant="secondary" block onClick={() => setEditing(true)}>
                  Editar perfil
                </Button>
                {/* Los ajustes ya no repiten el perfil, así que dejan de ser un
                    segundo botón con el mismo peso: son la rueda de al lado, y
                    en el teléfono esta es su única puerta. */}
                <Link
                  href="/ajustes"
                  aria-label="Ajustes"
                  className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-fill text-content transition-colors hover:bg-fill-strong"
                >
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden>
                    <circle cx="9" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.4" />
                    <path
                      d="M9 1.8v1.6M9 14.6v1.6M16.2 9h-1.6M3.4 9H1.8M14.1 3.9l-1.1 1.1M5 13l-1.1 1.1M14.1 14.1L13 13M5 5 3.9 3.9"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinecap="round"
                    />
                  </svg>
                </Link>
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
       * Tres pestañas, y son tres preguntas distintas.
       *
       * «¿Quién es esta persona?» se responde con lo que ha elegido y con la
       * forma de lo que tiene; «¿qué tiene?» con todos sus discos; «¿cómo lo
       * ordena?» con sus cajones. Antes estaba todo en una columna y había que
       * bajar tres pantallas para llegar a lo tercero, que en un perfil ajeno
       * es justo lo que más se busca.
       *
       * La diferencia entre tu perfil y el de otro no son las pestañas: son
       * las mismas tres. Lo que cambia es lo que hay dentro — a ti se te
       * ofrece cambiar tus tres y a un visitante se le enseña primero lo que
       * tenéis en común, porque es lo que convierte a un desconocido en
       * alguien a quien seguir.
       */}
      <div className="rail -mx-5 mb-7 flex gap-2 px-5 sm:mx-0 sm:px-0">
        {(
          [
            ["perfil", "Perfil"],
            ["coleccion", "Colección", stats?.records],
            ["racks", "Racks", stats?.lists],
          ] as const
        ).map(([value, label, count]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`pressable shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sub transition-colors ${
              tab === value ? "bg-paper text-ink" : "bg-fill text-content-secondary hover:bg-fill-strong"
            }`}
          >
            {label}
            {typeof count === "number" && count > 0 && (
              <span
                className={`ml-1.5 text-caption ${tab === value ? "text-ink/50" : "text-content-faint"}`}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "perfil" && (
        <>
          {!isYou && shared.length > 0 && <InCommon records={shared} onOpen={setOpenRecord} />}

          <Standouts
            records={picked}
            onOpen={setOpenRecord}
            mine={isYou}
            onEdit={isYou ? () => setPicking(true) : undefined}
          />

          <ProfileCharts records={theirs ?? []} mine={isYou} />

          {latest.length > 0 && (
            <section className="pb-10">
              <h2 className="text-heading font-medium leading-tight text-paper">
                {isYou ? "Últimas adquisiciones" : "Lo último que ha entrado"}
              </h2>
              <ul className="rail rail-page mt-4 flex gap-3 pb-2">
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
        </>
      )}

      {tab === "coleccion" && (
        <section className="pb-12">
          {theirs === null ? (
            <SkeletonCovers n={12} cols="grid-cols-3 sm:grid-cols-5" gap="gap-3" />
          ) : theirs.length === 0 ? (
            <EmptyState
              title={isYou ? "Tu colección está vacía" : "Todavía no ha enseñado ningún disco"}
              body={
                isYou
                  ? "Busca un disco por título, artista o código de barras y quedará guardado aquí."
                  : "Cuando publique un rack, sus discos aparecerán en esta pestaña."
              }
              action={
                isYou
                  ? { label: "Buscar discos", href: "/explorar?buscar=1" }
                  : { label: "Explorar colecciones", href: "/explorar" }
              }
            />
          ) : (
            <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-6">
              {theirs.map((v, i) => (
                <li key={v.id}>
                  <button
                    onClick={() => setOpenRecord(v)}
                    className="pressable block w-full text-left"
                  >
                    <Cover src={coverFor(v)} eager={i < 9} className="aspect-square w-full rounded-[3px]" />
                    <span className="mt-2 block truncate text-caption text-paper">{v.title}</span>
                    <span className="block truncate text-caption text-content-muted">
                      {cleanArtist(v.artist)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {tab === "racks" && (
        <section className="pb-12">
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

          {/* Los racks de otra gente que has guardado son tuyos de otra manera
              — los usas, no los has hecho — así que van al final y con su
              nombre puesto. */}
          {isYou && saved.length > 0 && (
            <div className="mt-12">
              <h2 className="text-caption uppercase tracking-label text-content-muted">
                Guardados de otra gente
              </h2>
              <div className="mt-4">
                <ListGrid lists={saved} mine={false} coversOf={coversOf} empty={null} />
              </div>
            </div>
          )}
        </section>
      )}

      {isYou && (
        <PickThreeSheet
          open={picking}
          onClose={() => setPicking(false)}
          records={theirs ?? []}
          current={picks}
          onSave={async (ids) => {
            setPicks(ids);
            await repo.setPicks(ids).catch(() => {});
          }}
        />
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
