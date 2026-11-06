import { describe, expect, it } from "vitest";
import {
  artOf,
  cdnKey,
  EMOJI,
  EMOJI_GROUPS,
  groupRows,
  motionUrl,
  RECENT_LIMIT,
  rememberRecent,
  rowOf,
  searchRows,
  SEARCH_LIMIT,
  shownChar,
  stillUrl,
  toned,
} from "./model";

describe("where an emoji lives on Google's CDN", () => {
  it("spells the emoji as its codepoints, in lower-case hex", () => {
    expect(cdnKey("😀")).toBe("1f600");
    // The variation selector is part of the key, not something to drop.
    expect(cdnKey("❤️")).toBe("2764_fe0f");
    expect(cdnKey("👋🏽")).toBe("1f44b_1f3fd");
  });

  it("asks for the drawing and the animation by that name", () => {
    expect(stillUrl("😀")).toBe(
      "https://fonts.gstatic.com/s/e/notoemoji/latest/1f600/emoji.svg",
    );
    expect(motionUrl("❤️")).toBe(
      "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/lottie.json",
    );
  });
});

describe("the emoji table", () => {
  it("holds the whole of Unicode's emoji, in nine groups", () => {
    expect(EMOJI.length).toBe(1906);
    expect(EMOJI_GROUPS.length).toBe(9);
  });

  it("names every row and puts it in a group that exists", () => {
    for (const row of EMOJI) {
      expect(row[0].length).toBeGreaterThan(0);
      expect(row[1].length).toBeGreaterThan(0);
      expect(row[2]).toBeGreaterThanOrEqual(0);
      expect(row[2]).toBeLessThan(EMOJI_GROUPS.length);
    }
  });

  it("splits into groups that add back up to the whole table", () => {
    let total = 0;
    for (let group = 0; group < EMOJI_GROUPS.length; group += 1) {
      const rows = groupRows(group);
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((row) => row[2] === group)).toBe(true);
      total += rows.length;
    }
    expect(total).toBe(EMOJI.length);
  });

  it("says a row takes a tone only when it carries all ten answers", () => {
    for (const row of EMOJI) {
      if (row[3] === 1) expect(row[7]).toMatch(/^[01]{10}$/);
      else expect(row[7]).toBe("");
    }
  });
});

describe("putting a skin tone on an emoji", () => {
  it("puts the modifier right after the emoji's only code point", () => {
    expect(toned("👋", 3)).toBe("👋🏽");
    expect(toned("✋", 1)).toBe("✋🏻");
  });

  it("drops the variation selector the modifier replaces", () => {
    // ☝️ is 261d fe0f; tinted it is 261d 1f3fd, with no selector between them.
    expect(toned("☝️", 3)).toBe("☝🏽");
    expect([...toned("☝️", 3)].length).toBe(2);
  });

  it("keeps what the emoji carries after its first code point in place", () => {
    // A joiner and a second person: the tone belongs to the first one only.
    const tinted = toned("👩‍💻", 4);
    expect([...tinted].length).toBe([..."👩‍💻"].length + 1);
    expect(tinted.startsWith("👩🏾")).toBe(true);
    expect(tinted.endsWith("‍💻")).toBe(true);
  });

  it("is the emoji itself for no tone, or for a tone that is not one", () => {
    expect(toned("👋", 0)).toBe("👋");
    expect(toned("👋", 6)).toBe("👋");
  });

  it("gives a different character for every tone", () => {
    const five = [1, 2, 3, 4, 5].map((tone) => toned("👋", tone));
    expect(new Set(five).size).toBe(5);
  });
});

describe("what a tile is drawing", () => {
  it("asks for the plain emoji for no tone", () => {
    const row = rowOf("👋")!;
    expect(shownChar(row, 0)).toBe("👋");
    expect(artOf(row, 0)).toEqual({ still: true, motion: true });
  });

  it("asks for the tinted emoji once a tone is picked", () => {
    const row = rowOf("👋")!;
    expect(shownChar(row, 3)).toBe("👋🏽");
  });

  it("reads the tinted answers from the row, not from the plain emoji's", () => {
    // The hand is drawn in every tone and animated in fewer than all of them,
    // which is the whole reason the ten digits are in the table.
    const row = rowOf("👋")!;
    const tints = [1, 2, 3, 4, 5].map((tone) => artOf(row, tone));
    expect(tints.every((art) => art.still)).toBe(true);
    expect(tints.some((art) => art.motion)).toBe(true);
    expect(row[7].slice(0, 5)).toBe("11111");
  });

  it("leaves an emoji no tone can be put on exactly as it was", () => {
    const row = rowOf("😀")!;
    expect(row[3]).toBe(0);
    expect(shownChar(row, 3)).toBe("😀");
    expect(artOf(row, 3)).toEqual(artOf(row, 0));
  });
});

describe("searching by name", () => {
  it("finds an emoji by the name it has", () => {
    const found = searchRows("grinning");
    expect(found.length).toBeGreaterThan(0);
    expect(found.map((row) => row[0])).toContain("😀");
  });

  it("finds one by a word the name does not carry", () => {
    // The seventh column is the short names people actually type.
    expect(searchRows("joy").map((row) => row[0])).toContain("😂");
  });

  it("narrows with every word rather than widening", () => {
    // All of them, not any: "cat face" is somebody narrowing down.
    const both = searchRows("cat face");
    const either = searchRows("cat");
    expect(both.length).toBeLessThan(either.length);
    expect(both.every((row) => either.includes(row))).toBe(true);
  });

  it("is not case sensitive", () => {
    expect(searchRows("ROCKET")).toEqual(searchRows("rocket"));
  });

  it("answers with nothing for nothing typed", () => {
    expect(searchRows("")).toEqual([]);
    expect(searchRows("   ")).toEqual([]);
  });

  it("draws no more than the limit at once", () => {
    // "a" is in most names there are, which is the case the limit is for.
    expect(searchRows("a").length).toBeLessThanOrEqual(SEARCH_LIMIT);
    expect(searchRows("a", 5).length).toBe(5);
  });
});

describe("the recent shelf", () => {
  it("puts the newest at the front", () => {
    expect(rememberRecent(["😂", "😀"], "🔥")).toEqual(["🔥", "😂", "😀"]);
  });

  it("holds one of each", () => {
    expect(rememberRecent(["😂", "😀"], "😂")).toEqual(["😂", "😀"]);
  });

  it("lets the oldest go once it is full", () => {
    const full = Array.from({ length: RECENT_LIMIT }, (_, index) => `e${index}`);
    const next = rememberRecent(full, "🔥");
    expect(next.length).toBe(RECENT_LIMIT);
    expect(next[0]).toBe("🔥");
    expect(next).not.toContain(`e${RECENT_LIMIT - 1}`);
  });

  it("leaves the shelf it was handed alone", () => {
    const shelf = ["😂"];
    rememberRecent(shelf, "🔥");
    expect(shelf).toEqual(["😂"]);
  });
});
