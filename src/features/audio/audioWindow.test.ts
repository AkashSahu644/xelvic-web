import { describe, expect, it } from "vitest";
import {
  SOUND_BASE_MS,
  SOUND_STEP_MS,
  hasWindow,
  momentSoundSpan,
  soundSpanForPictures,
  soundWindowLabel,
} from "./audioWindow";

/**
 * How much sound a moment asks for, and how the row that answers it reads.
 *
 * These are the phone's numbers, and the point of writing them down is that the
 * rule they state was *not* kept before: the part chooser opened on half a minute
 * however long the thing it was opened for ran. [soundSpanForPictures] is the
 * user's own table — 30/40/50/60/70 for one to five pictures — and the rest is
 * the two readings the sound row makes of the window it is handed.
 */

describe("how much of a track a run of pictures asks for", () => {
  it("is the user's own table: thirty for one, ten more for each after it", () => {
    expect(soundSpanForPictures(1)).toBe(30_000);
    expect(soundSpanForPictures(2)).toBe(40_000);
    expect(soundSpanForPictures(3)).toBe(50_000);
    expect(soundSpanForPictures(4)).toBe(60_000);
    expect(soundSpanForPictures(5)).toBe(70_000);
  });

  it("is the step and not a multiple of it", () => {
    // The first picture is not one step, it is the base: a run of two is not
    // twice a run of one, which is what `pictures * SOUND_STEP_MS` would say.
    expect(soundSpanForPictures(1)).toBe(SOUND_BASE_MS);
    expect(soundSpanForPictures(2)).toBe(SOUND_BASE_MS + SOUND_STEP_MS);
  });

  it("answers the house thirty for a run of none, or of nonsense", () => {
    expect(soundSpanForPictures(0)).toBe(SOUND_BASE_MS);
    expect(soundSpanForPictures(-3)).toBe(SOUND_BASE_MS);
    expect(soundSpanForPictures(Number.NaN)).toBe(SOUND_BASE_MS);
  });

  it("counts a part picture as the picture it is part of", () => {
    expect(soundSpanForPictures(2.7)).toBe(SOUND_BASE_MS + SOUND_STEP_MS);
  });

  it("keeps counting past the minute a moment will play", () => {
    // Sixty seconds is what a *moment* plays, not what a run of pictures asks
    // for: a run of eight is still a hundred seconds of run, and the ceiling is
    // applied where a sound is played, not here.
    expect(soundSpanForPictures(8)).toBe(100_000);
  });
});

describe("what a Spark card asks for", () => {
  it("is one picture's worth, whatever the run behind it was", () => {
    expect(momentSoundSpan()).toBe(SOUND_BASE_MS);
    expect(momentSoundSpan()).toBe(soundSpanForPictures(1));
  });
});

describe("whether a window says anything", () => {
  it("says nothing when both ends are nought", () => {
    // The picker's "the whole file": the row stands down rather than printing
    // `0:00 – 0:00` under a sound that plays all of itself.
    expect(hasWindow(0, 0)).toBe(false);
  });

  it("says something as soon as the end is past the start", () => {
    expect(hasWindow(0, 1)).toBe(true);
    expect(hasWindow(12_000, 42_000)).toBe(true);
  });

  it("says nothing about an end before the start", () => {
    expect(hasWindow(30_000, 10_000)).toBe(false);
  });
});

describe("a window as the row prints it", () => {
  it("is the two times, on the clock the sound rows already use", () => {
    expect(soundWindowLabel(0, 30_000)).toBe("0:00 – 0:30");
    expect(soundWindowLabel(30_000, 60_000)).toBe("0:30 – 1:00");
    expect(soundWindowLabel(65_000, 90_000)).toBe("1:05 – 1:30");
  });

  it("prints an hour-long file without inventing an hours field", () => {
    // Nothing in a moment reaches past a minute, but the clock is shared with
    // every other sound row in the app and does not get to be wrong here.
    expect(soundWindowLabel(0, 3_725_000)).toBe("0:00 – 62:05");
  });
});
