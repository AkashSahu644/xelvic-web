/**
 * The addresses and the keys, in one place.
 *
 * Moved here from `src/lib/env.ts` so the shape is the one the reference web
 * app uses: `config/env` holds the addresses, `config/axios` holds the client,
 * and `services/*` holds every call. Nothing about the values changed — the
 * same `VITE_API_URL` / `VITE_WS_URL` variables, the same fallbacks.
 */

import { STORAGE_KEYS } from "@/constants/storage";

function stripSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const fallback = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://api.xelvic.com";

/** The server's own origin, with no path on it. */
export const API_ORIGIN = stripSlash(import.meta.env.VITE_API_URL || fallback);

/** What axios is pointed at, and what `apiUrl()` builds on. */
export const API_BASE = `${API_ORIGIN}/api/v1`;

/** The same thing under the name the reference app gives it. */
export const API_BASE_URL = API_BASE;

export const WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  API_ORIGIN.replace(/^http/, "ws");

export const ENABLE_DEV_LOGIN =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === "1";

export const APP_NAME = "Xelvic";

/**
 * Where the session lives.
 *
 * The reference app keeps its tokens in `localStorage`; this one keeps them in
 * `sessionStorage` (see `src/store/session.ts`, which also holds an in-memory
 * copy and the expiry listener). The names live in `constants/storage.ts` now,
 * beside every other key this app writes, so a key that is renamed is renamed
 * once. This alias stays because callers already read `TOKEN_KEYS`.
 */
export const TOKEN_KEYS = {
  ACCESS_TOKEN: STORAGE_KEYS.accessToken,
  REFRESH_TOKEN: STORAGE_KEYS.refreshToken,
} as const;

/** How long a request may hang before it is given up on. */
export const REQUEST_TIMEOUT_MS = 120_000;

/** A file body is allowed longer than a JSON body — see the 600 MB video limit. */
export const UPLOAD_TIMEOUT_MS = 600_000;
