// The small things every shelf draws: the purse, a price, and the bolt.
//
// Ported from `SparkPurse` and `PriceChip` in `drip.dart`. Both read the wallet
// the marketplace already fetched, so the number on the header and the number
// on a tile are one number and cannot disagree.

import { Zap } from "lucide-react";
import { cn } from "@/utils/cn";
import { count, priceOf } from "@/theme/shop";
import type { ThemeDesign } from "@/theme/catalog";
import type { CatalogueTheme } from "./types";

/**
 * What is in the wallet, as a chip.
 *
 * `compact` is the app-bar form: no word, just the bolt and the number. The
 * app hides it entirely until the shelf has landed, because a purse reading
 * zero before the first fetch is a purse telling somebody they are broke.
 */
export function SparkPurse({
  balance,
  loaded,
  compact = false,
}: {
  balance: number;
  loaded: boolean;
  compact?: boolean;
}) {
  if (!loaded) return null;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-full px-2.5 py-[5px] text-[13px] font-extrabold text-[var(--accent)]"
      style={{ background: "var(--accent-soft)" }}
    >
      {compact ? null : <span className="pr-1 text-[12px] font-bold">Sparks</span>}
      <Zap className={compact ? "size-[15px]" : "size-[14px]"} aria-hidden />
      <span className={compact ? "text-[13.5px]" : "text-[13px]"}>{count(balance)}</span>
    </span>
  );
}

/** The arm a figure's chip is in. See `PriceChip`. */
type PriceArm =
  | { kind: "worn"; label: string }
  | { kind: "free"; label: string }
  | { kind: "kept"; label: string }
  | { kind: "price"; label: string; price: number };

export function priceArm(figure: {
  owned?: boolean;
  worn?: boolean;
  price?: number;
}): PriceArm {
  if (figure.worn) return { kind: "worn", label: "Wearing" };
  const price = figure.price ?? 0;
  if (figure.owned && price === 0) return { kind: "free", label: "Free" };
  if (figure.owned) return { kind: "kept", label: "Kept" };
  return { kind: "price", label: count(price), price };
}

/**
 * What a figure costs, and what has already happened to it.
 *
 * Read in one order and no other: worn, then free, then kept, then a price. A
 * bolt is drawn only on the last arm — a chip that says "Wearing" with a bolt
 * beside it would be a chip offering to sell somebody the thing they have on.
 */
export function PriceChip({ figure }: { figure: { owned?: boolean; worn?: boolean; price?: number } }) {
  const arm = priceArm(figure);
  const tone =
    arm.kind === "worn"
      ? "bg-[var(--accent)] text-[var(--on-accent)]"
      : arm.kind === "free"
        ? "text-[var(--good)]"
        : arm.kind === "kept"
          ? "text-[var(--dim)]"
          : "text-[var(--accent)]";
  const wash =
    arm.kind === "free"
      ? "rgb(var(--good-rgb) / 0.12)"
      : arm.kind === "kept"
        ? "color-mix(in srgb, var(--ink) 6%, transparent)"
        : arm.kind === "price"
          ? "rgb(var(--accent-rgb) / 0.14)"
          : undefined;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[9px] px-[7px] py-[3.5px] text-[10.5px] font-extrabold",
        tone,
      )}
      style={wash ? { background: wash } : undefined}
    >
      {arm.kind === "price" ? <Zap className="size-[11px]" aria-hidden /> : null}
      {arm.label}
    </span>
  );
}

/**
 * What a theme costs: the catalogue's own price when there is a row, and the
 * price the design was built with otherwise.
 *
 * A purchase never names a figure, so this is what a tile *shows* rather than
 * what the server charges — see `priceOf` and `sparks/themes.py`.
 */
export function themePrice(design: ThemeDesign, row: CatalogueTheme | null): number {
  return priceOf(design, row ? { price: row.price, owned: row.owned } : undefined);
}

/** Whether this theme is on the ladder's floor, and so everybody's. */
export function themeIsFree(design: ThemeDesign, row: CatalogueTheme | null): boolean {
  if (row) return row.price === 0;
  return design.price === 0;
}
