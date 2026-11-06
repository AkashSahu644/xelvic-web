import { describe, expect, it } from "vitest";
import { giveBack, MOST_MOVING, spare, wanted } from "./motion";

describe("whether an emoji should be moving", () => {
  it("moves a tile in the picker while it is on screen", () => {
    expect(wanted("tile", true, false)).toBe(true);
    expect(wanted("tile", false, false)).toBe(false);
  });

  it("leaves an emoji in a message still while it is merely on screen", () => {
    // The owner's own report: a thread where every bubble animates for as long
    // as it is in view is a thread that cannot be read.
    expect(wanted("text", true, false)).toBe(false);
  });

  it("moves an emoji in a message while a pointer is on it", () => {
    expect(wanted("text", true, true)).toBe(true);
    expect(wanted("text", false, true)).toBe(true);
  });
});

describe("whether there is room for one more", () => {
  it("starts while the budget has room", () => {
    expect(spare(0, false)).toBe(true);
    expect(spare(MOST_MOVING - 1, false)).toBe(true);
  });

  it("waits once the budget is full", () => {
    expect(spare(MOST_MOVING, false)).toBe(false);
    expect(spare(MOST_MOVING + 4, false)).toBe(false);
  });

  it("lets the one under the pointer through anyway", () => {
    expect(spare(MOST_MOVING, true)).toBe(true);
  });
});

describe("handing a place back", () => {
  it("gives back a place taken over the budget, once the pointer leaves", () => {
    expect(giveBack(true, false, MOST_MOVING + 1)).toBe(true);
  });

  it("keeps the place while the pointer is still there", () => {
    expect(giveBack(true, true, MOST_MOVING + 1)).toBe(false);
  });

  it("keeps a place that was taken while there was room", () => {
    // A pointer that landed under the budget did not overdraw anything, so
    // there is nothing to hand back even though it is at the line exactly.
    expect(giveBack(true, false, MOST_MOVING)).toBe(false);
    expect(giveBack(true, false, MOST_MOVING - 3)).toBe(false);
  });

  it("has nothing to give back when no pointer was involved", () => {
    expect(giveBack(false, false, MOST_MOVING + 6)).toBe(false);
  });
});
