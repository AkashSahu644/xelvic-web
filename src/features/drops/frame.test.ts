// The box a card's picture or clip is drawn in.
//
// Every figure now fills the card's width. A shape taller than four-to-five is
// cropped instead of narrowing the box, which is the rule the feed this is
// modelled on uses. The width is pinned three ways because a browser that is
// free to answer `aspect-ratio` through `max-height` will narrow a box whose
// width it considers automatic - the owner's report of 2026-11-06, *"inner card
// ki width kam kiye jisse design bahut hi kharab lag raha hai"*, beside a card
// holding a narrow figure in the middle of a wide white surface.

import { describe, expect, it } from "vitest";
import { frameBox, frameShape, TALLEST_FRAME } from "./frame";

describe("a card's frame", () => {
  it("fills the card's width and caps a tall clip at four-to-five", () => {
    const box = frameBox(1.78);

    expect(box.width).toBe("100%");
    expect(box.minWidth).toBe("100%");
    expect(box.maxWidth).toBe("100%");
    expect(box.aspectRatio).toBe(`1 / ${TALLEST_FRAME}`);
    expect(box.maxHeight).toBeUndefined();
  });

  it("stands a still no taller than four to five", () => {
    expect(frameShape(1.78)).toBe(TALLEST_FRAME);
    expect(frameShape(2.4)).toBe(TALLEST_FRAME);
    const box = frameBox(1.78);

    expect(box.width).toBe("100%");
    expect(box.aspectRatio).toBe(`1 / ${TALLEST_FRAME}`);
    expect(box.maxHeight).toBeUndefined();
  });

  it("leaves a shape that already fits alone", () => {
    // A square or a landscape photograph is under the ceiling at the card's
    // width, so it is drawn exactly as it was posted - cropping is what a
    // ceiling does, and there is no ceiling in the way.
    expect(frameShape(1)).toBe(1);
    expect(frameShape(0.5625)).toBe(0.5625);
    expect(frameBox(0.5625).aspectRatio).toBe("1 / 0.5625");
  });

  it("reserves a real box for a payload with no ratio", () => {
    // `ratio` empty is an older answer or a file whose shape was never read.
    // The card reserves four-to-five, which is what it reserved before any of
    // this existed, so nothing jumps when the bytes land.
    expect(frameShape(null)).toBe(TALLEST_FRAME);
    expect(frameShape(undefined)).toBe(TALLEST_FRAME);
    expect(frameShape(0)).toBe(TALLEST_FRAME);
    expect(frameShape(Number.NaN)).toBe(TALLEST_FRAME);
    expect(frameShape(-3)).toBe(TALLEST_FRAME);
    expect(frameBox(undefined).aspectRatio).toBe(`1 / ${TALLEST_FRAME}`);
  });
});
