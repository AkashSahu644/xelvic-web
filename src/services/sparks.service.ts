import api from "@/config/axios";
import type { WalletData } from "@/features/sparks/types";
import type { PurchaseAnswer } from "@/features/marketplace/types";
import type { Spark, UserCard } from "@/types/api";

/**
 * Sparks.
 *
 * The runs themselves, the wallet they pay into, and the leaderboard that ranks
 * them. Every method answers with the server's own body — `response.data` and
 * nothing reshaped — which matters more here than anywhere else in the folder:
 * a run's number, a rank and a balance are all the server's to say, and a
 * friendlier shape invented in the browser would only disagree with it.
 *
 * `SparksData` and `LeaderboardBook` are written here because until now each
 * lived inside the one screen that read it; they are the same shapes, moved to
 * the place the request is made from.
 */

/** The three numbers a restore answers with, beside the run it brought back. */
export interface WalletBlock {
  balance: number;
  earned: number;
  spent: number;
  owned: string[];
}

/** The book a run draws when the offer comes back as a card. */
export interface SparksData {
  sparks: Spark[];
  total: number;
  wallet: {
    balance: number;
    earned: number;
    spent: number;
    owned: string[];
    owned_logos?: string[];
  };
  catalog?: unknown;
}

/** A month's row. `day_row` — no rank, because the list order is the ranking. */
export interface LeaderPerson {
  thread_id?: string | null;
  days?: number | null;
  award?: string | null;
  last?: string | null;
  me?: boolean;
  other?: UserCard | null;
}

/** A year's row, and either board's pinned self. */
export interface LeaderRank {
  rank?: number | null;
  days?: number | null;
  award?: string | null;
  user?: UserCard | null;
  me?: boolean;
}

/** Both boards, as ranked. This page sorts nothing and breaks no ties. */
export interface LeaderboardBook {
  monthly: {
    month?: string;
    people: LeaderPerson[];
    me?: LeaderRank | null;
    previous?: { month?: string; winner?: LeaderPerson | null } | null;
  };
  yearly: {
    year?: number | null;
    people: LeaderRank[];
    me?: LeaderRank | null;
  };
}

export const sparksService = {
  /** Every run this account keeps, and the purse they have paid into. */
  list: async (): Promise<SparksData> => {
    const response = await api.get<SparksData>("/sparks/");
    return response.data;
  },

  /**
   * One conversation's run, read fresh.
   *
   * The sheet re-reads rather than taking the list's copy, because the list's is
   * as old as the last fetch and the two things the sheet is for — how much of
   * today is left, and whether today has been kept — change while nobody is
   * looking at them.
   *
   * Null for a chat that has no spark, which is not a failure: the server
   * answers the same shape with no `spark` in it, and the phone reads it the
   * same way (`Sparks.one`).
   */
  one: async (threadId: string): Promise<Spark | null> => {
    const response = await api.get<{ spark?: Spark | null }>(
      `/sparks/threads/${threadId}/`,
    );
    return response.data.spark ?? null;
  },

  /**
   * Hide this one person's spark from me, or show it again. Never theirs.
   *
   * Hidden is mine alone: the run keeps counting for the two of us exactly as it
   * did, nothing breaks and nothing is said in the conversation. The only thing
   * this changes is whether I am shown the mark.
   *
   * The reply carries the run, so the switch and the row behind it move in the
   * frame the tap landed in rather than after another round trip.
   */
  setOff: async (threadId: string, off: boolean): Promise<Spark | null> => {
    const response = await api.post<{ spark?: Spark | null }>(
      `/sparks/threads/${threadId}/off/`,
      { off },
    );
    return response.data.spark ?? null;
  },

  /**
   * Buy a broken run back, out of the wallet, inside the two days it is held.
   *
   * What it costs and what comes back are the server's: all this sends is which
   * conversation, because a client that could name its own price could name
   * nothing. The reply carries the wallet as well as the run, which is what the
   * sheet reads its next balance off.
   *
   * A refusal is thrown rather than swallowed and the server's own sentence is
   * what it throws — "Not enough in the wallet." is the whole of what the person
   * needs to read, and a restore that failed quietly would be a button that did
   * nothing.
   */
  restore: async (
    threadId: string,
  ): Promise<{ spark: Spark | null; wallet: WalletBlock | null }> => {
    const response = await api.post<{ spark?: Spark | null; wallet?: WalletBlock }>(
      `/sparks/threads/${threadId}/restore/`,
    );
    return {
      spark: response.data.spark ?? null,
      wallet: response.data.wallet ?? null,
    };
  },

  /** Whose run is strongest — among friends this month, app-wide this year. */
  leaderboard: async (): Promise<LeaderboardBook> => {
    const response = await api.get<LeaderboardBook>("/sparks/leaderboard/");
    return response.data;
  },

  /** The ledger: balance, everything earned and spent, and what it bought. */
  wallet: async (): Promise<WalletData> => {
    const response = await api.get<WalletData>("/sparks/wallet/");
    return response.data;
  },

  /** Buys a theme by key. The answer carries the price and the balance left. */
  buy: async (key: string): Promise<PurchaseAnswer> => {
    const response = await api.post<PurchaseAnswer>("/sparks/wallet/buy/", { key });
    return response.data;
  },

  /** Buys a logo by key, on the same purse. */
  buyLogo: async (key: string): Promise<PurchaseAnswer> => {
    const response = await api.post<PurchaseAnswer>("/sparks/wallet/buy-logo/", { key });
    return response.data;
  },
};

export default sparksService;
