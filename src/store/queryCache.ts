import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { STORAGE_KEYS } from "@/constants/storage";
import { readMe } from "@/store/me";
import { session } from "@/store/session";

/**
 * The last answers the server gave, kept for the tab so a reload can draw them
 * before the network answers again.
 *
 * A reload used to begin with empty memory: every screen asked the server for
 * what it had just been showing, and while the request crossed, the page was a
 * skeleton. On a fast connection that is a blink; on the connection this app is
 * actually opened on — four to six hundred milliseconds before the first byte,
 * before any database work — it is the "data bahut late aata hai" that a reader
 * sees as the site being slow.
 *
 * This module keeps a copy of the small, frequently-read answers in
 * `sessionStorage`, hydrates them into the query client before the first render,
 * and lets TanStack Query revalidate behind the page exactly as it would if the
 * data had been in memory all along. Nothing here marks data trusted: the
 * timestamp is restored too, so a copy older than the query's `staleTime` is
 * stale on arrival and is refetched on mount.
 *
 * Three rules make it safe:
 *
 *   * **Everything the screens read is kept, except what has no meaning after a
 *     reload.** A feed, a tray, a shelf, a thread's messages, a profile, a
 *     drop — whatever was drawn once is drawn again on the next open, while
 *     the network is asked to confirm it. A search answer is not kept: it is
 *     the shape of one typed word, and the pickers behind "mention" are
 *     unbounded. See `TRANSIENT`.
 *   * **It belongs to one account.** The key carries the remembered account id,
 *     restore refuses without a token, and sign-out deletes every cached copy.
 *     A signed-out tab must not be able to paint somebody's feed from storage.
 *   * **It is bounded.** The newest answers are kept up to a byte budget, a
 *     single answer may not take more than a quarter of it, and a quota failure
 *     is swallowed rather than breaking the page.
 */

const VERSION = 2;
/** How old a copy may be and still be drawn. Refreshed behind the page. */
const MAX_AGE_MS = 30 * 60_000;
/** The whole copy's budget. `sessionStorage` is about 5 MB per origin. */
const MAX_BYTES = 2_500_000;
/** No single answer may take more than this. */
const MAX_ENTRY_BYTES = 400_000;

/**
 * Query keys that are deliberately *not* kept.
 *
 * A search answer belongs to the word that was typed and has no meaning when
 * the tab is reopened — restoring it would draw somebody else's results under a
 * new query. The mention and people pickers are unbounded. A QR session is a
 * live handshake with an expiry, and drawing an expired one would be a code
 * that cannot be scanned. Everything else is kept.
 */
const TRANSIENT = new Set([
  "audio-search",
  "chat-search",
  "group-people",
  "mentionable",
  "moments-mentionable",
  "people",
  "people-search",
  "own-qr",
  "qr",
  "search-people",
  "search-tracks",
]);

interface SavedQuery {
  key: QueryKey;
  data: unknown;
  updatedAt: number;
}

interface SavedCache {
  version: number;
  savedAt: number;
  queries: SavedQuery[];
}

function plainKey(key: QueryKey): (string | number | boolean)[] | null {
  const parts: (string | number | boolean)[] = [];
  for (const part of key) {
    if (typeof part === "string" || typeof part === "number" || typeof part === "boolean") {
      parts.push(part);
    } else {
      // A key holding an object or a Date cannot be restored as the same key
      // after a JSON round trip, and a key that changes is a second request.
      return null;
    }
  }
  return parts;
}

function isKept(key: (string | number | boolean)[]): boolean {
  const head = key[0];
  return typeof head === "string" && !TRANSIENT.has(head);
}

/**
 * Where this account's copy lives.
 *
 * The account id is part of the key rather than inside the value, so a sign-in
 * as somebody else cannot read the previous answer at all — the old key is
 * simply not the key being looked for.
 */
function storageKey(): string | null {
  const me = readMe();
  if (me?.id === undefined || me?.id === null) return null;
  return `${STORAGE_KEYS.queryCache}.${String(me.id)}`;
}

/** Delete every persisted copy, for every account that used this tab. */
export function clearPersistedQueries(): void {
  encoded.clear();
  try {
    const doomed: string[] = [];
    for (let index = 0; index < sessionStorage.length; index += 1) {
      const key = sessionStorage.key(index);
      if (key?.startsWith(`${STORAGE_KEYS.queryCache}.`) || key === STORAGE_KEYS.queryCache) {
        doomed.push(key);
      }
    }
    for (const key of doomed) sessionStorage.removeItem(key);
  } catch {
    // Storage refused; there is nothing to clear.
  }
}

/**
 * Put the last copy of the allow-listed answers into a fresh query client.
 *
 * Called before the first render. A missing or old copy is simply not
 * restored; a malformed one is deleted. Nothing in here may throw — a cached
 * answer is an optimisation, never a reason for a blank page.
 */
