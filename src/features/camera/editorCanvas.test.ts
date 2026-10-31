import { describe, expect, it } from "vitest";
import { combinedFilter, effectiveSourceSize, layerSize } from "./editorCanvas";
import { auraByKey, defaultEditorDoc, filterByKey } from "./editorTypes";

describe("editor canvas helpers", () => {
  it("swaps the source size for odd turns", () => {
    expect(effectiveSourceSize({ width: 400, height: 300 }, 0)).toEqual({ width: 400, height: 300 });
    expect(effectiveSourceSize({ width: 400, height: 300 }, 1)).toEqual({ width: 300, height: 400 });
    expect(effectiveSourceSize({ width: 400, height: 300 }, 2)).toEqual({ width: 400, height: 300 });
    expect(effectiveSourceSize(null, 1)).toBeNull();
  });

  it("combines the chosen filter and aura", () => {
    const doc = defaultEditorDoc();
    doc.filter = "glow";
    doc.aura = "warm";
    expect(combinedFilter(doc)).toBe(`${filterByKey("glow").css} ${auraByKey("warm").css}`);
  });

  it("keeps the clean filter when nothing is selected", () => {
    expect(combinedFilter(defaultEditorDoc())).toBe("none");
  });

  it("sizes stickers and pictures from the stage", () => {
    expect(layerSize({ id: "a", kind: "sticker", src: "", x: 0.5, y: 0.5, scale: 2, rotation: 0, ratio: 2 }, 200, 100)).toEqual({ width: 60, height: 120 });
    expect(layerSize({ id: "b", kind: "image", src: "", x: 0.5, y: 0.5, scale: 1, rotation: 0, ratio: 0.5 }, 200, 100)).toEqual({ width: 45, height: 22.5 });
  });
});
