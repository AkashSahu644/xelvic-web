import api from "@/config/axios";
import type { SavedShelf } from "@/types/api";

/** Kept things — the shelf, the ids behind it, and the one write. */
export const savedService = {
  /** Every id this account has kept, so a card can draw its own state. */
  ids: async (): Promise<{ ids: string[] }> => {
    const response = await api.get<{ ids: string[] }>("/saved/ids/");
    return response.data;
  },

  /** The shelf itself, with the rows the ids only name. */
  shelf: async (): Promise<SavedShelf> => {
    const response = await api.get<SavedShelf>("/saved/");
    return response.data;
  },

  /**
   * Keep or let go. `on` is stated rather than toggled, so a retry after a lost
   * reply cannot land the opposite of what the thumb meant.
   */
  set: async (
    kind: string,
    id: string,
    on: boolean,
  ): Promise<{ saved: boolean; kind: string; id: string }> => {
    const response = await api.post<{ saved: boolean; kind: string; id: string }>("/saved/", {
      kind,
      id,
      on,
    });
    return response.data;
  },
};

export default savedService;
