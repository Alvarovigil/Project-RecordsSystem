"use client";

import Link from "next/link";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
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

  // the portal needs a DOM: on the server there is no document to reach for
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
      {/**
       * The collapsed trigger, under the title.
       *
       * It used to be pinned to the bottom of the window, a hundred pixels
       * above the edge and nowhere near the record it talks about. Under the
       * title it is a subtitle, which is what it always was: another fact
       * about this record. No position of its own any more; it flows wherever
       * the caption puts it.
       *
       * And it says a sentence now. "1 AMIGO · EN 5 RACKS DE LA COMUNIDAD"
       * was three fragments in 11px capitals with a fifth of an em between
       * the letters — a label, and one you had to assemble yourself: an
       * amigo who does *what*? Sentence case, a verb, and the subject first:
       * the line answers "who else has this" before you have decided whether
       * to press it. That is the whole job of a trigger that is also a fact.
       *
       * Nothing to say, nothing shown: with no friends and no public racks
       * the old line still rendered, and read "en 0 racks de la comunidad".
       */}
      {!open && (friends.length > 0 || lists.length > 0) && (
        <button
          onClick={() => setOpen(true)}
          /**
           * It fades in, because it cannot arrive with the record.
           *
           * Who else owns a sleeve is a question for the server, so this line
           * lands a beat after the artwork and the title are already still —
           * and a line of type that simply exists on frame two reads as a
           * glitch rather than as an answer. `.appear` is the app's own way
           * of saying "this was being fetched": the same fade the loaders
           * hand over with.
           *
           * Keyed by record so it plays again on the next sleeve; without it
           * the button stays mounted across records and only swaps its
           * numbers, which is the abrupt version of the same problem.
           */
          key={vinyl.id}
          className="appear group pointer-events-auto mt-3 border-b border-paper/15 pb-1 text-[13px] text-paper/50 transition-colors hover:border-paper/50 hover:text-paper"
        >
          {friends.length > 0 && (
            <span className="text-paper/80">
              Lo {friends.length === 1 ? "tiene" : "tienen"} {friends.length}{" "}
              {friends.length === 1 ? "amigo" : "amigos"}
            </span>
          )}
          {friends.length > 0 && lists.length > 0 && (
            <span className="text-paper/25"> · </span>
          )}
          {lists.length > 0 && (
            <span>
              {friends.length > 0 ? "está" : "Está"} en {lists.length}{" "}
              {lists.length === 1 ? "rack" : "racks"} de la comunidad
            </span>
          )}
          <span className="ml-2 inline-block text-paper/30 transition group-hover:translate-x-0.5 group-hover:text-paper/70">
            →
          </span>
        </button>
      )}

      {/**
       * The panel goes to the body, not to wherever the trigger happens to
       * live.
       *
       * The trigger is now a line inside the record's caption — a block that
       * is `pointer-events-none` (it floats over the rack and must not eat
       * clicks meant for it), carries a z-index of its own, and slides
       * sideways when the spec sheet opens. All three are fine for a line of
       * type and fatal for a full-screen panel: it would be unclickable,
       * painted under the top bar, and positioned against a moving box
       * instead of against the window. A portal is what keeps a modal a
       * modal wherever it is invoked from.
       */}
      {open && mounted && createPortal(
        <>
          <div
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-30 bg-black/40"
            aria-label="Cerrar comunidad"
          />
          <section className="fixed left-1/2 top-1/2 z-40 flex max-h-[80vh] w-[min(960px,94vw)] -translate-x-1/2 -translate-y-1/2 flex-col border border-line-overlay bg-surface-raised shadow-overlay">
            {/* header: breadcrumb-ish, always says where you are */}
            <header className="flex items-center justify-between border-b border-paper/[0.07] px-7 py-4">
              <div className="flex items-center gap-4">
                {stack.length > 1 && (
                  <button
                    onClick={back}
                    className="pressable text-sub text-paper/50 transition hover:text-paper"
                  >
                    ← Atrás
                  </button>
                )}
                <span className="text-sub text-paper/40">
                  {view.kind === "record"
                    ? "Comunidad"
                    : view.kind === "list"
                      ? "Rack"
                      : "Perfil"}
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="pressable text-sub text-paper/50 transition hover:text-paper"
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
        </>,
        document.body,
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
      <div className="px-7 pb-1 pt-6">
        <h2 className="text-heading text-paper">
          Quién más tiene <span className="text-paper/45">{vinyl.title}</span>
        </h2>
      </div>

      {friends.length > 0 && (
        <Section label="Amigos" count={friends.length}>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {friends.map((f) => (
              <li key={f.user.id}>
                <button
                  onClick={() => onOpenProfile(f.user.id)}
                  className="pressable flex w-full items-center gap-3 rounded-[14px] bg-fill-subtle p-3 text-left transition hover:bg-fill"
                >
                  <Avatar user={f.user} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sub font-medium text-paper">
                      {f.user.displayName}
                    </span>
                    <span
                      role="link"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenList(f.viaListId);
                      }}
                      onKeyDown={(e) => {
                        if (e.key !== "Enter") return;
                        e.stopPropagation();
                        onOpenList(f.viaListId);
                      }}
                      className="mt-0.5 block truncate text-caption text-paper/40 underline-offset-2 hover:text-paper hover:underline"
                    >
                      Lo tiene en {f.viaListTitle}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section label="Racks" count={lists.length}>
        {lists.length === 0 ? (
          <p className="text-sub text-paper/40">
            Todavía no está en ningún rack público. El tuyo sería el primero.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {lists.map((l) => (
              <li key={l.id}>
                <ListRow list={l} vinylById={vinylById} onOpen={() => onOpenList(l.id)} />
              </li>
            ))}
          </ul>
        )}
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

  if (!known) return <Empty text="Ese rack ya no está disponible" />;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 px-7 pb-5 pt-6">
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
            <span className="text-caption text-paper/35">
              {known.itemCount} discos · {known.saves} guardadas · {known.likes} ♥ ·{" "}
              {known.updatedAt}
            </span>
          </div>
          <Link
            href={`/u/${known.owner.username}/${known.slug}`}
            className="mt-3 inline-block text-sub text-paper/45 underline-offset-2 transition hover:text-paper hover:underline"
          >
            Ver el rack completo →
          </Link>
        </div>
        <FollowButton following={following} onClick={onToggleFollow} />
      </header>

      {items === null ? (
        <Empty text="Cargando…" />
      ) : (
        <ul className="grid grid-cols-3 gap-x-4 gap-y-6 px-7 pb-8 sm:grid-cols-5">
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
      <header className="flex flex-wrap items-start justify-between gap-4 px-7 pb-5 pt-6">
        <div className="flex items-start gap-4">
          <Avatar user={person} size={48} />
          <div className="min-w-0">
            <h2 className="text-[20px] leading-tight text-paper">{person.displayName}</h2>
            <p className="mono mt-0.5 text-caption text-paper/40">@{person.username}</p>
            <p className="mt-3 text-caption text-paper/35">
              {lists.length} racks · {discos} discos
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

      <Section label="Sus racks" count={lists.length}>
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {lists.map((l) => (
            <li key={l.id}>
              <ListRow list={l} vinylById={vinylById} onOpen={() => onOpenList(l.id)} hideOwner />
            </li>
          ))}
        </ul>
        {lists.length === 0 && <p className="text-sub text-paper/40">Todavía no ha publicado racks.</p>}
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
  /**
   * A rack, as the one card this product has.
   *
   * These used to be table cells: rows on a one-pixel grid of hairlines, so
   * five racks in a two-column layout drew a sixth empty cell and the section
   * read as a spreadsheet with a hole in it. Cards sit in a grid with real
   * space between them — an odd number just ends.
   *
   * The subtitle lost two thirds of its content on purpose. "BRUNO SÁEZ · 13
   * DISCOS · 4 GUARDADAS · 2 ♥" in tracked capitals did not fit and truncated
   * mid-word every single time; saves and likes are how a rack is *ranked*,
   * not how you recognise it. Whose it is and how big it is, in a voice you
   * can read.
   */
  return (
    <button
      onClick={onOpen}
      className="group pressable flex w-full items-center gap-3.5 rounded-[14px] bg-fill-subtle p-3 text-left transition hover:bg-fill"
    >
      <span className="flex shrink-0 overflow-hidden rounded-[3px]">
        {covers.map((v) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={v.id} src={coverFor(v)} alt="" className="h-11 w-11 object-cover" />
        ))}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sub font-medium text-paper">{list.title}</span>
        <span className="mt-0.5 block truncate text-caption text-paper/40">
          {!hideOwner ? `${list.owner.displayName} · ` : ""}
          {list.itemCount} discos
        </span>
      </span>
      <span className="shrink-0 pr-1 text-paper/20 transition group-hover:translate-x-0.5 group-hover:text-paper/50">
        →
      </span>
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
  /**
   * A heading and a number, not a table header.
   *
   * "AMIGOS ————— 1" spread across the full width in 10px capitals at a fifth
   * of an em was a rule with two labels stuck to its ends: the count sat so
   * far from the word it counted that they read as unrelated. The count
   * belongs next to the noun, in the same breath, and the section needs air
   * above it rather than a line under it — that is how every other surface in
   * this app separates one thing from the next.
   */
  return (
    <section className="px-7 pt-8 first:pt-6">
      <h3 className="flex items-baseline gap-2 text-body font-medium text-paper">
        {label}
        <span className="text-sub font-normal text-paper/30">{count}</span>
      </h3>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="px-7 py-8 text-sub text-paper/40">{text}</p>;
}
