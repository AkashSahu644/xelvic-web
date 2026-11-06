import api from "@/config/axios";
import type { AudienceMode } from "@/features/moments/AudienceSheet";
import type {
  ID,
  Memory,
  Moment,
  MomentItem,
  MomentPoll,
  MomentPollVoters,
  MomentReactor,
  MomentReactions,
  MomentTray,
  UserCard,
} from "@/types/api";

/**
 * Moments.
 *
 * One method per road, and every method answers with the server's own body —
 * `response.data` and nothing reshaped. That is the rule for every service in
 * this folder: a service decides *where* a request goes and *what shape* goes
 * with it, and never invents a value the server did not send.
 *
 * `post` is the one write every composer ends at — a camera capture, a text
 * card, a poll, a post shared onto a moment — and all of them hand the same
 * shape: the `items` list, the audience it went to, and the mark when it
 * carries one. Everything else here is a moment being read back, answered,
 * carried, taken down, or kept in a memory.
 */

/** The body every composer posts — see `MomentCreateSerializer` in `apps/moments`. */
export interface MomentPost {
  items: Record<string, unknown>[];
  /** Who it went to: `everyone`, `except` or `only`. */
  audience?: AudienceMode;
  /** The people the reach names, for `except` and `only`. */
  audience_users?: ID[];
  /** The author's own mark when the moment is adult, violent or graphic. */
  sensitive?: boolean;
  /**
   * The moment this one is put up from, when it is a remoment edited before it
   * went up. Null for an ordinary post — the service does the carry checks
   * (named in it, not my own, once only) and stamps the credit off this id.
   */
  source?: ID | null;
}

/** One waiting item the memories picker offers — `AwaitingItem` in `features/moments/AddToMemories.tsx`. */
export interface AwaitingItem extends MomentItem {
  /** The moment this item came off, when it is no longer on one. */
  moment?: string;
}

/** The body a new memory shelf is made from. */
export interface MemoryDraft {
  title: string;
  items: ID[];
  /** The picture uploaded to stand for the shelf, by asset id. */
  cover_upload?: ID;
  /** Or one of the shelf's own items chosen as its card, by item id. */
  cover?: ID;
}

/**
 * What a long press on my own shelf may change, one thing at a time.
 *
 * Every key is optional and an absent one means "leave it" — see
 * `MemoryEditSerializer`. `items` are the ones to *add*, never the whole list;
 * a body that sent the whole list would delete whatever the reader had not been
 * told about. A key that is present is sent and an absent one is left out of the
 * body entirely, the same way `editMemory` in `app/lib/moments.dart` builds it
 * (`'title': ?title`), because the edit serializer refuses a null where it takes
 * a uuid.
 */
export interface MemoryEdit {
  title?: string;
  /** The moments to put into it — added to what it holds, not instead of it. */
  items?: ID[];
  /** One of its own items chosen to stand for it. */
  cover?: ID;
  /** Or a picture off the phone, uploaded first and named here by asset id. */
  cover_upload?: ID;
}

