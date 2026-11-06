import api from "@/config/axios";
import type { UserCard } from "@/types/api";

/**
 * Collaborations.
 *
 * Asking people onto a post, and the search that finds them. The post is named
 * by its own kind — `vibe` or `drop` — so the body is passed through as built
 * rather than split into one shape here.
 */
export const collabsService = {
  /** Asks `users` onto the post the payload names. */
  create: async (payload: Record<string, unknown>): Promise<void> => {
    await api.post("/collabs/", payload);
  },

  /** The people picker behind a collaboration. */
  people: async (q: string): Promise<{ people: UserCard[] }> => {
    const response = await api.get<{ people: UserCard[] }>("/collabs/people/", { params: { q } });
    return response.data;
  },
};

export default collabsService;