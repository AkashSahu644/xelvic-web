import api from "@/config/axios";
import type { AuthTokens, Device, Me, QRStart, QRState, UserCard, Page } from "@/types/api";

/**
 * The account: who is signed in, the doors that sign them in, the switches that
 * change what they look like, and the sessions they are signed in on.
 *
 * `skipAuth: true` marks the roads that must answer before there is an account —
 * signing in, and the QR hand-off a phone uses to approve this browser.
 */
export const authService = {
  // ---- signing in and out -------------------------------------------------

  /** The phone-and-password door. No token is sent: there isn't one yet. */
  login: async (target: string, password: string): Promise<AuthTokens> => {
    const response = await api.post<AuthTokens>("/auth/login/", { target, password }, { skipAuth: true });
    return response.data;
  },

  /** Ends this session. Sends the refresh token when there is one to send. */
  logout: async (refresh?: string | null): Promise<void> => {
    await api.post("/auth/logout/", refresh ? { refresh } : {});
  },

  /** Deletes the account after 30 days unless the sign-in happens again. */
  deactivate: async (password: string): Promise<void> => {
    await api.post("/auth/deactivate/", { password });
  },

  changePassword: async (current_password: string, password: string): Promise<void> => {
    await api.post("/auth/password/change/", { current_password, password });
  },

  // ---- the account itself -------------------------------------------------

  me: async (): Promise<Me> => {
    const response = await api.get<Me>("/auth/me/");
    return response.data;
  },

  updateMe: async (patch: Record<string, unknown>): Promise<Me> => {
    const response = await api.patch<Me>("/auth/me/", patch);
    return response.data;
  },

  setPrivacy: async (patch: Record<string, unknown>): Promise<Me> => {
    const response = await api.patch<Me>("/auth/me/privacy/", patch);
    return response.data;
  },

  setProfessional: async (payload: Record<string, unknown>): Promise<Me> => {
    const response = await api.patch<Me>("/auth/me/professional/", payload);
    return response.data;
  },

  setTheme: async (key: string): Promise<Me> => {
    const response = await api.patch<Me>("/auth/me/theme/", { theme: key });
    return response.data;
  },

  setLogo: async (key: string): Promise<Me> => {
    const response = await api.patch<Me>("/auth/me/logo/", { logo: key });
    return response.data;
  },

  /** The picture off the phone: `kind` is `avatar` or `cover`. */
  uploadImage: async (kind: "avatar" | "cover", form: FormData): Promise<Me> => {
    const response = await api.post<Me>(`/auth/me/${kind}/`, form);
    return response.data;
  },

  removeImage: async (kind: "avatar" | "cover"): Promise<Me> => {
    const response = await api.delete<Me>(`/auth/me/${kind}/`);
    return response.data;
  },

  referral: async <T = unknown>(): Promise<T> => {
    const response = await api.get<T>("/auth/me/referral/");
    return response.data;
  },

  // ---- other people, by handle -------------------------------------------

  /** Somebody's public page. A deleted account answers 410, and says so. */
  user: async (username: string): Promise<unknown> => {
    const response = await api.get(`/auth/users/${encodeURIComponent(username)}/`);
    return response.data;
  },

  /**
   * The people picker. An empty `q` asks for the suggestions the server keeps
   * for somebody who has not typed anything yet.
   */
  searchUsers: async (q?: string): Promise<Page<UserCard>> => {
    const response = await api.get<Page<UserCard>>(
      "/auth/users/search/",
      q === undefined ? undefined : { params: { q } },
    );
    return response.data;
  },

  // ---- the QR hand-off ----------------------------------------------------

  /** A code for the phone to approve, or to show as this account's own QR. */
  qrStart: async (options: { skipAuth?: boolean; signal?: AbortSignal } = {}): Promise<QRStart> => {
    const response = await api.post<QRStart>("/auth/qr/start/", {}, options);
    return response.data;
  },

  qrState: async (session: string, secret: string): Promise<QRState> => {
    const response = await api.get<QRState>(`/auth/qr/${session}/`, {
      skipAuth: true,
      headers: { "X-Qr-Secret": secret },
    });
    return response.data;
  },

  qrCollect: async (session: string, secret: string): Promise<AuthTokens> => {
    const response = await api.post<AuthTokens>(
      `/auth/qr/${session}/collect/`,
      {},
      { skipAuth: true, headers: { "X-Qr-Secret": secret } },
    );
    return response.data;
  },

  qrCode: async (session: string, secret: string): Promise<{ code: string; code_expires_in: number }> => {
    const response = await api.post<{ code: string; code_expires_in: number }>(
      `/auth/qr/${session}/code/`,
      {},
      { skipAuth: true, headers: { "X-Qr-Secret": secret } },
    );
    return response.data;
  },

  // ---- the devices this account is signed in on ---------------------------

  devices: async (): Promise<Device[]> => {
    const response = await api.get<Device[]>("/auth/devices/");
    return response.data;
  },

  /** A removal is a real sign-out; the first device asks for the password. */
  removeDevice: async (id: string, password?: string): Promise<void> => {
    await api.delete(`/auth/devices/${id}/`, {
      data: password ? { password } : undefined,
    });
  },

  /** Ends every other session at once and reports how many it ended. */
  removeOtherDevices: async (): Promise<{ ended?: number; kept?: number }> => {
    const response = await api.delete<{ ended?: number; kept?: number }>("/auth/devices/others/");
    return response.data;
  },
};
export default authService;
