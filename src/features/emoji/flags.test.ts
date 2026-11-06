import { describe, expect, it } from "vitest";
import { EMOJI } from "./data";
import { EMOJI_FLAGS } from "./flags";

/**
 * The two generated files are written by the same run and read at different
 * times, which is exactly the arrangement that drifts. This is the rope: the
 * index is held to the table emoji by emoji, so a regeneration that touched one
 * and not the other is a failing test rather than a message drawing an emoji
 * the picker has no tile for, or refusing one it has.
 */
describe("the flags index against the picker's table", () => {
  it("holds one entry per emoji, and no others", () => {
    expect(Object.keys(EMOJI_FLAGS).length).toBe(EMOJI.length);
  });

  it("says the same thing about every emoji in it", () => {
    for (const row of EMOJI) {
      const [char, , , tone, still, motion, , masks] = row;
      const flags = EMOJI_FLAGS[char];
      expect(flags, `no flags for ${char}`).toBeDefined();
      // Three digits, then the ten tone masks for an emoji that takes a tone.
      expect(flags.length, char).toBe(tone ? 13 : 3);
      expect(flags, char).toBe(`${tone}${still}${motion}${tone ? masks : ""}`);
    }
  });

  it("gives a toneable emoji the same tints the table gives it", () => {
    const toneable = EMOJI.filter((row) => row[3] === 1);
    expect(toneable.length).toBeGreaterThan(0);
    for (const row of toneable) {
      expect(EMOJI_FLAGS[row[0]].slice(3), row[0]).toBe(row[7]);
    }
  });
});
