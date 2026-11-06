import {
  useEffect,
  useMemo,
  type FocusEventHandler,
  type MouseEventHandler,
  type TouchEventHandler,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { preloadRoute } from "@/routes/lazyPages";
import { prefetchRouteData } from "@/routes/prefetchData";

export interface PrefetchHandlers {
  onMouseEnter: MouseEventHandler<HTMLElement>;
  onFocus: FocusEventHandler<HTMLElement>;
  onTouchStart: TouchEventHandler<HTMLElement>;
}

/**
 * Handlers that warm a route's code the moment somebody shows intent to visit.
 *
 * A router only starts downloading a page after the click has already landed,
 * which is why the first visit to a tab is the slow one: the click waits for a
 * chunk the browser did not know it needed. Hovering a link on a desktop, or
 * touching a tab on a phone, happens a beat before the click does, and that
 * beat is enough to fetch a small chunk over an ordinary connection.
 *
 * `onFocus` is there for keyboards: tabbing to a link is the same intent as
 * hovering it, and a keyboard user should not pay the one-page-is-slow tax
 * either.
 *
 * Nothing here tracks whether the route was already warmed. A dynamic `import`
 * is deduplicated by the module loader itself, so a second call is a promise
 * lookup rather than a second download.
 */
export function useRoutePrefetch(to: string): PrefetchHandlers {
  const client = useQueryClient();
  return useMemo(() => {
    // Both halves of the wait: the page's chunk and the first answer it draws.
    // A duplicate hover is free — the module loader dedupes the import and
    // TanStack Query dedupes the request while it is in flight or fresh.
    const warm = () => {
      preloadRoute(to);
      prefetchRouteData(client, to);
    };
    return {
      onMouseEnter: warm,
      onFocus: warm,
      onTouchStart: warm,
    };
  }, [to, client]);
}

/**
 * Warm a list of routes while the browser is idle.
 *
 * Called once by the shell with its own tabs. `requestIdleCallback` is what
 * makes this safe to do during a first load: the work runs only in a gap after
 * the page has painted, and the timeout is the promise that a browser with no
 * gaps still gets to it eventually rather than postponing it forever.
 *
 * Two layers, deliberately apart in time. The page *chunks* are warmed in the
 * idle gap. The page *answers* wait another beat, because the first screen is
 * still asking for its own pictures at that moment and a tab nobody has tapped
 * should not be taking the connection from the tab that is on screen.
 */
export function useIdlePrefetch(paths: readonly string[], enabled = true): void {
  const client = useQueryClient();
  useEffect(() => {
    if (!enabled) return;

    // Warming five pages is a courtesy, not a right. On a metered or very slow
    // connection the reader has said they would rather not spend data on
    // things they may not open, so the courtesy waits for a better moment.
    const connection = (
      navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      connection?.saveData ||
      connection?.effectiveType === "slow-2g" ||
      connection?.effectiveType === "2g"
    ) {
      return;
    }

    let cancelled = false;
    let dataTimer = 0;

    const run = () => {
      if (cancelled) return;
      for (const path of paths) preloadRoute(path);
      // The answers, once the screen that is actually open has had its moment.
      dataTimer = window.setTimeout(() => {
        if (cancelled) return;
        for (const path of paths) prefetchRouteData(client, path);
      }, 1200);
    };

    const stop = () => {
      cancelled = true;
      window.clearTimeout(dataTimer);
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(run, { timeout: 1500 });
      return () => {
        stop();
        window.cancelIdleCallback(id);
      };
    }

    const id = window.setTimeout(run, 400);
    return () => {
      stop();
      window.clearTimeout(id);
    };
  }, [paths, enabled, client]);
}