export function restoreQueryCache(client: QueryClient): void {
  // A token is the only thing that makes a cache meaningful, and the account
  // id is what makes it the right account's. Without both, the stored copy is
  // somebody else's and is removed rather than shown.
  if (!session.access()) {
    clearPersistedQueries();
    return;
  }
  const key = storageKey();
  if (!key) return;

  let raw: string | null;
  try {
    raw = sessionStorage.getItem(key);
  } catch {
    return;
  }
  if (!raw) return;

  try {
    const saved = JSON.parse(raw) as SavedCache;
    if (saved.version !== VERSION || !saved.savedAt) {
      clearPersistedQueries();
      return;
    }
    if (Date.now() - saved.savedAt > MAX_AGE_MS) {
      clearPersistedQueries();
      return;
    }
    for (const entry of saved.queries ?? []) {
      const parts = plainKey(entry.key);
      if (!parts || !isKept(parts)) continue;
      // `updatedAt` travels with the data: a copy that was already stale when
      // the tab closed is still stale now, and the first mount refetches it.
      client.setQueryData(entry.key, entry.data, {
        updatedAt: entry.updatedAt || saved.savedAt,
      });
    }
  } catch {
    clearPersistedQueries();
  }
}

/**
 * One answer's serialised form, kept until its data changes.
 *
 * `flush` runs after every quiet moment and most of the cache has not moved
 * since the last one. Re-serialising two megabytes of unchanged JSON on the
 * main thread is the kind of work that shows up as a stutter right after a page
 * has become readable, so an entry's string is reused while its `updatedAt` is
 * the same and only a new answer costs a `stringify`.
 */
const encoded = new Map<string, { updatedAt: number; json: string }>();

function encode(id: string, entry: SavedQuery): string | null {
  const prior = encoded.get(id);
  if (prior && prior.updatedAt === entry.updatedAt) return prior.json;
  try {
    const json = JSON.stringify(entry);
    encoded.set(id, { updatedAt: entry.updatedAt, json });
    return json;
  } catch {
    // A value that cannot be serialised is not restorable; skip only it.
    encoded.delete(id);
    return null;
  }
}

/** Write every kept answer, newest first, until the byte budget is spent. */
function flush(client: QueryClient): void {
  const key = storageKey();
  if (!key) return;
  if (!session.access()) {
    clearPersistedQueries();
    return;
  }

  const candidates: SavedQuery[] = [];
  for (const query of client.getQueryCache().getAll()) {
    if (query.state.status !== "success" || query.state.data === undefined) continue;
    const parts = plainKey(query.queryKey);
    if (!parts || !isKept(parts)) continue;
    candidates.push({
      key: query.queryKey,
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    });
  }
  candidates.sort((a, b) => b.updatedAt - a.updatedAt);

  const partId = (entry: SavedQuery) => JSON.stringify(entry.key);
  const parts: string[] = [];
  let bytes = 0;
  for (const entry of candidates) {
    const id = partId(entry);
    const json = encode(id, entry);
    if (!json) continue;
    // A single huge answer (a very long thread) would evict everything else;
    // it is not worth keeping, and the server can send it again.
    if (json.length > MAX_ENTRY_BYTES) {
      encoded.delete(id);
      continue;
    }
    if (bytes + json.length > MAX_BYTES) break;
    parts.push(json);
    bytes += json.length;
  }

  // Forget strings for answers that are no longer on the cache at all.
  if (encoded.size > parts.length) {
    const live = new Set(parts.map((json) => json));
    for (const [id, value] of encoded) {
      if (!live.has(value.json)) encoded.delete(id);
    }
  }

  try {
    if (parts.length === 0) sessionStorage.removeItem(key);
    else
      sessionStorage.setItem(
        key,
        `{"version":${VERSION},"savedAt":${Date.now()},"queries":[${parts.join(",")}]}`,
      );
  } catch {
    // Quota or a refused storage. Drop the old copy rather than keep failing.
    try {
      sessionStorage.removeItem(key);
    } catch {
      // Nothing else to do.
    }
  }
}

/**
 * Keep the persisted copy in step with the cache, without writing on every
 * render.
 *
 * Writes are coalesced: a page that loads five answers in a second writes once
 * shortly after. The `pagehide` flush is what makes a tab close — the moment
 * somebody returns to the site later — the last moment the copy matters.
 */
export function persistQueryCache(client: QueryClient): () => void {
  let timer: number | null = null;

  const schedule = () => {
    if (timer !== null) return;
    timer = window.setTimeout(() => {
      timer = null;
      flush(client);
    }, 900);
  };

  const unsubscribe = client.getQueryCache().subscribe((event) => {
    if (event.type !== "updated") return;
    schedule();
  });

  const onHide = () => {
    if (document.visibilityState === "hidden") flush(client);
  };
  window.addEventListener("pagehide", onHide);
  document.addEventListener("visibilitychange", onHide);

  return () => {
    unsubscribe();
    window.removeEventListener("pagehide", onHide);
    document.removeEventListener("visibilitychange", onHide);
    if (timer !== null) window.clearTimeout(timer);
  };
}