import { audioClock } from "./soundBits";

/**
 * How much sound a moment asks to play.
 *
 * Ported from `app/lib/audio_window.dart`, which is the phone's own answer to
 * the same question, and it exists for the same reason: the part chooser ("Choose
 * a part") used to open on half a minute whatever it was being opened for, and
 * the person trimmed it down by hand every time. How much of a track a post needs
 * is a fact about the post, and the app already knows it at the moment the sound
 * is picked. So the caller works the number out here and hands it to the chooser,
 * and the chooser's one job is *which* part of the file that is.
 *
 * The phone's file states two rules — a picture drop's sound plays across the run
 * of pictures, and a clip's is its own length. Only the first is here, because
 * only the first has a caller: what this client posts a sound on today is a Spark
 * card, and a card is exactly one picture. The clip rule is the phone's and is
 * not restated until something on this side needs it, since a second copy of a
 * number with no caller is a copy that drifts.
 */

/** What one picture's worth of sound is: half a minute. */
export const SOUND_BASE_MS = 30_000;

/** What each picture after the first adds. */
export const SOUND_STEP_MS = 10_000;

/** The window into a file: how far in it starts, and how far in it ends. */
export interface SoundWindow {
  startMs: number;
  endMs: number;
}

/**
 * How much of a track a run of `pictures` asks for.
 *
 * Thirty seconds for one, and ten seconds more for each picture after it: the
 * sound plays across the run, so a run twice as long is a sound twice as long in
 * everything but its opening — the user's own table of 2026-10-20, 30/40/50/60/70
 * for one to five pictures.
 *
 * A run of none is not a run: it is the house thirty, which is what a caller with
 * nothing to count gets.
 */
export function soundSpanForPictures(pictures: number) {
  const count = Number.isFinite(pictures) ? Math.max(0, Math.floor(pictures)) : 0;
  return SOUND_BASE_MS + (count > 1 ? count - 1 : 0) * SOUND_STEP_MS;
}

/**
 * What a Spark card asks for: one picture's worth.
 *
 * Named rather than left as `SOUND_BASE_MS` at the call site, because the number
 * and the thing it is the answer *to* are the part that is easy to get wrong — a
 * card is one picture, and the run's own length is not what plays under it.
 */
export function momentSoundSpan() {
  return soundSpanForPictures(1);
}

/**
 * A window as the two times a row prints: `0:30 – 1:00`.
 *
 * The phone's `_soundRow` draws exactly this line under the sound's name, and
 * only when there is a window to draw — see [hasWindow].
 */
export function soundWindowLabel(startMs: number, endMs: number) {
  return `${audioClock(startMs / 1000)} – ${audioClock(endMs / 1000)}`;
}

/**
 * Whether a window says anything.
 *
 * Both zero is the picker's "the whole file" — nothing has been narrowed — so the
 * line stands down rather than printing `0:00 – 0:00` under a sound that is going
 * to play all of itself. The phone's own test, `pick.endMs > pick.startMs`.
 */
export function hasWindow(startMs: number, endMs: number) {
  return endMs > startMs;
}
