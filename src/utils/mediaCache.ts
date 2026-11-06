import { isBackendMediaPath, mediaUrl } from "@/config/urls";
import { mediaService } from "@/services/media.service";
import { readMe } from "@/store/me";

/**
 * The bytes behind a media address, kept for as long as the tab lives.
 *
 * This module is deliberately free of React: it is a cache and a loader, and
 * the hook that reads it is `hooks/useMediaUrl.ts`. Keeping the two apart is
 * what lets `peekMedia` and `mediaBlob` be called from places that are not
 * components at all — a download, a share, a preload — without dragging the
 * component tree's concerns in with them.
 */

export interface MediaEntry {
  refs: number;
  promise: Promise<string>;
  objectUrl: string | null;
  failed: boolean;
}

const cache = new Map<string, MediaEntry>();

/**
 * How many files this tab keeps the bytes of.
 *
 * The first version of this cache let go of a file thirty seconds after the
 * last thing drawing it went away, which is the right answer for a screen and
 * the wrong one for a feed: a thumb scrolled past and scrolled back to asked
 * the server for the same picture again, and the same clip was downloaded twice
 * in a minute. A feed is walked backwards as often as forwards.
 *
 * The retention is counted in files rather than in bytes because the number
 * the reader feels is the second one — a page of pictures arriving already
 * decoded — and a byte cap small enough to be honest would evict a page of
 * pictures for one clip. The cap is larger than any page the app asks for, so
 * a screenful and the one before it stay; the oldest a-screen-and-a-half-ago
 * is what goes. Files still on screen are never evicted.
 */
const CACHE_LIMIT = 160;

/**
 * The bytes also go to the browser's own disk cache, so a reload does not
 * download them again.
 *
 * `Cache Storage` is used rather than the HTTP cache because these reads are
 * made with `fetch`/XHR and an `Authorization` header: the browser does not put
 * them in the HTTP cache, so every reload re-downloaded every picture in the
 * feed — and with a first byte four hundred milliseconds away, that is exactly
 * "card aa jaata hai, photo baad me aati hai". The Cache API is the one store
 * a page may write to and read by URL, and it survives a reload and a new tab.
 *
 * Entries are keyed by the absolute address, in a cache named after the
 * account, so one account's pictures are never drawn for another. Sign-out
 * deletes the caches (see `clearMediaCache`).
 */
const STORE_PREFIX = "xelvic-media-";
/** Files kept on disk. A browser evicts the oldest under quota pressure too. */
const STORE_ENTRIES = 400;
/**
 * A single file larger than this is not kept.
 *
 * Big enough for the clips a feed plays and the tracks the player streams — a
 * fifteen-second vibe or a four-minute song is a file the reader asks for again
 * — and small enough that a long video does not sit on disk in place of a page
 * of pictures. The browser evicts the whole cache under quota pressure; the
 * `put` is guarded for exactly that.
 */
const STORE_MAX_BYTES = 20 * 1024 * 1024;

let storePromise: Promise<Cache | null> | null = null;
let storeFor: string | null = null;

function storeName(): string {
  const id = readMe()?.id;
  return `${STORE_PREFIX}${id === undefined || id === null ? "guest" : String(id)}`;
}

/** The tab's disk cache, opened once per account. */
function store(): Promise<Cache | null> {
  if (typeof caches === "undefined") return Promise.resolve(null);
  const name = storeName();
  if (!storePromise || storeFor !== name) {
    storeFor = name;
    storePromise = caches.open(name).catch(() => null);
  }
  return storePromise;
}

/** The disk copy of an address, or `null`. Exported for its own test. */
export async function storedMedia(url: string): Promise<Blob | null> {
  const cache = await store();
  if (!cache) return null;
  try {
    const hit = await cache.match(url);
    return hit ? await hit.blob() : null;
  } catch {
    return null;
  }
}

/** Keep the bytes on disk. Exported for its own test. */
export async function rememberMedia(url: string, blob: Blob): Promise<void> {
  if (blob.size > STORE_MAX_BYTES) return;
  const cache = await store();
  if (!cache) return;
  try {
    await cache.put(
      url,
      new Response(blob, {
        headers: { "Content-Type": blob.type || "application/octet-stream" },
      }),
    );
    const keys = await cache.keys();
    for (let index = 0; index < keys.length - STORE_ENTRIES; index += 1) {
      await cache.delete(keys[index]);
    }
  } catch {
    // Quota or a refused cache: the tab's memory copy still stands.
  }
}

/** Forget every picture kept on disk, for every account that used this browser. */
export async function clearMediaCache(): Promise<void> {
  if (storePromise) {
    storePromise = null;
    storeFor = null;
  }
  if (typeof caches === "undefined") return;
  try {
    const names = await caches.keys();
    await Promise.all(
      names.filter((name) => name.startsWith(STORE_PREFIX)).map((name) => caches.delete(name)),
    );
  } catch {
    // Storage refused; there is nothing to clear.
  }
}

