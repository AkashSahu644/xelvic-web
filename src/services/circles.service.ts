import api from "@/config/axios";
import type { CircleDay, CircleFields, Drop, ID } from "@/types/api";

/**
 * Circles — the interests picked this month, and the rooms those picks put
 * somebody in.
 *
 * Four routes, read off `apps/circles/urls.py` and changed not at all:
 *
 * - `fields/` is the picker: the interests on offer, each with whether this
 *   account has chosen it and which circle the choice landed in.
 * - `pick/` is the choosing. It answers with the day the choice landed on
 *   rather than with the choice, because the screen that just tapped is about
 *   to draw a circle and a second request to find out which one is a round trip
 *   for something the server already knew.
 * - `mine/` is the section on the Moments page: every circle this account is
 *   in, each as it stands today, in one request, because it is one screen.
 * - `<id>/` is one circle on its own — and its `POST`, which is how a take goes
 *   up. A circle post is an ordinary drop (`Drop.circle_day` is a column, not a
 *   second table), so the body here is the drop composer's own and the server's
 *   `write_fields` is the only mapping of it.
 *
 * Every method answers with the server's body and never reshapes it. The one
 * rule this folder keeps everywhere holds here too: nothing is invented, and a
 * refused pick throws the server's own `AppError`.
 */
export const circlesService = {
  /** Every circle this account is in, each as it stands today. */
  mine: async (): Promise<{ circles: CircleDay[]; run: number }> => {
    const response = await api.get<{ circles: CircleDay[]; run: number }>("/circles/mine/");
    return response.data;
  },

  /** The picker's rows, with this month's ticks already on them. */
  fields: async (): Promise<CircleFields> => {
    const response = await api.get<CircleFields>("/circles/fields/");
    return response.data;
  },

  /** Choose an interest, and be put in a circle for it. */
  pick: async (field: string): Promise<{ day: CircleDay }> => {
    const response = await api.post<{ day: CircleDay }>("/circles/pick/", { field });
    return response.data;
  },

  /** One circle's day: its task, its window, its board and its members. */
  one: async (id: ID): Promise<{ day: CircleDay }> => {
    const response = await api.get<{ day: CircleDay }>(
      `/circles/${encodeURIComponent(String(id))}/`,
    );
    return response.data;
  },

  /**
   * Put a take on a circle's board.
   *
   * The body is `write_fields`' own — the keys the drop composer sends — and
   * the answer is the posted drop beside the circle as it now stands, so the
   * screen that posted it does not need a second read to draw itself.
   */
  post: async (id: ID, payload: Record<string, unknown>): Promise<{ drop: Drop; day: CircleDay }> => {
    const response = await api.post<{ drop: Drop; day: CircleDay }>(
      `/circles/${encodeURIComponent(String(id))}/`,
      payload,
    );
    return response.data;
  },
};