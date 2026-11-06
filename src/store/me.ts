import { STORAGE_KEYS } from "@/constants/storage";
import type { Me } from "@/types/api";

/**
 * The last account the server described, remembered for the tab.
 *
 * This exists for one reason: `GET /auth/me/` sits between a reload and
 * anything being drawn, and its answer is almost always the one already known.
 * A remembered account lets `AuthProvider` start `authenticated`, so the shell,
 * the feed and the header paint immediately while the revalidation runs behind
 * them. See `store/session.ts` for the token this is paired with.
 *
 * It lives in `sessionStorage`, deliberately: the same lifetime as the access
 * token, gone when the tab is closed, and never shared with another tab. A
 * profile surviving a sign-out or a closed tab would be data nobody asked to
 * keep, and `clearMe` runs on both roads.
 */
const KEY = STORAGE_KEYS.me;

function usable(value: unknown): value is Me {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  const identified = typeof row.id === "string" || typeof row.id === "number";
  return identified && typeof row.username === "string" && row.username.length > 0;
}

/** The remembered account, or `null` when there is none to trust. */
export function readMe(): Me | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return usable(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Remember the account the server just answered. */
export function writeMe(me: Me | null): void {
  if (!me) {
    clearMe();
    return;
  }
  try {
    sessionStorage.setItem(KEY, JSON.stringify(me));
  } catch {
    // Storage can be full or disabled; the in-memory account still stands.
  }
}

/** Forget it — on sign-out, on an expired session, and on a refused token. */
export function clearMe(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nothing to do: the next read simply finds nothing.
  }
}