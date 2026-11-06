import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSocketEvent } from "@/hooks/useSocket";
import { alertsService } from "@/services/alerts.service";
import { ALERTS_KEY, applyAlertFrame } from "@/store/alerts";

export { ALERTS_KEY } from "@/store/alerts";

/**
 * The alerts list, kept live while a screen is watching it.
 *
 * `refetchOnMount: "always"` because the list is the thing a person opens *to
 * see what changed* — a cache older than the mount is the wrong answer to that
 * question. Once open, the socket answers instead of a poll: `alert.new` and
 * `alert.read` are applied to the cache in `store/alerts.ts`, so the row, the
 * count and the page all move together.
 */
export function useAlerts(enabled = true) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ALERTS_KEY,
    queryFn: () => alertsService.list(),
    enabled,
    staleTime: 30_000,
    refetchOnMount: "always",
  });

  useSocketEvent(["alert.new", "alert.read"], (frame) => applyAlertFrame(queryClient, frame));

  return query;
}