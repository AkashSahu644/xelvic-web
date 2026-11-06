import { describe, expect, it } from "vitest";
import {
  amplitudeBar,
  CANCEL_SLOP,
  holdSlide,
  LOCK_SLOP,
  withReading,
} from "./voicehold";

describe("reading a hold on the mic", () => {
  it("is nothing at all while the finger stays on the button", () => {
    expect(holdSlide({ x: 0, y: 0 })).toBe("none");
    expect(holdSlide({ x: -12, y: -9 })).toBe("none");
    // Downwards and rightwards are simply not the gesture.
    expect(holdSlide({ x: 90, y: 80 })).toBe("none");
  });

  it("locks exactly at the phone's own travel, not a pixel before", () => {
    expect(holdSlide({ x: 0, y: -LOCK_SLOP })).toBe("lock");
    expect(holdSlide({ x: 0, y: -(LOCK_SLOP - 1) })).toBe("none");
  });

  it("throws the note away exactly at the phone's own travel", () => {
    expect(holdSlide({ x: -CANCEL_SLOP, y: 0 })).toBe("cancel");
    expect(holdSlide({ x: -(CANCEL_SLOP - 1), y: 0 })).toBe("none");
  });

  it("takes the longer of two travels when the finger goes both ways", () => {
    // 90 up and 20 left is a lock that drifted.
    expect(holdSlide({ x: -20, y: -90 })).toBe("lock");
    // 20 up and 90 left is a throw-away that drifted.
    expect(holdSlide({ x: -90, y: -20 })).toBe("cancel");
  });

  it("keeps the recording on a dead heat", () => {
    // Both at exactly the slop is 70 up and 70 left — ambiguous, and an
    // ambiguous gesture must never be the one that loses the note.
    expect(holdSlide({ x: -70, y: -70 })).toBe("lock");
  });
});

describe("a loudness reading as a bar", () => {
  it("is nothing for silence, and for a number that is not one", () => {
    expect(amplitudeBar(0)).toBe(0);
    expect(amplitudeBar(-0.5)).toBe(0);
    expect(amplitudeBar(Number.NaN)).toBe(0);
  });

  it("is full at full scale", () => {
    expect(amplitudeBar(1)).toBe(100);
  });

  it("puts the quiet end of a voice at the bottom and not at zero", () => {
    // -60 dBFS is the floor this meter starts from.
    expect(amplitudeBar(0.001)).toBe(0);
    expect(amplitudeBar(0.01)).toBe(33);
    // A voice at 0.05 of full scale: quiet enough that a linear meter would
    // draw a pixel, and here it is a bar past the halfway line.
    expect(amplitudeBar(0.05)).toBeGreaterThan(50);
  });

  it("never runs off either end", () => {
    for (const rms of [0.0000001, 0.2, 0.9, 4]) {
      expect(amplitudeBar(rms)).toBeGreaterThanOrEqual(0);
      expect(amplitudeBar(rms)).toBeLessThanOrEqual(100);
    }
  });

  it("rises with the sound", () => {
    expect(amplitudeBar(0.05)).toBeGreaterThan(amplitudeBar(0.005));
  });
});

describe("the shelf of readings", () => {
  it("keeps the newest last", () => {
    expect(withReading([3, 4], 5)).toEqual([3, 4, 5]);
    expect(withReading([], 1)).toEqual([1]);
  });

  it("lets go of the oldest once it is full", () => {
    expect(withReading([1, 2, 3], 4, 3)).toEqual([2, 3, 4]);
  });

  it("leaves the list it was handed alone", () => {
    const bars = [1, 2];
    withReading(bars, 3);
    expect(bars).toEqual([1, 2]);
  });
});
