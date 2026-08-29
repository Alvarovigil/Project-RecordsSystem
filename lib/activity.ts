import type { ActivityEvent, ActivityKind, ShallowProfile } from "@/lib/data/types";

/**
 * Turning a log into something worth reading.
 *
 * A raw activity table is unreadable at any volume: one person emptying a
 * shopping bag into their collection produces twelve identical rows and buries
 * everything else that happened that day. Every social product solves this the
 * same way and it is worth naming the rules rather than discovering them again.
 *
 * **1. Group by session, not by day.** Two events belong together when they
 * are close *to each other*, not when they fall inside the same calendar box.
 * Someone cataloguing a crate on Sunday night at 23:50 and 00:10 did one thing,
 * and a day boundary would tell you they did two. The window is measured from
 * the last event in the group, so a long session keeps absorbing rather than
 * splitting at an arbitrary hour.
 *
 * **2. What you group by depends on who the event is about.** There are two
 * shapes and picking the wrong one is what makes feeds feel stupid:
 *
 *   - *Actor-centric* — one person, many objects: "Luis añadió 3 discos a
 *     Domingo por la mañana". This is right for other people's activity, where
 *     the interesting unit is the person doing things.
 *   - *Object-centric* — many people, one object: "Marta y 4 más guardaron tu
 *     lista". This is right for anything happening TO you, where the object is
 *     already known and the news is how many people showed up.
 *
 * **3. Never group across verbs.** "Luis hizo 5 cosas" is not information.
 *
 * **4. Yours floats.** Within the same window, events about your things sort
 * above gossip. Not across windows — recency still wins overall, because an
 * activity screen that shows you last week first is a screen nobody trusts.
 */

/** How far apart two events can be and still be the same sitting. */
const SESSION_MS = 6 * 60 * 60 * 1000;

/**
 * Six hours, and the reasoning matters more than the number: it has to be long
 * enough to cover an evening of adding records with a break for dinner, and
 * short enough that this morning and last night are not the same sentence.
 * Instagram uses roughly a day for "N new posts", Letterboxd groups by diary
 * entry; both are wrong here, where a session is the natural unit.
 */

export type ActivityGroup = {
  id: string;
  kind: ActivityKind;
  /** the most recent event in the group — what it sorts by */
  at: string;
  /** the oldest, so the UI can say "entre las 8 y las 11" if it ever wants to */
  since: string;
  /** one for actor-centric groups, several for object-centric ones */
  actors: ShallowProfile[];
  list?: ActivityEvent["list"];
  /** people followed, for "empezó a seguir a X, Y y 2 más" */
  targets: ShallowProfile[];
  releases: NonNullable<ActivityEvent["release"]>[];
  /** the object is yours (your list, you) */
  mine: boolean;
  /** how many raw events are behind this line */
  count: number;
};

/**
 * The object an event is about, as a string.
 *
 * This is the whole grouping decision in one function: events that answer this
 * the same way, from the same actor (or about the same object, when it is
 * yours), within one session, are one line.
 */
function groupKey(e: ActivityEvent): string {
  switch (e.kind) {
    // yours: aggregate the ACTORS around the object
    case "list-saved":
      return e.mine ? `saved:mine:${e.list?.id}` : `saved:${e.actor.id}`;
    // los me gusta sólo llegan de listas tuyas, y se cuentan por lista: la
    // noticia es "a seis personas les ha gustado ésta", nunca seis líneas
    case "list-liked":
      return `liked:mine:${e.list?.id}`;
    case "followed":
      return e.mine ? "followed:me" : `followed:${e.actor.id}`;
    // theirs: aggregate the OBJECTS around the actor
    case "added":
      return `added:${e.actor.id}:${e.list?.id}`;
    case "list-created":
      return `created:${e.actor.id}`;
  }
}

/** Whether a group collects actors (object-centric) or objects (actor-centric). */
export function isObjectCentric(g: ActivityGroup): boolean {
  return g.mine;
}

export function groupActivity(events: ActivityEvent[]): ActivityGroup[] {
  // newest first, so every group's first event is its most recent one and the
  // window is always measured backwards from a known edge
  const sorted = [...events].sort((a, b) => b.at.localeCompare(a.at));

  const open = new Map<string, ActivityGroup>();
  const out: ActivityGroup[] = [];

  const push = (g: ActivityGroup) => {
    out.push(g);
  };

  for (const e of sorted) {
    const key = groupKey(e);
    const current = open.get(key);
    const t = new Date(e.at).getTime();

    // too far from the last event in the open group: that sitting is over and
    // this is a new one. The old group is already in `out` — groups are pushed
    // when opened, not when closed, so order is preserved for free.
    if (current && new Date(current.since).getTime() - t > SESSION_MS) {
      open.delete(key);
    }

    const g = open.get(key);
    if (!g) {
      const fresh: ActivityGroup = {
        id: `${key}:${e.at}`,
        kind: e.kind,
        at: e.at,
        since: e.at,
        actors: [e.actor],
        list: e.list,
        targets: e.target ? [e.target] : [],
        releases: e.release ? [e.release] : [],
        mine: e.mine,
        count: 1,
      };
      open.set(key, fresh);
      push(fresh);
      continue;
    }

    g.since = e.at;
    g.count += 1;
    if (!g.actors.some((a) => a.id === e.actor.id)) g.actors.push(e.actor);
    if (e.target && !g.targets.some((t2) => t2.id === e.target!.id)) g.targets.push(e.target);
    // the same record can be in two lists; inside one group it is one record
    if (e.release && !g.releases.some((r) => r.slug === e.release!.slug)) g.releases.push(e.release);
  }

  // Rule 4: inside the same hour, what involves you comes first. Sorting by a
  // rounded timestamp rather than the raw one is what keeps "someone saved your
  // list" from sinking under a stranger's four-minute-newer addition.
  return out.sort((a, b) => {
    const bucket = (iso: string) => Math.floor(new Date(iso).getTime() / (60 * 60 * 1000));
    const diff = bucket(b.at) - bucket(a.at);
    if (diff !== 0) return diff;
    if (a.mine !== b.mine) return a.mine ? -1 : 1;
    return b.at.localeCompare(a.at);
  });
}

/**
 * "Marta", "Marta y Luis", "Marta, Luis y 3 más".
 *
 * Two names before the count, because the third name buys nothing and the
 * number does: past two people you stop reading names and start reading size.
 */
export function namesOf(people: { displayName: string }[], max = 2): string {
  const names = people.map((p) => p.displayName);
  if (names.length <= max) {
    if (names.length <= 1) return names[0] ?? "";
    return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
  }
  return `${names.slice(0, max).join(", ")} y ${names.length - max} más`;
}
