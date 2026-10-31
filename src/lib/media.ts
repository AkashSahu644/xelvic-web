import { useEffect, useState } from "react";
import { isBackendMediaPath, mediaUrl, refreshAccessToken } from "@/lib/api";
import { session } from "@/lib/session";

interface MediaEntry {
  refs: number;
  promise: Promise<string>;
  objectUrl: string | null;
  failed: boolean;
}

const cache = new Map<string, MediaEntry>();

async function loadMedia(url: string): Promise<string> {
  const absolute = mediaUrl(url);
  if (!absolute) throw new Error("No media URL");
  if (/^(data:|blob:)/i.test(absolute)) return absolute;

  // Public assets (CDN avatars, covers, etc.) must load directly. Fetching
  // them with auth headers triggers a CORS preflight the CDN does not answer.
  try {
    if (!isBackendMediaPath(new URL(absolute).pathname)) return absolute;
  } catch {
    // Fall through to the authenticated request for malformed URLs.
  }

  const requestOnce = async () => {
    const headers: Record<string, string> = {};
    const token = session.access();
    if (token) headers.Authorization = `Bearer ${token}`;
    return fetch(absolute, { headers, credentials: "include" });
  };

  let response = await requestOnce();
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await requestOnce();
  }
  if (!response.ok) throw new Error(`Media request failed (${response.status})`);
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

function entryFor(url: string): MediaEntry {
  const existing = cache.get(url);
  if (existing) return existing;
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
  return entry;
}

function release(url: string, entry: MediaEntry) {
  window.setTimeout(() => {
    if (entry.refs > 0) return;
    if (entry.objectUrl?.startsWith("blob:")) URL.revokeObjectURL(entry.objectUrl);
    if (cache.get(url) === entry) cache.delete(url);
  }, 30_000);
}

export interface MediaState {
  src: string | null;
  loading: boolean;
  failed: boolean;
}

export function useMediaUrl(url: string | null | undefined, enabled = true): MediaState {
  const [state, setState] = useState<MediaState>(() =>
    url && /^(data:|blob:)/i.test(url) ? { src: url, loading: false, failed: false } : { src: null, loading: !!url, failed: false },
  );

  useEffect(() => {
    if (!url || !enabled) {
      setState({ src: null, loading: false, failed: false });
      return;
    }
    if (/^(data:|blob:)/i.test(url)) {
      setState({ src: url, loading: false, failed: false });
      return;
    }
    let cancelled = false;
    const entry = entryFor(url);
    entry.refs += 1;
    setState({ src: entry.objectUrl, loading: !entry.objectUrl, failed: false });
    entry.promise
      .then((objectUrl) => {
        if (!cancelled) setState({ src: objectUrl, loading: false, failed: false });
      })
      .catch(() => {
        if (!cancelled) setState({ src: null, loading: false, failed: true });
      });
    return () => {
      cancelled = true;
      entry.refs -= 1;
      release(url, entry);
    };
  }, [url, enabled]);

  return state;
}
