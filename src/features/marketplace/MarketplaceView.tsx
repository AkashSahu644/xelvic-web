// The marketplace: the three shops the app has, on one page.
//
// Ported from `screens/marketplace.dart`. Two of the shelves used to be rows in
// Settings with pages of their own — **Drip**, the figures a convo draws, and
// **Themes**, the colour the whole app is read in — and each looked like the
// only shop in the app. They are one page with a tab strip now, and **Logos** is
// the third.
//
// This file owns what the aisles used to own each on their own: the strip. The
// title and the way out are the Settings header's, because the web reaches the
// marketplace as a view of one page rather than as a route of its own — and a
// second header under the first would be exactly the two-titles-two-ways-back
// the app merged away. The three bodies under the strip are *bodies*: no header,
// no title, no back button, which is what makes them three shelves of one shop.
//
// **The purse sits up here rather than in any aisle**, because all three charge
// sparks: a figure costs what the server says, so does a designed theme, and so
// does a logo other than the free one. One number at the top is one answer to
// "what have I got", which is the question every aisle is about to ask — and it
// is one read of `/sparks/wallet/`, so the header and the tiles cannot disagree.

import { useState } from "react";
import { cn } from "@/utils/cn";
import { DripView } from "./DripView";
import { LogoShopView } from "./LogoShopView";
import { SparkPurse } from "./parts";
import { useMarketWallet } from "@/hooks/useMarketplace";
import { ThemeShopView } from "./ThemeShopView";

/** Which of the three aisles the page opens on. See `ShopTab`. */
export type MarketTab = "drip" | "themes" | "logos";

/**
 * The strip, in the app's order.
 *
 * Drip leads and Themes follows — the order the two rows had in Settings. Logos
 * comes last because it is the one that was asked for by number, and because a
 * mark is the smallest thing on the shelf: the figure and the colour are both
 * bigger changes to a page than the picture in its corner.
 */
export const MARKET_TABS: ReadonlyArray<{ key: MarketTab; label: string }> = [
  { key: "drip", label: "Drip" },
  { key: "themes", label: "Themes" },
  { key: "logos", label: "Logos" },
];

/** The purse, for the header above the strip. One reading, one number. */
export function MarketPurse() {
  const wallet = useMarketWallet();
  return <SparkPurse balance={wallet.data?.balance ?? 0} loaded={Boolean(wallet.data)} compact />;
}

/**
 * The strip itself. See the app's `TabBar`: the label is the indicator's width,
 * so the accent line sits under the word rather than across the whole third of
 * the page — and the words are 13.5 at w700 in both states, because a selected
 * tab that grew would move the strip under the thumb that chose it.
 */
export function MarketStrip({ tab, onTab }: { tab: MarketTab; onTab: (next: MarketTab) => void }) {
  return (
    <div className="sticky top-[64px] z-20 border-b border-line bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
      <div className="flex justify-center">
        {MARKET_TABS.map((aisle) => {
          const on = tab === aisle.key;
          return (
            <button
              key={aisle.key}
              type="button"
              onClick={() => onTab(aisle.key)}
              aria-current={on ? "page" : undefined}
              className={cn(
                "relative px-4 py-3 text-[13.5px] font-bold transition",
                on ? "text-ink" : "text-dim hover:text-ink",
              )}
            >
              {aisle.label}
              {on ? <span className="absolute inset-x-1 bottom-0 h-[2px] rounded-full bg-accent" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The page: the strip, and whichever aisle is under it.
 *
 * `initialTab` is how a link that already names one thing — a logo, a theme, a
 * figure — lands on that shelf rather than on Drip: making somebody swipe is
 * asking them to find the thing the link was already about.
 */
export function MarketplaceView({ initialTab = "drip" }: { initialTab?: MarketTab }) {
  const [tab, setTab] = useState<MarketTab>(initialTab);
  return (
    <div>
      <MarketStrip tab={tab} onTab={setTab} />
      <div className="px-4 py-4">
        {/* One aisle at a time, and each mounts its own read of its own shelf
            when it opens — the app's `TabBarView` keeps all three alive, but
            there is nothing here worth keeping alive: a shelf is a fetch the
            query cache already holds, and a tab switch is not a reason to
            redraw two pages nobody is looking at. */}
        {tab === "drip" ? <DripView /> : null}
        {tab === "themes" ? <ThemeShopView /> : null}
        {tab === "logos" ? <LogoShopView /> : null}
      </div>
    </div>
  );
}
