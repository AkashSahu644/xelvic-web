import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string | string[]>;
  retryAfter: number | null;

  constructor(message: string, options: {
    status?: number;
    code?: string;
    fields?: Record<string, string | string[]>;
    retryAfter?: number | null;
  } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = options.status ?? 0;
    this.code = options.code ?? "request_failed";
    this.fields = options.fields ?? {};
    this.retryAfter = options.retryAfter ?? null;
  }
}

function parseRetryAfter(value?: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, Math.ceil(seconds));
  const date = Date.parse(value);
  if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  return null;
}

export function errorFromResponse(status: number, body: unknown, retryAfter?: string | null): ApiError {
  const parsed = (body ?? {}) as ApiErrorBody;
  const detail = parsed.error;
  const fallback =
    status === 0
      ? "The server could not be reached."
      : status === 401
        ? "Your session has ended. Sign in again."
        : status === 403
          ? "You do not have access to this."
          : status === 404
            ? "That is not available on this server."
            : status === 429
              ? "Too many requests. Give it a moment."
              : status >= 500
                ? "The server had a problem. Try again."
                : "That request did not work.";
  /*
   * A bare `{"detail": "..."}` reads as the message too.
   *
   * Most refusals arrive inside the envelope, but a view that answers with its
   * own `Response({"detail": ...}, 400)` skips the exception handler that builds
   * it — `apps/verify/views.ApplyView` does exactly that for the rule its
   * service raises, and the sentence there ("Up to 5 documents, please.") is the
   * only thing on the response that says what to do about it. Dropping it in
   * favour of "That request did not work." would be this client throwing away an
   * answer the server took the trouble to write.
   */
  const bare = typeof parsed.detail === "string" ? parsed.detail : "";
  return new ApiError(detail?.message || bare || fallback, {
    status,
    code: detail?.code || (status === 429 ? "throttled" : "request_failed"),
    fields: detail?.fields || {},
    retryAfter: parseRetryAfter(retryAfter),
  });
}

export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Something went wrong.";
}

export function isMissingRoute(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 405);
}
