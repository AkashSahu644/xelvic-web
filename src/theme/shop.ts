// The theme shop: every design the build carries, the rungs they sit on, and
// the rules that stand between somebody and a theme.
//
// This is a reading of the Android shelf (`xelvic/app/lib/theme_shop.dart`):
// the same ladder, rung for rung — the floor, which everybody has, then twelve
// rungs of three where one of each may be opened, except the last two rungs of
// the middle and the top of the climb, where all three open at once. The client
// draws it because the server keeps only prices (`apps/sparks/themes.py`); a
// purchase names a *key* and never a figure, so the shop shows what it shows
// and the server charges what it charges, and a drift between the two is a
// stale price rather than a way to underpay.
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

/** Whether the ladder is in force. The server keeps the twin of this line. */
export const ladderOn = true;

/**
 * The ladder, rung by rung, in the order the shop lays it out.
 *
 * The floor's `opens` of two has never been read: a floor theme is *included*,
 * so no count applies to it and nobody spends a slot on it.
 */
export const THEME_TIERS: ThemeTier[] = [
  { at: 0, opens: 2, keys: ["pink", "unicorn", "catgirl"] },
  { at: 100, opens: 1, keys: ["monsoon", "chai", "neon"] },
  { at: 500, opens: 1, keys: ["orchid", "tidepool", "ember"] },
  { at: 1000, opens: 1, keys: ["cosmos", "sakura", "marigold"] },
  { at: 5000, opens: 1, keys: ["aurora", "obsidian", "peacock"] },
  { at: 10000, opens: 3, keys: ["solaris", "nebula", "eclipse"] },
  { at: 15000, opens: 1, keys: ["kitsune", "shojo", "idol"] },
  { at: 20000, opens: 1, keys: ["mecha", "ronin", "shinobi"] },
  { at: 25000, opens: 1, keys: ["toon", "bubblegum", "dino"] },
  { at: 30000, opens: 3, keys: ["windup", "cutlass", "astro"] },
  { at: 35000, opens: 1, keys: ["teddy"] },
  { at: 40000, opens: 1, keys: ["animeblue"] },
  { at: 45000, opens: 1, keys: ["alone"] },
];

/** What the shop reads a design's price against, beside what it was built with. */
export interface ShopFacts {
  /** The Studio row's resolved price, where a `free_until` lives. */
  price?: number;
  /** Whether the server says this person already owns it. */
  owned?: boolean;
}

/**
 * What [design] costs: the catalogue's own price when there is a row, and the
 * price the design was built with otherwise. A purchase never names a figure,
 * so this is what the tile *shows* rather than what the server charges.
 */
export function priceOf(design: ThemeDesign, facts?: ShopFacts): number {
  return facts?.price ?? design.price;
}

/** Every design in the shop, floor first. */
export function shopAll(all: ThemeDesign[]): ThemeDesign[] {
  return THEME_TIERS.flatMap((tier) =>
    tier.keys.map((key) => all.find((d) => d.key === key)).filter((d): d is ThemeDesign => Boolean(d)),
  );
}

/** The rung [design] sits on. An unknown design falls back to the floor. */
export function tierOf(design: ThemeDesign): ThemeTier {
  return THEME_TIERS.find((tier) => tier.keys.includes(design.key)) ?? THEME_TIERS[0];
}

/**
 * Whether this design's rung is the floor — the themes the app already was,
 * which are nobody's to open because everybody has them.
 *
 * Never true for a design the Studio authored: the floor is a fact about the
 * ladder, and the ladder has no rung for a theme the server wrote.
 */
export function included(design: ThemeDesign): boolean {
  return !design.custom && tierOf(design).at === 0;
}

/**
 * Whether [design] can be worn right now.
 *
 * Read in exactly one place because "can this be worn" is the only question the
 * gate answers, and everything downstream is a consequence. A design priced at
 * nothing is open whatever its rung — the price is the shop's own word for
 * "this one is free".
 */
export function isOpen(design: ThemeDesign, opened: Set<string>, facts?: ShopFacts): boolean {
  if (!ladderOn) return true;
  if (included(design)) return true;
  if (priceOf(design, facts) === 0) return true;
  if (opened.has(design.key)) return true;
  return facts?.owned === true;
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

/** Whether there is enough in the wallet to buy [design]. */
export function affordable(design: ThemeDesign, balance: number, facts?: ShopFacts): boolean {
  return balance >= priceOf(design, facts);
}

/**
 * Whether the shelf offers a *buy* for [design]: not already open, reached,
 * with a slot left on its rung, and affordable.
 *
 * A design the Studio authored skips the rung and the slots entirely — it is
 * priced by its row and gated on owning it, never on the ladder.
 */
export function canOpen(
  design: ThemeDesign,
  opened: Set<string>,
  earned: number,
  balance: number,
  facts?: ShopFacts,
): boolean {
  if (isOpen(design, opened, facts)) return false;
  const rung = design.custom || (reached(tierOf(design), earned) && slotsLeft(tierOf(design), opened) > 0);
  return rung && affordable(design, balance, facts);
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