/**
 * How many files may be crossing the wire at once.
 *
 * A feed that comes into view asks for every picture near it in the same tick:
 * a rail of clips, a dozen avatars, the photographs in three cards. Those are
 * ordinary requests, and they compete with the request the page actually needs
 * — the next page of JSON. On HTTP/1.1 the browser opens six connections to
 * the origin and every further request queues behind them; even on HTTP/2 a
 * burst of a dozen media reads is a dozen streams on the same connection as the
 * one API call that must not wait.
 *
 * Six matches what a browser will open to one HTTP/1.1 host, and the pictures a
 * screenful actually needs are few enough that six drains in one pass. The ones
 * nearest the screen are asked for first because they are the ones observed
 * first, and the feed's JSON is still not last in line behind an album. A read
 * answered from the disk cache never takes a slot at all.
 */
const MAX_IN_FLIGHT = 6;
let inFlight = 0;
const waiting: (() => void)[] = [];

async function withMediaSlot<T>(read: () => Promise<T>): Promise<T> {
  if (inFlight >= MAX_IN_FLIGHT) {
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  inFlight += 1;
  try {
    return await read();
  } finally {
    inFlight -= 1;
    // Hand the slot straight to the next reader rather than waiting for it to
    // notice a slot is free.
    waiting.shift()?.();
  }
}

/** Move a file to the young end of the cache, so the cap evicts the quiet ones. */
function touch(url: string, entry: MediaEntry) {
  if (cache.get(url) === entry && cache.size > 0) {
    cache.delete(url);
    cache.set(url, entry);
  }
}

function evict() {
  if (cache.size <= CACHE_LIMIT) return;
  for (const [url, entry] of cache) {
    if (cache.size <= CACHE_LIMIT) return;
    if (entry.refs > 0) continue;
    cache.delete(url);
    if (entry.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.objectUrl);
  }
}

/**
 * The bytes behind a media address, through the account's own credentials.
 *
 * One road for every read of a private file: the token when there is one, the
 * cookie always, and a single renewal on a 401 — the same three steps the
 * pictures and clips in this app have always taken. It is named and exported
 * because a *download* needs the bytes rather than an element: handing the
 * browser a bare address to save would ask for a private file with no
 * Authorization header at all, and would put the server's error page on disk
 * under the picture's own name. See `DropMenu`'s "Save to gallery".
 */
export function mediaBlob(url: string): Promise<Blob> {
  return mediaService.blob(url);
}

async function loadMedia(url: string): Promise<string> {
  const absolute = mediaUrl(url);
  if (!absolute) throw new Error("No media URL");
  if (/^(data:|blob:)/i.test(absolute)) return absolute;

  // Public assets (CDN avatars, covers, etc.) must load directly: an `<img>` a
  // CDN will serve is a picture, while the same address read through `fetch`
  // is a cross-origin request the CDN answers no CORS headers for.
  try {
    if (!isBackendMediaPath(new URL(absolute).pathname)) return absolute;
  } catch {
    // Fall through to the authenticated request for malformed URLs.
  }

  // The disk copy first, and it does not queue for a network slot: a picture
  // already in the browser's own store is a picture that is on screen now.
  const stored = await storedMedia(absolute);
  if (stored) return URL.createObjectURL(stored);

  const blob = await withMediaSlot(() => mediaBlob(absolute));
  // Writing the copy is not on the critical path — the picture is drawn from
  // the bytes already in hand, and the next open reads them from disk.
  void rememberMedia(absolute, blob);
  return URL.createObjectURL(blob);
}

/**
 * The cache entry for an address, starting the read if this is its first ask.
 *
 * Exported for `useMediaUrl`, which counts how many things are drawing an
 * entry (`refs`) so the eviction pass above can leave it alone.
 */
export function entryFor(url: string): MediaEntry {
  const existing = cache.get(url);
  if (existing) {
    touch(url, existing);
    return existing;
  }
  const entry: MediaEntry = {
    refs: 0,
    objectUrl: null,
    failed: false,
    promise: Promise.resolve(""),
  };
  entry.promise = loadMedia(url)
    .then((objectUrl) => {
      entry.objectUrl = objectUrl;
      return objectUrl;
    })
    .catch((error: unknown) => {
      entry.failed = true;
      throw error;
    });
  cache.set(url, entry);
  evict();
  return entry;
}

/**
 * Let go of the count, not of the file.
 *
 * The bytes stay in the cache until the cap evicts them: a picture scrolled
 * past and scrolled back to is a picture that should already be on the screen,
 * and asking the server for it again is the slow part of a feed.
 */
export function releaseMedia(entry: MediaEntry) {
  void entry;
}

/**
 * The bytes already in hand for an address, without asking for them.
 *
 * Read on the first render of a picture so one that has been on screen before
 * draws immediately instead of flashing a skeleton for a frame. `null` means
 * "not fetched yet", not "not there".
 */
export function peekMedia(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(data:|blob:)/i.test(url)) return url;
  const entry = cache.get(url);
  if (!entry) return null;
  touch(url, entry);
  return entry.objectUrl;
}

