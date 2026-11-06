/**
 * The rules of the composer's hold-to-record mic, kept apart from the browser
 * that does the recording.
 *
 * The phone's own voice note is a *hold* rather than a tap: `chat.dart`'s
 * `_holdStart`/`_holdSlide`/`_holdEnd` and `chat_audio.dart`'s `voiceHoldSlide`.
 * Down starts the recording, up sends it, sliding left throws it away, sliding
 * up locks the recorder so the finger can come off and the note waits for a
 * Send. Nothing is decided until the finger comes up, so sliding back to the
 * button undoes either choice.
 *
 * The three numbers below are the phone's, not new ones — a gesture that means
 * one thing on the phone and another on the web is worse than either.
 *
 * Everything here is arithmetic on the finger's own travel and on the
 * recorder's own readings, so it can be checked without a microphone.
 */

/** How far left the finger must travel before letting go throws the note away. */
export const CANCEL_SLOP = 70;

/** And how far up before letting go leaves the recorder running without it. */
export const LOCK_SLOP = 60;

/** Which way the finger has taken the hold. */
export type HoldSlide = "none" | "cancel" | "lock";

/**
 * Reads a drag from the mic as one of the three things a hold can become.
 *
 * `from` is the finger's travel since the press: left is negative x, up is
 * negative y. A finger on a diagonal has gone both ways at once, so the longer
 * of the two travels is the one it meant — and a dead heat keeps the recording,
 * because an ambiguous gesture should never be the one that throws a note away.
 */
export function holdSlide(from: { x: number; y: number }): HoldSlide {
  const up = -from.y;
  const left = -from.x;
  const locking = up >= LOCK_SLOP;
  const cancelling = left >= CANCEL_SLOP;
  if (locking && cancelling) return up >= left ? "lock" : "cancel";
  if (locking) return "lock";
  if (cancelling) return "cancel";
  return "none";
}

/**
 * A voice note shorter than this is a finger that slipped rather than something
 * anybody said — the phone's `_minVoiceDuration`.
 */
export const MIN_VOICE_MS = 1000;

/** The phone's own ceiling on a recording: thirty minutes. */
export const MAX_VOICE_MS = 30 * 60 * 1000;

/** And its ceiling on the bytes: the same 25 MB the upload door allows. */
export const MAX_VOICE_BYTES = 25 * 1024 * 1024;

/**
 * How many loudness samples travel with the note, and how often one is taken.
 *
 * The phone keeps its own last 120 amplitudes as integers from 0 to 100
 * (`recording_controller.dart`), and the bubble on either side draws whatever
 * arrives. Twelve seconds of window at this rate, which is what a bar of that
 * width can show without every sample collapsing into one pixel.
 */
export const WAVEFORM_SAMPLES = 120;
export const WAVEFORM_SAMPLE_MS = 100;

/** Where silence sits on the meter, in decibels below full scale. */
const FLOOR_DB = -60;

/**
 * One reading of the microphone's loudness, as the 0–100 the phone sends.
 *
 * Straight from the analyser's root-mean-square would be unreadable: speech
 * sits around 0.02–0.1 and would draw a bar of two or three pixels whatever
 * anybody said. Decibels put the quiet end and the loud end of a voice far
 * enough apart to see, and the floor at −60 dBFS keeps a silent room from
 * being drawn as a hairline.
 */
export function amplitudeBar(rms: number): number {
  if (!Number.isFinite(rms) || rms <= 0) return 0;
  const db = 20 * Math.log10(rms);
  const level = ((db - FLOOR_DB) / -FLOOR_DB) * 100;
  return Math.max(0, Math.min(100, Math.round(level)));
}

/**
 * The shelf of readings to send: the one just taken, and the last few before
 * it. Newest last, which is the order the phone's own list is in.
 */
export function withReading(
  bars: readonly number[],
  bar: number,
  cap = WAVEFORM_SAMPLES,
): number[] {
  const next = [...bars, bar];
  return next.length > cap ? next.slice(next.length - cap) : next;
}
