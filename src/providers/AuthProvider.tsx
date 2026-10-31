import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { session } from "@/lib/session";
import type { AuthTokens, Me } from "@/types/api";

export type AuthStatus = "loading" | "authenticated" | "anonymous" | "error";

interface AuthContextValue {
  status: AuthStatus;
  user: Me | null;
  error: string | null;
  retry: () => void;
  devLogin: (target: string, password: string) => Promise<void>;
  acceptTokens: (tokens: AuthTokens) => Promise<Me>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<Me> | Me) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>(() => (session.access() ? "loading" : "anonymous"));
  const [user, setUser] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const fetchMe = useCallback(async () => {
    const me = await api.get<Me>("/auth/me/");
    if (mounted.current) {
      setUser(me);
      setStatus("authenticated");
      setError(null);
    }
    return me;
  }, []);

  const retry = useCallback(() => {
    if (!session.access()) {
      setStatus("anonymous");
      setUser(null);
      return;
    }
    setStatus("loading");
    setError(null);
    fetchMe().catch((cause: unknown) => {
      if (!mounted.current) return;
      if (cause instanceof ApiError && cause.status === 401) {
        session.clear();
        setUser(null);
        setStatus("anonymous");
      } else {
        setError(cause instanceof Error ? cause.message : "Could not reach the server.");
        setStatus("error");
      }
    });
  }, [fetchMe]);

  useEffect(() => {
    if (session.access()) retry();
    const expire = () => {
      if (!mounted.current) return;
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
      session.set(tokens);
      if (tokens.user) {
        const me = tokens.user;
        setUser(me);
        setStatus("authenticated");
        setError(null);
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
      const tokens = await api.post<AuthTokens>("/auth/login/", { target, password }, { auth: false });
      await acceptTokens(tokens);
    },
    [acceptTokens],
  );

  const logout = useCallback(async () => {
    const refresh = session.refresh();
    try {
      await api.post("/auth/logout/", refresh ? { refresh } : {});
    } catch {
      // The token may already be dead; local sign-out still stands.
    }
    session.clear();
    queryClient.clear();
    if (mounted.current) {
      setUser(null);
      setStatus("anonymous");
      setError(null);
    }
  }, [queryClient]);

  const updateUser = useCallback((patch: Partial<Me> | Me) => {
    setUser((current) => (current ? { ...current, ...patch } : (patch as Me)));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ status, user, error, retry, devLogin, acceptTokens, logout, updateUser }),
    [status, user, error, retry, devLogin, acceptTokens, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
