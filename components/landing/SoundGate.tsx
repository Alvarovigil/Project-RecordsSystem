"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { previewSrc } from "@/lib/audio";

type Track = {
  title: string;
  artist: string;
  album: string;
  previewUrl: string;
  cover: string | null;
};

const NEEDLE = "/sfx/needle-drop.mp3";
const VOLUME = 0.42;
/** how long before the needle effect ends the song is already coming up */
const OVERLAP = 0.7;

/**
 * The list, asked for once per page load.
 *
 * It was a fetch inside an effect, and the landing asked four times on
 * arrival: Strict Mode mounts twice in development, and the gate remounts
 * whenever the landing does. One promise at module scope answers all of them.
 * A failure forgets it, so the next press can try again instead of inheriting
 * a dead answer.
 */
let jukebox: Promise<Track[]> | null = null;
function loadJukebox(): Promise<Track[]> {
  jukebox ??= fetch("/api/jukebox")
    // a 500 is a failure like a dropped connection: forgotten, so the next
    // press asks again instead of inheriting an empty answer
    .then((r) => {
      if (!r.ok) throw new Error(`jukebox ${r.status}`);
      return r.json();
    })
    .then((d: { tracks?: Track[] }) => d.tracks ?? [])
    .catch(() => {
      jukebox = null;
      return [];
    });
  return jukebox;
}

/**
 * Brings an element up from silence.
 *
 * Squared, not linear: loudness is not perceived linearly, so a straight ramp
 * sounds like it arrives all at once near the end.
 */
