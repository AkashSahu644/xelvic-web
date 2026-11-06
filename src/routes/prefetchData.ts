import type { QueryClient } from "@tanstack/react-query";
import { dropsFeedQuery, dropsVibesQuery } from "@/features/drops/feedQueries";
import { audioService } from "@/services/audio.service";
import { chatService } from "@/services/chat.service";
import { momentsService } from "@/services/moments.service";
import { spacesService } from "@/services/spaces.service";

/**
 * The first read behind a tab, started a beat before the tab is opened.
 *
 * `preloadRoute` (in `lazyPages.tsx`) fetches the page's *code*. This file
 * fetches the page's *answer*, and both are needed for the click to feel
 * instant: a tab whose chunk is warm but whose data is cold still draws a
 * skeleton for as long as the API takes, which on this server is the larger
 * half of the wait.
 *
 * The drops feed's two entries warm the page's *own* options object
 * (`features/drops/feedQueries.ts`) instead of restating it. Every other entry
 * here copies a key and a fetch out of a page that keeps its options inline, and
 * a key that drifts in that copying warms a row nobody reads: one wasted
 * request, and nothing worse than that. The drops feed was that kind of entry
 * until 2026-11-02, and it was worse: an option dropped in the copying — there,
 * `getNextPageParam` — is not a wasted request, it is a query whose own options
 * are wrong from then on. `feedQueries.ts` says the whole of it.
 *
 * Only the five shell tabs are here, and only their first page: prefetching a
 * feed's second page on hover would spend the reader's data on a page they may
 * not reach, while the first page is the one the tab cannot open without.
 */

type Prefetcher = (client: QueryClient) => void;

const PREFETCHERS: Record<string, Prefetcher> = {
  "/app/drops": (client) => {
    // The page's own options object, not a second copy of it. A prefetch that
    // restates a query's options is a prefetch that can disagree with the page
    // about them, and this one did: it left out `getNextPageParam`, which
    // replaced the query's options with an object that had no next-page rule in
    // it and threw on the feed's next invalidate. `feedQueries.ts` says the
    // whole of it.
    void client.prefetchInfiniteQuery(dropsFeedQuery);
    void client.prefetchInfiniteQuery(dropsVibesQuery);
  },
  "/app/moments": (client) => {
    void client.prefetchQuery({
      queryKey: ["moments-tray"],
      queryFn: () => momentsService.tray(),
      staleTime: 30_000,
    });
    void client.prefetchQuery({
      queryKey: ["moments-mine"],
      queryFn: () => momentsService.mine(),
      staleTime: 30_000,
    });
  },
  "/app/convo": (client) => {
    void client.prefetchQuery({
      queryKey: ["threads"],
      queryFn: () => chatService.threads(),
      staleTime: 15_000,
    });
  },
  "/app/audio": (client) => {
    void client.prefetchQuery({
      queryKey: ["audio-home"],
      queryFn: () => audioService.home(),
      staleTime: 30_000,
    });
    void client.prefetchQuery({
      queryKey: ["audio-categories"],
      queryFn: () => audioService.categories(),
      staleTime: 60_000,
    });
  },
  "/app/live": (client) => {
    void client.prefetchQuery({
      queryKey: ["rooms", "live"],
      queryFn: () => spacesService.shelf("live"),
      staleTime: 15_000,
    });
  },
};

/** Start the reads a route needs, for a path the shell already has in hand. */
export function prefetchRouteData(client: QueryClient, pathname: string): void {
  const bare = pathname.split(/[?#]/, 1)[0] ?? "";
  const path = bare.replace(/\/+$/, "") || "/";
  PREFETCHERS[path]?.(client);
}