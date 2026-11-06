import api from "@/config/axios";
import type {
  AudioBoard,
  AudioBoardSection,
  AudioCatalogue,
  AudioCreator,
  AudioHome,
  AudioRow,
  AudioShelfPage,
  Playlist,
  Track,
} from "@/types/api";

/**
 * Audio.
 *
 * One method per road, and every method answers with the server's own body —
 * `response.data` and nothing reshaped. That is the rule for every service in
 * this folder: a service decides *where* a request goes and *what shape* goes
 * with it, and never invents a value the server did not send.
 *
 * A cursor is the one thing a caller, not this file, holds: the track listing
 * pages with the server's own `next` path, so `tracksPage` takes that path
 * whole and hands it straight to the client rather than rebuilding it as a
 * query. Everything else asks with `params`.
 */

/**
 * A page of tracks, as the calls read it. The three shelves that ask for
 * tracks — the audio page's search, the artist page and the camera's picker —
 * each declared a narrower slice (`tracks`/`query` here, `results` there, a
 * `count` and a `next` beside them); every field is optional so one shape
 * serves them all, exactly as `socialService` lets one `SocialState` serve two
 * screens.
 */
interface AudioTracksPage {
  tracks?: Track[];
  results?: Track[];
  query?: string;
  count?: number;
  next?: string | null;
  next_page?: number | null;
}

/** What a search answers: tracks, shelves and makers, grouped. See `TrackListView`. */
interface AudioSearchAnswer {
  query: string;
  tracks: Track[];
  playlists?: Playlist[];
  people?: AudioCreator[];
}

/**
 * One row of the creator's own list — `apps/audio/studio.py`'s `Item`.
 *
 * `listeners`, `completion` and `score` are nullable on purpose: the server
 * sends `null` where a number has not been measured, and a fake zero would be
 * a chart that says "nobody" rather than "not known yet".
 */
interface StudioItem {
  subject: string;
  id: string;
  kind: string;
  title: string;
  artist?: string;
  seed?: number;
  duration?: number;
  plays?: number;
  listeners?: number | null;
  completion?: number | null;
  stage?: string;
  score?: number | null;
  outcome?: string;
  why?: string;
}

/**
 * One page of the reco deck. `next` is the server's cursor, kept opaque: it is
 * handed back unchanged or not at all, and `has_more` without a cursor is the
 * end as far as an ask is concerned.
 */
interface AudioFeedPage {
  key?: string;
  title?: string;
  outcome?: string;
  why?: string;
  rows?: AudioRow[];
  next?: string;
  has_more?: boolean;
}

/** One studio row opened — `studio.Studio.as_dict`. */
interface StudioDetail {
  item: StudioItem;
  /** The ten lifetime sums, keyed by `SUM_FIELDS`. */
  totals?: Record<string, number>;
  /** completion / skip / replay, each nullable where it was not measured. */
  rates?: Record<string, number | null>;
  /** The trend engine's own reads, verbatim — `trend.Read.as_dict`. */
  components?: StudioComponent[];
  used_by?: {
    creators?: number | null;
    posts?: number | null;
    countries?: string[] | null;
    outcome?: string;
    why?: string;
  };
  standing?: { points?: number; week?: string };
  /** playable / promotable / savable / shareable, each false when it may not. */
  rights?: Record<string, boolean>;
}

/** One component of a trend score: what it measured, and how much it counts. */
interface StudioComponent {
  key: string;
  value?: number | null;
  weight?: number;
  raw?: number | null;
  outcome?: string;
  why?: string;
}

/**
 * One thing's listening, day by day — `studio.audience`.
 *
 * A day with no rows is a real nought, so `days` is always the whole window and
 * never only the days that happened. `countries` is `no_data` on purpose: the
 * app counts events and not people, so where a listener is cannot be told, and
 * the server's own `why` is the honest line.
 */
interface StudioAudience {
  outcome?: string;
  window?: { days: number; start: string; end: string };
  days?: ({ day: string } & Record<string, number>)[];
  totals?: Record<string, number>;
  countries?: { outcome?: string; why?: string };
}

/** One track opened: the row, its trend, what may be done with it, its neighbours. */
interface AudioTrackPage {
  row?: Track;
  track?: Track;
  components?: { key: string; outcome?: string; why?: string; value?: number | null; weight?: number }[];
  band?: string | null;
  outcome?: string;
  why?: string;
  rights?: Record<string, boolean>;
  related?: unknown[];
}

/** The like road's answer, in either of the two shapes it has been read in. */
interface AudioLikeAnswer {
  liked?: boolean;
  data?: { liked?: boolean };
}