function fadeIn(audio: HTMLAudioElement, to: number, ms: number) {
  const started = performance.now();
  audio.volume = 0;
  const step = () => {
    const t = Math.min(1, (performance.now() - started) / ms);
    audio.volume = to * t * t;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/**
 * The door, and the record player behind it.
 *
 * Browsers only let audio start from a gesture, so the choice has to be asked
 * for rather than assumed — and that click is the consent for everything that
 * sounds afterwards.
 *
 * One component owns the whole chain because it is one chain: the gate starts
 * the needle, the needle hands over to the song, and the control that stays on
 * screen drives the same element.
 */
export default function SoundGate() {
  /*
   * Sin puerta: la página llega abierta y la música es una oferta («Poner
   * música»). La puerta que la tapaba en cada visita se retiró en F4 y su
   * código se quedó sin uso (F5): fuera.
   */

  const [tracks, setTracks] = useState<Track[]>([]);
  /**
   * Whether there is music to put on at all.
   *
   * Pressing «Poner música» before the list had arrived, or after it failed,
   * dropped the needle and then nothing: the effect hands over to an empty
   * queue. Now a press while loading waits for the list and says so, and a
   * list that never comes says «Sin música ahora» instead of a needle.
   */
  const [status, setStatus] = useState<"loading" | "ready" | "none">("loading");
  /** pressed before the list arrived: put it on as soon as it does */
  const [waiting, setWaiting] = useState(false);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);

  /**
   * Whether the track's name is showing.
   *
   * Opens on every change of song and closes three seconds later — long enough
   * to read what you are hearing, short enough that the corner goes back to
   * being a meter and two buttons.
   */
  const [announced, setAnnounced] = useState(false);
  useEffect(() => {
    if (!current) return;
    setAnnounced(true);
    const t = setTimeout(() => setAnnounced(false), 3000);
    return () => clearTimeout(t);
  }, [current]);

  /**
   * And it comes back when you go looking for it.
   *
   * Folding the name away only works if there is a way to ask for it again —
   * otherwise the answer to "what is this song" is "wait for the next one".
   * Pointing at the control is that ask, and it costs nothing: the same
   * element, the same transition, opened by a second reason.
   */
  const [peeking, setPeeking] = useState(false);
  // before anything has played, the invitation stays readable
  /**
   * Open only at the very top of the page.
   *
   * Spelled out, the pill sat over whatever paragraph was passing underneath
   * it and, at the foot, over the footer. After the first scroll it folds to
   * the meter and the play button — still there, still a target, no longer a
   * caption on top of the reading.
   */
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const read = () => setScrolled(window.scrollY > 24);
    read();
    window.addEventListener("scroll", read, { passive: true });
    return () => window.removeEventListener("scroll", read);
  }, []);
  const open = peeking || (!scrolled && (announced || !current));

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const needleRef = useRef<HTMLAudioElement | null>(null);
  // the order is shuffled once, then walked: a random pick every time repeats
  // songs far more often than people expect it to
  const queue = useRef<Track[]>([]);
  const cursor = useRef(0);


  // the stack of records, fetched once per page load and kept (see loadJukebox)
  const alive = useRef(true);
  const fetchList = useCallback(() => {
    setStatus("loading");
    void loadJukebox().then((list) => {
      if (!alive.current) return;
      if (list.length) setTracks(list);
      setStatus(list.length ? "ready" : "none");
    });
  }, []);
  useEffect(() => {
    alive.current = true;
    fetchList();
    return () => {
      alive.current = false;
    };
  }, [fetchList]);

  const playAt = useCallback((index: number, fade = false) => {
    const list = queue.current;
    if (!list.length) return;
    const track = list[index % list.length];
    cursor.current = index % list.length;
    setCurrent(track);

    const audio = (audioRef.current ??= new Audio());
    const src = previewSrc(track.previewUrl);
    // Never reassign the src it already holds: that throws away the buffer we
    // spent the whole gate preloading, and the gap comes straight back.
    if (!audio.src.endsWith(src)) audio.src = src;
    audio.currentTime = 0;
    if (fade) fadeIn(audio, VOLUME, 1100);
    else audio.volume = VOLUME;
    audio.play().then(
      () => setPlaying(true),
      () => setPlaying(false),
    );
  }, []);

  const shuffle = useCallback(
    (list: Track[]) => {
      // Fisher-Yates, seeded by nothing in particular: a different record each
      // visit is the whole point
      const out = [...list];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      queue.current = out;
    },
    [],
  );

  /**
   * Drop the needle, and let the song rise underneath its tail.
   *
   * Not "play the effect, then play the song": the two overlap. The music
   * starts while the needle is still settling and fades up through it, so
   * there is no seam to hear — which is also how it works on a real deck.
   *
   * Every change of record goes through here, not just the first one: taking
   * the arm off and putting it down again is what actually happens between two
   * records, and a preview cutting straight into the next one sounds like a
   * playlist.
   */
  const dropNeedle = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        setPlaying(false);
      }

      const needle = (needleRef.current ??= new Audio(NEEDLE));
      needle.currentTime = 0;
      needle.volume = 0.9;

      let handedOver = false;
      const handOver = () => {
        if (handedOver) return;
        handedOver = true;
        if (queue.current.length) playAt(index, true);
      };

      needle.ontimeupdate = () => {
        const total = needle.duration;
        if (Number.isFinite(total) && needle.currentTime >= total - OVERLAP) handOver();
      };
      // a safety net: timeupdate fires ~4 times a second and can skip the
      // window on a busy main thread
      needle.onended = handOver;

      // if the effect cannot play at all, the music still should
      void needle.play().catch(handOver);
    },
    [playAt],
  );


  // the queue is ready as soon as the list is
  useEffect(() => {
    if (!tracks.length) return;
    shuffle(tracks);

    // Both files are fetched while the door is still shut. A preview is a
    // network round trip; waiting for it after the effect ends is exactly the
    // silence we are trying to avoid.
    const needle = (needleRef.current ??= new Audio(NEEDLE));
    needle.preload = "auto";
    needle.load();

    const audio = (audioRef.current ??= new Audio());
    audio.preload = "auto";
    audio.src = previewSrc(queue.current[0].previewUrl);
    audio.load();
  }, [tracks, shuffle]);

  // After the queue effect on purpose: effects run in the order they are
  // declared, and the needle must not come down on a queue not yet shuffled.
  // the press that came before the list: honoured when the list lands, or
  // turned into «Sin música ahora» if it never does
  useEffect(() => {
    if (!waiting || status === "loading") return;
    setWaiting(false);
    if (status === "ready") dropNeedle(cursor.current);
  }, [waiting, status, dropNeedle]);

  /**
   * Warm the next record while this one plays.
   *
   * The proxy serves previews with a day of cache, so simply asking for the
   * file puts it in the browser's HTTP cache. By the time the needle comes
   * down on it, there is nothing left to download — which is the difference
   * between the effect covering a hand-over and the effect covering a wait.
   */
  useEffect(() => {
    const list = queue.current;
    if (!current || !list.length) return;
    const upcoming = list[(cursor.current + 1) % list.length];
    if (!upcoming) return;
    const warm = new Audio();
    warm.preload = "auto";
    warm.src = previewSrc(upcoming.previewUrl);
    warm.load();
    return () => {
      warm.removeAttribute("src");
      warm.load();
    };
  }, [current]);

  // a preview is thirty seconds: when it runs out, put the next one on
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onEnd = () => dropNeedle(cursor.current + 1);
    audio.addEventListener("ended", onEnd);
    return () => audio.removeEventListener("ended", onEnd);
  }, [current, dropNeedle]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) {
      if (!queue.current.length) {
        /**
         * The list is still on its way: wait for it, not with a needle.
         *
         * A browser only lets audio start from a gesture, and by the time the
         * list arrives this press is history. Calling play() on both elements
         * now, inside the gesture, is what lets them play later on iOS; the
         * needle is muted for it so nothing sounds until there is a song to
         * hand over to.
         */
        const needle = (needleRef.current ??= new Audio(NEEDLE));
        needle.muted = true;
        void needle.play().then(
          () => {
            needle.pause();
            needle.muted = false;
          },
          () => {
            needle.muted = false;
          },
        );
        void (audioRef.current ??= new Audio()).play().catch(() => {});
        setWaiting(true);
        // after «Sin música ahora», a press is a second try, not a dead end
        if (status === "none") fetchList();
        return;
      }
      // never started (came in silent): this click is the gesture, so the
      // record goes on properly, needle and all
      dropNeedle(cursor.current);
      return;
    }
    if (audio.paused) {
      void audio.play().then(() => setPlaying(true));
    } else {
      audio.pause();
      setPlaying(false);
    }
  }, [current, dropNeedle, status, fetchList]);

  const next = useCallback(() => dropNeedle(cursor.current + 1), [dropNeedle]);

  const label =
    status === "none" ? "Sin música ahora" : waiting ? "Un momento…" : "Poner música";

  useEffect(
    () => () => {
      audioRef.current?.pause();
      needleRef.current?.pause();
    },
    [],
  );

  return (
    <>
      {/* Above the "Sobre el proyecto" link on a phone rather than beside it:
          two corner labels on a 390px row printed straight through each other.
          On a wider screen they have their own corners back. */}
        <div
          onMouseEnter={() => setPeeking(true)}
          onMouseLeave={() => setPeeking(false)}
          /**
           * A pill of frosted glass, like the tab bar in the app — and with no
           * outline, because there is nothing on the other side of it to be
           * separated from. Sitting directly on the shelf it needed a ground:
           * over a pale sleeve the controls disappeared, and the fix is the
           * one the rest of the product already uses. At 0.8 rather than 0.55:
           * over the bright end of the shelf the label was still fighting it.
           */
          // centred at the foot of a phone, back in its corner from sm up
          style={{ bottom: "calc(var(--safe-bottom) + 24px)" }}
          className="fixed left-1/2 z-[70] flex min-h-[44px] max-w-[calc(100vw-2.5rem)] -translate-x-1/2 items-center rounded-full bg-[rgb(var(--ink-rgb)/0.8)] text-[12px] uppercase tracking-[0.05em] text-paper/80 backdrop-blur-xl sm:bottom-5 sm:left-auto sm:right-5 sm:translate-x-0 sm:text-[13px]"
        >
          {current ? (
            <span className="flex min-h-[44px] items-center gap-2 px-4">
              {/* The brackets were a frame around three bars that already read
                  as a meter; two more characters, and they held the label at
                  arm's length from the thing it is labelling. */}
              <span aria-hidden className="mono shrink-0 text-paper/70">
                <Bars animate={playing} />
              </span>
              <TrackName open={open}>{`${current.artist} — ${current.title}`}</TrackName>
              <span className="-mr-2 flex shrink-0 items-center">
                <button
                  onClick={toggle}
                  aria-label={playing ? "Pausa" : "Reproducir"}
                  className="flex h-11 w-9 items-center justify-center transition hover:text-paper/60"
                >
                  {playing ? <PauseIcon /> : <PlayIcon />}
                </button>
                <button
                  onClick={next}
                  aria-label="Siguiente canción"
                  className="flex h-11 w-9 items-center justify-center transition hover:text-paper/60"
                >
                  <NextIcon />
                </button>
              </span>
            </span>
          ) : (
            /**
             * Until something plays, the pill is one button.
             *
             * It was a <div> with an onClick holding two 13px buttons: with a
             * keyboard or a screen reader only those two existed, and «Siguiente
             * canción» before anything has played skips nothing. Now the whole
             * pill is the control, and what it says is what it will do.
             */
            <button
              onClick={toggle}
              aria-busy={waiting}
              aria-label={label}
              className="pressable flex min-h-[44px] items-center gap-2 rounded-full px-4 uppercase"
            >
              <span aria-hidden className="mono shrink-0 text-paper/70">
                <Bars animate={waiting} />
              </span>
              <TrackName open={open || status === "none" || waiting}>{label}</TrackName>
              {status !== "none" && (
                <span className="shrink-0">
                  <PlayIcon />
                </span>
              )}
            </button>
          )}
        </div>
    </>
  );
}

