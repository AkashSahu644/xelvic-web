import { describe, expect, it } from "vitest";
import { coverCrop, formatDuration, moveNormalizedPoint } from "./cameraMath";
import { LOOKS } from "./looks";

describe("camera crop math", () => {
  it("centres a cover crop for a portrait preview over a landscape frame", () => {
    const crop = coverCrop(1280, 720, 9 / 16);
    expect(crop.sh).toBe(720);
    expect(crop.sw).toBeCloseTo(405);
    expect(crop.sx).toBeCloseTo((1280 - 405) / 2);
    expect(crop.sy).toBe(0);
  });

  it("keeps the full frame when the aspects match", () => {
    expect(coverCrop(1280, 720, 16 / 9)).toEqual({
      sx: 0,
      sy: 0,
      sw: 1280,
      sh: 720,
    });
  });

  it("shrinks the crop as the zoom rises", () => {
    const one = coverCrop(1000, 1000, 1, 1);
    const two = coverCrop(1000, 1000, 1, 2);
    expect(two.sw).toBe(one.sw / 2);
    expect(two.sh).toBe(one.sh / 2);
    expect(two.sx).toBe(one.sx + one.sw / 4);
  });

  it("falls back safely when the frame is not ready", () => {
    expect(coverCrop(0, 0, 1)).toEqual({ sx: 0, sy: 0, sw: 0, sh: 0 });
  });
});

describe("camera duration label", () => {
  it("formats recording time as minutes and seconds", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(12_900)).toBe("0:12");
    expect(formatDuration(30_000)).toBe("0:30");
  });
});

describe("camera overlay dragging", () => {
  it("moves stickers using stage-relative coordinates", () => {
    expect(moveNormalizedPoint({ x: 0.5, y: 0.5 }, 100, -200, 400, 800, 80, 40)).toEqual({
      x: 0.75,
      y: 0.25,
    });
  });

  it("keeps the whole sticker inside the stage", () => {
    expect(moveNormalizedPoint({ x: 0.5, y: 0.5 }, 500, 900, 400, 800, 160, 160)).toEqual({
      x: 0.8,
      y: 0.9,
    });
  });
});

describe("camera looks", () => {
  it("matches the seven look previews shipped with the app", () => {
    expect(LOOKS.map((look) => look.key)).toEqual([
      "original",
      "glow",
      "mono",
      "soft",
      "blush",
      "clear",
      "vivid",
    ]);
  });
});