/** One playlist and its rows, as the detail page reads them. */
interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
  shared_with?: PlaylistShare[];
}

interface PlaylistShare {
  id: string;
  where: string;
  to?: string;
  to_username?: string;
  token?: string;
  link?: string;
  at?: string;
}

export const audioService = {
  /** The shelves the audio page opens on: a hero, what is recent, playlists, podcasts. */
  home: async (): Promise<AudioHome> => {
    const response = await api.get<AudioHome>("/audio/");
    return response.data;
  },

  /**
   * The track listing. One road answers four questions — the plain list, `q`
   * for a search, `artist` for one artist's page, `source: "drop"` for the
   * uploaded sounds alone — which is why they are one method and not four.
   * `AudioTracksPage` is the default reading; a shelf that asked for a narrower
   * slice names it as the type argument, as `chatService.start` does. A search
   * asks for `AudioSearchAnswer`, whose answer carries the playlists and the
   * makers beside the tracks.
   */
  tracks: async <T = AudioTracksPage>(params?: {
    q?: string;
    artist?: string;
    source?: "catalogue" | "drop";
    kind?: string;
    page?: number;
    page_size?: number;
    limit?: number;
  }): Promise<T> => {
    const response = await api.get<T>("/audio/tracks/", { params });
    return response.data;
  },

  /** Everything one word found, grouped — the search screen's one ask. */
  search: async (query: string): Promise<AudioSearchAnswer> => {
    const response = await api.get<AudioSearchAnswer>("/audio/tracks/", { params: { q: query } });
    return response.data;
  },

  /**
   * The shelves' cards and the filter options, from the reco layer rather than
   * typed into the client. A failed ask leaves the rail out; the catalogue
   * under it is the rest of the tab and does not need the doors.
   */
  categories: async (params?: { country?: string; language?: string }): Promise<AudioCatalogue> => {
    const response = await api.get<AudioCatalogue>("/audio/categories/", { params });
    return response.data;
  },

  /**
   * One page of one shelf. `key` is the shelf's own name, `page` is one-based,
   * and the filters are sent only when they are chosen — an absent filter is an
   * absent argument, not an empty string the server has to guess at.
   */
  shelf: async (
    key: string,
    params?: { page?: number; country?: string; language?: string; mood?: string; genre?: string },
  ): Promise<AudioShelfPage> => {
    const response = await api.get<AudioShelfPage>(
      `/audio/categories/${encodeURIComponent(key)}/`,
      { params },
    );
    return response.data;
  },

  /** The weekly board on its own: one list per shelf, and who is on top. */
  trending: async (params?: { limit?: number }): Promise<AudioBoard> => {
    const response = await api.get<AudioBoard>("/audio/trending/", { params });
    return response.data;
  },

  /**
   * One page of the reco deck — the run of audio the server suggests for this
   * account. `cursor` is the previous page's opaque `next`, handed back whole;
   * `language` and `mood` filter the run rather than decorate it.
   */
  feed: async (params?: {
    cursor?: string;
    limit?: number;
    country?: string;
    language?: string;
    mood?: string;
  }): Promise<AudioFeedPage> => {
    const response = await api.get<AudioFeedPage>("/audio/feed/", { params });
    return response.data;
  },

  /**
   * One board, for one week. No key answers every shelf the way `trending`
   * does; `week` is the Monday of the week wanted, which is how a board that
   * has been and gone is read.
   */
  board: async (params?: { key?: string; week?: string; limit?: number }): Promise<AudioBoardSection> => {
    const response = await api.get<AudioBoardSection>("/audio/board/", { params });
    return response.data;
  },

  /** One track opened: its row, what its trend is made of, and its neighbours. */
  track: async (id: string): Promise<AudioTrackPage> => {
    const response = await api.get<AudioTrackPage>(`/audio/tracks/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** The rows that belong beside one — same language, or a shared mood. */
  related: async (id: string): Promise<{ rows: Track[] }> => {
    const response = await api.get<{ rows: Track[] }>(
      `/audio/tracks/${encodeURIComponent(id)}/related/`,
    );
    return response.data;
  },

  /** What somebody else handed this account, as its own shelf list. */
  sharedWithMe: async (): Promise<{ playlists: Playlist[] }> => {
    const response = await api.get<{ playlists: Playlist[] }>("/audio/shared/");
    return response.data;
  },

  /**
   * The account's own audio, as the studio's rows. One's own only: the server
   * answers an empty list for anybody else, so there is nothing here to filter.
   */
  studio: async (): Promise<{ items: StudioItem[] }> => {
    const response = await api.get<{ items: StudioItem[] }>("/audio/studio/");
    return response.data;
  },

  /**
   * One studio row opened: its lifetime totals, its rates, and what its trend
   * is made of. One's own only — somebody else's is a 404 from the service.
   */
  studioDetail: async (id: string): Promise<StudioDetail> => {
    const response = await api.get<StudioDetail>(`/audio/studio/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /**
   * The same row's listening, day by day, over the last `days`. A second
   * question with a second failure: a page whose audience ask fails keeps the
   * numbers it already has rather than losing them.
   */
  studioAudience: async (id: string, days = 7): Promise<StudioAudience> => {
    const response = await api.get<StudioAudience>(
      `/audio/studio/${encodeURIComponent(id)}/audience/`,
      { params: { days } },
    );
    return response.data;
  },

  /**
   * The next page of the same listing, fetched by the full cursor path the
   * server handed back (`next`). The path is already a path, so it is sent as
   * given rather than taken apart into params.
   */
  tracksPage: async (path: string): Promise<AudioTracksPage> => {
    const response = await api.get<AudioTracksPage>(path);
    return response.data;
  },

  /** The tracks this account has felt — the audio page's saved shelf. */
  felt: async (): Promise<AudioTracksPage> => {
    const response = await api.get<AudioTracksPage>("/audio/felt/");
    return response.data;
  },

  /** The heart. Answers with the state it landed on, not the one that was asked for. */
  like: async <T = AudioLikeAnswer>(id: string): Promise<T> => {
    const response = await api.post<T>(`/audio/tracks/${id}/like/`);
    return response.data;
  },

  /** A new empty playlist; `cover` is an asset id or nothing at all. */
  createPlaylist: async (input: { name: string; cover?: string | null }): Promise<{ playlist: Playlist }> => {
    const response = await api.post<{ playlist: Playlist }>("/audio/playlists/", input);
    return response.data;
  },

  /** One playlist with its rows. */
  playlist: async (id: string): Promise<PlaylistDetail> => {
    const response = await api.get<PlaylistDetail>(`/audio/playlists/${id}/`);
    return response.data;
  },

  /** Renames a playlist, and paints its cover when one is named. */
  updatePlaylist: async (
    id: string,
    patch: { name?: string; cover?: string | null },
  ): Promise<{ playlist: Playlist }> => {
    const response = await api.patch<{ playlist: Playlist }>(`/audio/playlists/${id}/`, patch);
    return response.data;
  },

  /** Takes the playlist down and, with it, the rows only it held. */
  deletePlaylist: async (id: string): Promise<void> => {
    await api.delete(`/audio/playlists/${id}/`);
  },

  /** Puts a track on the end. */
  addTrack: async (playlistId: string, track: string): Promise<void> => {
    await api.post(`/audio/playlists/${playlistId}/items/`, { track });
  },

  /** Takes one row off by its item id, not the track's. */
  removeTrack: async (playlistId: string, item: string): Promise<void> => {
    await api.delete(`/audio/playlists/${playlistId}/items/${item}/`);
  },

  /** Rewrites the order from the item ids as they now stand. */
  reorder: async (playlistId: string, items: string[]): Promise<void> => {
    await api.post(`/audio/playlists/${playlistId}/order/`, { items });
  },

  /** Who the playlist has been sent to. */
  shares: async (playlistId: string): Promise<{ shared_with: PlaylistShare[] }> => {
    const response = await api.get<{ shared_with: PlaylistShare[] }>(
      `/audio/playlists/${playlistId}/share/`,
    );
    return response.data;
  },

  /**
   * Sends the playlist into a conversation, or mints the public link that is
   * the same road with `{ link: true }`. The link answer carries the token.
   */
  share: async (
    playlistId: string,
    payload: { thread: string } | { link: true },
  ): Promise<{ token?: string; link?: string }> => {
    const response = await api.post<{ token?: string; link?: string }>(
      `/audio/playlists/${playlistId}/share/`,
      payload,
    );
    return response.data;
  },

  /** Takes one share back. */
  unshare: async (playlistId: string, shareId: string): Promise<void> => {
    await api.delete(`/audio/playlists/${playlistId}/share/${shareId}/`);
  },

  /**
   * A playlist as a stranger holding the link sees it. No token is sent: the
   * link is the whole credential, which is why this one asks with
   * `{ skipAuth: true }`.
   */
  shared: async (token: string): Promise<{ playlist: Playlist; tracks: Track[] }> => {
    const response = await api.get<{ playlist: Playlist; tracks: Track[] }>(
      `/audio/shared/${token}/`,
      { skipAuth: true },
    );
    return response.data;
  },
};

export default audioService;
