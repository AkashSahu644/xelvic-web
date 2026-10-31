function stripSlash(value: string) {
  return value.replace(/\/+$/, "");
}

const fallback = import.meta.env.DEV ? "http://127.0.0.1:8000" : "https://api.xelvic.com";

export const API_ORIGIN = stripSlash(import.meta.env.VITE_API_URL || fallback);
export const API_BASE = `${API_ORIGIN}/api/v1`;

export const WS_ORIGIN =
  import.meta.env.VITE_WS_URL ||
  API_ORIGIN.replace(/^http/, "ws");

export const ENABLE_DEV_LOGIN =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_LOGIN === "1";
