import type { QueryClient } from "@tanstack/react-query";
import type { Drop, SpaceRoom, ThreadCard, ThreadDetail } from "@/types/api";

/**
 * The rows already in hand, read out of the cache instead of asked for again.
 *
 * Opening a drop from the feed used to start empty: the feed's own copy of that
 * drop was in memory, in the page the reader had *just tapped*, and the page it
 * opened threw that copy away and asked the server for the same row. On a
 * connection where the first byte takes four hundred milliseconds, that is a
 * card that is already on screen in one place and a skeleton in another.
 *
 * These helpers find the row in whatever list cached it. They never fetch, never
 * write, and never decide whether the row is fresh: the page still makes its own
 * request, and the server's answer replaces the seed when it lands. The seed is
 * what the first frame draws, not what the page believes.
 *
 * A seed is a *display* value and not a cached answer — it is passed as
 * `placeholderData`, which TanStack Query deliberately does not write into the
 * cache, so a stale row can never be mistaken for a fresh one by another screen.
 */

/**
 * The rows inside a cached answer, flattening infinite pages.
 *
 * Different screens name their list differently — a feed page carries
 * `results`, the saved shelf carries `items`, a drop sent into a convo carries
 * a single `drop` — so a caller passes every field it is willing to read and
 * gets whichever of them is there.
 */
function rowsOf(data: unknown, fields: readonly string[]): unknown[] {
  if (!data || typeof data !== "object") return [];
  const record = data as Record<string, unknown>;
  if (Array.isArray(record.pages)) {
    return record.pages.flatMap((page) => rowsOf(page, fields));
  }
  const rows: unknown[] = [];
  for (const field of fields) {
    const value = record[field];
    if (Array.isArray(value)) rows.push(...value);
    else if (value && typeof value === "object") rows.push(value);
  }
  return rows;
}

/**
 * The first row with this id in any cached answer whose key starts with one of
 * `heads`, read from one of the named fields of that answer.
 */
function findRow<T>(
  client: QueryClient,
  heads: readonly string[],
  fields: readonly string[],
  id: string | number,
): T | null {
  const wanted = String(id);
  if (!wanted) return null;
  for (const query of client.getQueryCache().getAll()) {
    const head = query.queryKey[0];
    if (typeof head !== "string" || !heads.includes(head)) continue;
    for (const row of rowsOf(query.state.data, fields)) {
      if (!row || typeof row !== "object") continue;
      if (String((row as { id?: unknown }).id) === wanted) return row as T;
    }
  }
  return null;
}

/**
 * The lists that can carry a drop the reader is about to open.
 *
 * `drops` is the feed and the vibes walk, `profile-shelf`/`profile-vibes` are a
 * person's wall, `tag` is a word's shelf, `saved-shelf` is what was saved, and
 * `chat-drop` is a drop sent into a convo and opened from the message.
 */
const DROP_LISTS = ["drops", "profile-shelf", "profile-vibes", "tag", "saved-shelf", "chat-drop"];

export function cachedDrop(client: QueryClient, id: string | number): Drop | null {
  return findRow<Drop>(client, DROP_LISTS, ["results", "items", "drop", "vibe"], id);
}

/** Rooms as the Live shelves cached them, for opening one from a shelf. */
export function cachedRoom(client: QueryClient, id: string | number): SpaceRoom | null {
  return findRow<SpaceRoom>(client, ["rooms"], ["rooms"], id);
}

/**
 * The convo's own row as the Convo tab cached it, for the chat's header.
 *
 * The list types a `gate` as a code *or* an object while the thread's own
 * answer types it as an object only, so a row carrying a string gate is not
 * seeded at all: the chat would otherwise read a refusal as "no gate" for the
 * first few hundred milliseconds. A row without one is the header — name, face,
 * members, wallpaper — which is the whole of what this is for.
 */
export function cachedThread(client: QueryClient, id: string | number): ThreadDetail | null {
  const card = findRow<ThreadCard>(client, ["threads", "threads-aside", "threads-share"], ["threads"], id);
  if (!card || typeof card.gate === "string") return null;
  return card as ThreadDetail;
}