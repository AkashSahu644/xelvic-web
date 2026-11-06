import { describe, expect, it } from "vitest";
import { EMOJI, artOf, rowOf, toned } from "./model";
import { drawingOf, splitEmoji } from "./text";

/** What a body was cut into, as texts, so a case reads as the sentence did. */
const pieces = (text: string) => splitEmoji(text).map((run) => run.text);
/** Just the runs something can be drawn for. */
const drawn = (text: string) => splitEmoji(text).filter((run) => run.art);

describe("cutting a message into text and emoji", () => {
  it("finds nothing in an empty body", () => {
    expect(splitEmoji("")).toEqual([]);
  });

  it("hands a body with no emoji back as one piece of text", () => {
    expect(splitEmoji("see you at 5")).toEqual([{ text: "see you at 5" }]);
    expect(drawn("see you at 5")).toEqual([]);
  });

  it("hands a body that is only letters with accents back whole too", () => {
    // The fast path only skips ASCII; an accented letter still goes through the
    // segmenter, and comes out as text because the table has no row for it.
    expect(splitEmoji("café")).toEqual([{ text: "café" }]);
  });

  it("keeps the words and takes the emoji out from between them", () => {
    expect(pieces("hi 👋 there")).toEqual(["hi ", "👋", " there"]);
    expect(drawn("hi 👋 there").map((run) => run.text)).toEqual(["👋"]);
  });

  it("finds an emoji at each end, with no empty pieces around them", () => {
    expect(pieces("👋 hi 😀")).toEqual(["👋", " hi ", "😀"]);
  });

  it("keeps a variation selector with the emoji it belongs to", () => {
    // ❤️ is two code points. Cut on code points this would be the heart and a
    // stray selector, and the heart alone is a different CDN key.
    expect(pieces("❤️")).toEqual(["❤️"]);
    expect(drawn("❤️").length).toBe(1);
  });

  it("keeps a tinted emoji whole, tone and all", () => {
    expect(pieces("thanks 👋🏽")).toEqual(["thanks ", "👋🏽"]);
    expect(drawn("thanks 👋🏽").length).toBe(1);
  });

  it("reports whether each emoji it found can be drawn and can move", () => {
    const [run] = drawn("👋");
    expect(run.art).toEqual({ still: true, motion: true });
  });

  it("puts back exactly what it was given, whichever way the body is cut", () => {
    const bodies = [
      "hi 👋 there",
      "❤️",
      "👋🏽",
      "👋 hi 😀",
      "no emoji here",
      "🏳️‍🌈 and 🇮🇳 and 1️⃣",
      "trailing 👋",
      "👋",
      "a\nb 😀\tc",
    ];
    for (const body of bodies) {
      expect(pieces(body).join("")).toBe(body);
    }
  });

  it("answers the same way twice, and does not mind being asked often", () => {
    expect(splitEmoji("hi 👋 there")).toEqual(splitEmoji("hi 👋 there"));
  });
});

describe("reading one emoji's artwork out of the index", () => {
  it("finds a plain emoji and agrees with the picker's own table", () => {
    expect(drawingOf("👋")).toEqual(artOf(rowOf("👋")!, 0));
    expect(drawingOf("😀")).toEqual(artOf(rowOf("😀")!, 0));
  });

  it("reads a tinted emoji the way the picker does, tone and all", () => {
    // 👋🏽 is two code points and no row of its own; the tone has to be read
    // off the end and the tinted drawings asked about separately.
    for (const tone of [1, 2, 3, 4, 5]) {
      expect(drawingOf(toned("👋", tone))).toEqual(artOf(rowOf("👋")!, tone));
    }
  });

  it("says no as readily as yes, for the emoji Google draws nothing of", () => {
    // The handful of emoji Google has no drawing for are in the list all the
    // same, and a body that holds one has to fall back to the character rather
    // than to a broken picture.
    const undrawn = EMOJI.filter((row) => row[4] === 0);
    expect(undrawn.length).toBeGreaterThan(0);
    for (const row of undrawn) {
      expect(drawingOf(row[0]), row[0]).toEqual({ still: false, motion: false });
    }
  });

  it("refuses what it does not hold", () => {
    expect(drawingOf("q")).toBeNull();
    expect(drawingOf("café")).toBeNull();
    expect(drawingOf("👋🏽🏽")).toBeNull();
    expect(drawingOf("👨🏽‍🤝‍👨🏾")).toBeNull();
  });

  it("refuses a tone on an emoji that cannot wear one", () => {
    expect(rowOf("😀")![3]).toBe(0);
    expect(drawingOf("😀🏽")).toBeNull();
  });
});
