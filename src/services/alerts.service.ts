import api from "@/config/axios";
import type { AlertFlags, AlertsPageData } from "@/types/api";

/**
 * Alerts.
 *
 * One method per road, and every method answers with the server's own body —
 * `response.data` and nothing reshaped. That is the rule for every service in
 * this folder: a service decides *where* a request goes and *what shape* goes
 * with it, and never invents a value the server did not send.
 */
export const alertsService = {
  /** The list as the server has it, newest first. */
  list: async (): Promise<AlertsPageData> => {
    const response = await api.get<AlertsPageData>("/alerts/");
    return response.data;
  },

  /** One older page, by the cursor path the server handed back in `next`. */
  page: async (path: string): Promise<AlertsPageData> => {
    const response = await api.get<AlertsPageData>(path);
    return response.data;
  },

  /** Marks everything read; answers with the unread count that is left. */
  markRead: async (): Promise<{ unread?: number }> => {
    const response = await api.post<{ unread?: number }>("/alerts/read/", {});
    return response.data;
  },

  /** The switchboard on the notifications page. */
  setFlags: async (flags: AlertFlags): Promise<AlertFlags> => {
    const response = await api.patch<AlertFlags>("/alerts/flags/", flags);
    return response.data;
  },
};

export default alertsService;
