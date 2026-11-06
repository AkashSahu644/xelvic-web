import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { API_BASE } from "@/config/env";
import type { Drop, Page } from "@/types/api";
import { dropsFeedQuery, dropsVibesQuery } from "./feedQueries";

/**
 * The regression these two options objects exist for.
 *
 * The error was `options.getNextPageParam is not a function`, intermittently,
 * on the feed. It needed three things at once — a prefetch that re-read a feed
 * older than its `staleTime`, more than one page already in hand, and an
 * invalidate afterwards — which is why it turned up sometimes and never on a
 * feed that had just been opened. `feedQueries.ts` says why the third thing
 * then read a page rule that was not there; what is checked here is the part a
 * unit test can hold: the options the prefetcher warms with carry the rule, and
 * a refetch driven from the cache over a two-page feed leaves the query well.
 *
 * The third case was checked against the old shape once, as a scratch test that
 * stated the prefetch without the rule: the query went to `status: "error"`
 * with exactly `options.getNextPageParam is not a function`, and back to
 * `success` when the rule was stated — so this is the error that was reported
 * and this is the line it came in on.
 */

const mock = vi.hoisted(() => ({
  asked: [] as string[],
  page: { results: [], next: null, previous: null } as Page<Drop>,
}));

vi.mock("@/services/drops.service", () => ({
  DROPS_FEED_FIRST: "/drops/?seen=strict",
  VIBES_FEED_FIRST: "/drops/vibes/?limit=8",
  dropsService: {
    feed: async (next?: string) => {
      mock.asked.push(next ?? "(no cursor)");
      return mock.page;
    },
    vibesFeed: async () => mock.page,
  },
}));

const FIRST_PAGE: Page<Drop> = {
  results: [],
  next: `${API_BASE}/drops/?seen=strict&cursor=abc`,
  previous: null,
};

describe("the feed's own query options", () => {
  it("carry the next-page rule for both shelves", () => {
    expect(typeof dropsFeedQuery.getNextPageParam).toBe("function");
    expect(typeof dropsVibesQuery.getNextPageParam).toBe("function");
  });

  it("turn the address the server handed out into a path to ask for", () => {
    expect(dropsFeedQuery.getNextPageParam(FIRST_PAGE)).toBe(
      "/drops/?seen=strict&cursor=abc",
    );
    expect(
      dropsFeedQuery.getNextPageParam({ results: [], next: null, previous: null }),
    ).toBeNull();
  });

  it("leave a feed with two pages in hand unharmed by an invalidate", async () => {
    mock.asked.length = 0;
    // Every page this shelf hands back carries the same cursor, which is all
    // the refetch below needs: page one read again, then the rule asked for the
    // page after it.
    mock.page = {
      results: [],
      next: `${API_BASE}/drops/?seen=strict&cursor=abc`,
      previous: null,
    };
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    // The prefetch, exactly as the route runs it: the same object the page
    // reads. This is the call that used to leave the query's options without a
    // next-page rule in them.
    await client.prefetchInfiniteQuery(dropsFeedQuery);

    // A reader who has scrolled a second hand into the feed.
    client.setQueryData(dropsFeedQuery.queryKey, {
      pages: [FIRST_PAGE, { results: [], next: null, previous: null }],
      pageParams: [undefined, "/drops/?seen=strict&cursor=abc"],
    });

    // `refetchType: "all"` stands in for the page being mounted: a real
    // invalidate is `{ queryKey: ["drops"] }`, which refetches the active
    // queries, and both arrive at the same `query.fetch(void 0, …)` — the call
    // that reads the *query's* options rather than the page's.
    await client.invalidateQueries({ queryKey: ["drops"], refetchType: "all" });

    expect(client.getQueryState(dropsFeedQuery.queryKey)?.error ?? null).toBeNull();
    expect(client.getQueryState(dropsFeedQuery.queryKey)?.status).toBe("success");
    // The first ask is the prefetch. The invalidate then re-reads page one and
    // asks the rule for the page after it — the ask a missing rule made
    // impossible, because the behaviour read `options.getNextPageParam` before
    // it reached this line.
    expect(mock.asked).toEqual([
      "/drops/?seen=strict",
      "/drops/?seen=strict",
      "/drops/?seen=strict&cursor=abc",
    ]);
  });
});
