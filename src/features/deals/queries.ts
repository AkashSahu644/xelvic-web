import { useInfiniteQuery, useQuery, type QueryClient } from "@tanstack/react-query";
import { api, apiPathFrom } from "@/lib/api";
import { uploadAsset } from "@/lib/upload";
import type { CreatorPage, Deal, DealPage, DealUser } from "@/types/api";
import { DELIVERABLE_KINDS, statusFrom } from "./model";

/**
 * The deals API, spoken from one place.
 *
 * A straight port of the `Deals` class in `app/lib/deals.dart` —
 * `/api/v1/deals/` and its eight routes — with the app's `fromJson` defaults
 * kept, because two of them are load-bearing: `currency` falls back to `INR` (a
 * deal drawn without it would read "undefined 5000") and `deliverable_kind` to
 * `video`, which is what `DealListView.post` defaults to on the server anyway.
 *
 * What the app does *not* do is re-read a deal after writing to it, and neither
 * does this: every action route answers the updated `Deal` — new status, new
 * timeline, new `can` map — and `applyDeal` drops that answer into the cache.
 * A write is not followed by a read here because the write *is* the read.
 *
 * Both lists are cursor pages. The app reads the first page and stops; the web
 * walks the cursor, so a company with more than thirty deals or a directory
 * with more than thirty eligible creators can reach the rest. That is the one
 * place this deliberately does more than the app rather than less.
 */

export const DEALS_KEY = ["deals"] as const;

export function dealKey(id: string) {
  return ["deals", "deal", id] as const;
}

export function creatorsKey(query: string) {
  return ["deals", "creators", query] as const;
}

/** One cursor page, as both routes answer them. */
export interface DealCursorPage {
  results: Deal[];
  next: string | null;
}

export interface CreatorCursorPage {
  results: DealUser[];
  next: string | null;
}

/** The wire shape, with the app's `Deal.fromJson` defaults applied. */
function normaliseDeal(raw: unknown): Deal | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const id = row.id ? String(row.id) : "";
  if (!id) return null;

  const can: Record<string, boolean> = {};
  if (row.can && typeof row.can === "object") {
    for (const [key, value] of Object.entries(row.can as Record<string, unknown>)) {
      can[key] = value === true;
    }
  }

  const events = Array.isArray(row.events)
    ? row.events.filter(
        (event): event is NonNullable<Deal["events"]>[number] => !!event && typeof event === "object",
      )
    : [];

  return {
    id,
    title: typeof row.title === "string" ? row.title : "",
    brief: typeof row.brief === "string" ? row.brief : "",
    deliverable_kind: typeof row.deliverable_kind === "string" ? row.deliverable_kind : "video",
    amount: typeof row.amount === "number" ? row.amount : 0,
    currency: typeof row.currency === "string" && row.currency ? row.currency : "INR",
    status: statusFrom(typeof row.status === "string" ? row.status : null),
    my_role: typeof row.my_role === "string" ? row.my_role : "",
    agreement: typeof row.agreement === "string" ? row.agreement : "",
    decline_reason: typeof row.decline_reason === "string" ? row.decline_reason : "",
    deadline: (row.deadline as string | null) ?? null,
    agreement_accepted_at: (row.agreement_accepted_at as string | null) ?? null,
    created_at: (row.created_at as string | null) ?? null,
    company: (row.company as Deal["company"]) ?? null,
    creator: (row.creator as Deal["creator"]) ?? null,
    deliverable: (row.deliverable as Deal["deliverable"]) ?? null,
    events,
    can,
  };
}

function dealRows(raw: unknown): Deal[] {
  const list = raw && typeof raw === "object" ? (raw as { results?: unknown }).results : undefined;
  if (!Array.isArray(list)) return [];
  return list.map(normaliseDeal).filter((deal): deal is Deal => deal !== null);
}

