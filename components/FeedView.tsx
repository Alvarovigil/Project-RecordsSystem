"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Page, PageHeader } from "@/components/app/AppShell";
import Avatar, { Cover } from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Segmented from "@/components/ui/Segmented";
import EmptyState from "@/components/ui/EmptyState";
import { useRepository } from "@/hooks/useRepository";
import { useNotifications } from "@/hooks/useNotifications";
import type { FeedEntry } from "@/lib/data/types";

/**
 * Two rivers, kept apart.
 *
 * **Novedades** is ambient: what the people you follow have been adding. You
 * dip in, you miss things, nothing is lost.
 *
 * **Para ti** is addressed to you personally, and some of it is a question —
 * an invitation to a shared list is a fork in a flow, and a fork buried in a
 * river of activity is a fork nobody takes. That is the dead end this split
 * exists to close.
 *
 * Instagram separates them into two screens; Spotify has no equivalent at all.
 * Two segments on one screen is the version that fits a product this size: the
 * unread dot on the tab bar leads here, and both halves are one thumb apart.
 */
export default function FeedView() {
  const repo = useRepository();
  const [entries, setEntries] = useState<FeedEntry[] | null>(null);
  const notif = useNotifications();
  const [tab, setTab] = useState<"activity" | "you">("activity");

  useEffect(() => {
    repo
      .feed()
      .then(setEntries)
      .catch(() => setEntries([]));
  }, [repo]);

  // Opening the personal half is what counts as having seen it — not opening
  // the app, and not scrolling past. The dot clears when you actually look.
  useEffect(() => {
    if (tab === "you" && notif.unread > 0) void notif.markRead();
  }, [tab, notif]);

  const groups = groupByActorAndList(entries ?? []);

  return (
    <Page width="full">
      <PageHeader title="Feed" subtitle="Lo que se mueve alrededor de tu colección." />

      <Segmented
        value={tab}
        onChange={setTab}
        segments={[
          { value: "activity", label: "Novedades" },
          { value: "you", label: "Para ti", count: notif.unread || undefined },
        ]}
      />

      {tab === "activity" && (
        <div className="mt-7">
          {entries === null ? (
            <p className="text-sub text-content-faint">Cargando…</p>
          ) : groups.length === 0 ? (
            <EmptyState
              title="Todavía no sigues a nadie"
              body="Sigue a alguien, o guarda una lista, y aquí verás lo que van añadiendo. Es la parte del producto que no funciona en solitario."
              action={{ label: "Buscar gente", href: "/explorar" }}
              secondary={{ label: "Ver mi colección", href: "/coleccion" }}
            />
          ) : (
            <ul className="space-y-9">
              {groups.map((g) => (
                <li key={`${g.actor.id}-${g.listId}-${g.at}`}>
                  <div className="flex items-center gap-3">
                    <Link href={`/u/${g.actor.username}`} className="pressable shrink-0">
                      <Avatar
                        name={g.actor.displayName}
                        handle={g.actor.username}
                        src={g.actor.avatarUrl}
                        size="sm"
                      />
                    </Link>
                    {/* the page runs edge to edge, the sentence does not: a
                        line 1800px long is unreadable however much room there
                        is for it */}
                    <p className="min-w-0 flex-1 max-w-[78ch] text-sub leading-snug text-content-secondary">
                      <Link
                        href={`/u/${g.actor.username}`}
                        className="font-medium text-paper hover:underline"
                      >
                        {g.actor.displayName}
                      </Link>{" "}
                      añadió {g.releases.length}{" "}
                      {g.releases.length === 1 ? "disco" : "discos"} a{" "}
                      <Link
                        href={`/u/${g.actor.username}/${g.listSlug}`}
                        className="font-medium text-paper hover:underline"
                      >
                        {g.listTitle}
                      </Link>
                    </p>
                    <time className="shrink-0 text-caption text-content-faint">{ago(g.at)}</time>
                  </div>

                  {/* The records are the content, so they get the room. A feed
                      of text rows about an object nobody can see is a log. */}
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === "you" && (
        <div className="mt-7">
          {notif.loading ? (
            <p className="text-sub text-content-faint">Cargando…</p>
          ) : notif.items?.length === 0 ? (
            <EmptyState
              title="Nada pendiente"
              body="Aquí llegan las invitaciones a listas compartidas, quién te sigue y quién guarda tus listas."
              action={{ label: "Explorar la comunidad", href: "/explorar" }}
            />
          ) : (
            <ul className="divide-y divide-line">
              {(notif.items ?? []).map((n) => (
                <li
                  key={n.id}
                  className={`flex gap-3 py-4 ${n.read ? "" : "-mx-3 rounded-sm bg-fill-subtle px-3"}`}
                >
                  <Link href={`/u/${n.actor.username}`} className="pressable shrink-0 pt-0.5">
                    <Avatar
                      name={n.actor.displayName}
                      handle={n.actor.username}
                      src={n.actor.avatarUrl}
                      size="md"
                    />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="max-w-[78ch] text-sub leading-snug text-content-secondary">
                      <Link
                        href={`/u/${n.actor.username}`}
                        className="font-medium text-paper hover:underline"
                      >
                        {n.actor.displayName}
                      </Link>{" "}
                      {phraseFor(n.kind)}
                      {n.listTitle && (
                        <>
                          {" "}
                          <span className="font-medium text-paper">{n.listTitle}</span>
                        </>
                      )}
                    </p>
                    <time className="mt-1 block text-caption text-content-faint">{ago(n.at)}</time>

                    {/* An invitation is answered here, in one place, and then
                        stops asking. Nothing is left hanging. */}
                    {n.actionable && n.kind === "invite" && (
                      <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="primary" onClick={() => void notif.respond(n.id, true)}>
                          Aceptar
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => void notif.respond(n.id, false)}>
                          Rechazar
                        </Button>
                      </div>
                    )}
                  </div>
                  {!n.read && (
                    <span aria-label="Sin leer" className="mt-2 h-2 w-2 shrink-0 rounded-full bg-accent" />
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Page>
  );
}

function phraseFor(kind: string) {
  switch (kind) {
    case "follow":
      return "te ha empezado a seguir.";
    case "invite":
      return "te invita a editar";
    case "added-to-list":
      return "añadió un disco a";
    case "saved-list":
      return "ha guardado tu lista";
    default:
      return "";
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

type Group = {
  actor: FeedEntry["actor"];
  listId: string;
  listTitle: string;
  listSlug: string;
  at: string;
  releases: FeedEntry["release"][];
};

/**
 * "Marta añadió 4 discos a Sonido de sótano" is a thing that happened; four
 * separate rows are the same thing wearing four timestamps.
 */
function groupByActorAndList(entries: FeedEntry[]): Group[] {
  const groups = new Map<string, Group>();
  for (const e of entries) {
    const key = `${e.actor.id}:${e.listId}`;
    const found = groups.get(key);
    if (found) {
      found.releases.push(e.release);
      continue;
    }
    groups.set(key, {
      actor: e.actor,
      listId: e.listId,
      listTitle: e.listTitle,
      listSlug: e.listSlug,
      at: e.at,
      releases: [e.release],
    });
  }
  return [...groups.values()].sort((a, b) => b.at.localeCompare(a.at));
}