/**
 * The words in the pill, which announce themselves and then get out of the way.
 *
 * Folded by max-width rather than by unmounting: the text stays in the DOM for
 * anyone listening to the page, the two states are the same element so the
 * transition is continuous, and the controls slide rather than jump. The width
 * is only ever set by the open/closed pair — Tailwind sorts utilities by its
 * own rules, so a second max-width on the base class used to win while closed.
 */
function TrackName({ open, children }: { open: boolean; children: React.ReactNode }) {
  return (
    <span
      className={`min-w-0 truncate transition-[max-width,opacity] duration-slow ease-out ${
        open ? "max-w-[52vw] opacity-100 sm:max-w-[300px]" : "max-w-0 opacity-0"
      }`}
    >
      {children}
    </span>
  );
}

/**
 * An equaliser, not a logo: it moves while something is playing and stands
 * still when nothing is. Each bar runs on its own duration so the three never
 * fall into step, which is what makes drawn equalisers look fake.
 */
const BAR_MS = [780, 1120, 920, 640];
const BAR_REST = ["55%", "100%", "40%", "75%"];

function Bars({ animate }: { animate: boolean }) {
  return (
    <span className="inline-flex h-[13px] items-end gap-[2.5px] align-middle">
      {BAR_MS.map((ms, i) => (
        <span
          key={i}
          className={`w-[2px] bg-current ${animate ? "sound-bar" : ""}`}
          style={{
            height: animate ? "100%" : BAR_REST[i],
            animationDuration: `${ms}ms`,
            animationDelay: `${i * 130}ms`,
          }}
        />
      ))}
    </span>
  );
}

function PlayIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2.5 1.5 L10 6 L2.5 10.5 Z" />
    </svg>
  );
}

function PauseIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <rect x="2.5" y="1.5" width="2.6" height="9" />
      <rect x="6.9" y="1.5" width="2.6" height="9" />
    </svg>
  );
}

function NextIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 12 12" fill="currentColor" aria-hidden>
      <path d="M2 1.5 L8.4 6 L2 10.5 Z" />
      <rect x="9" y="1.5" width="1.8" height="9" />
    </svg>
  );
}
