"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import type { Vinyl } from "@/lib/types";
import { coverFor } from "@/lib/cover";
import { useRepository } from "@/hooks/useRepository";
import {
  getRepository,
  type FriendWithRecord,
  type ListWithRecord,
  type Profile,
} from "@/lib/data";

type View =
  | { kind: "record" }
  | { kind: "list"; id: string }
  | { kind: "profile"; id: string };

type Props = {
  vinyl: Vinyl;
  allVinilos: Vinyl[];
  /** a record you already own — jump to it in your own shelf */
  onOpenOwn: (v: Vinyl) => void;
  /** a record you don't own yet — hand it to the save flow */
  onSave: (v: Vinyl) => void;
};

/**
 * The bridge: a record is a doorway into other people's collections.
 *
 * Collapsed it is a single line under the cover; expanded it is a sheet with
 * the friends who own this record and the community lists that hold it. From
 * there you can walk into a list, from a list into its owner, and from that
 * owner into another list — with a back stack, so wandering never loses the
 * thread you pulled.
 */
export default function CommunityBridge({ vinyl, allVinilos, onOpenOwn, onSave }: Props) {
  const repo = useRepository();
  const [open, setOpen] = useState(false);
  const [stack, setStack] = useState<View[]>([{ kind: "record" }]);
  const [follows, setFollows] = useState<string[]>([]);

  const [friends, setFriends] = useState<FriendWithRecord[]>([]);
  const [lists, setLists] = useState<ListWithRecord[]>([]);

  // the bridge itself: who else has this record, and where
  useEffect(() => {
    let alive = true;
    Promise.all([
      repo.friendsWithRelease(vinyl.id),
      repo.listsWithRelease(vinyl.id),
    ]).then(([f, l]) => {
      if (!alive) return;
      setFriends(f);
      setLists(l);
    });
    return () => {
      alive = false;
    };
  }, [repo, vinyl.id]);

  useEffect(() => {
    repo
      .following()
      .then(({ profiles, lists }) => setFollows([...profiles, ...lists]))
      .catch(() => setFollows([]));
  }, [repo]);

  // a different record is a different thread
  useEffect(() => {
    setOpen(false);
    setStack([{ kind: "record" }]);
  }, [vinyl.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      if (stack.length > 1) setStack((s) => s.slice(0, -1));
      else setOpen(false);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, stack.length]);

  const view = stack[stack.length - 1];
  const push = (v: View) => setStack((s) => [...s, v]);
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const toggleFollow = (kind: "profile" | "list", id: string) => {
    const isFollowing = follows.includes(id);
    setFollows((prev) => (isFollowing ? prev.filter((x) => x !== id) : [...prev, id]));
    void (isFollowing ? repo.unfollow(kind, id) : repo.follow(kind, id));
  };

  const vinylById = (id: string) => allVinilos.find((v) => v.id === id);

  // lists of whichever profile you are looking at
  const [profileLists, setProfileLists] = useState<ListWithRecord[]>([]);
  useEffect(() => {
    if (view.kind !== "profile") return;
    let alive = true;
    repo.listsOfProfile(view.id).then((l) => alive && setProfileLists(l));
    return () => {
      alive = false;
    };
  }, [repo, view]);

  return (
    <>
      {/* collapsed trigger, right under the cover */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="group pointer-events-auto absolute bottom-[112px] left-1/2 z-30 -translate-x-1/2 border-b border-paper/15 pb-1 text-[11px] uppercase tracking-[0.18em] text-paper/45 transition hover:border-paper/50 hover:text-paper"
        >
          {friends.length > 0 && (
            <span className="text-paper/70">
              {friends.length} {friends.length === 1 ? "amigo" : "amigos"} ·{" "}
            </span>
          )}
          en {lists.length} listas de la comunidad
          <span className="ml-2 inline-block text-paper/30 transition group-hover:text-paper/70">
            ↑
          </span>
        </button>
      )}

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40"
            aria-label="Cerrar comunidad"
          />
          <section className="fixed left-1/2 top-1/2 z-40 flex max-h-[80vh] w-[min(960px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col border border-line-overlay bg-surface-raised shadow-overlay">
            {/* header: breadcrumb-ish, always says where you are */}
            <header className="flex items-center justify-between border-b border-paper/10 px-6 py-3">
              <div className="flex items-center gap-3">
                {stack.length > 1 && (
                  <button
                    onClick={back}
                    className="mono text-[10px] uppercase tracking-[0.2em] text-paper/45 transition hover:text-paper"
                  >
                    ← Atrás
                  </button>
                )}
                <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/35">
                  {view.kind === "record"
                    ? "Comunidad"
                    : view.kind === "list"
                      ? "Lista"
                      : "Perfil"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="mono text-[10px] uppercase tracking-[0.2em] text-paper/45 transition hover:text-paper"
              >
                Cerrar
              </button>
            </header>

            <div data-scrollable className="min-h-0 flex-1 overflow-y-auto">
              {view.kind === "record" && (
                <RecordView
                  vinyl={vinyl}
                  friends={friends}
                  lists={lists}
                  vinylById={vinylById}
                  onOpenList={(id) => push({ kind: "list", id })}
                  onOpenProfile={(id) => push({ kind: "profile", id })}
                />
              )}

              {view.kind === "list" && (
                <ListView
                  key={view.id}
                  listId={view.id}
                  known={lists.find((l) => l.id === view.id) ?? profileLists.find((l) => l.id === view.id)}
                  currentId={vinyl.id}
                  following={follows.includes(view.id)}
                  onToggleFollow={() => toggleFollow("list", view.id)}
                  onOpenProfile={(id) => push({ kind: "profile", id })}
                  onOpenOwn={onOpenOwn}
                  onSave={onSave}
                  ownedIds={allVinilos.map((v) => v.id)}
                />
              )}

              {view.kind === "profile" && (
                <ProfileView
                  key={view.id}
                  profileId={view.id}
                  lists={profileLists}
                  friend={friends.find((f) => f.user.id === view.id)?.user}
                  vinylById={vinylById}
                  following={follows.includes(view.id)}
                  onToggleFollow={() => toggleFollow("profile", view.id)}
                  onOpenList={(id) => push({ kind: "list", id })}
                />
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}

// ------------------------------------------------------------------- views
function RecordView({
  vinyl,
  friends,
  lists,
  vinylById,
  onOpenList,
  onOpenProfile,
}: {
  vinyl: Vinyl;
  friends: FriendWithRecord[];
  lists: ListWithRecord[];
  vinylById: (id: string) => Vinyl | undefined;
  onOpenList: (id: string) => void;
  onOpenProfile: (id: string) => void;
}) {
  return (
    <>
      <div className="px-6 pb-1 pt-5">
        <h2 className="text-[15px] text-paper">
          Quién más tiene <span className="text-paper/60">{vinyl.title}</span>
        </h2>
      </div>

      <Section label="Amigos" count={friends.length}>
        {friends.length === 0 ? (
          <p className="px-6 pb-4 text-[13px] text-paper/40">
            Nadie a quien sigues lo tiene todavía. Serías el primero.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-2 px-6 pb-5">
            {friends.map((f) => (
              <li key={f.user.id}>
                <button
                  onClick={() => onOpenProfile(f.user.id)}
                  className="flex items-center gap-3 border border-paper/10 py-2 pl-2 pr-4 text-left transition hover:border-paper/30 hover:bg-paper/[0.04]"
                >
                  <Avatar user={f.user} />
                  <span>
                    <span className="block text-[13px] text-paper">{f.user.displayName}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenList(f.viaListId);
                      }}
                      className="mt-0.5 block text-[11px] text-paper/45 underline-offset-2 hover:text-paper hover:underline"
                    >
                      en {f.viaListTitle}
                    </button>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="Racks destacados" count={lists.length}>
        <ul className="grid grid-cols-1 gap-px bg-paper/[0.07] sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id} className="bg-[#0b0b0b]">
              <ListRow list={l} vinylById={vinylById} onOpen={() => onOpenList(l.id)} />
            </li>
          ))}
        </ul>
      </Section>
    </>
  );
}

function ListView({
  listId,
  known,
  currentId,
  following,
  ownedIds,
  onToggleFollow,
  onOpenProfile,
  onOpenOwn,
  onSave,
}: {
  listId: string;
  known?: ListWithRecord;
  currentId: string;
  following: boolean;
  ownedIds: string[];
  onToggleFollow: () => void;
  onOpenProfile: (id: string) => void;
  onOpenOwn: (v: Vinyl) => void;
  onSave: (v: Vinyl) => void;
}) {
  const repo = useRepository();
  const [items, setItems] = useState<Vinyl[] | null>(null);

  useEffect(() => {
    let alive = true;
    repo.releasesOfList(listId).then((r) => alive && setItems(r));
    return () => {
      alive = false;
    };
  }, [repo, listId]);

  if (!known) return <Empty text="Esa lista ya no está disponible" />;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 px-6 pb-5 pt-5">
        <div className="min-w-0">
          <h2 className="text-[22px] leading-tight text-paper">{known.title}</h2>
          {known.description && (
            <p className="mt-1.5 text-[13px] text-paper/50">{known.description}</p>
          )}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => onOpenProfile(known.owner.id)}
              className="flex items-center gap-2 text-[12px] text-paper/60 transition hover:text-paper"
            >
              <Avatar user={known.owner} size={22} />
              {known.owner.displayName}
            </button>
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-paper/30">
              {known.itemCount} discos · {known.saves} guardadas · {known.likes} ♥ ·{" "}
              {known.updatedAt}
            </span>
          </div>
          <Link
            href={`/u/${known.owner.username}/${known.slug}`}
            className="mono mt-3 inline-block text-[10px] uppercase tracking-[0.16em] text-paper/40 underline-offset-2 transition hover:text-paper hover:underline"
          >
            Ver la lista completa →
          </Link>
        </div>
        <FollowButton following={following} onClick={onToggleFollow} />
      </header>

      {items === null ? (
        <Empty text="Cargando…" />
      ) : (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6 px-6 pb-8 sm:grid-cols-5">
          {items.map((v) => {
            const owned = ownedIds.includes(v.id);
            return (
              <li key={v.id} className="group">
                <div
                  className={`relative aspect-square w-full overflow-hidden bg-paper/[0.04] ${
                    v.id === currentId ? "outline outline-1 outline-paper/30 outline-offset-2" : ""
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverFor(v)}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover opacity-90 transition group-hover:opacity-100"
                  />
                  <button
                    onClick={() => (owned ? onOpenOwn(v) : onSave(v))}
                    className="reveal-on-hover absolute inset-0 flex items-end justify-center bg-gradient-to-t from-ink/85 via-transparent to-transparent p-2 transition"
                  >
                    <span className="mono text-[9px] uppercase tracking-[0.16em] text-paper">
                      {owned ? "Ver en mi colección" : "Guardar"}
                    </span>
                  </button>
                </div>
                <div className="mt-2 truncate text-[12px] text-paper/85">{v.title}</div>
                <div className="truncate text-[11px] text-paper/40">{v.artist}</div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

function ProfileView({
  profileId,
  friend,
  lists,
  vinylById,
  following,
  onToggleFollow,
  onOpenList,
}: {
  profileId: string;
  friend?: Pick<Profile, "id" | "username" | "displayName" | "avatarUrl">;
  lists: ListWithRecord[];
  vinylById: (id: string) => Vinyl | undefined;
  following: boolean;
  onToggleFollow: () => void;
  onOpenList: (id: string) => void;
}) {
  const person = friend ?? lists[0]?.owner;
  const discos = lists.reduce((n, l) => n + l.itemCount, 0);

  if (!person) return <Empty text="Ese perfil ya no está disponible" />;

  return (
    <>
      <header className="flex flex-wrap items-start justify-between gap-4 px-6 pb-5 pt-5">
        <div className="flex items-start gap-4">
          <Avatar user={person} size={48} />
          <div className="min-w-0">
            <h2 className="text-[20px] leading-tight text-paper">{person.displayName}</h2>
            <p className="mono mt-0.5 text-[11px] text-paper/40">@{person.username}</p>
            <p className="mono mt-3 text-[10px] uppercase tracking-[0.16em] text-paper/30">
              {lists.length} listas · {discos} discos
            </p>
            <Link
              href={`/u/${person.username}`}
              className="mono mt-3 inline-block text-[10px] uppercase tracking-[0.16em] text-paper/40 underline-offset-2 transition hover:text-paper hover:underline"
            >
              Ver perfil completo →
            </Link>
          </div>
        </div>
        <FollowButton following={following} onClick={onToggleFollow} />
      </header>

      <Section label="Sus listas" count={lists.length}>
        <ul className="grid grid-cols-1 gap-px bg-paper/[0.07] sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id} className="bg-[#0b0b0b]">
              <ListRow list={l} vinylById={vinylById} onOpen={() => onOpenList(l.id)} hideOwner />
            </li>
          ))}
        </ul>
        {lists.length === 0 && <Empty text="Todavía no ha publicado listas." />}
      </Section>
    </>
  );
}

// ------------------------------------------------------------------- pieces
function ListRow({
  list,
  vinylById,
  onOpen,
  hideOwner = false,
}: {
  list: ListWithRecord;
  vinylById: (id: string) => Vinyl | undefined;
  onOpen: () => void;
  hideOwner?: boolean;
}) {
  // placeholder lists carry their members inline; real ones don't need to
  const memberIds = (list as ListWithRecord & { vinylIds?: string[] }).vinylIds ?? [];
  const covers = memberIds
    .map(vinylById)
    .filter((v): v is Vinyl => !!v)
    .slice(0, 4);
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-center gap-4 px-6 py-4 text-left transition hover:bg-paper/[0.04]"
    >
      <span className="flex h-12 shrink-0 gap-px">
        {covers.map((v) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={v.id} src={coverFor(v)} alt="" className="h-12 w-12 object-cover" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] text-paper">{list.title}</span>
        <span className="mono mt-1 block truncate text-[10px] uppercase tracking-[0.16em] text-paper/35">
          {!hideOwner ? `${list.owner.displayName} · ` : ""}
          {list.itemCount} discos · {list.saves} guardadas · {list.likes} ♥
        </span>
      </span>
      <span className="text-paper/25">→</span>
    </button>
  );
}

function FollowButton({ following, onClick }: { following: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 px-4 py-2 text-[12px] transition ${
        following
          ? "border border-paper/25 text-paper/60 hover:border-paper/50 hover:text-paper"
          : "bg-paper text-ink hover:bg-paper/85"
      }`}
    >
      {following ? "Siguiendo" : "Seguir"}
    </button>
  );
}

function Avatar({
  user,
  size = 34,
}: {
  user: Pick<Profile, "displayName" | "avatarUrl">;
  size?: number;
}) {
  const initials = user.displayName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-paper/10 mono text-[10px] tracking-[0.06em] text-paper/70"
      style={{ width: size, height: size }}
      aria-hidden
    >
      {user.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatarUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline justify-between border-b border-paper/[0.07] px-6 pb-2 pt-5">
        <span className="mono text-[10px] uppercase tracking-[0.2em] text-paper/40">{label}</span>
        <span className="mono text-[10px] tracking-[0.16em] text-paper/30">{count}</span>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-6 py-8 text-[13px] text-paper/40">{text}</p>;
}
