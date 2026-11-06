import { describe, expect, it } from "vitest";
import { clampSpot, dockEdge, homeSpot, WINDOW_GUTTER } from "./minibar";

/** A window on a laptop-sized page, where there is room to move it about. */
const box = { width: 320, height: 60 };
const view = { width: 1280, height: 800 };

/** The same bar on a phone, where it fills almost the whole width. */
const tightBox = { width: 366, height: 60 };
const tightView = { width: 390, height: 844 };

describe("where the small call bar sits", () => {
  it("opens in the bottom right corner, clear of the sides", () => {
    expect(homeSpot(box, view)).toEqual({
      left: view.width - box.width - 16,
      top: view.height - box.height - 16,
    });
  });

  it("opens inside a screen too small to hold it", () => {
    const tiny = { width: 120, height: 80 };
    expect(homeSpot(box, tiny)).toEqual({
      left: WINDOW_GUTTER,
      top: WINDOW_GUTTER,
    });
  });

  it("is pulled back inside when a resize leaves it off the screen", () => {
    expect(clampSpot({ left: -40, top: -20 }, box, view)).toEqual({
      left: WINDOW_GUTTER,
      top: WINDOW_GUTTER,
    });
    expect(clampSpot({ left: 5000, top: 5000 }, box, view)).toEqual({
      left: view.width - box.width - WINDOW_GUTTER,
      top: view.height - box.height - WINDOW_GUTTER,
    });
  });

  it("is left exactly where it was dragged to, inside the gutter", () => {
    const spot = { left: 120, top: 300 };
    expect(clampSpot(spot, box, view)).toEqual(spot);
  });
});

describe("docking against an edge", () => {
  it("docks left only once the bar is pushed past the gutter", () => {
    expect(dockEdge({ left: 5, top: 300 }, box, view)).toBe("left");
    expect(dockEdge({ left: -80, top: 300 }, box, view)).toBe("left");
    // Let go exactly on the gutter line: floating, because a floating bar is
    // held at exactly this distance and nothing has pushed it further.
    expect(dockEdge({ left: WINDOW_GUTTER, top: 300 }, box, view)).toBeNull();
    expect(dockEdge({ left: 120, top: 300 }, box, view)).toBeNull();
  });

  it("docks right only once the bar's own edge is inside the gutter", () => {
    const pushed = view.width - box.width - 4;
    expect(dockEdge({ left: pushed, top: 300 }, box, view)).toBe("right");
    expect(
      dockEdge({ left: view.width - box.width - WINDOW_GUTTER, top: 300 }, box, view),
    ).toBeNull();
  });

  it("never docks from the middle of the screen", () => {
    const middle = {
      left: (view.width - box.width) / 2,
      top: (view.height - box.height) / 2,
    };
    expect(dockEdge(middle, box, view)).toBeNull();
  });

  it("folds at the slightest push on a phone, where it fills the width", () => {
    // The honest cost of a bar this wide: at rest it is already exactly the
    // gutter from both sides, so one pixel past either edge is a push. The
    // phone's own window has the same rule and does not have this problem,
    // because it is 116pt wide on the same screen.
    expect(dockEdge({ left: WINDOW_GUTTER, top: 400 }, tightBox, tightView)).toBeNull();
    expect(dockEdge({ left: WINDOW_GUTTER + 1, top: 400 }, tightBox, tightView)).toBe(
      "right",
    );
    expect(dockEdge({ left: WINDOW_GUTTER - 1, top: 400 }, tightBox, tightView)).toBe(
      "left",
    );
  });
});