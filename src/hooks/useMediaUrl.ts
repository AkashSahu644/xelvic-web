import { useEffect, useState } from "react";
import { entryFor, peekMedia, releaseMedia } from "@/utils/mediaCache";

/** What a picture or clip element needs to know about its bytes. */
export interface MediaState {
  src: string | null;
  loading: boolean;
  failed: boolean;
}

/**
 * The bytes behind a media address, for one element.
 *
 * The read itself lives in `utils/mediaCache.ts`; this hook only subscribes to
 * it and keeps the entry's reference count honest, so a file that is still on
 * screen is never evicted while a file that has been left behind can be.
 *
 * `enabled` is what makes a feed cheap: a card that is nowhere near the screen
 * asks for nothing until it is. See `components/Media.tsx`, which flips it from
 * an `IntersectionObserver`.
 */
export function useMediaUrl(url: string | null | undefined, enabled = true): MediaState {
  const [state, setState] = useState<MediaState>(() => {
    if (url && /^(data:|blob:)/i.test(url)) return { src: url, loading: false, failed: false };
    // Already in hand from an earlier visit to this screen: draw it on the
    // first frame rather than a skeleton for the frame it takes to notice.
    const remembered = peekMedia(url);
    if (remembered) return { src: remembered, loading: false, failed: false };
    return { src: null, loading: !!url, failed: false };
  });

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
      releaseMedia(entry);
    };
  }, [url, enabled]);

  return state;
}