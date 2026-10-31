import { describe, expect, it } from "vitest";
import {
  EDIT_FILTERS,
  EDIT_FONTS,
  aspectValue,
  defaultEditorDoc,
  filterByKey,
  fontByKey,
  frameAspect,
  frameForMode,
} from "./editorTypes";

describe("editor frame helpers", () => {
  it("reads APK frame ratios", () => {
    expect(aspectValue("4/5")).toBe(0.8);
    expect(aspectValue("1/1")).toBe(1);
    expect(aspectValue("9/16")).toBe(0.5625);
  });

  it("falls back to portrait for a broken ratio", () => {
    expect(aspectValue("nope")).toBe(0.8);
    expect(aspectValue("4/0")).toBe(0.8);
  });

  it("maps frame keys to ratios", () => {
    expect(frameAspect("portrait")).toBe("4/5");
    expect(frameAspect("square")).toBe("1/1");
    expect(frameAspect("tall")).toBe("9/16");
  });

  it("keeps edit on portrait and follows the shot for moments", () => {
    expect(frameForMode("edit", "9/16")).toBe("portrait");
    expect(frameForMode("moment", "9/16")).toBe("tall");
    expect(frameForMode("moment", "1/1")).toBe("square");
    expect(frameForMode("moment", "4/3")).toBe("portrait");
  });
});

describe("editor filter and font lookup", () => {
  it("finds the APK filter set and falls back to original", () => {
    expect(EDIT_FILTERS).toHaveLength(14);
    expect(filterByKey("glow").key).toBe("glow");
    expect(filterByKey("missing").key).toBe("original");
  });

  it("finds the APK font set and falls back to classic", () => {
    expect(EDIT_FONTS.map((font) => font.label)).toEqual(["Classic", "Poet", "BOLD", "whisper", "Neo"]);
    expect(fontByKey("neo").key).toBe("neo");
    expect(fontByKey("missing").key).toBe("classic");
  });
});

describe("default editor document", () => {
  it("starts clean and gives every editor its own layers", () => {
    const one = defaultEditorDoc();
    const two = defaultEditorDoc("square");
    one.texts.push({
      id: "one",
      value: "Text",
      x: 0.5,
      y: 0.5,
      font: "classic",
      size: 34,
      color: "#ffffff",
      background: "none",
      outline: "none",
      align: "center",
      box: false,
      rotation: 0,
    });
    expect(two.texts).toHaveLength(0);
    expect(two.frame).toBe("square");
    expect(two.filter).toBe("original");
    expect(two.audio).toBeNull();
    expect(two.aura).toBe("asis");
    expect(two.turns).toBe(0);
    expect(two.crop).toBeNull();
    expect(two.cutout).toBeNull();
    expect(two.layers).toHaveLength(0);
  });
});