export const momentsService = {
  /** The rail as the server has it — mine, unseen, seen, and the silenced last. */
  tray: async (): Promise<MomentTray> => {
    const response = await api.get<MomentTray>("/moments/tray/");
    return response.data;
  },

  /** My own moments, with the totals the page's header draws. */
  mine: async (): Promise<{ moments: Moment[]; total?: number; total_views?: number }> => {
    const response = await api.get<{ moments: Moment[]; total?: number; total_views?: number }>(
      "/moments/mine/",
    );
    return response.data;
  },

  /** One person's day, by handle — what a rail row opens. */
  byUser: async (username: string): Promise<{ moments: Moment[] }> => {
    const response = await api.get<{ moments: Moment[] }>(
      `/moments/users/${encodeURIComponent(username)}/`,
    );
    return response.data;
  },

  /** Asks to be shown this person's day last, or to stop being shown it last. */
  silence: async (user: ID, silent: boolean): Promise<unknown> => {
    const response = await api.post<unknown>("/moments/silence/", { user, silent });
    return response.data;
  },

  /** Puts a moment up. The body is the same one every composer builds. */
  post: async (payload: MomentPost): Promise<unknown> => {
    const response = await api.post<unknown>("/moments/", payload);
    return response.data;
  },

  /** One moment by its own id — a deep link's read, and a carried moment's source. */
  detail: async (id: ID): Promise<{ moment: Moment }> => {
    const response = await api.get<{ moment: Moment }>(`/moments/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** Takes the whole moment down; every item on it goes with it. */
  remove: async (id: ID): Promise<unknown> => {
    const response = await api.delete<unknown>(`/moments/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** Says the whole moment was watched — sent when its last item is left. */
  seen: async (id: ID): Promise<unknown> => {
    const response = await api.post<unknown>(`/moments/${encodeURIComponent(id)}/seen/`, {});
    return response.data;
  },

  /** Says one item was watched, which is what the ring counts. */
  itemSeen: async (itemId: ID): Promise<unknown> => {
    const response = await api.post<unknown>(
      `/moments/items/${encodeURIComponent(itemId)}/seen/`,
      {},
    );
    return response.data;
  },

  /** Who watched this one — the author's own read. */
  viewers: async (id: ID): Promise<{ viewers: UserCard[]; count?: number }> => {
    const response = await api.get<{ viewers: UserCard[]; count?: number }>(
      `/moments/${encodeURIComponent(id)}/viewers/`,
    );
    return response.data;
  },

  /** Who answered this one, each with the face they gave. */
  reactors: async (id: ID): Promise<{ reactors: MomentReactor[]; count?: number }> => {
    const response = await api.get<{ reactors: MomentReactor[]; count?: number }>(
      `/moments/${encodeURIComponent(id)}/reactors/`,
    );
    return response.data;
  },

  /** Gives a face, and answers with the tally that is left. */
  react: async (id: ID, emoji: string): Promise<{ reactions: MomentReactions }> => {
    const response = await api.post<{ reactions: MomentReactions }>(
      `/moments/${encodeURIComponent(id)}/react/`,
      { emoji },
    );
    return response.data;
  },

  /** Answers a moment in words, the way a hold-and-hold does on the phone. */
  reply: async (id: ID, body: string): Promise<unknown> => {
    const response = await api.post<unknown>(`/moments/${encodeURIComponent(id)}/reply/`, { body });
    return response.data;
  },

  /** Puts this moment on my own day, as a way in rather than a copy. */
  carry: async (id: ID): Promise<unknown> => {
    const response = await api.post<unknown>(`/moments/${encodeURIComponent(id)}/carry/`, {});
    return response.data;
  },

  /**
   * Asks whether this moment may leave the app at all.
   *
   * Asked before the sheet is drawn, because a private account's moment cannot
   * be shared and the refusal has to arrive as a refusal rather than as a sheet
   * whose Send would fail.
   */
  shareGate: async (id: ID): Promise<{ allowed?: boolean }> => {
    const response = await api.post<{ allowed?: boolean }>(
      `/moments/${encodeURIComponent(id)}/share/`,
      {},
    );
    return response.data;
  },

  /** The deed, one convo at a time — the gate above has already said yes. */
  share: async (id: ID, thread: ID): Promise<unknown> => {
    const response = await api.post<unknown>(`/moments/${encodeURIComponent(id)}/share/`, {
      thread,
    });
    return response.data;
  },

  /** Answers a poll item, and answers with the tally it moved. */
  vote: async (itemId: ID, option: ID): Promise<{ poll: MomentPoll }> => {
    const response = await api.post<{ poll: MomentPoll }>(
      `/moments/items/${encodeURIComponent(itemId)}/vote/`,
      { option },
    );
    return response.data;
  },

  /** The names under every option of a poll — the author's own read. */
  voters: async (itemId: ID): Promise<{ options: MomentPollVoters[] }> => {
    const response = await api.get<{ options: MomentPollVoters[] }>(
      `/moments/items/${encodeURIComponent(itemId)}/voters/`,
    );
    return response.data;
  },

  /** Everything of mine that a memory may still be made from. */
  awaiting: async (): Promise<{ items: AwaitingItem[]; count: number }> => {
    const response = await api.get<{ items: AwaitingItem[]; count: number }>("/moments/awaiting/");
    return response.data;
  },

  /** My memory shelves, as the profile strip draws them. */
  memories: async (): Promise<{ memories: Memory[] }> => {
    const response = await api.get<{ memories: Memory[] }>("/moments/memories/");
    return response.data;
  },

  /** Somebody's memory shelves, by handle — the same strip on their page. */
  memoriesByUser: async (username: string): Promise<{ memories: Memory[] }> => {
    const response = await api.get<{ memories: Memory[] }>(
      `/moments/memories/users/${encodeURIComponent(username)}/`,
    );
    return response.data;
  },

  /** Keeps a new shelf: a name, the items on it, and the card that stands for it. */
  createMemory: async (payload: MemoryDraft): Promise<unknown> => {
    const response = await api.post<unknown>("/moments/memories/", payload);
    return response.data;
  },

  /** Adds items to a shelf that already exists. */
  editMemory: async (id: ID, patch: MemoryEdit): Promise<{ memory: Memory }> => {
    // Built key by key rather than handed straight through: a key the caller did
    // not set must not travel as `null`, which the edit serializer refuses for
    // the two covers. Naming one cover takes the other off the card, server side.
    const body: Record<string, unknown> = {};
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.items !== undefined) body.items = patch.items;
    if (patch.cover !== undefined) body.cover = patch.cover;
    if (patch.cover_upload !== undefined) body.cover_upload = patch.cover_upload;
    const response = await api.patch<{ memory: Memory }>(
      `/moments/memories/${encodeURIComponent(id)}/`,
      body,
    );
    return response.data;
  },

  /**
   * Takes a shelf off my profile. The moments it holds stay exactly where they
   * are — see `MemoryDetailView.delete` and `services.drop_memory`.
   */
  dropMemory: async (id: ID): Promise<{ gone: ID }> => {
    const response = await api.delete<{ gone: ID }>(
      `/moments/memories/${encodeURIComponent(id)}/`,
    );
    return response.data;
  },

  /**
   * Answers a Memory — at a route of its own.
   *
   * A Memory is not a moment: the moment routes look their subject up among
   * live moments only, so aiming one of them at a Memory is a 404. Everything
   * about the answer is shared with the moment's own reply; only the lookup
   * differs. See `MemoryReplyView`.
   */
  memoryReply: async (id: ID, body: string): Promise<{ sent: boolean; message: ID }> => {
    const response = await api.post<{ sent: boolean; message: ID }>(
      `/moments/memories/${encodeURIComponent(id)}/reply/`,
      { body },
    );
    return response.data;
  },

  /** Gives a face to a Memory, and answers with the tally that is left. */
  memoryReact: async (id: ID, emoji: string): Promise<{ reactions: MomentReactions }> => {
    const response = await api.post<{ reactions: MomentReactions }>(
      `/moments/memories/${encodeURIComponent(id)}/react/`,
      { emoji },
    );
    return response.data;
  },

  /** Who answered a Memory, and with what. Its keeper's business only — no watchers. */
  memoryReactors: async (id: ID): Promise<{ reactors: MomentReactor[]; count?: number }> => {
    const response = await api.get<{ reactors: MomentReactor[]; count?: number }>(
      `/moments/memories/${encodeURIComponent(id)}/reactors/`,
    );
    return response.data;
  },

  /** The same question a moment's share route answers: may this leave the app? */
  memoryShareGate: async (id: ID): Promise<{ allowed?: boolean }> => {
    const response = await api.post<{ allowed?: boolean }>(
      `/moments/memories/${encodeURIComponent(id)}/share/`,
      {},
    );
    return response.data;
  },

  /** The deed for a Memory, one convo at a time. */
  memoryShare: async (id: ID, thread: ID): Promise<unknown> => {
    const response = await api.post<unknown>(
      `/moments/memories/${encodeURIComponent(id)}/share/`,
      { thread },
    );
    return response.data;
  },
};

export default momentsService;
