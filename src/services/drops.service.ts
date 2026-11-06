import api from "@/config/axios";
import type { VibeStudioAudience, VibeStudioDetail, VibeStudioList } from "@/features/drops/VibeStudio";
import type {
  ActivityData,
  Comment,
  Drop,
  ID,
  Note,
  Page,
  Poll,
  UserCard,
} from "@/types/api";

/**
 * Drops and Vibes.
 *
 * A drop and a Vibe are two tables behind two families of routes, and the app
 * keeps the choice in one place — `dropBase` in `features/drops/model.ts`
 * answers `"drops"` or `"drops/vibes"`. Every method here that acts on one post
 * takes that base as its first argument and builds the same path the call site
 * built, so a clip and a sound reach their own table by the caller's word
 * rather than by a guess each card makes for itself.
 *
 * One method per road, and every method answers with the server's own body —
 * `response.data` and nothing reshaped. That is the rule for every service in
 * this folder: a service decides *where* a request goes and *what shape* goes
 * with it, and never invents a value the server did not send.
 */

/**
 * What a person's shelf answer carries besides the page.
 *
 * `ShelfPage` in `features/profile/ProfileShelf.tsx`, which is where the two
 * extra keys are read: a private account's shelf comes back with the gate that
 * says so, and with whether this reader may post to it.
 */
export interface ShelfPage extends Page<Drop> {
  gate?: ShelfGate;
  can_post?: boolean;
}

/** `ShelfGate` in `features/profile/ProfileShelf.tsx`. */
export interface ShelfGate {
  view?: boolean;
  mode?: string;
  title?: string;
  text?: string;
}

/**
 * The author's own read of who is behind a post — `Audience` in
 * `features/drops/StatsSheet.tsx`. One page at a time: `next` is the cursor.
 */
export interface DropAudience {
  of: string;
  total: number;
  crew: number;
  others: number;
  counts: Record<string, number>;
  people: { person: UserCard; last: string; count: number; ms?: number }[];
  next: string | null;
}

/**
 * A post as the server writes it back.
 *
 * A drop answers under `drop` and a Vibe under `vibe` — the same serializer
 * under two keys — so both are optional here and the caller reads whichever the
 * base it sent produces.
 */
export interface DropWrite {
  drop?: Drop;
  vibe?: Drop;
}

/** Everything filed under one word, one page at a time. */
export interface TagPage {
  tag: string;
  count: number;
  results: Drop[];
  next: string | null;
}

/** A respond's body, whether it is a first answer or a reword. */
export interface CommentDraft {
  body: string;
  asset?: ID;
  sticker?: ID;
  parent?: ID;
  mentions?: ID[];
}

/** A private note's body: the line, and whatever it wears. */
export interface NoteDraft {
  body: string;
  subject?: ID;
  asset?: ID;
  sticker?: ID;
}

/** What a share may say: where it went, and — in a convo — to which thread. */
export interface DropShareBody {
  /** `sheet` for the browser's own sheet, `chat` for one convo. */
  where?: string;
  thread?: ID;
}

/**
 * The two respond tables behind a base.
 *
 * A Vibe's responds are their own rows — `/drops/vibe-comments/` — and a drop's
 * are `/drops/comments/`; the same split the one place works out. `commentRoutes`
 * in `features/drops/CommentsModal.tsx` keeps the same four strings, and the
 * split belongs here for the same reason it belongs there: a row read off the
 * wrong table would 404 rather than say anything wrong.
 */
function commentTable(base: string): string {
  return base === "drops/vibes" ? "/drops/vibe-comments" : "/drops/comments";
}

/** The note tables, split the way the respond tables are. */
function noteTable(base: string): string {
  return base === "drops/vibes" ? "/drops/vibe-notes" : "/drops/notes";
}

/**
 * The first page of the feed, in the app's own words.
 *
 * `seen=strict` is the phone saying it can draw a finished feed: the server
 * leaves out every drop this reader has already been shown and answers an empty
 * page rather than re-dealing the corpus when there is nothing new
 * (`apps/drops/views.py`, `DropFeedView`, and `Drops._load` in the app). Sent
 * without it, the feed repeats once it has been read through — which is a page
 * that never ends, a scroll that keeps asking for more of the same cards, and
 * one of the reasons this page felt heavy.
 *
 * `limit=8` on the Vibes shelf is the app's number too (`Drops._load`): a shelf
 * row carries a whole recipe and the addresses of every upload in it, so thirty
 * of them on the first open is several times the weight of the cards under it.
 * The walk asks for the next hand as the thumb reaches it.
 */
export const DROPS_FEED_FIRST = "/drops/?seen=strict";
export const VIBES_FEED_FIRST = "/drops/vibes/?limit=8";