/** My deals, newest first. Both sides of them, on one screen. */
export function useDeals(enabled = true) {
  return useInfiniteQuery({
    queryKey: DEALS_KEY,
    initialPageParam: null as string | null,
    queryFn: async ({ pageParam }) => {
      const path = pageParam ? apiPathFrom(pageParam) : "/deals/";
      const page = await api.get<DealPage>(path ?? "/deals/");
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
    queryFn: async () => normaliseDeal(await api.get<unknown>(`/deals/${id}/`)),
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
      const path = pageParam ? apiPathFrom(pageParam) : "/deals/creators/";
      const page = await api.get<CreatorPage>(path ?? "/deals/creators/", {
        query: pageParam || !query ? undefined : { q: query },
      });
      return { results: page?.results ?? [], next: page?.next ?? null } satisfies CreatorCursorPage;
    },
    getNextPageParam: (last) => last.next,
    enabled,
    staleTime: 30_000,
  });
}

/**
 * Put an answered deal where both screens can see it.
 *
 * The detail cache takes it whole. A list row is patched in place only if that
 * row is already loaded — a deal that has just been created is not there yet,
 * and rather than guess where it belongs inside a cursor page this leaves the
 * list alone; the home refetches on mount, which is the read the app does too.
 */
export function applyDeal(queryClient: QueryClient, deal: Deal | null) {
  if (!deal) return;
  queryClient.setQueryData(dealKey(deal.id), deal);
  queryClient.setQueryData<{ pages: DealCursorPage[]; pageParams: unknown[] }>(
    DEALS_KEY,
    (data) => {
      if (!data?.pages) return data;
      let touched = false;
      const pages = data.pages.map((page) => {
        if (!page.results.some((row) => row.id === deal.id)) return page;
        touched = true;
        return { ...page, results: page.results.map((row) => (row.id === deal.id ? deal : row)) };
      });
      return touched ? { ...data, pages } : data;
    },
  );
}

/** The deal a write just answered, normalised, and dropped into the cache. */
async function wrote(queryClient: QueryClient, answer: unknown): Promise<Deal> {
  const deal = normaliseDeal(answer);
  if (!deal) throw new Error("The server answered without a deal.");
  applyDeal(queryClient, deal);
  return deal;
}

export interface InviteInput {
  creator: string;
  title: string;
  brief: string;
  deliverableKind: string;
  amount: number;
  currency?: string;
  deadline?: string | null;
  agreement?: string;
}

/** Company sends an invite/brief to an eligible creator. */
export async function sendInvite(queryClient: QueryClient, input: InviteInput): Promise<Deal> {
  const body: Record<string, unknown> = {
    creator: input.creator,
    title: input.title,
    brief: input.brief,
    deliverable_kind: DELIVERABLE_KINDS.includes(input.deliverableKind as never)
      ? input.deliverableKind
      : "video",
    amount: input.amount,
    currency: input.currency ?? "INR",
    agreement: input.agreement ?? "",
  };
  if (input.deadline) body.deadline = input.deadline.slice(0, 10);
  return wrote(queryClient, await api.post<unknown>("/deals/", body));
}

export async function acceptDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/accept/`, {}));
}

export async function declineDeal(
  queryClient: QueryClient,
  id: string,
  reason: string,
): Promise<Deal> {
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/decline/`, { reason }));
}

export async function approveDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/approve/`, {}));
}

/** Company marks the (tracked-only) payment released. Terminal. */
export async function markDealPaid(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/paid/`, {}));
}

export async function cancelDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/cancel/`, {}));
}

/**
 * Upload one file as an ordinary asset and attach it as the deliverable.
 *
 * The picker and the upload route are the app's own — `chat/assets/`, the same
 * pair a drop or a moment goes out on — so a deliverable is an asset like any
 * other, and the id it comes back with is what `/deals/<id>/deliver/` records.
 * A real progress bar, because this is the one action on a deal that moves a
 * file while somebody waits.
 */
export async function deliverDeal(
  queryClient: QueryClient,
  id: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<Deal> {
  const asset = await uploadAsset(file, { onProgress });
  if (!asset?.id) throw new Error("That upload came back without an id.");
  return wrote(queryClient, await api.post<unknown>(`/deals/${id}/deliver/`, { asset: asset.id }));
}
