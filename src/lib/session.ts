import type { AuthTokens } from "@/types/api";

const ACCESS_KEY = "xelvic.access";
const REFRESH_KEY = "xelvic.refresh";

function read(key: string) {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {
    // Storage can be disabled; the in-memory copy below still works.
  }
}

let accessToken: string | null = read(ACCESS_KEY);
let refreshToken: string | null = read(REFRESH_KEY);
let onExpire: (() => void) | null = null;

export const session = {
  access: () => accessToken,
  refresh: () => refreshToken,
  set(tokens: AuthTokens) {
    accessToken = tokens.access;
    refreshToken = tokens.refresh ?? refreshToken;
    write(ACCESS_KEY, accessToken);
    write(REFRESH_KEY, refreshToken);
  },
  setAccess(access: string) {
    accessToken = access;
    write(ACCESS_KEY, access);
  },
  setRefresh(refresh: string | null) {
    refreshToken = refresh;
    write(REFRESH_KEY, refresh);
  },
  clear() {
    accessToken = null;
    refreshToken = null;
    write(ACCESS_KEY, null);
    write(REFRESH_KEY, null);
  },
  onExpire(listener: (() => void) | null) {
    onExpire = listener;
  },
  expire() {
    session.clear();
    onExpire?.();
  },
};
