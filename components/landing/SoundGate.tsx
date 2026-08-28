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
  const [entered, setEntered] = useState(false);
  /**
   * The door does not slam in your face on arrival. The page lands clear —
   * a moment of the shelf actually running — and only then does the blur roll
   * in with the message on top.
   */
  const [armed, setArmed] = useState(false);

  const [tracks, setTracks] = useState<Track[]>([]);
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
  const open = announced || peeking;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const needleRef = useRef<HTMLAudioElement | null>(null);
  // the order is shuffled once, then walked: a random pick every time repeats
  // songs far more often than people expect it to
  const queue = useRef<Track[]>([]);
  const cursor = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => setArmed(true), 900);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!armed) return;
    document.documentElement.dataset.landing = entered ? "entered" : "gate";
    return () => {
      // Never remove it — set it to the open state instead. The blur is a
      // 1.6s transition, so a single frame without the attribute is enough to
      // start playing that transition backwards, and a remount then plays it
      // forwards again: the page appears to flash and re-blur itself.
      document.documentElement.dataset.landing = "entered";
    };
  }, [entered, armed]);

  // the stack of records, fetched once and kept
  useEffect(() => {
    let alive = true;
    fetch("/api/jukebox")
      .then((r) => r.json())
      .then((d: { tracks?: Track[] }) => {
        if (!alive || !d.tracks?.length) return;
        setTracks(d.tracks);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

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

  const enter = useCallback(
    (withSound: boolean) => {
      setEntered(true);
      if (withSound) dropNeedle(cursor.current);
    },
    [dropNeedle],
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
  }, [current, dropNeedle]);

  const next = useCallback(() => dropNeedle(cursor.current + 1), [dropNeedle]);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      needleRef.current?.pause();
    },
    [],
  );

  return (
    <>
      {!entered && (
        <div className="landing-gate fixed inset-0 z-[80] flex-col items-center justify-center px-6 pb-24 text-center">
          {/**
           * The door says what the place is, in the words the place uses
           * everywhere else.
           *
           * It used to be one long sentence in the middle of the screen and a
           * button the size of a headline — the button was the biggest thing
           * on the page, so the first thing anybody read was an instruction
           * about audio rather than what they had arrived at.
           *
           * Now it reads in the order the outside world already meets this in:
           * the name, the line that rides beside it everywhere, and then what
           * it is for. The same three lines as the shared card and the app
           * listing, so arriving here confirms what brought you rather than
           * introducing something new.
           */}
          <span aria-hidden className="mono flex items-center text-[15px] text-paper/50">
            <Bars animate />
          </span>

          {/* No name here: the mark is on screen above this, dimmed but
              legible, and printing "RACKR CLUB" underneath it says the same
              thing twice in two typefaces. */}
          <h1 className="mt-7 max-w-[18ch] text-[30px] leading-[1.1] tracking-[-0.02em] text-paper md:max-w-[20ch] md:text-[44px]">
            Tu colección de vinilos, más allá de la estantería.
          </h1>
          <p className="mt-4 max-w-[34ch] text-[15px] leading-relaxed text-paper/60 md:text-[17px]">
            Organiza, descubre y comparte tu colección con el club.
          </p>

          <button
            onClick={() => enter(true)}
            className="pressable mt-9 inline-flex h-11 select-none items-center gap-2.5 rounded-full bg-paper px-6 text-[13px] font-medium uppercase tracking-[0.07em] text-ink transition-colors hover:bg-paper/85"
          >
            {/* The icon carries the part the words dropped: this one turns the
                sound on. "Vamos allá" is the invitation; the speaker is the
                small print, and it belongs in a shape rather than in four more
                words. */}
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden>
              <path
                d="M3.2 6.1h2.1L8.4 3.4v9.2L5.3 9.9H3.2z"
                fill="currentColor"
              />
              <path
                d="M10.6 6.2a2.6 2.6 0 0 1 0 3.6M12.4 4.4a5.1 5.1 0 0 1 0 7.2"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
              />
            </svg>
            Vamos allá
          </button>

          <button
            onClick={() => enter(false)}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[11px] uppercase tracking-[0.05em] text-paper/60 underline-offset-4 transition hover:text-paper hover:underline sm:text-[13px]"
          >
            Entrar en silencio
          </button>
        </div>
      )}

      {/* Above the "Sobre el proyecto" link on a phone rather than beside it:
          two corner labels on a 390px row printed straight through each other.
          On a wider screen they have their own corners back. */}
      {entered && (
        <div
          onMouseEnter={() => setPeeking(true)}
          onMouseLeave={() => setPeeking(false)}
          className="fixed bottom-[52px] right-5 z-[70] flex max-w-[calc(100vw-2.5rem)] items-center gap-2 transition-[gap] duration-slow ease-out text-[11px] uppercase tracking-[0.05em] text-paper/80 sm:bottom-5 sm:text-[13px]">
          {/* The brackets were a frame around three bars that already read as a
              meter; two more characters, and they held the label at arm's
              length from the thing it is labelling. */}
          <span aria-hidden className="mono shrink-0 text-paper/70">
            <Bars animate={playing} />
          </span>

          {/**
           * The name announces itself and then gets out of the way.
           *
           * A track title parked in the corner of a landing page for as long
           * as the song lasts is a label nobody is reading after the first
           * three seconds — but the three seconds matter, because that is when
           * you want to know what you are hearing. So it opens on every change
           * of track, waits, and folds back to the meter and the controls.
           *
           * Folded by max-width rather than by unmounting: the text stays in
           * the DOM for anyone listening to the page, the two states are the
           * same element so the transition is continuous, and the controls
           * slide rather than jump because nothing is being added or removed.
           */}
          <span
            /**
             * The width is only ever set by the open/closed pair.
             *
             * There was a `sm:max-w-[300px]` on the base class as well, and
             * Tailwind sorts utilities by its own rules rather than by the
             * order you write them — so the open width kept winning while the
             * thing was closed. The name was invisible and still occupying
             * three hundred pixels, which is why the meter sat marooned at one
             * end of the bar and the controls at the other.
             *
             * Now the row is exactly as wide as what is in it: closed, the
             * meter and the two buttons sit together; open, the strip grows to
             * make room for the name and everything slides across with it.
             */
            className={`min-w-0 truncate transition-[max-width,opacity] duration-slow ease-out ${
              open ? "max-w-[52vw] opacity-100 sm:max-w-[300px]" : "max-w-0 opacity-0"
            }`}
          >
            {current ? `${current.artist} — ${current.title}` : "Sin sonido"}
          </span>

          <span className="flex shrink-0 items-center gap-2.5">
            <button
              onClick={toggle}
              aria-label={playing ? "Pausa" : "Reproducir"}
              className="transition hover:text-paper/60"
            >
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button
              onClick={next}
              aria-label="Siguiente canción"
              className="transition hover:text-paper/60"
            >
              <NextIcon />
            </button>
          </span>
        </div>
      )}
    </>
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
