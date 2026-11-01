import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useSocketEvent, type SocketFrame } from "@/providers/SocketProvider";
import type { Alert, AlertFlags, AlertsPageData } from "@/types/api";

export const ALERTS_KEY = ["alerts"] as const;

function frameData(frame: SocketFrame): Record<string, unknown> {
  return frame.data && typeof frame.data === "object" ? (frame.data as Record<string, unknown>) : {};
}

/**
 * One alert off the wire, in the shape the row is drawn from.
 *
 * Exported because the in-app banner and the background tab's system
 * notification read the same `alert.new` frame this list reads, and a frame
 * parsed two ways is two drawings of one row that can disagree.
 */
export function normaliseAlert(raw: unknown): Alert | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<Alert> & { id?: unknown; kind?: unknown };
  if (!row.id || !row.kind) return null;
  return {
    id: String(row.id),
    kind: String(row.kind),
    about: row.about ? String(row.about) : "you",
    body: row.body ? String(row.body) : "",
    at: row.at ? String(row.at) : null,
    read: row.read === true,
    rung: typeof row.rung === "number" ? row.rung : null,
    kept: typeof row.kept === "boolean" ? row.kept : null,
    actor: row.actor ?? null,
    target: row.target ?? null,
    preview: row.preview ?? null,
    // The shelf's own link, carried through untouched. A frame can name a route
    // the list row then opens; dropping it here is how a `studio` alert would
    // arrive live with nowhere to go.
    route: typeof row.route === "string" ? row.route : "",
  };
}

export function applyAlertFrame(queryClient: QueryClient, frame: SocketFrame) {
  const current = queryClient.getQueryData<AlertsPageData>(ALERTS_KEY);
  if (!current) return;
  const data = frameData(frame);

  if (frame.event === "alert.read") {
    const unread = typeof data.unread === "number" ? data.unread : null;
    if (unread == null) return;
    queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, {
      ...current,
      unread,
      results: current.results.map((row) => (row.read ? row : { ...row, read: true })),
    });
    return;
  }

  if (frame.event !== "alert.new") return;
  const fresh = normaliseAlert(data.alert);
  if (!fresh) return;
  if (current.results.some((row) => row.id === fresh.id)) return;
  queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, {
    ...current,
    results: [fresh, ...current.results],
    unread: current.unread + 1,
  });
}

export function useAlerts(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => api.get<AlertsPageData>("/alerts/"),
    enabled,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  useSocketEvent(["alert.new", "alert.read"], (frame) => applyAlertFrame(queryClient, frame));

  return query;
}

export async function markAlertsRead(queryClient: QueryClient) {
  const current = queryClient.getQueryData<AlertsPageData>(ALERTS_KEY);
  if (!current || current.unread <= 0) return;
  const was = current;
  queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, {
    ...current,
    unread: 0,
    results: current.results.map((row) => (row.read ? row : { ...row, read: true })),
  });
  try {
    const answer = await api.post<{ unread?: number }>("/alerts/read/", {});
    const unread = typeof answer?.unread === "number" ? answer.unread : 0;
    queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, (data) =>
      data ? { ...data, unread } : data,
    );
  } catch {
    queryClient.setQueryData(ALERTS_KEY, was);
  }
}

export async function setAlertFlags(queryClient: QueryClient, flags: AlertFlags) {
  const answer = await api.patch<AlertFlags>("/alerts/flags/", flags);
  queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, (data) =>
    data
      ? {
          ...data,
          pinned: answer.pinned === true,
          muted: answer.muted === true,
        }
      : data,
  );
  return answer;
}

export function alertKeptBack(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, (data) =>
    data
      ? {
          ...data,
          results: data.results.map((row) =>
            row.id === id ? { ...row, kept: true } : row,
          ),
        }
      : data,
  );
}

export function alertAnswered(queryClient: QueryClient, id: string) {
  queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, (data) => {
    if (!data) return data;
    const found = data.results.find((row) => row.id === id);
    if (!found) return data;
    return {
      ...data,
      unread: !found.read && data.unread > 0 ? data.unread - 1 : data.unread,
      results: data.results.filter((row) => row.id !== id),
    };
  });
}

export async function answerAlertKeep(queryClient: QueryClient, alert: Alert, keep: boolean) {
  const who = alert.actor;
  if (!who) return null;
  await api.post(`/social/users/${who.id}/${keep ? "accept" : "decline"}/`, {});
  alertAnswered(queryClient, alert.id);
  return {
    line: keep ? `Keeping ${who.name || who.username}.` : "Not now. They are not told.",
    bad: false,
  };
}