export const dropsService = {
  // ---- the shelf, a page at a time ----------------------------------------

  /**
   * The feed. `next` is the server's own cursor, taken as the path it arrives
   * as (`apiPathFrom`), and the first ask is [DROPS_FEED_FIRST].
   */
  feed: async (next?: string): Promise<Page<Drop>> => {
    const response = await api.get<Page<Drop>>(next ?? DROPS_FEED_FIRST);
    return response.data;
  },

  /** The Vibes shelf, dealt the same way and a hand of eight at a time. */
  vibesFeed: async (next?: string): Promise<Page<Drop>> => {
    const response = await api.get<Page<Drop>>(next ?? VIBES_FEED_FIRST);
    return response.data;
  },

  /** One person's drops, by handle — their profile's first tab. */
  userShelf: async (username: string, next?: string): Promise<ShelfPage> => {
    const response = await api.get<ShelfPage>(
      next ?? `/drops/users/${encodeURIComponent(username)}/`,
    );
    return response.data;
  },

  /** One person's Vibes — their own table, and their own ask. */
  userVibes: async (username: string, next?: string): Promise<ShelfPage> => {
    const response = await api.get<ShelfPage>(
      next ?? `/drops/users/${encodeURIComponent(username)}/vibes/`,
    );
    return response.data;
  },

  /** Everything filed under one word. The first page is the word's own road. */
  tags: async (word: string, next?: string | null): Promise<TagPage> => {
    const response = await api.get<TagPage>(next || `/tags/${encodeURIComponent(word)}/`);
    return response.data;
  },

  // ---- one post, under whichever base it lives on --------------------------

  /** The post itself. A Vibe answers under `vibe`, a drop under `drop`. */
  detail: async <T = DropWrite>(base: string, id: ID): Promise<T> => {
    const response = await api.get<T>(`/${base}/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** Puts a post up; the body is the payload the composer built. */
  create: async (base: string, payload: Record<string, unknown>): Promise<DropWrite> => {
    const response = await api.post<DropWrite>(`/${base}/`, payload);
    return response.data;
  },

  /**
   * Changes what an edit may change. A field left out is left alone, which is
   * why the body carries only the fields that differ.
   */
  edit: async (
    base: string,
    id: ID,
    payload: Record<string, unknown>,
  ): Promise<DropWrite> => {
    const response = await api.patch<DropWrite>(`/${base}/${encodeURIComponent(id)}/`, payload);
    return response.data;
  },

  /** Takes the post down. */
  remove: async (base: string, id: ID): Promise<unknown> => {
    const response = await api.delete<unknown>(`/${base}/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** Counts one look. My own post is never a look, and the caller says so. */
  seen: async (base: string, id: ID): Promise<unknown> => {
    const response = await api.post<unknown>(`/${base}/${encodeURIComponent(id)}/seen/`, {});
    return response.data;
  },

  /**
   * The felt. `on` is stated rather than toggled, so a retry after a lost reply
   * cannot land the opposite of what the thumb meant.
   */
  like: async (base: string, id: ID, on: boolean): Promise<{ likes: number; liked: boolean }> => {
    const response = await api.post<{ likes: number; liked: boolean }>(
      `/${base}/${encodeURIComponent(id)}/like/`,
      { on },
    );
    return response.data;
  },

  /**
   * There is deliberately **no** `save` here.
   *
   * This file used to carry one, posting to `/{base}/{id}/save/` — the shape
   * `like` and `hide` above suggest, and an address no urlconf in the backend
   * has: `apps/drops/urls.py` defines no `save` path, so it answered 404 on
   * every press. The editor's bookmark called it, which is why Save on a sound
   * did nothing. The one write that puts anything on the shelf is
   * `POST /saved/ {kind, id, on}` — `apps/saved/views.py` is the whole of it —
   * and the app reaches it through `src/store/saved.ts` and
   * `src/hooks/useSaved.ts`, which also keep the glyph in step with the
   * server's answer. A `save` method next to `like`/`hide` is a trap, so it is
   * not here.
   */

  /** "I do not want to be shown that again." */
  hide: async (base: string, id: ID, on = true): Promise<unknown> => {
    const response = await api.post<unknown>(`/${base}/${encodeURIComponent(id)}/hide/`, { on });
    return response.data;
  },

  /**
   * The share road, asked three ways by its callers: with no body at all to get
   * the link and write nothing, with `where: "sheet"` once the browser's own
   * sheet has actually handed it on, and with a thread for one convo.
   */
  share: async (base: string, id: ID, body: DropShareBody = {}): Promise<{ link?: string }> => {
    const response = await api.post<{ link?: string }>(
      `/${base}/${encodeURIComponent(id)}/share/`,
      body,
    );
    return response.data;
  },

  /** The pages of who is behind a post — one kind only, the likes. */
  audience: async (base: string, id: ID, before?: string | null): Promise<DropAudience> => {
    const response = await api.get<DropAudience>(`/${base}/${encodeURIComponent(id)}/audience/`, {
      params: { of: "likes", before: before ?? undefined },
    });
    return response.data;
  },

  /** What a post did — the numbers the statistics sheet draws. Author-only. */
  stats: async <T = unknown>(base: string, id: ID): Promise<T> => {
    const response = await api.get<T>(`/${base}/${encodeURIComponent(id)}/stats/`);
    return response.data;
  },

  // ---- the two answers a poll takes ---------------------------------------

  /** A tick on a line, or a whole order handed in at once. */
  pollVote: async (
    base: string,
    id: ID,
    payload: Record<string, unknown>,
  ): Promise<{ poll: Poll }> => {
    const response = await api.post<{ poll: Poll }>(
      `/${base}/${encodeURIComponent(id)}/poll/vote/`,
      payload,
    );
    return response.data;
  },

  // ---- the two voices under a post ----------------------------------------

  /** The public responds on a post. */
  comments: async (base: string, id: ID): Promise<{ comments: Comment[] }> => {
    const response = await api.get<{ comments: Comment[] }>(
      `/${base}/${encodeURIComponent(id)}/comments/`,
    );
    return response.data;
  },

  /** Says something under a post. The body is the draft the composer built. */
  comment: async (
    base: string,
    id: ID,
    payload: CommentDraft,
  ): Promise<{ comment: Comment; count?: number }> => {
    const response = await api.post<{ comment: Comment; count?: number }>(
      `/${base}/${encodeURIComponent(id)}/comments/`,
      payload,
    );
    return response.data;
  },

  /** Rewords one respond, by its own row on its own table. */
  editComment: async (
    base: string,
    id: ID,
    payload: CommentDraft,
  ): Promise<{ comment: Comment }> => {
    const response = await api.patch<{ comment: Comment }>(
      `${commentTable(base)}/${encodeURIComponent(id)}/`,
      payload,
    );
    return response.data;
  },

  /** Takes one respond down. */
  removeComment: async (base: string, id: ID): Promise<unknown> => {
    const response = await api.delete<unknown>(`${commentTable(base)}/${encodeURIComponent(id)}/`);
    return response.data;
  },

  /** Agrees with one respond. Its likes are not on the card, so the caller re-reads. */
  likeComment: async (base: string, id: ID, on: boolean): Promise<unknown> => {
    const response = await api.post<unknown>(
      `${commentTable(base)}/${encodeURIComponent(id)}/like/`,
      { on },
    );
    return response.data;
  },

  /** The private threads on a post. The owner reads every reader's; a reader reads their own. */
  notes: async (base: string, id: ID): Promise<{ notes: Note[] }> => {
    const response = await api.get<{ notes: Note[] }>(
      `/${base}/${encodeURIComponent(id)}/notes/`,
    );
    return response.data;
  },

  /** Says a private thing to the post's owner, or answers them. */
  note: async (base: string, id: ID, payload: NoteDraft): Promise<{ note: Note }> => {
    const response = await api.post<{ note: Note }>(
      `/${base}/${encodeURIComponent(id)}/notes/`,
      payload,
    );
    return response.data;
  },

  /** Takes one note back, by its own row on its own table. */
  removeNote: async (base: string, id: ID): Promise<unknown> => {
    const response = await api.delete<unknown>(`${noteTable(base)}/${encodeURIComponent(id)}/`);
    return response.data;
  },

  // ---- mutes, and the studio ----------------------------------------------

  /** Nothing more from this author — or, with `on === false`, everything again. */
  muteAuthor: async (userId: ID, on?: boolean): Promise<unknown> => {
    const response = await api.post<unknown>(
      `/drops/mute/${encodeURIComponent(userId)}/`,
      on === undefined ? {} : { on },
    );
    return response.data;
  },

  /** Fewer of this format from now on. */
  muteFormat: async (format: string): Promise<unknown> => {
    const response = await api.post<unknown>(
      `/drops/formats/${encodeURIComponent(format)}/mute/`,
      {},
    );
    return response.data;
  },

  /** The studio's shelf: every clip of mine, with the numbers behind it. */
  studio: async (): Promise<VibeStudioList> => {
    const response = await api.get<VibeStudioList>("/drops/vibes/studio/");
    return response.data;
  },

  /** One clip's own page in the studio. */
  studioItem: async (id: ID): Promise<VibeStudioDetail> => {
    const response = await api.get<VibeStudioDetail>(
      `/drops/vibes/studio/${encodeURIComponent(id)}/`,
    );
    return response.data;
  },

  /** The window of watching behind one clip: one row a day. */
  studioAudience: async (id: ID): Promise<VibeStudioAudience> => {
    const response = await api.get<VibeStudioAudience>(
      `/drops/vibes/studio/${encodeURIComponent(id)}/audience/`,
    );
    return response.data;
  },

  // ---- what I did, and what I watched -------------------------------------

  /** My own shelf of doing: the posts I felt, and the lines I said. */
  activity: async (): Promise<ActivityData> => {
    const response = await api.get<ActivityData>("/drops/mine/activity/");
    return response.data;
  },

  /**
   * How a clip was watched, told to the server.
   *
   * `POST /reco/signals/` answers the size of the batch and never what it kept,
   * so there is nothing to read back — the caller adds its own `session` and
   * drops a failure rather than holding it.
   */
  signals: async (payload: Record<string, unknown>): Promise<unknown> => {
    const response = await api.post<unknown>("/reco/signals/", payload);
    return response.data;
  },
};

export default dropsService;
