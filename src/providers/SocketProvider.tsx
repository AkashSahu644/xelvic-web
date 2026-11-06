import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SocketContext } from "@/context/socket";
import { WS_ORIGIN } from "@/config/env";
import { session } from "@/store/session";
import { useAuth } from "@/hooks/useAuth";

export type SocketStatus = "offline" | "connecting" | "live" | "reconnecting";

export interface SocketFrame {
  event?: string;
  data?: unknown;
  action?: string;
  [key: string]: unknown;
}

type Listener = (frame: SocketFrame) => void;

export interface SocketContextValue {
  status: SocketStatus;
  send: (action: Record<string, unknown>) => boolean;
  subscribe: (listener: Listener) => () => void;
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [status, setStatus] = useState<SocketStatus>("offline");
  const socketRef = useRef<WebSocket | null>(null);
  const listeners = useRef(new Set<Listener>());
  const retryRef = useRef(0);
  const reconnectTimer = useRef<number | null>(null);
  const heartbeat = useRef<number | null>(null);
  const closedByUs = useRef(false);

  const clearTimers = useCallback(() => {
    if (reconnectTimer.current) window.clearTimeout(reconnectTimer.current);
    if (heartbeat.current) window.clearInterval(heartbeat.current);
    reconnectTimer.current = null;
    heartbeat.current = null;
  }, []);

  const connect = useCallback(() => {
    const token = session.access();
    if (!token || authStatus !== "authenticated") return;
    if (socketRef.current && (socketRef.current.readyState === WebSocket.OPEN || socketRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }
    closedByUs.current = false;
    setStatus(retryRef.current > 0 ? "reconnecting" : "connecting");
    let socket: WebSocket;
    try {
      socket = new WebSocket(`${WS_ORIGIN}/ws/?token=${encodeURIComponent(token)}`);
    } catch {
      setStatus("offline");
      return;
    }
    socketRef.current = socket;

    socket.onopen = () => {
      retryRef.current = 0;
      setStatus("live");
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      heartbeat.current = window.setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ action: "ping" }));
      }, 25_000);
    };

    socket.onmessage = (message) => {
      try {
        const frame = JSON.parse(String(message.data)) as SocketFrame;
        // Everything a frame means is decided by whoever listens for it. This
        // provider owns the connection — opening it, keeping it alive, putting
        // it back — and nothing else: a sound or a notification belongs to the
        // surface that draws the news, so that the strip over the page and the
        // browser's own row come from one decision rather than two. See
        // `features/notices/NoticeProvider.tsx`.
        listeners.current.forEach((listener) => listener(frame));
      } catch {
        // A frame that is not JSON is not ours; ignore it rather than kill the socket.
      }
    };

    socket.onclose = (event) => {
      if (socketRef.current === socket) socketRef.current = null;
      if (heartbeat.current) window.clearInterval(heartbeat.current);
      heartbeat.current = null;
      if (closedByUs.current || authStatus !== "authenticated" || !session.access()) {
        setStatus("offline");
        return;
      }
      if (event.code === 4001 || event.code === 4401) {
        setStatus("offline");
        return;
      }
      retryRef.current += 1;
      const delay = Math.min(20_000, 900 * 2 ** Math.min(retryRef.current - 1, 4)) + Math.random() * 500;
      setStatus("reconnecting");
      reconnectTimer.current = window.setTimeout(connect, delay);
    };

    socket.onerror = () => {
      if (socket.readyState === WebSocket.OPEN) socket.close();
    };
  }, [authStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    /**
     * The socket is opened once the page has settled, not before.
     *
     * A websocket handshake is a second connection to the same origin and it
     * used to be asked for at the same instant as the page's first reads —
     * competing for the connection pool, for TLS work and for the browser's
     * single-threaded start-up, precisely while somebody is waiting to see
     * their feed. Nothing is lost by waiting: every surface that listens here
     * also reads its data on mount, so the first page is complete before the
     * first frame can arrive. Real-time still means real-time — it just starts
     * a beat after the content rather than in front of it.
     */
    let cancelled = false;
    const open = () => {
      if (cancelled || socketRef.current) return;
      connect();
    };

    let idleId: number | null = null;
    let timer = 0;
    if (typeof window.requestIdleCallback === "function") {
      idleId = window.requestIdleCallback(open, { timeout: 1500 });
    } else {
      timer = window.setTimeout(open, 600);
    }

    return () => {
      cancelled = true;
      if (idleId !== null) window.cancelIdleCallback(idleId);
      window.clearTimeout(timer);
      closedByUs.current = true;
      clearTimers();
      socketRef.current?.close();
      socketRef.current = null;
      setStatus("offline");
    };
  }, [authStatus, clearTimers, connect]);

  useEffect(() => {
    const online = () => {
      if (!socketRef.current && authStatus === "authenticated") connect();
    };
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [authStatus, connect]);

  const send = useCallback((action: Record<string, unknown>) => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(action));
    return true;
  }, []);

  const subscribe = useCallback((listener: Listener) => {
    listeners.current.add(listener);
    return () => listeners.current.delete(listener);
  }, []);

  const value = useMemo(() => ({ status, send, subscribe }), [status, send, subscribe]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

