import {
  BarChart3,
  FileText,
  Image,
  LayoutGrid,
  MapPin,
  Mic,
  Music,
  Podcast,
  Users,
  Video,
  Zap,
  type LucideIcon,
} from "lucide-react";

/**
 * One thing arriving that somebody is not looking at.
 *
 * Ported from `Notice` in `app/lib/notices.dart`, and carried on exactly the
 * same road: the `notice` field inside a `thread.update` frame. The phone's
 * version has fields the socket never fills — a push address, a link to
 * something that is not a conversation, which account the push belonged to —
 * and none of them are here, because the socket frame is the only road this
 * build has and a field with no source is a field that can only be invented.
 */
export interface Notice {
  /** The conversation it belongs to, which is also where a tap goes. */
  thread: string;
  from: NoticePerson;
  /** The conversation's own preview — what its list row says. */
  preview: string;
  /**
   * What a *notification* says, when the server wrote words of its own.
   *
   * Not `preview`, and that is the whole point: a notification is read over a
   * shoulder as often as by the person it was sent to, so a message is
   * announced as a message ("sent you a convo") and what was written stays in
   * the conversation. `chat.notices.row_words` is the other end of this.
   */
  row: string;
  /** The bubble's kind, so a notice with no words can still be drawn. */
  kind: string;
  group: boolean;
  title: string;
  /** Which room of a group it was said in, or "". */
  room: string;
  ordinal: number;
  card: NoticeCard | null;
  mention: boolean;
  by: string;
  media: NoticeMedia | null;
  at: string | null;
  /** Whether the person this was built for has that conversation muted. */
  muted: boolean;
}

export interface NoticePerson {
  id: string;
  username: string;
  name: string;
  verified: boolean;
  /** The account's own photograph, as a storage path (`/media/...`) or None. */
  avatar: string | null;
  /** The shelf figure they wear; "" for almost every account. */
  character: string;
  /** The theme whose character an account wearing nothing is drawn as. */
  theme: string;
  /** The shop's picture of that figure, when the shelf has one. */
  dp: string | null;
}

export interface NoticeCard {
  id: string;
  kind: string;
  body: string;
  author: { username: string; name: string } | null;
  still: string | null;
}

export interface NoticeMedia {
  kind: string;
  thumb: string | null;
  content: string | null;
  ratio: number | null;
  durationMs: number | null;
  name: string;
}

/** What the server calls a typing note. `chat.notices.TYPING_KIND`. */
export const TYPING_KIND = "typing";

/** What a typing note says under the name. `chat.notices.TYPING_WORDS`. */
export const TYPING_WORDS = "is typing...";

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function orNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}

function numOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * The notice a `thread.update` frame carries, or null when it carries none.
 *
 * Null is the ordinary answer for most frames: a frame without a notice is a
 * seat changing (an unread count, a rename), and a notice with no conversation
 * names nowhere to go and is refused here rather than drawn as a dead row.
 */
export function noticeFrom(raw: unknown): Notice | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  const thread = text(data.thread);
  if (!thread) return null;
  const person = data.from && typeof data.from === "object" ? (data.from as Record<string, unknown>) : {};
  const id = text(person.id);
  if (!id) return null;

  const cardSource = data.card && typeof data.card === "object" ? (data.card as Record<string, unknown>) : null;
  const author = cardSource?.author && typeof cardSource.author === "object" ? (cardSource.author as Record<string, unknown>) : null;
  const mediaSource = data.media && typeof data.media === "object" ? (data.media as Record<string, unknown>) : null;
  const mediaKind = text(mediaSource?.kind);

  return {
    thread,
    from: {
      id,
      username: text(person.username),
      name: text(person.name) || text(person.username),
      verified: person.verified === true,
      avatar: orNull(person.avatar),
      character: text(person.character),
      theme: text(person.theme),
      dp: orNull(person.dp),
    },
    preview: text(data.preview),
    row: text(data.row),
    kind: text(data.kind) || "text",
    group: data.group === true,
    title: text(data.title),
    room: text(data.room),
    ordinal: typeof data.ordinal === "number" ? data.ordinal : 0,
    card: cardSource
      ? {
          id: text(cardSource.id),
          kind: text(cardSource.kind),
          body: text(cardSource.body),
          author: author
            ? { username: text(author.username), name: text(author.name) }
            : null,
          still: orNull(cardSource.still),
        }
      : null,
    mention: data.mention === true,
    by: text(data.by),
    media: mediaKind
      ? {
          kind: mediaKind,
          thumb: orNull(mediaSource?.thumb),
          content: orNull(mediaSource?.content),
          ratio: numOrNull(mediaSource?.ratio),
          durationMs: numOrNull(mediaSource?.duration_ms),
          name: text(mediaSource?.name),
        }
      : null,
    at: orNull(data.at),
    muted: data.muted === true,
  };
}

/** Whether this is the note that somebody has started typing. */
export function noticeIsTyping(notice: Notice) {
  return notice.kind === TYPING_KIND;
}

/**
 * What the notice calls itself: the group's name, or whoever spoke.
 *
 * A group's own title, because on a direct conversation the same field is the
 * other person's name and saying it twice — once as the title and once as the
 * sender — is the drawing the phone avoids too.
 */
export function noticeWho(notice: Notice) {
  if (notice.group && notice.title.trim()) return notice.title.trim();
  return notice.from.name || notice.from.username || "Someone";
}

/**
 * The second line, decorated for a group.
 *
 * In a group the speaker's name goes first, because "ten?" on its own does not
 * say who is asking — and so does the room, because the group is where
 * everybody is and the room is where this was said. `Notice._second` is the
 * same function on the phone.
 */
export function noticeSecond(notice: Notice, words: string) {
  const line = words.trim();
  if (noticeIsTyping(notice)) return line || TYPING_WORDS;
  const who = notice.from.name || notice.from.username;
  if (notice.group && who && line) {
    const said = notice.room.trim() ? `${who} in #${notice.room.trim()}` : who;
    return `${said}: ${line}`;
  }
  return line;
}

/** The conversation's own line, as its list row says it. */
export function noticeLine(notice: Notice) {
  return noticeSecond(notice, notice.preview);
}

/**
 * The line every *notification* says — the strip, and the tab's own row.
 *
 * The server's words when it sent any, decorated exactly the way the
 * conversation's line is; that line itself when it did not. The decoration is
 * shared because it is one sentence either way: "who said it, and which room
 * of the group they said it in" is a fact about the conversation, and the two
 * lines differ only in what they are about.
 */
export function noticeRowLine(notice: Notice) {
  const given = notice.row.trim();
  return given ? noticeSecond(notice, given) : noticeLine(notice);
}

/** Where a tap on the strip goes. A notice always names a conversation. */
export function noticeHref(notice: Notice) {
  return notice.thread ? `/app/convo/${encodeURIComponent(notice.thread)}` : null;
}

/**
 * A small mark for the bubbles that are not words.
 *
 * The line already says "Photo" or "Voice note", so this is not carrying the
 * meaning — it is what makes the strip readable at a glance, before the words
 * are. The same table as `_glyph` in `notice_banner.dart`.
 */
export function noticeGlyph(kind: string): LucideIcon | null {
  switch (kind) {
    case "image":
      return Image;
    case "video":
      return Video;
    case "voice":
      return Mic;
    case "audio":
      return Music;
    case "doc":
      return FileText;
    case "location":
      return MapPin;
    case "poll":
      return BarChart3;
    case "vibe":
      return Zap;
    case "drop":
      return LayoutGrid;
    case "live":
      return Podcast;
    case "collab":
      return Users;
    default:
      return null;
  }
}