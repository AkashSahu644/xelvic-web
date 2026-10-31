import { API_BASE, API_ORIGIN } from "@/lib/env";
import { ApiError, errorFromResponse } from "@/lib/errors";
import { session } from "@/lib/session";

type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  signal?: AbortSignal;
  headers?: Record<string, string>;
  query?: Record<string, QueryValue>;
  attempt?: number;
}

let refreshPromise: Promise<boolean> | null = null;

function withQuery(url: string, query?: Record<string, QueryValue>) {
  if (!query) return url;
  const parsed = new URL(url, typeof window === "undefined" ? API_ORIGIN : window.location.origin);
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    parsed.searchParams.set(key, String(value));
  });
  if (url.startsWith("http")) return parsed.toString();
  return `${parsed.pathname}${parsed.search}`;
}

export function apiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function apiPathFrom(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const base = new URL(`${API_BASE}/`);
    const parsed = new URL(url, base);
    const prefix = base.pathname.replace(/\/$/, "");
    const path = parsed.pathname.startsWith(prefix) ? parsed.pathname.slice(prefix.length) : parsed.pathname;
    return `${path || "/"}${parsed.search}`;
  } catch {
    return url;
  }
}

const BACKEND_MEDIA_PATH = /^\/(?:api|media|ws)(?:\/|$)/;

export function isBackendMediaPath(pathname: string): boolean {
  return BACKEND_MEDIA_PATH.test(pathname);
}

export function mediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^(data:|blob:)/i.test(url)) return url;
  try {
    const parsed = new URL(url, API_ORIGIN);
    if (isBackendMediaPath(parsed.pathname)) {
      return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
    }
    if (/^(https?:)/i.test(url)) return url;
    return `${API_ORIGIN}${parsed.pathname}${parsed.search}`;
  } catch {
    return url;
  }
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;
  const type = response.headers.get("content-type") || "";
  if (type.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }
  const text = await response.text();
  return text || undefined;
}

export async function refreshAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = session.refresh();
    try {
      const response = await fetch(apiUrl("/auth/token/refresh/"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(refresh ? { refresh } : {}),
      });
      if (!response.ok) {
        session.expire();
        return false;
      }
      const body = (await parseBody(response)) as {
        access?: string;
        refresh?: string;
        data?: { access?: string; refresh?: string };
      } | null;
      const access = body?.access ?? body?.data?.access;
      if (!access) {
        session.expire();
        return false;
      }
      session.setAccess(access);
      const rotated = body?.refresh ?? body?.data?.refresh;
      if (rotated) session.setRefresh(rotated);
      return true;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const {
    method = "GET",
    body,
    form,
    auth = true,
    signal,
    headers: extraHeaders,
    query,
    attempt = 0,
  } = options;

  const headers: Record<string, string> = { Accept: "application/json", ...extraHeaders };
  const token = session.access();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  const url = withQuery(apiUrl(path), query);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: payload,
      credentials: "include",
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError("The server could not be reached. Check your connection.", {
      status: 0,
      code: "network",
    });
  }

  if (response.status === 401 && auth && attempt === 0) {
    const refreshed = await refreshAccessToken();
    if (refreshed) return request<T>(path, { ...options, attempt: 1 });
    session.expire();
  }

  const parsed = await parseBody(response);
  if (!response.ok) {
    throw errorFromResponse(response.status, parsed, response.headers.get("Retry-After"));
  }
  return parsed as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "DELETE" }),
  form: <T>(path: string, form: FormData, options?: Omit<RequestOptions, "method" | "body" | "form">) =>
    request<T>(path, { ...options, method: "POST", form }),
};
