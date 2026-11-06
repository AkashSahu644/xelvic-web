import api from "@/config/axios";
import type {
  Asset,
  ChatGate,
  ConvoCatalog,
  Message,
  MessagePoll,
  Page,
  ThreadCard,
  ThreadDetail,
  UserCard,
  VaultState,
} from "@/types/api";

/**
 * Chat.
 *
 * Every road the convo screens walk: the thread list and one thread, the message
 * cursor, the writes that change a message or a thread, groups, search, the
 * vault, and the one asset upload. One method per road, and each answers with
 * the server's own body — `response.data` and nothing reshaped. That is the rule
 * for every service in this folder: a service decides *where* a request goes and
 * *what shape* goes with it, and never invents a value the server did not send.
 *
 * A cursor is the one thing taken as a path rather than as parts. `messagesAt`
 * is handed the `next` from the page before it, because the URL of the next page
 * is the server's to compose and ours only to follow.
 */

/** What `POST /chat/threads/` answers: the convo it opened, or the gate's own sentence about why it would not. */
export interface ThreadStart {
  thread?: ThreadCard | null;
  gate?: (ChatGate & { reason?: string }) | null;
}

/** The thread list. `unread` is the whole-inbox count the convo menu reads. */
export interface ThreadList {
  threads: ThreadCard[];
  unread?: number;
}

/** The body `messages/send/` accepts — the same fields the send screen builds. */
export interface SendPayload {
  kind?: string;
  body?: string;
  reply_to?: string;
  asset?: string;
  payload?: Record<string, unknown>;
  channel?: string | null;
  /** Reused on a retry, so the server's `(sender, client_id)` dedupe holds. */
  client_id?: string;
}

/** One name in a message's delivery buckets. */
export interface MessageReceipt {
  user: UserCard;
  at: string | null;
}

/** A thread's own look: which backdrop it stands on and which tint it wears. */
export interface SkinPayload {
  wallpaper?: string;
  tint?: string;
}

