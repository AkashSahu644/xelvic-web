import api from "@/config/axios";
import type { ID, SpaceRoom } from "@/types/api";

/**
 * Rooms.
 *
 * The Live shelves, one room, the board-game catalogue, and the thirteen action
 * routes a room takes. Every method answers with the server's own body —
 * `response.data` and nothing reshaped — and every one of them goes through
 * `api`, so no screen and no hook builds a room request of its own.
 *
 * Thirteen action routes is too many to give thirteen names that all mean the
 * same thing, so they are not: `action` takes the route's own word for what is
 * happening — `start`, `end`, `hand`, `mute`, `camera`, `stage`, `dismiss`, or
 * one of the `game/*` roads — and the two that do more than move a hand have
 * their own method (`join`, `leave`) because the room they answer with is the
 * one the caller is standing in.
 */

/** One game the room can be given — the server's own words about it. */
export interface GameOffer {
  kind: string;
  name: string;
  blurb: string;
  cols: number;
  rows: number;
  bundled?: boolean;
}

/** A shelf read: which shelf answered, and every room on it. */
export interface RoomShelf {
  shelf: string;
  rooms: SpaceRoom[];
}

/** What it takes to open a room. `starts_at` is `null` for a room on now. */
export interface RoomInput {
  title: string;
  note: string;
  kind: string;
  tags: string[];
  starts_at: string | null;
}

export const spacesService = {
  /** One shelf — on now, upcoming, ended, or mine. */
  shelf: async (shelf: string): Promise<RoomShelf> => {
    const response = await api.get<RoomShelf>("/spaces/", { params: { shelf } });
    return response.data;
  },

  /** Opens a room, or announces one if `starts_at` is set. */
  create: async (input: RoomInput): Promise<{ room: SpaceRoom }> => {
    const response = await api.post<{ room: SpaceRoom }>("/spaces/", input);
    return response.data;
  },

  /** The room itself, with the stage, audience and board it holds right now. */
  room: async (id: ID): Promise<{ room: SpaceRoom }> => {
    const response = await api.get<{ room: SpaceRoom }>(`/spaces/${id}/`);
    return response.data;
  },

  /** Every game a room may be given. */
  games: async (): Promise<{ games: GameOffer[] }> => {
    const response = await api.get<{ games: GameOffer[] }>("/spaces/games/");
    return response.data;
  },

  /** Walks in. Answers with the room as the walker now sees it. */
  join: async (id: ID): Promise<{ room: SpaceRoom }> => {
    const response = await api.post<{ room: SpaceRoom }>(`/spaces/${id}/join/`, {});
    return response.data;
  },

  /** Walks out, from any part of the room. */
  leave: async (id: ID): Promise<{ room: SpaceRoom }> => {
    const response = await api.post<{ room: SpaceRoom }>(`/spaces/${id}/leave/`, {});
    return response.data;
  },

  /** Sends the room into a convo. The answer is the server's own and unused. */
  share: async (id: ID, thread: ID): Promise<unknown> => {
    const response = await api.post(`/spaces/${id}/share/`, { thread });
    return response.data;
  },

  /**
   * Any other action the room takes: `start`, `end`, `hand`, `mute`, `camera`,
   * `stage`, `dismiss`, or the board's own roads — `game/open`, `game/play`,
   * `game/join`, `game/again`, `game/close`. `path` is passed as the route
   * spells it, slash and all, because the board's are two words deep.
   */
  action: async (id: ID, path: string, body?: unknown): Promise<{ room: SpaceRoom }> => {
    const response = await api.post<{ room: SpaceRoom }>(`/spaces/${id}/${path}/`, body);
    return response.data;
  },
};

export default spacesService;
