/**
 * The one HTTP client.
 *
 * Every call in the app goes through this instance, and every call is made from
 * `src/services/*` — no component and no hook builds a request of its own. The
 * shape is the reference app's (`config/axios.js`): an instance with a base URL
 * and a timeout, a request interceptor that attaches the account's token, and a
 * response interceptor that renews an expired token once and refuses to loop.
 *
 * Three things are deliberately *not* the reference app's, because copying them
 * would have changed behaviour this app depends on:
 *
 * 1. **Tokens stay in `sessionStorage`.** The reference reads and writes
 *    `localStorage`; this app's `src/lib/session.ts` is the store, and it also
 *    holds the in-memory copy and the expiry listener. Only the interceptor's
 *    *shape* was adopted.
 * 2. **Failures are thrown, not toasted.** The reference turns every error into
 *    a toast inside the interceptor. Here a failure has to arrive at the screen
 *    that asked for it — `ErrorState` draws a retry, `MomentViewer` turns a 404
 *    into "That moment is no longer there.", `useQrSignIn` reads a 429's
 *    `retryAfter`. Toasting in the interceptor would both swallow those and
 *    double every notification the call site already raises. So the interceptor
 *    *normalises* the failure into the `ApiError` the app already reads, and
 *    stops there. Nothing about that shape changed: `.status`, `.code`,
 *    `.fields`, `.retryAfter` are the same fields `src/lib/errors.ts` has always
 *    produced, which is why no call site had to learn a new error type.
 * 3. **A timeout exists.** The fetch client had none, so a server that accepted
 *    a connection and then said nothing would hang the screen indefinitely. The
 *    default here is the reference's 120s, overridable per request — uploads
 *    ask for longer, because a 600 MB clip is allowed.
 */

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL, REQUEST_TIMEOUT_MS } from "@/config/env";
import { ApiError, errorFromResponse } from "@/utils/errors";
import { session } from "@/store/session";

declare module "axios" {
  export interface AxiosRequestConfig {
    /**
     * `false` sends the request with no token at all — the sign-in doors, the
     * QR approve route, and a shared playlist all answer before there is an
     * account to send. Defaults to `true`.
     */
    skipAuth?: boolean;
    /** Set by the interceptor, so one reply is renewed at most once. */
    _retry?: boolean;
  }
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT_MS,
  // The phone's 401 road and the QR door both rely on the session cookie, so
  // every request carries it — the same `credentials: "include"` the fetch
  // client sent.
  withCredentials: true,
  headers: { Accept: "application/json" },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = session.access();
  if (config.skipAuth !== true && token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  /*
   * A FormData body must be sent with no Content-Type of ours: the boundary is
   * generated when the body is serialised, and a header naming
   * `multipart/form-data` without one is a body the server cannot parse.
   */
  if (typeof FormData !== "undefined" && config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

/**
 * One renewal for however many requests were refused at once.
 *
 * Ten parallel calls that all come back 401 must produce one refresh and ten
 * retries, not ten refreshes — the second refresh would be sent with a token
 * the first already rotated away, and would sign the account out.
 */
let refreshPromise: Promise<boolean> | null = null;

async function renewAccessToken(): Promise<boolean> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    const refresh = session.refresh();
    try {
      /*
       * A bare axios call rather than the instance: going through `api` would
       * put this request back in front of the same interceptor, and a refused
       * refresh would ask for another refresh — the loop the reference app's
       * `/logout` guard exists to break.
       */
      const response = await axios.post(
        `${API_BASE_URL}/auth/token/refresh/`,
        refresh ? { refresh } : {},
        { withCredentials: true, timeout: REQUEST_TIMEOUT_MS, headers: { "Content-Type": "application/json" } },
      );
      const body = response.data as {
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
      session.expire();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

/** A server that never answered is not the same failure as a server that refused. */
function networkError(error: AxiosError): ApiError {
  const timedOut =
    error.code === "ECONNABORTED" ||
    error.code === "ETIMEDOUT" ||
    /timeout/i.test(error.message ?? "");
  return timedOut
    ? new ApiError("The server took too long to answer. Try again.", { status: 0, code: "timeout" })
    : new ApiError("The server could not be reached. Check your connection.", { status: 0, code: "network" });
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    /*
     * A cancelled request stays a cancellation. `useQrSignIn`, the camera, the
     * photo editor, the share sheet and both Sparks screens all branch on
     * `name === "AbortError"` to tell "the caller walked away" apart from "this
     * failed", so axios's `CanceledError` is translated back rather than
     * allowed to arrive as an ordinary failure.
     */
    if (axios.isCancel(error)) {
      return Promise.reject(new DOMException("Aborted", "AbortError"));
    }

    const config = error.config as InternalAxiosRequestConfig | undefined;
    const status = error.response?.status ?? 0;
    const body = error.response?.data;

    if (status === 401 && config && config.skipAuth !== true && !config._retry) {
      const renewed = await renewAccessToken();
      if (renewed) {
        config._retry = true;
        return api.request(config);
      }
    }

    if (!error.response) throw networkError(error);

    throw errorFromResponse(
      status,
      body,
      (error.response.headers?.["retry-after"] as string | undefined) ?? null,
    );
  },
);

export default api;
export { api };
