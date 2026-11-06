import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthContext } from "@/context/auth";
import { clearMe, readMe, writeMe } from "@/store/me";
import { clearPersistedQueries } from "@/store/queryCache";
import { clearMediaCache } from "@/utils/mediaCache";
import { session } from "@/store/session";
import { ApiError } from "@/utils/errors";
import { authService } from "@/services/auth.service";
import type { AuthTokens, Me } from "@/types/api";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

export interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  error: string | null;
  retry: () => void;
  devLogin: (target: string, password: string) => Promise<void>;
  acceptTokens: (tokens: AuthTokens) => Promise<Me>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<Me> | Me) => void;
}

/**
 * The account, and the one question asked before anything else is drawn.
 *
 * **A remembered account is drawn on the first frame.** `GET /auth/me/` is the
 * slowest thing between a reload and the app, and the answer it gives almost
 * never differs from the last one: the profile is in `store/me.ts`, written on
 * every read and every edit, and a session with a remembered account starts as
 * `authenticated` and revalidates behind the page. Only a session that has a
 * token but no remembered account waits on the splash.
 *
 * That ordering is what the app does too — `Session.restore` reads the box
 * first and asks the server afterwards — and it is the difference between a
 * reload showing a spinner for a network round trip and showing the feed.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Read synchronously, once: the value decides the very first paint.
  const remembered = useRef(session.access() ? readMe() : null).current;
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (!session.access()) return "anonymous";
    return remembered ? "authenticated" : "loading";
  });
  const [user, setUser] = useState<Me | null>(remembered);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchMe = useCallback(async () => {
    const me = await authService.me();
    if (mounted.current) {
      setUser(me);
      setStatus("authenticated");
      setError(null);
    }
    writeMe(me);
    return me;
  }, []);

  const retry = useCallback(() => {
    if (!session.access()) {
      clearMe();
      setStatus("anonymous");
      setUser(null);
      return;
    }
    const cached = readMe();
    // The splash is for somebody whose name we do not know yet. A remembered
    // account is already on screen; the ask below only confirms it.
    if (!cached) setStatus("loading");
    setError(null);
    fetchMe().catch((cause: unknown) => {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        session.clear();
        clearMe();
        clearPersistedQueries();
        void clearMediaCache();
        queryClient.clear();
        setUser(null);
        setStatus("anonymous");
        return;
      }
      /*
       * A network failure with an account already on screen is not a reason to
       * replace the whole page with an error: the token may be perfectly good,
       * the server may be a second away, and every screen below has its own
       * retry. Only somebody with nothing remembered gets the full-page error.
       */
      if (cached) return;
      setError(cause instanceof Error ? cause.message : "Could not reach the server.");
      setStatus("error");
    });
  }, [fetchMe, queryClient]);

  useEffect(() => {
    if (session.access()) retry();
    const expire = () => {
      if (!mounted.current) return;
      clearMe();
      clearPersistedQueries();
      void clearMediaCache();
      setUser(null);
      setStatus("anonymous");
      setError(null);
      queryClient.clear();
    };
    session.onExpire(expire);
    return () => session.onExpire(null);
  }, [queryClient, retry]);

  const acceptTokens = useCallback(
    async (tokens: AuthTokens) => {
      // A new sign-in must not inherit the answers kept for the account that
      // was here before it, even in the same tab.
      clearPersistedQueries();
      void clearMediaCache();
      session.set(tokens);
      if (tokens.user) {
        const me = tokens.user;
        setUser(me);
        setStatus("authenticated");
        setError(null);
        writeMe(me);
        queryClient.setQueryData(["me"], me);
        return me;
      }
      setStatus("loading");
      const me = await fetchMe();
      queryClient.setQueryData(["me"], me);
      return me;
    },
    [fetchMe, queryClient],
  );

  const devLogin = useCallback(
    async (target: string, password: string) => {
      const tokens = await authService.login(target, password);
      await acceptTokens(tokens);
    },
    [acceptTokens],
  );

  const logout = useCallback(async () => {
    const refresh = session.refresh();
    try {
      await authService.logout(refresh);
    } catch {
      // The token may already be dead; local sign-out still stands.
    }
    session.clear();
    clearMe();
    clearPersistedQueries();
    void clearMediaCache();
    queryClient.clear();
    if (mounted.current) {
      setUser(null);
      setStatus("anonymous");
      setError(null);
    }
  }, [queryClient]);

  const updateUser = useCallback((patch: Partial<Me> | Me) => {
    setUser((current) => {
      const next = current ? { ...current, ...patch } : (patch as Me);
      writeMe(next);
      return next;
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, retry, devLogin, acceptTokens, logout, updateUser }),
    [status, user, error, retry, devLogin, acceptTokens, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}