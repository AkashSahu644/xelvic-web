/**
 * The drops feed's two infinite queries, stated in one place.
 *
 * They were stated twice — once by the page that reads them and once by the
 * prefetcher that warms them — and the two copies were one property apart: the
 * prefetcher left out `getNextPageParam`. That is not a harmless omission,
 * because of how this library keeps a query's options:
 *
 * - `Query.fetch(options)` calls `setOptions(options)` when it is given any,
 *   and `setOptions` does not merge — it *replaces*
 *   (`query-core/query.js`: `this.options = { ...this.#defaultOptions,
 *   ...options }`).
 * - A refetch driven from the cache rather than from a mounted observer —
 *   `invalidateQueries({ queryKey: ["drops"] })` → `refetchQueries` →
 *   `query.fetch(void 0, …)`, which is what liking, keeping, commenting or
 *   hiding a drop does — fetches with *the query's* options, not the page's.
 * - `InfiniteQueryBehavior` re-fetches as many pages as are already in hand
 *   and asks `options.getNextPageParam(...)` for every page after the first,
 *   unguarded (`infiniteQueryBehavior.js`).
 *
 * So: a prefetch that lands while the cached feed is stale enough to re-read
 * (past its `staleTime`) and *already more than one page long* handed the query
 * an options object with no `getNextPageParam` in it, and the next invalidate
 * threw `options.getNextPageParam is not a function` — intermittently, because
 * it takes both halves of that sentence to be true, and neither is true on a
 * feed that was just opened.
 *
 * One object, read by both, is what makes the two copies unable to drift. The
 * prefetcher also inherits this `staleTime` (it used to warm on a shorter one):
 * the page treats an answer under a minute old as the answer, so warming a
 * query the page will read as fresh is the whole point and re-asking behind the
 * page's back is the waste this avoids.
 */

import { apiPathFrom } from "@/config/urls";
import {
  DROPS_FEED_FIRST,
  dropsService,
  VIBES_FEED_FIRST,
} from "@/services/drops.service";
import type { Drop, Page } from "@/types/api";

/**
 * How long a page of the feed is the answer.
 *
 * Coming back to the feed inside a minute is coming back to the page that was
 * already read. Every navigation used to re-ask for the first page and draw
 * skeletons over a feed the tab still had in hand.
 */
export const DROPS_FEED_STALE_MS = 60_000;

/**
 * The feed itself. `seen=strict` and the reason for it are in
 * `drops.service.ts`, beside the first ask.
 */
export const dropsFeedQuery = {
  queryKey: ["drops", "feed"] as const,
  queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
    dropsService.feed(pageParam),
  initialPageParam: DROPS_FEED_FIRST as string | undefined,
  getNextPageParam: (last: Page<Drop>) => apiPathFrom(last.next),
  staleTime: DROPS_FEED_STALE_MS,
};

/**
 * The Vibes shelf. The shelf is dealt a page at a time and the walk keeps
 * asking while it is being read — `Drops.vibeBatch` ahead, in the app. The
 * first hand is the eight `VIBES_FEED_FIRST` asks for and the walk is not
 * supposed to end there: a thumb with nothing after it is the app's own
 * complaint about a shelf that stopped.
 */
export const dropsVibesQuery = {
  queryKey: ["drops", "vibes"] as const,
  queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
    dropsService.vibesFeed(pageParam),
  initialPageParam: VIBES_FEED_FIRST as string | undefined,
  getNextPageParam: (last: Page<Drop>) => apiPathFrom(last.next),
  staleTime: DROPS_FEED_STALE_MS,
};
