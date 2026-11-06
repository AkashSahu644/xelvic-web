import { describe, expect, it } from "vitest";
import {
  EDIT_BACKGROUNDS,
  EDIT_FILTERS,
  EDIT_FONTS,
  aspectValue,
  defaultEditorDoc,
  filterByKey,
  fontByKey,
  frameAspect,
  frameForMode,
  inkOn,
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

describe("ink on the editor's own colours", () => {
  it("puts dark words on a light plate and light words on a dark one", () => {
    expect(inkOn("#ffffff")).toBe("text-[#111111]");
    expect(inkOn("#111111")).toBe("text-white");
    expect(inkOn("#ffec3d")).toBe("text-[#111111]");
    expect(inkOn("#ec1670")).toBe("text-white");
  });

  it("reads the panel's own ink where the panel is the ground", () => {
    expect(inkOn("transparent")).toBe("text-ink");
    // A plate the panel shows through is the panel, whatever colour it claims.
    expect(inkOn("rgba(0,0,0,.4)")).toBe("text-ink");
    expect(inkOn("")).toBe("text-ink");
  });

  it("reads the translucent ends of the plate row against what shows through", () => {
    expect(inkOn("rgba(0,0,0,.62)")).toBe("text-white");
    expect(inkOn("rgba(255,255,255,.9)")).toBe("text-[#111111]");
  });

  it("never paints a plate's name in the plate's own colour", () => {
    // The regression the helper exists for: "White" was a near-white plate with
    // white words on it, which is a plate that reads as an empty one.
    const plate = (key: string) =>
      inkOn(EDIT_BACKGROUNDS.find((item) => item.key === key)!.value);
    expect(plate("white")).not.toBe("text-white");
    expect(plate("black")).not.toBe("text-[#111111]");
    expect(plate("white")).not.toBe(plate("black"));
  });

  it("answers every plate in the row with a definite ink", () => {
    for (const item of EDIT_BACKGROUNDS) {
      const ink = inkOn(item.value);
      if (item.key === "none") expect(ink).toBe("text-ink");
      else expect(["text-white", "text-[#111111]"]).toContain(ink);
    }
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
