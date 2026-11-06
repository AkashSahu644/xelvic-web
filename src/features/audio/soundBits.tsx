import { useState } from "react";
import { Music2 } from "lucide-react";
import { mediaUrl } from "@/config/urls";
import { mediaService } from "@/services/media.service";
import { cn } from "@/utils/cn";
import type { Track } from "@/types/api";

/**
 * The sleeve a sound row wears, and the four readings a row is drawn from.
 *
 * Lifted out of `camera/PhotoEditor.tsx`, where they were written for its Audio
 * sheet, because a *second* surface now draws a sound row — the picker the
 * Spark card page opens — and a song that wore one sleeve in the editor and
 * another on the Spark page would be the same song with two faces. This is the
 * app's own structure: `screens/audio_bits.dart` holds what every sound list in
 * the phone draws, and no list restates it.
 *
 * Nothing here is invented. A row the server gave a cover is drawn with that
 * cover; a row with none is drawn from its own number, which is the seed the
 * server already ranks it by — so the same sound wears the same sleeve in every
 * list it appears in, and a row that is redrawn is not a row that has changed.
 *
 * The one thing this sleeve is *not* is the catalogue's own `CoverArt`
 * (`features/audio/parts.tsx`). That one is a flat tone with a music or a
 * microphone mark, drawn from a track's `seed` alone, and it is what the Audio
 * tab's shelves wear. This one is the picker's: it reads an uploaded sound's
 * cover when there is one, which the catalogue's never has, because a sound
 * somebody posted is a file with a thumbnail and a catalogue track is a title
 * with a number.
 */

/** Where a row's bytes play from, or null when there is no row. */
export function trackStream(track: Track | null) {
  if (!track) return null;
  return (
    track.stream || track.stream_url || `/audio/tracks/${track.id}/stream/`
  );
}

/** A row's cover, made absolute against the media origin — or null. */
export function trackCover(track: Track | null) {
  if (!track) return null;
  const raw =
    track.cover_url ||
    track.cover?.thumbnail_url ||
    track.cover?.content_url ||
    null;
  return raw ? (mediaUrl(raw) ?? raw) : null;
}

/**
 * The two tones a coverless row is drawn in, picked by its number.
 *
 * Eight pairs rather than the catalogue's six flat tones, because this sleeve
 * has to sit under a white music mark and a dark one at the same time — see
 * `AudioArt`.
 */
export const TRACK_TONES = [
  ["#243b80", "#7f8cff"],
  ["#0b6b63", "#5eead4"],
  ["#8e174e", "#ff7ab8"],
  ["#4c2b86", "#b794ff"],
  ["#8a4b0f", "#ffc46b"],
  ["#0d5f73", "#7dd3fc"],
  ["#5b1d1d", "#ff8b8b"],
  ["#334155", "#cbd5e1"],
] as const;

/**
 * A row as a number, for choosing its sleeve.
 *
 * The server's own `seed` when the row came with one, and the id otherwise —
 * the same fallback `audioShelf.keptToTrack` leans on, so a saved upload and
 * the same upload in the picker are drawn alike.
 */
export function trackSeed(track: Track | null) {
  const raw = String(track?.seed ?? track?.id ?? "xelvic");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/**
 * The sleeve.
 *
 * A cover when the row has one, and the row's own two tones with a music mark
 * over them when it has not — and a cover that fails to load falls back to the
 * tones rather than to a broken picture, which is the one thing a list of
 * sounds cannot show. The failure is remembered per address, so a row that
 * comes back with a working cover is drawn with it.
 */
export function AudioArt({
  track,
  className,
  iconClassName,
  eager = false,
}: {
  track: Track | null;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  const rawSrc = trackCover(track);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = rawSrc && rawSrc !== failedSrc ? rawSrc : null;
  const [from, to] = TRACK_TONES[trackSeed(track) % TRACK_TONES.length];
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(rawSrc)}
          className="size-full object-cover"
        />
      ) : (
        <>
          <span
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          />
          <span className="absolute -right-4 -top-5 size-16 rounded-full bg-white/15" />
          <span className="absolute -bottom-5 -left-4 size-16 rounded-full bg-black/10" />
          <Music2
            className={cn("relative size-5 text-white/90", iconClassName)}
          />
        </>
      )}
    </span>
  );
}

/** A number of seconds as `m:ss`, the app's own reading of a length. */
export function audioClock(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return "0:00";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

/** How many times a sound has been played, in the app's own words. */
export function audioPlays(track: Track) {
  const plays = track.plays ?? 0;
  return `${plays} ${plays === 1 ? "play" : "plays"}`;
}

/**
 * How long a file is, read off the file itself.
 *
 * The picker needs this for a sound nobody has played yet: a catalogue row
 * carries `seconds`, an upload somebody posted minutes ago usually does not,
 * and the part chooser cannot offer a window into a length it does not know.
 * It is read from a blob URL the browser makes of the local `File` — no
 * request, and nothing said to anybody — and a file whose metadata will not
 * load is refused rather than guessed at, because a window drawn on a guessed
 * length is a window that plays the wrong part.
 */
export function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That audio has no length to read."));
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.round(audio.duration * 1000)
        : 0;
      URL.revokeObjectURL(url);
      if (duration > 0) resolve(duration);
      else reject(new Error("That audio has no length to read."));
    };
    audio.onerror = fail;
    audio.src = url;
  });
}

/**
 * A row's bytes, as a file this client can upload.
 *
 * A sound is posted by asset id, and a row off a shelf has no asset id of its
 * own — only an address. So the bytes come down first and go up under this
 * account's own asset, which is the same two-step `CameraCapture.postMoment`
 * makes and the same one the phone makes through its attachment bridge.
 */
export async function fetchAudioFile(track: Track): Promise<File> {
  const raw = trackStream(track);
  const url = mediaUrl(raw);
  if (!url) throw new Error("That track has no audio to upload.");
  const blob = await mediaService.blob(url);
  return new File([blob], `${track.title || "xelvic-audio"}.mp3`, {
    type: blob.type || "audio/mpeg",
  });
}
