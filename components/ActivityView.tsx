"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Page, PageHeader } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import { useRepository } from "@/hooks/useRepository";
import { useNotifications } from "@/hooks/useNotifications";
import { groupActivity, namesOf, type ActivityGroup } from "@/lib/activity";
import type { ActivityEvent } from "@/lib/data/types";

/**
 * Actividad: what is moving around your collection.
 *
 * This used to be "Feed", and it showed one thing — records other people
 * added. Which meant that the two moments that actually pull someone back into
 * a social product never appeared anywhere: somebody kept *your* list, and
 * somebody you follow started following someone new. A feed with one verb is a
 * log with a nicer font.
 *
 * Four verbs now, in one river, grouped by lib/activity.ts. The ordering rule
 * is recency first and yours-floats-within-the-hour second, so what implicates
 * you is near the top without the screen ever showing you last week first.
 *
 * Pending invitations do NOT flow here. An invitation is a question, and a
 * question in a river gets carried past — they sit pinned above everything,
 * and they leave when they are answered.
 */
export default function ActivityView() {
  const repo = useRepository();
  const notif = useNotifications();
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);

  useEffect(() => {
    repo
      .activity()
      .then(setEvents)
      .catch(() => setEvents([]));
  }, [repo]);

  // Reading the screen is what counts as having seen it. Not opening the app,
  // not scrolling past — arriving here.
  useEffect(() => {
    if (notif.unread > 0) void notif.markRead();
    // deliberately once per mount: marking read on every notif change would
    // clear the dot for something that arrived while you were looking away
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const groups = groupActivity(events ?? []);
  const invites = (notif.items ?? []).filter((n) => n.actionable && n.kind === "invite");

  return (
    <Page width="full">
      <PageHeader title="Actividad" subtitle="Lo que se mueve alrededor de tu colección." />

      {invites.length > 0 && (
        <ul className="mb-9 space-y-3">
          {invites.map((n) => (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-3 border border-line bg-fill-subtle/40 px-4 py-3.5"
            >
              <Avatar
                name={n.actor.displayName}
                handle={n.actor.username}
                src={n.actor.avatarUrl}
                size="sm"
              />
              <p className="min-w-0 flex-1 text-sub leading-snug text-content-secondary">
                <span className="font-medium text-paper">{n.actor.displayName}</span> te invita a
                editar <span className="font-medium text-paper">{n.listTitle}</span>
              </p>
              <div className="flex shrink-0 gap-2">
                <Button size="sm" variant="primary" onClick={() => void notif.respond(n.id, true)}>
                  Aceptar
                </Button>
                <Button size="sm" variant="ghost" onClick={() => void notif.respond(n.id, false)}>
                  Rechazar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {events === null ? (
        <p className="text-sub text-content-faint">Cargando…</p>
      ) : groups.length === 0 ? (
        <EmptyState
          title="Todavía no se mueve nada"
          body="Sigue a alguien o guarda una lista y aquí aparecerá lo que van añadiendo, las listas que publican y quién se fija en las tuyas. Es la parte del producto que no funciona en solitario."
          action={{ label: "Buscar gente", href: "/explorar" }}
          secondary={{ label: "Ver mi colección", href: "/coleccion" }}
        />
      ) : (
        <ul className="space-y-9">
          {groups.map((g) => (
            <li key={g.id}>
              <Row group={g} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/**
 * One line of activity, and — when there is something to look at — the thing
 * itself underneath.
 *
 * The covers are not decoration: a river of sentences about records nobody can
 * see is exactly the screen people scroll past. Where there is no object (a
 * follow), the row stays a single line rather than growing a placeholder.
 */
function Row({ group: g }: { group: ActivityGroup }) {
  const lead = g.actors[0];
  const listHref = g.list ? `/u/${g.list.ownerHandle}/${g.list.slug}` : undefined;

  return (
    <>
      <div className="flex items-center gap-3">
        {/* the faces of the people in this group: one, or a small stack when
            several people did the same thing to the same object */}
        <div className="flex shrink-0 -space-x-2">
          {g.actors.slice(0, 3).map((a) => (
            <Link key={a.id} href={`/u/${a.username}`} className="group pressable">
              <span className="block rounded-full ring-2 ring-surface">
                <Avatar
                  name={a.displayName}
                  handle={a.username}
                  src={a.avatarUrl}
                  size="sm"
                  interactive
                />
              </span>
            </Link>
          ))}
        </div>

        {/* the page runs edge to edge, the sentence does not: a line 1800px
            long is unreadable however much room there is for it */}
        <p className="min-w-0 max-w-[78ch] flex-1 text-sub leading-snug text-content-secondary">
          <Sentence group={g} lead={lead} listHref={listHref} />
        </p>

        <time className="shrink-0 text-caption text-content-faint">{ago(g.at)}</time>
      </div>

      {g.releases.length > 0 && (
        <ul className="mt-3 grid grid-cols-3 gap-2.5 pl-[42px] sm:grid-cols-5 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12">
          {g.releases.slice(0, 12).map((r) => (
            <li key={r.slug}>
              <Cover src={r.cover} alt={r.title} />
              <span className="mt-1.5 block truncate text-caption text-content-muted">
                {r.title}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The sentence, per verb.
 *
 * Written as sentences people say — "guardaron tu lista", not "list_follow
 * created" — and always naming the object, because the object is where you go
 * next. Every proper noun in here is a link: the whole point of this screen is
 * that it leads somewhere.
 */
function Sentence({
  group: g,
  lead,
  listHref,
}: {
  group: ActivityGroup;
  lead: ActivityGroup["actors"][number];
  listHref?: string;
}) {
  const who = (
    <Link href={`/u/${lead.username}`} className="font-medium text-paper hover:underline">
      {lead.displayName}
    </Link>
  );
  const list =
    g.list && listHref ? (
      <Link href={listHref} className="font-medium text-paper hover:underline">
        {g.list.title}
      </Link>
    ) : null;

  switch (g.kind) {
    case "added":
      return (
        <>
          {who} añadió {g.releases.length} {g.releases.length === 1 ? "disco" : "discos"} a {list}
        </>
      );

    case "list-created":
      return (
        <>
          {who} ha publicado {g.count === 1 ? "una lista nueva" : `${g.count} listas nuevas`}
          {g.count === 1 && list ? <>: {list}</> : null}
        </>
      );

    case "list-saved":
      // yours: the actors are the news, so they are what gets counted
      return g.mine ? (
        <>
          <span className="font-medium text-paper">{namesOf(g.actors)}</span>{" "}
          {g.actors.length === 1 ? "ha guardado" : "han guardado"} tu lista {list}
        </>
      ) : (
        <>
          {who} ha guardado {list}
        </>
      );

    case "followed":
      return g.mine ? (
        <>
          <span className="font-medium text-paper">{namesOf(g.actors)}</span>{" "}
          {g.actors.length === 1 ? "te ha empezado a seguir" : "te han empezado a seguir"}
        </>
      ) : (
        <>
          {who} ha empezado a seguir a{" "}
          {g.targets.slice(0, 2).map((t, i) => (
            <span key={t.id}>
              {i > 0 && " y "}
              <Link href={`/u/${t.username}`} className="font-medium text-paper hover:underline">
                {t.displayName}
              </Link>
            </span>
          ))}
          {g.targets.length > 2 && ` y ${g.targets.length - 2} más`}
        </>
      );
  }
}

/**
 * Relative time, in words, and never more precise than it needs to be.
 * "hace 3 h" is what someone wants; a timestamp is what a database wants.
 */
function ago(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.round(mins / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}
