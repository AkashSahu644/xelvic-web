import { useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { CloudOff, Hash } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { Square } from "@/features/profile/ProfileShelf";
import { apiPathFrom } from "@/config/urls";
import { dropsService } from "@/services/drops.service";
import { errorMessage } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Everything filed under one word, as a grid.
 *
 * Ported from `TagFeedScreen` in `screens/tag_feed.dart`. A tag is a shelf the
 * whole app shares — a word many people put on many posts — and this is the way
 * onto it: tap a `#word` anywhere a caption is drawn and this opens, newest
 * first. It is a grid rather than a feed for the same reason a profile's Drops
 * are: a shelf is a place to find a thing, and the feed is the thing found's own
 * screen. A tile is the profile grid's own square, so a word's shelf and a
 * person's shelf cannot read as two different kinds of page.
 *
 * `GET /tags/{tag}/` answers `{tag, count, results, next}` and has already been
 * through the same gate the feed is — a private account's post, a blocked one's,
 * a sensitive one's are not handed to this reader at all — so nothing here
 * decides who may see what. `count` is the word's all-time tally and is
 * deliberately *not* what is on this page: it is the same number the trending
 * rail draws, so the word's page and its chip can never disagree.
 *
 * An unknown word answers an empty list rather than a 404 — a word nobody has
 * used is a page with nothing on it yet, and it says so.
 */
export function TagPage() {
  const { tag = "" } = useParams();
  const { t } = usePreferences();
  // The server normalises the word itself (`/Sunset` and `/sunset` are one
  // shelf), so what is read is what was typed; what is *drawn* is the server's
  // own spelling once it answers.
  const word = decodeURIComponent(tag);

  const feed = useInfiniteQuery({
    queryKey: ["tag", word.toLowerCase()],
    queryFn: ({ pageParam }) =>
      dropsService.tags(word, String(pageParam)),
    initialPageParam: `/tags/${encodeURIComponent(word)}/`,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(word),
  });

  const posts = useMemo(() => {
    // A tie can only name one row once, but the pages are read in order and a
    // repeat would be two identical tiles almost touching — the feed dedupes for
    // the same reason.
    const seen = new Set<string>();
    return (feed.data?.pages ?? []).flatMap((page) => page.results ?? []).filter((drop) => {
      if (seen.has(String(drop.id))) return false;
      seen.add(String(drop.id));
      return true;
    });
  }, [feed.data]);

  const shown = feed.data?.pages?.[0]?.tag || word;
  const total = feed.data?.pages?.[0]?.count ?? 0;

  // The next page, asked for as the foot comes into view. The app listens to
  // the scroll of its own list and fetches at 400 points from the bottom; a
  // sentinel with the same margin says the same thing in a browser.
  const foot = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feed;
  useEffect(() => {
    const node = foot.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void fetchNextPage();
      },
      // Farther out than the phone's 400 points — see `DropsPage`: the request's
      // latency is paid before the reader reaches the foot, not after.
      { rootMargin: "1400px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, posts.length]);

  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <PageHeader title={`#${shown}`} back />

      {feed.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : feed.isError ? (
        <Blank
          top=""
          icon={<CloudOff className="size-[46px]" />}
          title={t("Could not load")}
          line={errorMessage(feed.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void feed.refetch()}>
              {t("Try again")}
            </button>
          }
        />
      ) : !posts.length ? (
        <Blank
          top=""
          icon={<Hash className="size-[46px]" />}
          title={`Nothing under #${shown} yet`}
          line={t("When somebody uses this tag, it shows up here.")}
        />
      ) : (
        <>
          {/* The word's all-time tally, said once under the title — the page's
              tiles are one page of it, and a grid that never said how much
              shelf there was would read as the whole of it. */}
          <p className="px-2 pb-1 text-[11.5px] font-semibold text-dim">
            {total === 1 ? "1 post" : `${total.toLocaleString()} posts`}
          </p>
          <div className="grid grid-cols-3 gap-1 p-1">
            {posts.map((drop) => (
              <Square key={String(drop.id)} drop={drop} />
            ))}
          </div>
          {feed.isFetchingNextPage ? (
            <div className="flex justify-center py-4">
              <span className="size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : null}
        </>
      )}
      <div ref={foot} className="h-px" />
    </div>
  );
}