import type { QueryClient } from "@tanstack/react-query";

/**
 * The marketplace's keys, and the one refresh every write shares.
 *
 * Three shelves read the same three answers — the catalogue, the Drip shelf and
 * the purse — so the keys are written once here rather than repeated in each
 * shelf's file. A write that moved one of them moves all three, and
 * `refreshShelves` is that sentence.
 *
 * The reads are `hooks/useMarketplace.ts`; the writes that use this refresh are
 * the `useMarket` actions there.
 */

/** The four query keys the marketplace reads and refreshes. */
export const marketKeys = {
  catalogue: ["catalogue"] as const,
  drip: ["drip"] as const,
  wallet: ["sparks-wallet"] as const,
  figurePick: ["catalogue-figure-pick"] as const,
};

/** Everything the three shelves change when one of them moves. */
export async function refreshShelves(client: QueryClient) {
  await Promise.all([
    client.invalidateQueries({ queryKey: marketKeys.catalogue }),
    client.invalidateQueries({ queryKey: marketKeys.drip }),
    client.invalidateQueries({ queryKey: marketKeys.wallet }),
  ]);
}