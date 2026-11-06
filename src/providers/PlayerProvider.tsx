import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { PlayerContext } from "@/context/player";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { claimEar, releaseEar } from "@/utils/playback";
import type { Track } from "@/types/api";

export interface PlayerContextValue {
  current: Track | null;
  queue: Track[];
  index: number;
  playing: boolean;
  loading: boolean;
  time: number;
  duration: number;
  volume: number;
  failed: boolean;
  barHidden: boolean;
  setBarHidden: (hidden: boolean) => void;
  play: (track: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
}

function streamOf(track: Track | null) {
  if (!track) return null;
  return track.stream || track.stream_url || `/audio/tracks/${track.id}/stream/`;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.9);
  const [barHidden, setBarHidden] = useState(false);
  const wantPlay = useRef(false);
  const media = useMediaUrl(streamOf(current));

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (!media.src) {
      audio.pause();
      audio.removeAttribute("src");
      setTime(0);
      setDuration(0);
      setLoading(false);
      return;
    }
    audio.src = media.src;
    audio.load();
    setLoading(true);
    setTime(0);
    if (wantPlay.current) {
      audio.play().catch(() => setPlaying(false));
    }
  }, [media.src]);

  useEffect(() => {
    if (media.failed) {
      setLoading(false);
      setPlaying(false);
    }
  }, [media.failed]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setTime(audio.currentTime);
    const onDuration = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    // The music bar is one of the things that can be heard, so it obeys the
    // app's one-ear rule like every clip does: starting takes the ear off
    // whatever was playing, and stopping gives it back. See `lib/playback`.
    const onPlay = () => {
      claimEar(audio);
      setPlaying(true);
      setLoading(false);
    };
    const onPause = () => {
      releaseEar(audio);
      setPlaying(false);
    };
    const onWaiting = () => setLoading(true);
    const onPlaying = () => setLoading(false);
    const onEnded = () => {
      // An element that ran out is not paused by the browser, so it gives the
      // ear back here rather than waiting for a `pause` that never comes.
      releaseEar(audio);
      setPlaying(false);
      setIndex((currentIndex) => {
        if (currentIndex < 0) return currentIndex;
        const nextIndex = currentIndex + 1;
        if (nextIndex >= queue.length) {
          wantPlay.current = false;
          return currentIndex;
        }
        setCurrent(queue[nextIndex]);
        wantPlay.current = true;
        return nextIndex;
      });
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("durationchange", onDuration);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("waiting", onWaiting);
    audio.addEventListener("playing", onPlaying);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("durationchange", onDuration);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("waiting", onWaiting);
      audio.removeEventListener("playing", onPlaying);
      audio.removeEventListener("ended", onEnded);
    };
  }, [queue]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = volume;
  }, [volume]);

  const play = useCallback((track: Track, nextQueue?: Track[]) => {
    if (current?.id === track.id) {
      const audio = audioRef.current;
      if (!audio) return;
      if (audio.paused) {
        wantPlay.current = true;
        audio.play().catch(() => setPlaying(false));
      } else {
        wantPlay.current = false;
        audio.pause();
      }
      return;
    }
    const list = nextQueue && nextQueue.length ? nextQueue : [track];
    const position = Math.max(0, list.findIndex((item) => item.id === track.id));
    setQueue(list);
    setIndex(position);
    setCurrent(track);
    wantPlay.current = true;
    setPlaying(true);
  }, [current]);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !current) return;
    if (audio.paused) {
      wantPlay.current = true;
      audio.play().catch(() => setPlaying(false));
    } else {
      wantPlay.current = false;
      audio.pause();
    }
  }, [current]);

  const move = useCallback(
    (delta: number) => {
      if (!queue.length) return;
      const nextIndex = (index + delta + queue.length) % queue.length;
      setIndex(nextIndex);
      setCurrent(queue[nextIndex]);
      wantPlay.current = true;
      setPlaying(true);
    },
    [index, queue],
  );

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(seconds, Number.isFinite(audio.duration) ? audio.duration : seconds));
    setTime(audio.currentTime);
  }, []);

  const setVolume = useCallback((next: number) => {
    setVolumeState(Math.max(0, Math.min(1, next)));
  }, []);

  const close = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
    }
    wantPlay.current = false;
    setCurrent(null);
    setQueue([]);
    setIndex(-1);
    setPlaying(false);
    setLoading(false);
    setTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    const session = navigator.mediaSession;
    if (!current || !session || typeof MediaMetadata === "undefined") {
      if (session) {
        session.metadata = null;
        session.playbackState = "none";
      }
      return;
    }

    session.metadata = new MediaMetadata({
      title: current.title,
      artist: current.artist,
      album: current.series ?? undefined,
    });

    const handlers: Array<[MediaSessionAction, MediaSessionActionHandler]> = [
      ["play", () => {
        if (audioRef.current?.paused) toggle();
      }],
      ["pause", () => {
        if (audioRef.current && !audioRef.current.paused) toggle();
      }],
      ["previoustrack", () => move(-1)],
      ["nexttrack", () => move(1)],
      ["seekbackward", (details) => seek((audioRef.current?.currentTime ?? 0) - (details.seekOffset ?? 10))],
      ["seekforward", (details) => seek((audioRef.current?.currentTime ?? 0) + (details.seekOffset ?? 10))],
      ["seekto", (details) => {
        if (details.seekTime !== undefined) seek(details.seekTime);
      }],
    ];
    const registered: MediaSessionAction[] = [];
    for (const [action, handler] of handlers) {
      try {
        session.setActionHandler(action, handler);
        registered.push(action);
      } catch (error) {
        if (!(error instanceof DOMException) || error.name !== "NotSupportedError") {
          throw error;
        }
      }
    }

    return () => {
      for (const action of registered) session.setActionHandler(action, null);
    };
  }, [current, move, seek, toggle]);

  useEffect(() => {
    const session = navigator.mediaSession;
    if (!session) return;
    session.playbackState = current ? (playing ? "playing" : "paused") : "none";
    if (!duration || !Number.isFinite(time) || typeof session.setPositionState !== "function") return;
    session.setPositionState({
      duration,
      playbackRate: audioRef.current?.playbackRate ?? 1,
      position: Math.min(time, duration),
    });
  }, [current, duration, playing, time]);

  const value = useMemo<PlayerContextValue>(
    () => ({
      current,
      queue,
      index,
      playing,
      loading,
      time,
      duration,
      volume,
      failed: media.failed,
      barHidden,
      setBarHidden,
      play,
      toggle,
      next: () => move(1),
      previous: () => move(-1),
      seek,
      setVolume,
      close,
    }),
    [current, queue, index, playing, loading, time, duration, volume, media.failed, barHidden, play, toggle, move, seek, setVolume, close],
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" className="hidden" />
    </PlayerContext.Provider>
  );
}

