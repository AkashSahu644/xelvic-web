import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/lib/api";
import { ApiError, errorMessage, isMissingRoute } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import type { AuthTokens, QRStart, QRState } from "@/types/api";

export type QrPhase =
  | "starting"
  | "waiting"
  | "scanned"
  | "approved"
  | "collecting"
  | "collected"
  | "denied"
  | "expired"
  | "unavailable"
  | "error";

interface StartOptions {
  signal?: AbortSignal;
}

const LIVE = new Set(["waiting", "scanned", "approved"]);
const MAX_AUTO_ROTATIONS = 3;
const MAX_RATE_LIMIT_RETRIES = 3;
const QR_START_TIMEOUT_MS = 15_000;
const QR_STORAGE_KEY = "xelvic.qr.session";

interface StoredQr {
  value: QRStart;
  expiresAt: number;
  codeExpiresAt: number;
}

function readStoredQr(): StoredQr | null {
  try {
    const raw = sessionStorage.getItem(QR_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as StoredQr;
    if (!stored?.value?.session || !stored.value.secret) {
      sessionStorage.removeItem(QR_STORAGE_KEY);
      return null;
    }
    if (typeof stored.expiresAt !== "number" || stored.expiresAt <= Date.now()) {
      sessionStorage.removeItem(QR_STORAGE_KEY);
      return null;
    }
    return stored;
  } catch {
    return null;
  }
}

function writeStoredQr(value: QRStart) {
  try {
    const now = Date.now();
    sessionStorage.setItem(
      QR_STORAGE_KEY,
      JSON.stringify({
        value,
        expiresAt: now + value.expires_in * 1000,
        codeExpiresAt: now + value.code_expires_in * 1000,
      } satisfies StoredQr),
    );
  } catch {
    // Storage can be disabled; the in-memory session still works.
  }
}

function clearStoredQr() {
  try {
    sessionStorage.removeItem(QR_STORAGE_KEY);
  } catch {
    // Ignore storage errors.
  }
}

const QR_COOLDOWN_KEY = "xelvic.qr.cooldown";

function readCooldownMs(): number {
  try {
    const raw = sessionStorage.getItem(QR_COOLDOWN_KEY);
    if (!raw) return 0;
    const left = Number(raw) - Date.now();
    if (left > 0) return left;
    sessionStorage.removeItem(QR_COOLDOWN_KEY);
    return 0;
  } catch {
    return 0;
  }
}

function writeCooldown(seconds: number) {
  try {
    sessionStorage.setItem(QR_COOLDOWN_KEY, String(Date.now() + seconds * 1000));
  } catch {
    // Ignore storage errors.
  }
}

function clearCooldown() {
  try {
    sessionStorage.removeItem(QR_COOLDOWN_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function waitFor(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = window.setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

function throttleMessage(seconds: number) {
  if (seconds >= 120) {
    return `Too many sign-in attempts from this network. Trying again in about ${Math.ceil(seconds / 60)} minutes…`;
  }
  if (seconds >= 60) {
    return "Too many sign-in attempts from this network. Trying again in about 1 minute…";
  }
  return `Too many sign-in attempts. Trying again in ${Math.max(1, Math.ceil(seconds))} seconds…`;
}

let startRequest: Promise<QRStart> | null = null;

function fetchQrStart(): Promise<QRStart> {
  if (!startRequest) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), QR_START_TIMEOUT_MS);
    startRequest = api
      .post<QRStart>("/auth/qr/start/", {}, { auth: false, signal: controller.signal })
      .finally(() => {
        window.clearTimeout(timeout);
        startRequest = null;
      });
  }
  return startRequest;
}

export function safeNextPath() {
  const next = new URLSearchParams(window.location.search).get("next");
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/app/drops";
  return next;
}

export function useQrSignIn() {
  const { acceptTokens } = useAuth();
  const navigate = useNavigate();
  const [phase, setPhase] = useState<QrPhase>("starting");
  const [session, setSession] = useState<QRStart | null>(null);
  const [code, setCode] = useState("");
  const [match, setMatch] = useState("");
  const [codeSeconds, setCodeSeconds] = useState(0);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [retryable, setRetryable] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const rotateLock = useRef(false);
  const autoRotationCount = useRef(0);
  const rateLimitStreak = useRef(0);
  const finished = useRef(false);
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  const start = useCallback(async ({ signal }: StartOptions) => {
    finished.current = false;
    rotateLock.current = false;
    autoRotationCount.current = 0;
    rateLimitStreak.current = 0;
    setError(null);
    setSession(null);
    setCode("");

    const stored = readStoredQr();
    if (stored) {
      const codeLeft = Math.ceil((stored.codeExpiresAt - Date.now()) / 1000);
      setSession(stored.value);
      setCode(stored.value.code);
      setMatch(stored.value.match);
      setCodeSeconds(Math.max(0, codeLeft));
      setSessionSeconds(Math.max(0, Math.ceil((stored.expiresAt - Date.now()) / 1000)));
      setPhase(codeLeft > 2 ? "waiting" : "starting");
      setRetryable(true);
      return;
    }

    const cooldownMs = readCooldownMs();
    if (cooldownMs > 0) {
      setPhase("error");
      setError(throttleMessage(cooldownMs / 1000));
      setRetryable(true);
      try {
        await waitFor(cooldownMs, signal);
      } catch {
        return;
      }
      if (finished.current || signal?.aborted) return;
    }

    setPhase("starting");
    for (;;) {
      try {
        const next = await fetchQrStart();
        if (finished.current || signal?.aborted) return;
        clearCooldown();
        writeStoredQr(next);
        setSession(next);
        setCode(next.code);
        setMatch(next.match);
        setCodeSeconds(next.code_expires_in);
        setSessionSeconds(next.expires_in);
        setPhase("waiting");
        setRetryable(true);
        return;
      } catch (cause) {
        if (finished.current || signal?.aborted) return;
        if (isMissingRoute(cause)) {
          setPhase("unavailable");
          setRetryable(false);
          setError("Scan sign-in is not switched on for this server yet.");
          return;
        }
        if (cause instanceof ApiError && cause.status === 429) {
          const wait =
            cause.retryAfter && Number.isFinite(cause.retryAfter) && cause.retryAfter > 0
              ? cause.retryAfter
              : 60;
          writeCooldown(wait);
          setPhase("error");
          setError(throttleMessage(wait));
          setRetryable(true);
          try {
            await waitFor(wait * 1000, signal);
          } catch {
            return;
          }
          if (finished.current || signal?.aborted) return;
          setError(null);
          setPhase("starting");
          continue;
        }
        if (cause instanceof DOMException && cause.name === "AbortError") {
          setPhase("error");
          setError("QR generation timed out. Please request a new QR code.");
          setRetryable(true);
          return;
        }
        setPhase("error");
        setError(errorMessage(cause));
        setRetryable(true);
        return;
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void start({ signal: controller.signal });
    return () => {
      controller.abort();
      finished.current = true;
    };
    // `start` is stable; attempt is the explicit restart signal.
  }, [attempt, start]);

  useEffect(() => {
    if (!session || finished.current) return;
    let cancelled = false;
    let timer: number | undefined;

    const collect = async () => {
      setPhase("collecting");
      try {
        const tokens = await api.post<AuthTokens>(
          `/auth/qr/${session.session}/collect/`,
          {},
          { auth: false, headers: { "X-Qr-Secret": session.secret } },
        );
        if (cancelled) return;
        finished.current = true;
        clearStoredQr();
        await acceptTokens(tokens);
        setPhase("collected");
        navigateRef.current(safeNextPath(), { replace: true });
      } catch (cause) {
        if (cancelled) return;
        finished.current = true;
        clearStoredQr();
        if (cause instanceof ApiError && (cause.code === "qr_used" || cause.code === "qr_done")) {
          setPhase("expired");
          setError("This sign-in was already used. Ask for a fresh code.");
        } else {
          setPhase("error");
          setError(errorMessage(cause));
        }
        setRetryable(true);
      }
    };

    const tick = async () => {
      try {
        const state = await api.get<QRState>(`/auth/qr/${session.session}/`, {
          auth: false,
          headers: { "X-Qr-Secret": session.secret },
        });
        if (cancelled) return;
        rateLimitStreak.current = 0;
        if (state.code) setCode(state.code);
        if (typeof state.code_expires_in === "number") setCodeSeconds(state.code_expires_in);
        if (state.match) setMatch(state.match);

        if (state.state === "approved") {
          await collect();
          return;
        }
        if (state.state === "denied") {
          clearStoredQr();
          setPhase("denied");
          setError("The phone said no. Nothing was signed in.");
          return;
        }
        if (state.state === "expired") {
          clearStoredQr();
          setPhase("expired");
          setError("This code timed out. Start a fresh one.");
          return;
        }
        if (state.state === "collected") {
          clearStoredQr();
          setPhase("expired");
          setError("This sign-in has already been used.");
          return;
        }
        if (state.state === "waiting" || state.state === "scanned") {
          setPhase(state.state);
          if ((state.code_expires_in ?? 1) <= 2 && !rotateLock.current) {
            if (autoRotationCount.current >= MAX_AUTO_ROTATIONS) {
              clearStoredQr();
              setPhase("expired");
              setError("QR auto-refresh limit reached. Request a new QR code to continue.");
              setRetryable(true);
              return;
            }
            rotateLock.current = true;
            autoRotationCount.current += 1;
            try {
              const rotated = await api.post<{ code: string; code_expires_in: number }>(
                `/auth/qr/${session.session}/code/`,
                {},
                { auth: false, headers: { "X-Qr-Secret": session.secret } },
              );
              if (!cancelled) {
                setCode(rotated.code);
                setCodeSeconds(rotated.code_expires_in);
              }
            } catch {
              // The next poll can try again; do not tear down a live session for a blip.
            } finally {
              rotateLock.current = false;
            }
          }
        }
        timer = window.setTimeout(tick, Math.max(1, state.poll_after ?? session.poll_after) * 1000);
      } catch (cause) {
        if (cancelled) return;
        if (cause instanceof ApiError && cause.status === 429) {
          rateLimitStreak.current += 1;
          if (rateLimitStreak.current >= MAX_RATE_LIMIT_RETRIES) {
            setPhase("error");
            setError("Too many QR requests. Click Request new QR code to try again.");
            setRetryable(true);
            return;
          }
          const serverWait = cause.retryAfter ?? 3;
          const wait = Math.min(30, serverWait * 2 ** (rateLimitStreak.current - 1));
          timer = window.setTimeout(tick, wait * 1000);
          return;
        }
        setPhase("error");
        setError(errorMessage(cause));
        setRetryable(true);
      }
    };

    timer = window.setTimeout(tick, Math.max(1, session.poll_after) * 1000);
    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [session, acceptTokens]);

  useEffect(() => {
    if (!session) return;
    setSessionSeconds((value) => Math.max(0, value));
    const interval = window.setInterval(() => {
      setCodeSeconds((value) => Math.max(0, value - 1));
      setSessionSeconds((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [session]);

  useEffect(() => {
    if (sessionSeconds > 0 || !session || !LIVE.has(phase)) return;
    clearStoredQr();
    setPhase("expired");
    setError("This sign-in session ran out of time.");
  }, [sessionSeconds, session, phase]);

  const restart = useCallback(() => {
    clearStoredQr();
    setAttempt((value) => value + 1);
  }, []);

  return {
    phase,
    session,
    code,
    match,
    codeSeconds,
    sessionSeconds,
    error,
    retryable,
    start,
    restart,
  };
}
