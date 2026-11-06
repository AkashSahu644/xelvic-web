import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Handshake, ListFilter, Plus } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Spinner } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState } from "@/components/ui/States";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/utils/cn";
import type { Deal } from "@/types/api";
import { counterpart, isClosed, money, stampLine } from "./model";
import { DealRetry, GroupHeading, StatusChip, VerifiedTick } from "./parts";
import { useDeals } from "@/hooks/useDeals";

/**
 * My paid collaborations, both sides of them on one screen.
 *
 * Ported from `app/lib/screens/deals/deals_home.dart`. The list is split by
 * which side I am on — the deals I sent as a company and the deals I received
 * as a creator — because the two are read differently: one is work I am waiting
 * on, the other is work I have been offered. A company also gets the one door
 * into the creator directory from here, since sending a new invite is the thing
 * a company comes to this screen to do.
 *
 * Money is tracked only; nothing here moves a balance.
 */

/** The in-memory cut of the list. Active is everything still in flight; Done is
 * the closed statuses. `isClosed` is the app's `DealStatus.isClosed`. */
type Filter = "all" | "active" | "done";

export function DealsHomeView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [filter, setFilter] = useState<Filter>("all");
  const query = useDeals();

  const deals = useMemo(
    () => (query.data?.pages ?? []).flatMap((page) => page.results),
    [query.data],
  );

  /**
   * Whether the account is in company mode. Read off the cached user when the
   * field is there; a company who has already sent a deal is a company either
   * way, so their own outgoing deals answer the question when the flag does
   * not. A plain creator sees no invite button.
   */
  const iAmCompany = user?.is_company === true || deals.some((deal) => deal.my_role === "company");

  if (query.isLoading) {
    return (
      <>
        <PageHeader title="Deals" back />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="size-6 text-accent" />
        </div>
      </>
    );
  }

  if (query.isError) {
    return (
      <>
        <PageHeader title="Deals" back />
        <DealRetry
          title="Could not load your deals"
          line="Check your connection and try again."
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }

  const shown = deals.filter((deal) => {
    if (filter === "all") return true;
    if (filter === "active") return !isClosed(deal.status);
    return isClosed(deal.status);
  });
  const asCompany = shown.filter((deal) => deal.my_role === "company");
  const asCreator = shown.filter((deal) => deal.my_role !== "company");

  return (
    <>
      <PageHeader
        title="Deals"
        back
        actions={
          iAmCompany ? (
            <Button
              size="sm"
              icon={<Plus className="size-4" aria-hidden />}
              onClick={() => navigate("/app/deals/new")}
            >
              Invite a creator
            </Button>
          ) : null
        }
      />

      {deals.length === 0 ? (
        <div className="pt-[90px]">
          <EmptyState
            icon={<Handshake className="size-6" aria-hidden />}
            title="No deals yet"
            body="Paid collaborations you send or receive show up here."
          />
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[760px] pb-24">
          <div className="flex gap-2 px-4 pb-1 pt-3">
            <FilterChip label="All" on={filter === "all"} onClick={() => setFilter("all")} />
            <FilterChip label="Active" on={filter === "active"} onClick={() => setFilter("active")} />
            <FilterChip label="Done" on={filter === "done"} onClick={() => setFilter("done")} />
          </div>

          {shown.length === 0 ? (
            <div className="pt-[60px]">
              <EmptyState
                icon={<ListFilter className="size-6" aria-hidden />}
                title={filter === "active" ? "Nothing active" : "Nothing here"}
                body="Try another filter."
              />
            </div>
          ) : null}

          {asCompany.length > 0 ? (
            <>
              <GroupHeading>As a company</GroupHeading>
              {asCompany.map((deal) => (
                <DealRow key={deal.id} deal={deal} onOpen={() => navigate(`/app/deals/${deal.id}`)} />
              ))}
            </>
          ) : null}

          {asCreator.length > 0 ? (
            <>
              <GroupHeading>As a creator</GroupHeading>
              {asCreator.map((deal) => (
                <DealRow key={deal.id} deal={deal} onOpen={() => navigate(`/app/deals/${deal.id}`)} />
              ))}
            </>
          ) : null}

          {query.hasNextPage ? (
            <div className="flex justify-center px-4 pt-4">
              <Button
                variant="secondary"
                size="sm"
                loading={query.isFetchingNextPage}
                onClick={() => void query.fetchNextPage()}
              >
                Show more
              </Button>
            </div>
          ) : null}
        </div>
      )}
    </>
  );
}

function FilterChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-4 py-2 text-[13px] font-bold transition",
        on
          ? "border-accent bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent"
          : "border-line bg-card text-dim hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

/**
 * One deal as a tidy row: the other party, the title, the amount, and where the
 * arrangement stands. Tapping it opens the shared timeline.
 */
function DealRow({ deal, onOpen }: { deal: Deal; onOpen: () => void }) {
  const who = counterpart(deal);
  const name = who?.name || who?.username || "Someone";

  return (
    <div className="px-4 pb-2 pt-1">
      <button
        type="button"
        onClick={onOpen}
        className="w-full rounded-2xl border border-line bg-card p-3.5 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]"
      >
        <div className="flex items-center gap-3">
          <Avatar name={name} src={who?.avatar ?? null} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-[15px] font-bold">{name}</span>
              {who?.verified ? <VerifiedTick size={14} /> : null}
            </div>
            {who?.username ? (
              <p className="truncate text-[12px] text-dim" dir="ltr">
                @{who.username}
              </p>
            ) : null}
          </div>
          <StatusChip status={deal.status} />
        </div>

        <p className="mt-3 line-clamp-2 text-[15px] font-semibold leading-[1.3]">
          {deal.title}
        </p>

        <div className="mt-1.5 flex items-baseline justify-between gap-3">
          <span className="text-base font-extrabold">{money(deal.amount, deal.currency)}</span>
          <span className="truncate text-[12px] text-dim">{stampLine(deal.deadline, deal.created_at)}</span>
        </div>
      </button>
    </div>
  );
}
