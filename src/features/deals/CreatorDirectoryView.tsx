import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, Search, Store, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Spinner } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState } from "@/components/ui/States";
import { count } from "@/utils/format";
import type { DealUser } from "@/types/api";
import { InviteCompose } from "./InviteCompose";
import { DealRetry, VerifiedTick } from "./parts";
import { useCreators } from "@/hooks/useDeals";

/**
 * The eligible-creator directory: who a company may send a brief to.
 *
 * Ported from `app/lib/screens/deals/creator_directory.dart`. The server decides
 * eligibility — public accounts past the follower floor — so this screen only
 * asks and draws, and the search narrows the same list by name or handle.
 *
 * Tapping a creator opens the brief on them, and a brief that actually went out
 * takes this screen off with it: the company lands back on their own deals home
 * rather than on a directory they are done with.
 */
export function CreatorDirectoryView() {
  const navigate = useNavigate();
  const [text, setText] = useState("");

  /**
   * One request per pause in the typing rather than one per keystroke — the
   * app's 300ms debounce. A late answer for an earlier query cannot overwrite a
   * later one: each query is its own react-query entry, and the row list below
   * reads only the entry for what is in the box now.
   */
  const [query, setQuery] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [text]);

  const creators = useCreators(query);
  const [chosen, setChosen] = useState<DealUser | null>(null);

  const rows = useMemo(
    () => (creators.data?.pages ?? []).flatMap((page) => page.results),
    [creators.data],
  );

  return (
    <>
      <PageHeader
        title="Invite a creator"
        back
        actions={creators.isFetching && !creators.isLoading ? <Spinner className="size-4" /> : null}
      />

      <div className="mx-auto w-full max-w-[760px]">
        <div className="px-4 pb-2.5 pt-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-dim" aria-hidden />
            <input
              className="field w-full pl-10 pr-10 text-[15.5px]"
              placeholder="Search creators by name or @handle"
              value={text}
              onChange={(event) => setText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") setQuery(event.currentTarget.value.trim());
              }}
              type="search"
            />
            {text ? (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-dim transition hover:text-ink"
                aria-label="Clear"
                onClick={() => {
                  setText("");
                  setQuery("");
                }}
              >
                <X className="size-[18px]" />
              </button>
            ) : null}
          </div>
        </div>

        {creators.isLoading ? (
          <div className="flex min-h-[30vh] items-center justify-center">
            <Spinner className="size-6 text-accent" />
          </div>
        ) : creators.isError && rows.length === 0 ? (
          <DealRetry
            title="Could not load creators"
            line={query ? undefined : "Cannot reach the server."}
            onRetry={() => void creators.refetch()}
          />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<Store className="size-6" aria-hidden />}
            title="No eligible creators"
            body={
              query
                ? `Nobody eligible goes by "${query}".`
                : "Public creators with 2k followers or more show up here."
            }
          />
        ) : (
          <ul>
            {rows.map((creator, index) => (
              <li key={creator.id}>
                {index > 0 ? <div className="ml-[82px] h-px bg-line" /> : null}
                <button
                  type="button"
                  onClick={() => setChosen(creator)}
                  className="flex w-full items-center gap-4 px-4 py-1.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                >
                  <Avatar name={creator.name || creator.username} src={creator.avatar} size={48} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                      <span className="truncate text-base font-bold">
                        {creator.name || creator.username}
                      </span>
                      {creator.verified ? <VerifiedTick size={15} /> : null}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-dim" dir="ltr">
                      @{creator.username}
                    </span>
                    <span className="block text-[12.5px] text-dim">
                      {count(creator.followers_count ?? 0)} followers
                    </span>
                  </span>
                  <ChevronRight className="size-5 shrink-0 text-dim" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        {creators.hasNextPage ? (
          <div className="flex justify-center px-4 py-4 pb-24">
            <Button
              variant="secondary"
              size="sm"
              loading={creators.isFetchingNextPage}
              onClick={() => void creators.fetchNextPage()}
            >
              Show more
            </Button>
          </div>
        ) : null}
      </div>

      {/* A brief that actually went out takes this screen off with it, the way
          the app pops the directory rather than returning to it. */}
      <InviteCompose
        creator={chosen}
        onClose={() => setChosen(null)}
        onSent={() => {
          setChosen(null);
          navigate("/app/deals");
        }}
      />
    </>
  );
}