export const chatService = {
  // ---- threads ------------------------------------------------------------

  /** The list as the server has it. `vault` asks for the rows inside the vault. */
  threads: async (options: { vault?: boolean } = {}): Promise<ThreadList> => {
    const response = await api.get<ThreadList>(
      "/chat/threads/",
      options.vault ? { params: { vault: "1" } } : undefined,
    );
    return response.data;
  },

  /** One thread, with the wallpaper/reaction catalog that only this road carries. */
  thread: async (threadId: string): Promise<{ thread: ThreadDetail; catalog?: ConvoCatalog }> => {
    const response = await api.get<{ thread: ThreadDetail; catalog?: ConvoCatalog }>(
      `/chat/threads/${threadId}/`,
    );
    return response.data;
  },

  /** Opens the direct convo with somebody, or hands back the gate that refuses. */
  start: async <T = ThreadStart>(userId: string): Promise<T> => {
    const response = await api.post<T>("/chat/threads/", { user: userId });
    return response.data;
  },

  /** A thread's switches: `pinned`, `muted`, `vaulted`, `invites_on`. */
  flags: async (threadId: string, patch: Record<string, boolean>): Promise<{ thread: ThreadDetail }> => {
    const response = await api.patch<{ thread: ThreadDetail }>(`/chat/threads/${threadId}/flags/`, patch);
    return response.data;
  },

  /** How long this convo keeps its own words. `days` rides along when it is on. */
  vanish: async (
    threadId: string,
    mode: string,
    days?: number,
  ): Promise<{ mode: string; days: number | null }> => {
    const response = await api.patch<{ mode: string; days: number | null }>(
      `/chat/threads/${threadId}/vanish/`,
      days ? { mode, days } : { mode },
    );
    return response.data;
  },

  /** The backdrop and the tint this convo wears. */
  skin: async (threadId: string, patch: SkinPayload): Promise<{ wallpaper: string; tint: string }> => {
    const response = await api.patch<{ wallpaper: string; tint: string }>(
      `/chat/threads/${threadId}/skin/`,
      patch,
    );
    return response.data;
  },

  /** Empties this account's copy; the thread and the other side stay. */
  clear: async (threadId: string): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/clear/`, {});
  },

  /** Removes the thread outright. */
  removeThread: async (threadId: string): Promise<void> => {
    await api.delete(`/chat/threads/${threadId}/`);
  },

  /** Steps out of a group, leaving it behind for everybody else. */
  leave: async (threadId: string): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/leave/`, {});
  },

  /** Writes every thread read at once — the convo menu's "all caught up". */
  readAll: async (): Promise<void> => {
    await api.post("/chat/threads/read/", {});
  },

  /** Says how far this account has read in one thread. */
  read: async (threadId: string, ordinal?: number): Promise<void> => {
    await api.post(`/chat/threads/${threadId}/read/`, ordinal === undefined ? {} : { ordinal });
  },

  /** A group, made in one step from a name and the people in it. */
  createGroup: async (title: string, members: string[]): Promise<{ thread: ThreadCard }> => {
    const response = await api.post<{ thread: ThreadCard }>("/chat/groups/", { title, members });
    return response.data;
  },

  // ---- messages -----------------------------------------------------------

  /** The newest page of a thread's messages. */
  messages: async (threadId: string): Promise<Page<Message>> => {
    const response = await api.get<Page<Message>>(`/chat/threads/${threadId}/messages/`);
    return response.data;
  },

  /**
   * The page the previous one named. The caller hands over the `next` it was
   * given — a cursor the server composed — rather than parts to rebuild it.
   */
  messagesAt: async (path: string): Promise<Page<Message>> => {
    const response = await api.get<Page<Message>>(path);
    return response.data;
  },

  /** Sends one message and answers with the row the server made of it. */
  send: async (threadId: string, payload: SendPayload): Promise<{ message: Message }> => {
    const response = await api.post<{ message: Message }>(
      `/chat/threads/${threadId}/messages/send/`,
      payload,
    );
    return response.data;
  },

  /** Rewrites a message's words. */
  edit: async (threadId: string, messageId: string, body: string): Promise<void> => {
    await api.patch(`/chat/threads/${threadId}/messages/${messageId}/`, { body });
  },

  /** Removes it from this copy, or — with `all` — for everybody. */
  removeMessage: async (threadId: string, messageId: string, all = false): Promise<void> => {
    await api.delete(
      `/chat/threads/${threadId}/messages/${messageId}/`,
      all ? { params: { scope: "all" } } : undefined,
    );
  },

  /** Copies a message into the picked threads, and answers with the copies. */
  forward: async (
    threadId: string,
    messageId: string,
    threads: string[],
  ): Promise<{ messages: Message[] }> => {
    const response = await api.post<{ messages: Message[] }>(
      `/chat/threads/${threadId}/messages/${messageId}/forward/`,
      { threads },
    );
    return response.data;
  },

  /** Who has seen, who has it, and who has neither — straight from the server. */
  messageInfo: async (
    threadId: string,
    messageId: string,
  ): Promise<{ seen: MessageReceipt[]; delivered: MessageReceipt[]; not_delivered: MessageReceipt[] }> => {
    const response = await api.get<{
      seen: MessageReceipt[];
      delivered: MessageReceipt[];
      not_delivered: MessageReceipt[];
    }>(`/chat/threads/${threadId}/messages/${messageId}/info/`);
    return response.data;
  },

  /** The same emoji twice takes the reaction back, and `emoji` says so. */
  react: async (
    threadId: string,
    messageId: string,
    emoji: string,
  ): Promise<{ emoji: string | null; reactions: Message["reactions"] }> => {
    const response = await api.post<{ emoji: string | null; reactions: Message["reactions"] }>(
      `/chat/threads/${threadId}/messages/${messageId}/react/`,
      { emoji },
    );
    return response.data;
  },

  /** Answers a poll by the index of the option chosen. */
  vote: async (threadId: string, messageId: string, choice: number): Promise<{ poll: MessagePoll }> => {
    const response = await api.post<{ poll: MessagePoll }>(
      `/chat/threads/${threadId}/messages/${messageId}/vote/`,
      { choice },
    );
    return response.data;
  },

  /** Spends a one-look message, which is what makes the server purge its bytes. */
  openOnce: async (threadId: string, messageId: string): Promise<{ message: Message }> => {
    const response = await api.post<{ message: Message }>(
      `/chat/threads/${threadId}/messages/${messageId}/open-once/`,
      {},
    );
    return response.data;
  },

  /** Everything ever shared in one thread, of the kinds asked for. */
  media: async (
    threadId: string,
    kinds = "image,video,voice,audio,doc",
  ): Promise<{ messages: Message[] }> => {
    const response = await api.get<{ messages: Message[] }>(`/chat/threads/${threadId}/media/`, {
      params: { kinds },
    });
    return response.data;
  },

  // ---- finding ------------------------------------------------------------

  /** The words themselves, across every convo this account can read. */
  search: async (q: string): Promise<{ query: string; messages: Message[] }> => {
    const response = await api.get<{ query: string; messages: Message[] }>("/chat/search/", {
      params: { q },
    });
    return response.data;
  },

  // ---- the vault ----------------------------------------------------------

  /** The lock's own state: whether a code is set, whether the door is open, and whether it is hidden. */
  vaultState: async (): Promise<VaultState> => {
    const response = await api.get<VaultState>("/chat/vault/");
    return response.data;
  },

  /** Opens the vault for this session. Too many tries answer 429. */
  vaultUnlock: async (code: string): Promise<void> => {
    await api.post("/chat/vault/unlock/", { code });
  },

  /** Closes it again. */
  vaultLock: async (): Promise<void> => {
    await api.delete("/chat/vault/unlock/");
  },

  /** Sets or changes the code; `current` is required once one is already set. */
  vaultSetCode: async (code: string, current?: string): Promise<void> => {
    await api.put("/chat/vault/", current === undefined ? { code } : { code, current });
  },

  /** Takes the code away, which is what unlocks the vault for good. */
  vaultRemoveCode: async (code: string): Promise<void> => {
    await api.delete("/chat/vault/", { data: { code } });
  },

  /** Hides the vault's door — or puts it back in the convo menu. */
  vaultHide: async (hide: boolean): Promise<VaultState> => {
    const response = await api.patch<VaultState>("/chat/vault/", { hide });
    return response.data;
  },

  /** The forgotten-code road: every chat inside the vault is deleted. */
  vaultReset: async (password: string): Promise<void> => {
    await api.post("/chat/vault/reset/", { password });
  },

  // ---- files --------------------------------------------------------------

  /** The upload. The form is the body, whole. */
  uploadAsset: async (form: FormData): Promise<{ asset?: Asset } & Asset> => {
    const response = await api.post<{ asset?: Asset } & Asset>("/chat/assets/", form);
    return response.data;
  },
};

export default chatService;
