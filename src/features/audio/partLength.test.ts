import { describe, expect, it } from "vitest";
import {
  PART_LENGTHS_MS,
  PART_MENU_HEIGHT,
  PART_ROW_HEIGHT,
  placePartMenu,
} from "./partLength";

/**
 * The part-length list and where its menu opens.
 *
 * Both were wrong in ways the control itself hides. The list held six values
 * where the phone offers eleven, so a forty-second part could not be asked for
 * at all; and the menu is opened from a pill at the foot of a scrolling bottom
 * sheet, which is the one place a menu positioned by CSS class is clipped by
 * the box it is drawn in. Hence arithmetic, and hence these.
 */

/** A phone-shaped window, and the pill that opens this menu. */
const WINDOW = { width: 390, height: 780 };
const PILL = {
  top: 700,
  bottom: 744,
  left: 250,
  right: 310,
  width: 60,
};

describe("the lengths a part may be", () => {
  it("is the phone's own list: ten to sixty, in fives", () => {
    expect(PART_LENGTHS_MS).toEqual([
      10_000, 15_000, 20_000, 25_000, 30_000, 35_000, 40_000, 45_000, 50_000,
      55_000, 60_000,
    ]);
  });

  it("holds the forty to sixty it used to leave out", () => {
    expect(PART_LENGTHS_MS).toContain(40_000);
    expect(PART_LENGTHS_MS).toContain(60_000);
  });
});

describe("where the menu opens", () => {
  it("opens upwards above a pill at the foot of the sheet, with the full list", () => {
    const place = placePartMenu(PILL, WINDOW);
    expect(place.opensUp).toBe(true);
    expect(place.bottom).toBe(88);
    expect(place.top).toBeUndefined();
    expect(place.maxHeight).toBe(PART_MENU_HEIGHT);
  });

  it("opens downwards when there is more room below the pill", () => {
    const place = placePartMenu(
      { top: 40, bottom: 84, left: 140, right: 200, width: 60 },
      WINDOW,
    );
    expect(place.opensUp).toBe(false);
    expect(place.top).toBe(92);
    expect(place.bottom).toBeUndefined();
    expect(place.maxHeight).toBe(PART_MENU_HEIGHT);
  });

  it("stops at the window's edge instead of hanging off it", () => {
    const place = placePartMenu(
      { top: 700, bottom: 744, left: 330, right: 382, width: 52 },
      WINDOW,
    );
    expect(place.width).toBe(132);
    expect(place.left + place.width).toBe(WINDOW.width - 8);
  });

  it("never runs off the left edge either", () => {
    const place = placePartMenu(
      { top: 700, bottom: 744, left: 0, right: 52, width: 52 },
      WINDOW,
    );
    expect(place.left).toBe(8);
  });

  it("grows no wider than the longest label needs, however wide the pill is", () => {
    expect(placePartMenu({ ...PILL, left: 0, right: 400, width: 400 }, WINDOW).width).toBe(220);
  });

  it("takes the taller side and scrolls when neither side fits the list", () => {
    const place = placePartMenu(
      { top: 240, bottom: 284, left: 140, right: 200, width: 60 },
      { width: 390, height: 500 },
    );
    expect(place.opensUp).toBe(true);
    expect(place.maxHeight).toBe(232);
    expect(place.maxHeight).toBeLessThan(PART_MENU_HEIGHT);
  });

  it("is never shorter than one row, even on a window with no room at all", () => {
    const place = placePartMenu(
      { top: 0, bottom: 100, left: 0, right: 200, width: 200 },
      { width: 200, height: 100 },
    );
    expect(place.maxHeight).toBe(PART_ROW_HEIGHT);
  });
});
