import api from "@/config/axios";
import type { ChatGate, Relation, RequestsBundle, UserCard } from "@/types/api";

/**
 * The three answers `/social/users/{id}/follow|withdraw|block/` can give.
 *
 * Two screens read these roads and each declared its own narrower shape — the
 * card's button needs `relation`/`cta`/`action`, the person's page also wants
 * `user` and `gate`. Every field is optional here so one type serves both, and
 * a caller that knows better can still say so: `socialService.follow<TheirType>()`.
 */
export interface SocialState {
  relation?: Relation | { following?: boolean; requested?: boolean; blocked?: boolean } | null;
  cta?: string | null;
  action?: string | null;
  gate?: ChatGate | null;
  user?: UserCard;
}

export const socialService = {
  /**
   * Somebody's page as the social side sees it — the gate a card's button reads
   * before it knows whether to offer a keep.
   */
  user: async <T = unknown>(username: string): Promise<T> => {
    const response = await api.get<T>(`/social/users/${encodeURIComponent(username)}/`);
    return response.data;
  },

  /** The people picker behind an `@`. */
  mentionable: async (q: string): Promise<UserCard[]> => {
    const response = await api.get<UserCard[]>("/social/mentionable/", { params: { q } });
    return response.data;
  },

  follow: async <T = SocialState>(userId: string): Promise<T> => {
    const response = await api.post<T>(`/social/users/${userId}/follow/`, {});
    return response.data;
  },

  /** Lets somebody go. The server answers with the state that is left. */
  unfollow: async <T = SocialState>(userId: string): Promise<T> => {
    const response = await api.delete<T>(`/social/users/${userId}/follow/`);
    return response.data;
  },

  /** Takes back a request that has not been answered yet. */
  withdraw: async <T = SocialState>(userId: string): Promise<T> => {
    const response = await api.post<T>(`/social/users/${userId}/withdraw/`, {});
    return response.data;
  },

  block: async <T = SocialState>(userId: string): Promise<T> => {
    const response = await api.post<T>(`/social/users/${userId}/block/`, {});
    return response.data;
  },

  unblock: async <T = SocialState>(userId: string): Promise<T> => {
    const response = await api.delete<T>(`/social/users/${userId}/block/`);
    return response.data;
  },

  /** Answers a follow request: `keep` accepts, anything else declines quietly. */
  answerRequest: async (userId: string, keep: boolean): Promise<void> => {
    await api.post(`/social/users/${userId}/${keep ? "accept" : "decline"}/`, {});
  },

  /** Takes somebody off my own Crew — one of my followers, and nobody else's. */
  remove: async (userId: string): Promise<void> => {
    await api.post(`/social/users/${userId}/remove/`, {});
  },

  /** Says this account looked at that page. Fire-and-forget by design. */
  seen: async (userId: string): Promise<void> => {
    await api.post(`/social/users/${userId}/view/`, {});
  },

  mutuals: async (userId: string): Promise<{ count?: number; people?: UserCard[] }> => {
    const response = await api.get<{ count?: number; people?: UserCard[] }>(
      `/social/users/${userId}/mutuals/`,
    );
    return response.data;
  },

  /** `which` is `following` or `followers`. */
  crew: async (userId: string, which: "following" | "followers"): Promise<UserCard[]> => {
    const response = await api.get<UserCard[]>(`/social/users/${userId}/crew/${which}/`);
    return response.data;
  },

  insights: async (userId: string, days: number | string): Promise<unknown> => {
    const response = await api.get(`/social/users/${userId}/insights/?days=${days}&visitors=0`);
    return response.data;
  },

  requests: async (): Promise<RequestsBundle> => {
    const response = await api.get<RequestsBundle>("/social/requests/");
    return response.data;
  },

  requestCount: async (): Promise<{ pending: number }> => {
    const response = await api.get<{ pending: number }>("/social/requests/count/");
    return response.data;
  },

  /** The reasons a report may give — read, never written here. */
  reportReasons: async <T = unknown>(): Promise<T> => {
    const response = await api.get<T>("/social/report/");
    return response.data;
  },

  report: async (payload: Record<string, unknown>): Promise<{ ok: boolean; new: boolean }> => {
    const response = await api.post<{ ok: boolean; new: boolean }>("/social/report/", payload);
    return response.data;
  },
};
export default socialService;
