import { Music2, Podcast } from "lucide-react";
import type { Track } from "@/types/api";

/**
 * The sleeve, and the four readings of a track every sound list shares.
 *
 * Lifted out of `pages/AudioPage.tsx`, where they were written, because a
 * *second* surface now draws a track — the shelf, whose rows are drops, vibes and
 * songs in one list — and a song drawn with a different sleeve on the shelf than
 * in the audio tab would be the same song wearing two faces. This is the app's
 * own structure: `screens/audio_bits.dart` holds `CoverArt` and the track
 * helpers, and both the tab and every list inside it read them from there.
 *
 * Nothing here invents a shape: the numbers are `audio.dart`'s (`isPodcast`,
 * `byline`, `under`, `playCount`) and the tones are the ones the catalogue's own
 * sleeves already used.
 */

const COVER_TONES = ["#2A3EB1", "#00796B", "#AD1457", "#6A3FB5", "#9C5A00", "#116A80"];

export function seedOf(value: number | string | undefined | null) {
  const number = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

export function coverTone(seed: number) {
  return COVER_TONES[seed % COVER_TONES.length];
}

/**
 * A track's sleeve, made from its own number.
 *
 * The catalogue has no artwork of its own — a track is a title, an artist and a
 * seed — so the seed *is* the picture: one of six tones, and a mark that says
 * whether what is behind it is a song or an episode. Deterministic, so the same
 * track wears the same sleeve in every list it appears in, which is the whole
 * reason it is drawn from the id rather than picked at random.
 */
export function CoverArt({
  seed,
  podcast,
  size = 46,
  radius,
}: {
  seed: number;
  podcast?: boolean;
  size?: number;
  radius?: number;
}) {
  const Icon = podcast ? Podcast : Music2;
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.3,
        backgroundColor: coverTone(seed),
      }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  );
}

/**
 * Whether a track is an episode rather than a song.
 *
 * One flag, read in several places, and never re-derived from anything else: the
 * backend keeps `kind` on the row and `Track.Kind` has exactly two members, so a
 * second test (a series being set, a runtime being long) would be a guess that
 * happens to agree most of the time.
 */
export function trackIsPodcast(track: Track) {
  return track.kind === "podcast";
}

/** What a track is called in a list that already has its own heading. */
export function trackLine(track: Track) {
  return trackIsPodcast(track) ? track.series || track.artist : track.title;
}

/** What sits under that: the artist on a song, the episode on an episode. */
export function trackUnder(track: Track) {
  if (!trackIsPodcast(track)) return track.artist;
  return [track.title, track.artist].filter(Boolean).join(" · ");
}

/**
 * A song's plays as a sentence — `playCount` in `audio.dart`.
 *
 * A word and not a bare number, because the number is not the point: "1 play"
 * and "1,204 plays" are both answering "is this worth pressing", and a row that
 * said `1204` would be asking the reader to work that out.
 */
export function playCount(value: number | undefined) {
  const plays = Math.max(0, Math.trunc(value ?? 0));
  if (plays === 1) return "1 play";
  if (plays < 1000) return `${plays} plays`;
  if (plays < 1_000_000) {
    const thousands = plays / 1000;
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}K plays`;
  }
  const millions = plays / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1) : Math.round(millions)}M plays`;
}
