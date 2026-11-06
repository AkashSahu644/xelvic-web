import type { ThreadCard, UserCard } from "@/types/api";

export function threadTitle(thread: ThreadCard) {
  if (thread.title) return thread.title;
  const person = thread.other ?? thread.member ?? thread.members?.[0]?.user;
  return person?.name || person?.username || "Conversation";
}

export function threadFace(thread: ThreadCard): UserCard | undefined {
  return thread.other ?? thread.member ?? thread.members?.[0]?.user;
}

export function stamp(iso: string | null | undefined) {
  if (!iso) return "";
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const gap = Date.now() - at;
  const minutes = Math.floor(gap / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/** How many lines a row says are waiting in it. */
export function threadUnread(thread: ThreadCard): number {
  return thread.unread_count ?? thread.unread ?? 0;
}

/**
 * The part of a row's count that is *not* a Spark still waiting.
 *
 * Null rather than nought when the card does not carry the key. Nought is a real
 * answer from the server and a missing key is not.
 */
export function threadUnreadOther(thread: ThreadCard): number | null {
  const value = thread.unread_other_count;
  return typeof value === "number" ? value : null;
}

/**
 * Whether a convo belongs on the Unread lane.
 *
 * The lane follows the same count as the row's badge and tint: every convo with
 * at least one waiting line belongs here.
 */
export function inUnreadLane(thread: ThreadCard): boolean {
  return threadUnread(thread) > 0;
}

/**
 * What one chat-list row says under the name.
 *
 * **Never the message itself.** A chat list is the screen people read over your
 * shoulder, so the last line of a private conversation has no business on it —
 * the owner's rule, and the phone has kept it since the list was written
 * (`screens/home.dart::listLine`, whose comment this is). What is left is the
 * four things a row can honestly say: an invitation when there is nothing in it,
 * my own run's receipt word, how many lines are waiting, and that nothing is.
 *
 * This client printed the preview instead, with a `You:` prefix on my own
 * messages, a stub word per attachment kind ("Photo", "A drop"), and
 * "N new messages" only when there was no preview to describe. Two of those
 * divergences are visible and one is not: "messages" is a noun this product does
 * not use anywhere else, and `preview.text` is the leak the rule exists to
 * prevent.
 *
 * The receipt word is the server's own — `Sent`, `Delivered`, `Opened`, and
 * `Waiting` while the gate holds the line — and it describes *my* last line and
 * not the row. It is printed as it arrives, which in this client is as the phone
 * prints it: the mapping in `sparks.dart`'s sibling `home.dart::receiptWord`
 * exists so a Hindi or Arabic screen does not carry four English words, and this
 * client has one language and does not need the table.
 */
export function listLine(thread: ThreadCard, unread: number): string {
  const status = (thread.status ?? "").trim();
  const preview = thread.preview;
  const hasPreview = Boolean(preview && Object.keys(preview).length);

  // A convo with myself is the one row that says something of its own: there is
  // no second person whose words could be the line, so the only two things it
  // can report are how far my own newest one got and that there is nothing in it
  // yet. "Say something" is not that — it is an invitation to a conversation,
  // and this is the one convo where the invitation is the whole of it.
  if (thread.self) return status || "Convo with yourself";

  if (!hasPreview) return "Say something";
  if (preview?.mine && status) return status;
  // A count of what is waiting, with no noun at all: "message" is a word this
  // product does not use, and "convos" would be a lie — they are all in one.
  if (unread > 0) return unread === 1 ? "1 new" : `${unread} new`;
  return "Nothing new";
}

/**
 * How the line under a name is coloured.
 *
 * It takes the line itself rather than the receipt word behind it, because the
 * two can disagree: a run of theirs with nothing since draws "Nothing new", and
 * a colour picked from a receipt that is not on screen ends up pointing at the
 * words "Nothing new" in the accent. Deciding both from the one thing that is
 * actually written is what keeps them from ever disagreeing.
 *
 * "Opened" is the end of a journey and the one word worth pointing at, so it
 * takes the accent whether or not anything is waiting. Everything else is either
 * waiting (and so reads as full-strength text) or quiet.
 */
export function lineTone(line: string, unread: number) {
  if (line === "Opened") return { className: "font-bold text-accent" };
  if (unread > 0) return { className: "font-semibold text-ink" };
  return { className: "font-normal text-dim" };
}
