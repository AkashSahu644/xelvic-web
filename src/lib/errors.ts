import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  status: number;
  code: string;
  fields: Record<string, string>;
  retryAfter: number | null;

  constructor(message: string, options: {
    status?: number;
    code?: string;
    fields?: Record<string, string>;
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
  return new ApiError(detail?.message || fallback, {
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
