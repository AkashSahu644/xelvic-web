import { describe, expect, it } from "vitest";
import { designedThemes } from "@/theme/catalog";
import {
  canOpen,
  isOpen,
  progress,
  shopAll,
  slotsLeft,
  THEME_TIERS,
  toGo,
} from "@/theme/shop";

function theme(key: string) {
  const found = designedThemes.find((design) => design.key === key);
  if (!found) throw new Error(`Missing theme in test catalogue: ${key}`);
  return found;
}

describe("theme shop eligibility", () => {
  it("keeps included designs available without using a paid tier slot", () => {
    const opened = new Set<string>();
    expect(isOpen(theme("pink"), opened)).toBe(true);
    expect(isOpen(theme("unicorn"), opened)).toBe(true);
    expect(canOpen(theme("pink"), opened, 0, 0)).toBe(false);
    expect(slotsLeft(THEME_TIERS[0], opened)).toBe(2);
  });

  it("requires the lifetime earned threshold and enough wallet balance", () => {
    const opened = new Set<string>();
    expect(canOpen(theme("monsoon"), opened, 99, 60)).toBe(false);
    expect(canOpen(theme("monsoon"), opened, 100, 59)).toBe(false);
    expect(canOpen(theme("monsoon"), opened, 100, 60)).toBe(true);
    expect(toGo(theme("monsoon"), 99)).toBe(1);
  });

  it("enforces the one-pick limit on paid tiers", () => {
    const opened = new Set(["monsoon"]);
    expect(canOpen(theme("chai"), opened, 100, 1_000)).toBe(false);
    expect(slotsLeft(THEME_TIERS[1], opened)).toBe(0);
  });

  it("opens all three designs in the final tier", () => {
    const opened = new Set<string>();
    for (const key of THEME_TIERS[5].keys) {
      expect(canOpen(theme(key), opened, 10_000, 4_000)).toBe(true);
    }
  });

  it("returns themes in tier order and caps progress at one", () => {
    expect(shopAll(designedThemes)[0].key).toBe("pink");
    expect(progress(THEME_TIERS[1], 50)).toBe(0.5);
    expect(progress(THEME_TIERS[1], 200)).toBe(1);
  });
});
