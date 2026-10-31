// The theme shop: every design the web carries, the rungs they sit on, and the
// rules that stand between somebody and a theme.
//
// This is a reading of the Android shelf (`xelvic/app/lib/theme_shop.dart`) —
// the same ladder the user asked for: six rungs of three, one of each openable
// except the last, where all three open. The client draws it because the server
// keeps only prices (`apps/sparks/themes.py`); a purchase names a *key* and
// never a figure, so the shop shows what it shows and the server charges what
// it charges, and a drift between the two is a stale price rather than a way
// to underpay.
//
// The two numbers a theme is measured against come from the wallet and are
// deliberately read as arguments, not globals: `earned` (every day ever
// credited) decides what is unlocked, and `balance` (what is left after the
// purchases) decides what can be paid for. Keeping the ladder on `earned` is
// what stops a purchase from taking back the rung it was made on.

// The theme shop: every design the web carries, the rungs they sit on, and the
// rules that stand between somebody and a theme.
//
// This is a reading of the Android shelf (`xelvic/app/lib/theme_shop.dart`) —
// the same ladder the user asked for: six rungs of three, one of each openable
// except the last, where all three open. The client draws it because the server
// keeps only prices (`apps/sparks/themes.py`); a purchase names a *key* and
// never a figure, so the shop shows what it shows and the server charges what
// it charges, and a drift between the two is a stale price rather than a way
// to underpay.
//
// The two numbers a theme is measured against come from the wallet and are
// deliberately read as arguments, not globals: `earned` (every day ever
// credited) decides what is unlocked, and `balance` (what is left after the
// purchases) decides what can be paid for. Keeping the ladder on `earned` is
// what stops a purchase from taking back the rung it was made on.

import type { ThemeDesign } from "@/theme/catalog";

export interface ThemeTier {
  /** The streak total that reaches this rung. Zero is the floor. */
  at: number;
  /** How many of the rung's themes one person may open. */
  opens: number;
  keys: string[];
}

/** The ladder, rung by rung, in the order the shop lays it out. */
export const THEME_TIERS: ThemeTier[] = [
  { at: 0, opens: 2, keys: ["pink", "unicorn", "catgirl"] },
  { at: 100, opens: 1, keys: ["monsoon", "chai", "neon"] },
  { at: 500, opens: 1, keys: ["orchid", "tidepool", "ember"] },
  { at: 1000, opens: 1, keys: ["cosmos", "sakura", "marigold"] },
  { at: 5000, opens: 1, keys: ["aurora", "obsidian", "peacock"] },
  { at: 10000, opens: 3, keys: ["solaris", "nebula", "eclipse"] },
];

/** Every design in the shop, floor first. */
export function shopAll(all: ThemeDesign[]): ThemeDesign[] {
  return THEME_TIERS.flatMap((tier) =>
    tier.keys.map((key) => all.find((d) => d.key === key)).filter((d): d is ThemeDesign => Boolean(d)),
  );
}

/** The rung [design] sits on. */
export function tierOf(design: ThemeDesign): ThemeTier {
  return THEME_TIERS.find((tier) => tier.keys.includes(design.key)) ?? THEME_TIERS[0];
}

/** Whether [design] has been opened, from the keys already spent. */
export function isOpen(design: ThemeDesign, opened: Set<string>): boolean {
  const price = design.price;
  return price === 0 || opened.has(design.key);
}

/** Whether the rung [tier] is reached, by the lifetime total. */
export function reached(tier: ThemeTier, earned: number): boolean {
  return earned >= tier.at;
}

/** How many of [tier]'s themes have been opened. */
export function openedIn(tier: ThemeTier, opened: Set<string>): number {
  return tier.keys.filter((key) => opened.has(key)).length;
}

/** How many are left to open on [tier]. Never negative. */
export function slotsLeft(tier: ThemeTier, opened: Set<string>): number {
  const left = tier.opens - openedIn(tier, opened);
  return left < 0 ? 0 : left;
}

/** Whether [design] can be opened right now. */
export function canOpen(design: ThemeDesign, opened: Set<string>, earned: number, balance: number): boolean {
  return !isOpen(design, opened) && reached(tierOf(design), earned) && slotsLeft(tierOf(design), opened) > 0 && affordable(design, balance);
}

/** Whether there is enough in the wallet to buy [design]. */
export function affordable(design: ThemeDesign, balance: number): boolean {
  return balance >= design.price;
}

/** The streak total [design] is still waiting on — zero once reached. */
export function toGo(design: ThemeDesign, earned: number): number {
  const left = tierOf(design).at - earned;
  return left < 0 ? 0 : left;
}

/** How far along somebody is towards [tier], from nothing to one. */
export function progress(tier: ThemeTier, earned: number): number {
  if (tier.at === 0) return 1;
  if (earned >= tier.at) return 1;
  return earned / tier.at;
}

/** A streak total the way a person says it: 1,000, never 1000. */
export function count(n: number): string {
  const digits = Math.abs(n).toString();
  const out: string[] = [];
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out.push(",");
    out.push(digits[i]);
  }
  return `${n < 0 ? "-" : ""}${out.join("")}`;
}
