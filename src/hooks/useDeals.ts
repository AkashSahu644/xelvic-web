import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiPathFrom } from "@/config/urls";
import { dealsService } from "@/services/deals.service";
import {
  DEALS_KEY,
  creatorsKey,
  dealKey,
  dealRows,
  normaliseDeal,
  type CreatorCursorPage,
  type DealCursorPage,
} from "@/store/deals";

export type { CreatorCursorPage, DealCursorPage } from "@/store/deals";

/**
 * The deals API's three reads.
 *
 * Both lists are cursor pages. The app reads the first page and stops; the web
 * walks the cursor, so a company with more than thirty deals or a directory
 * with more than thirty eligible creators can reach the rest. That is the one
 * place this deliberately does more than the app rather than less.
 *
 * The normalisers and the writes are in `store/deals.ts`, so a screen that
 * only wants to act on a deal does not import a query hook to get them.
 */

/** My deals, newest first. Both sides of them, on one screen. */
export function useDeals(enabled = true) {
  return useInfiniteQuery({
    queryKey: DEALS_KEY,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const page = await dealsService.list(pageParam ? apiPathFrom(pageParam) : null);
      return { results: dealRows(page), next: page?.next ?? null } satisfies DealCursorPage;
    },
    getNextPageParam: (last) => last.next,
    enabled,
    staleTime: 15_000,
    // The app re-reads this list every time a detail or the directory closes,
    // because that is where a status moves. Mounting the route again is the
    // web's version of coming back, and it is the same moment.
    refetchOnMount: "always",
  });
}

export function useDeal(id: string | undefined, enabled = true) {
  return useQuery({
    queryKey: dealKey(id ?? ""),
    queryFn: async () => normaliseDeal(await dealsService.detail(id ?? "")),
    enabled: enabled && !!id,
    staleTime: 15_000,
  });
}

/**
 * The eligible-creator directory. The server decides eligibility — public
 * accounts past the follower floor — so this only asks and draws, and `query`
 * narrows the same list by name or handle server-side.
 */
export function useCreators(query: string, enabled = true) {
  return useInfiniteQuery({
    queryKey: creatorsKey(query),
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      // A cursor link carries the filter that produced it, so a later page is
      // asked for by URL alone and the query is not sent twice.
      const page = await dealsService.creators(
        pageParam ? apiPathFrom(pageParam) : null,
        query,
      );
      return { results: page?.results ?? [], next: page?.next ?? null } satisfies CreatorCursorPage;
    },
    getNextPageParam: (last) => last.next,
    enabled,
    staleTime: 30_000,
  });
}