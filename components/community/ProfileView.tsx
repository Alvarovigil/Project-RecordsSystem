"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Page } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Sheet from "@/components/ui/Sheet";
import { Tabs } from "@/components/ui/Segmented";
import EmptyState, { CoverGridSkeleton } from "@/components/ui/EmptyState";
import FollowButton from "./FollowButton";
import PersonRow from "./PersonRow";
import ListCard from "./ListCard";
import EditProfileSheet from "./EditProfileSheet";
import { useRepository } from "@/hooks/useRepository";
import { useRelationship } from "@/hooks/useRelationship";
import type { ListWithRecord, Profile, ProfileStats, SavedList } from "@/lib/data/types";
import type { Vinyl } from "@/lib/types";

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
  const [tab, setTab] = useState<"lists" | "records" | "saved">("lists");
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

  const tabs = [
    { value: "lists" as const, label: "Listas", count: stats?.lists },
    ...(isYou
      ? [
          { value: "records" as const, label: "Discos", count: stats?.records },
          { value: "saved" as const, label: "Guardadas", count: saved.length },
        ]
      : []),
  ];

  return (
    <Page width={900}>
      <header className="pb-7">
        <div className="flex items-start gap-4 sm:gap-5">
          <Avatar
            name={profile?.displayName ?? "?"}
            handle={profile?.username}
            src={profile?.avatarUrl}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-title font-medium text-paper sm:text-display">
              {profile?.displayName ?? "…"}
            </h1>
            <p className="mono mt-0.5 truncate text-sub text-content-muted">
              @{profile?.username ?? ""}
            </p>
          </div>
          {/* The action sits at the top on desktop where there is room, and
              moves below the stats on a phone — full width, reachable, and not
              competing with the name for the same 40px. */}
          <div className="hidden shrink-0 items-center gap-2.5 sm:flex">
            {isYou ? (
              <>
                <Button variant="secondary" onClick={() => setEditing(true)}>
                  Editar perfil
                </Button>
                <Button variant="ghost" href="/ajustes">
                  Ajustes
                </Button>
              </>
            ) : (
              <FollowButton profileId={profileId} displayName={profile?.displayName ?? ""} />
            )}
          </div>
        </div>

        {profile?.bio && (
          <p className="mt-4 max-w-[56ch] text-body leading-relaxed text-content-secondary">
            {profile.bio}
          </p>
        )}

        {/* the counts ARE the navigation into the people */}
        <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Stat n={stats?.records} label="discos" />
          <Stat n={stats?.lists} label="listas" />
          <Stat n={stats?.followers} label="seguidores" onClick={() => setPeople("followers")} />
          <Stat n={stats?.following} label="siguiendo" onClick={() => setPeople("following")} />
        </div>

        {/* Ajustes had no door on a phone at all. The account menu that holds
            it on a desktop does not exist under a thumb — there is a tab bar
            instead — so the settings for an account live where the account
            does: on your own profile, next to editing it. */}
        <div className="mt-5 sm:hidden">
          {isYou ? (
            <div className="flex gap-2.5">
              <Button variant="secondary" block onClick={() => setEditing(true)}>
                Editar perfil
              </Button>
              <Button variant="secondary" block href="/ajustes">
                Ajustes
              </Button>
            </div>
          ) : (
            <FollowButton profileId={profileId} displayName={profile?.displayName ?? ""} block />
          )}
        </div>
      </header>

      <Tabs segments={tabs} value={tab} onChange={setTab} />

      <div className="mt-6">
        {tab === "lists" && (
          <ListGrid
            lists={lists}
            mine={isYou}
            coversOf={coversOf}
            empty={
              isYou ? (
                <EmptyState
                  title="Todavía no has publicado ninguna lista"
                  body="Una lista es la forma de contar por qué estos discos están juntos. «El turno de noche» dice más que «Rock, 40 discos»."
                  action={{ label: "Ir a mi colección", href: "/coleccion" }}
                />
              ) : (
                <EmptyState
                  title={`${profile?.displayName ?? "Esta persona"} no tiene listas públicas`}
                  body="Cuando publique alguna aparecerá aquí. Mientras tanto, puedes seguirle para enterarte."
                  action={{ label: "Explorar otras colecciones", href: "/explorar" }}
                />
              )
            }
          />
        )}

        {tab === "records" && (
          <>
            {releases.length === 0 ? (
              <EmptyState
                title="Tu biblioteca está vacía"
                body="Busca un disco por título, artista o código de barras y quedará guardado aquí."
                action={{ label: "Buscar discos", href: "/explorar?buscar=1" }}
              />
            ) : (
              <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
                {releases.map((v) => (
                  <li key={v.id}>
                    <Link href="/coleccion" className="pressable block">
                      <Cover vinyl={v} alt={v.title} />
                      <span className="mt-2 block truncate text-sub text-paper">{v.title}</span>
                      <span className="block truncate text-caption text-content-muted">
                        {v.artist}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "saved" && (
          <ListGrid
            lists={saved}
            mine={false}
            coversOf={coversOf}
            empty={
              <EmptyState
                title="No has guardado ninguna lista"
                body="Cuando guardes la lista de otra persona vivirá aquí y en tu colección, siempre con su nombre encima. Sigue siendo suya: si la cambia, cambia la tuya."
                action={{ label: "Ver listas de la comunidad", href: "/explorar" }}
              />
            }
          />
        )}
      </div>

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
  if (lists === null) return <CoverGridSkeleton count={6} />;
  if (lists.length === 0) return <>{empty}</>;
  return (
    <ul className="grid grid-cols-2 gap-x-9 gap-y-14 sm:grid-cols-3 lg:grid-cols-4">
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
        {rows === null && <p className="py-6 text-sub text-content-faint">Cargando…</p>}
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
