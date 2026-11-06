import api from "@/config/axios";
import type { CreatorPage, Deal, DealPage, ID } from "@/types/api";

/**
 * Deals.
 *
 * The two lists, one deal, and the nine writes a deal takes from invite to
 * paid. Every method answers with the server's own body — `response.data` and
 * nothing reshaped.
 *
 * The actions are worth reading once: an action route answers the *updated*
 * deal — new status, new timeline, new `can` map — so a write is already the
 * read that follows it, and no caller here has to ask again to find out what
 * changed.
 *
 * Both lists are cursor-paged, and both take the cursor link's own path rather
 * than a page number: `next` is what the last page said to ask for, and it is
 * used as it came. `creators` sends its filter only on the first page, because
 * a cursor link carries the filter that produced it and asking twice would be
 * asking a different question.
 */

/** What a company sends an eligible creator. Money is in whole rupees. */
export interface DealInvite {
  creator: ID;
  title: string;
  brief: string;
  deliverable_kind: string;
  amount: number;
  currency?: string;
  deadline?: string | null;
  agreement?: string;
}

export const dealsService = {
  /** My deals, newest first — both sides of them. `next` is a cursor path. */
  list: async (next?: string | null): Promise<DealPage> => {
    const response = await api.get<DealPage>(next || "/deals/");
    return response.data;
  },

  /** One deal, with its timeline and the permissions this side has on it. */
  detail: async (id: ID): Promise<Deal> => {
    const response = await api.get<Deal>(`/deals/${id}/`);
    return response.data;
  },

  /**
   * The eligible-creator directory. The server decides eligibility; `query`
   * narrows the first page by name or handle, and is not sent on a later one.
   */
  creators: async (next?: string | null, query?: string): Promise<CreatorPage> => {
    const response = await api.get<CreatorPage>(next || "/deals/creators/", {
      params: next || !query ? undefined : { q: query },
    });
    return response.data;
  },

  /** Sends the invite. Answers the deal it created. */
  create: async (input: Record<string, unknown>): Promise<Deal> => {
    const response = await api.post<Deal>("/deals/", input);
    return response.data;
  },

  /** The creator takes it on. */
  accept: async (id: ID): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/accept/`, {});
    return response.data;
  },

  /** The creator turns it down, with the reason the company will read. */
  decline: async (id: ID, reason: string): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/decline/`, { reason });
    return response.data;
  },

  /** The company signs off the delivered work. */
  approve: async (id: ID): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/approve/`, {});
    return response.data;
  },

  /** The company marks the tracked payment released. Terminal. */
  paid: async (id: ID): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/paid/`, {});
    return response.data;
  },

  /** Either side walks away. Terminal. */
  cancel: async (id: ID): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/cancel/`, {});
    return response.data;
  },

  /**
   * Attaches an already-uploaded asset as the deliverable. The upload itself is
   * `uploadAsset` in `lib/upload` — a file moving while somebody waits is a
   * different job from recording that it moved.
   */
  deliver: async (id: ID, asset: ID): Promise<Deal> => {
    const response = await api.post<Deal>(`/deals/${id}/deliver/`, { asset });
    return response.data;
  },

  /**
   * The company's mode switch, on the settings page. The answer is not read —
   * the page re-reads `/auth/me/`, because what changed is the account.
   */
  mode: async (company: boolean): Promise<unknown> => {
    const response = await api.post("/deals/mode/", { company });
    return response.data;
  },
};

export default dealsService;
