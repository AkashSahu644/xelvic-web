import type { QueryClient } from "@tanstack/react-query";
import { uploadAsset } from "@/utils/upload";
import { dealsService } from "@/services/deals.service";
import type { Deal, DealUser } from "@/types/api";
import { DELIVERABLE_KINDS, statusFrom } from "@/features/deals/model";

/**
 * The deals API, spoken from one place — the cache half.
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
 * The three reads are hooks in `hooks/useDeals.ts`; everything in this file is
 * a key, a normaliser, or a write.
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
export function normaliseDeal(raw: unknown): Deal | null {
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

export function dealRows(raw: unknown): Deal[] {
  const list = raw && typeof raw === "object" ? (raw as { results?: unknown }).results : undefined;
  if (!Array.isArray(list)) return [];
  return list.map(normaliseDeal).filter((deal): deal is Deal => deal !== null);
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
  return wrote(queryClient, await dealsService.create(body));
}

export async function acceptDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await dealsService.accept(id));
}

export async function declineDeal(
  queryClient: QueryClient,
  id: string,
  reason: string,
): Promise<Deal> {
  return wrote(queryClient, await dealsService.decline(id, reason));
}

export async function approveDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await dealsService.approve(id));
}

/** Company marks the (tracked-only) payment released. Terminal. */
export async function markDealPaid(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await dealsService.paid(id));
}

export async function cancelDeal(queryClient: QueryClient, id: string): Promise<Deal> {
  return wrote(queryClient, await dealsService.cancel(id));
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
  return wrote(queryClient, await dealsService.deliver(id, asset.id));
}