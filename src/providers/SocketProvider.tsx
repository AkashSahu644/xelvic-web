import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { WS_ORIGIN } from "@/lib/env";
import { session } from "@/lib/session";
import { useAuth } from "@/providers/AuthProvider";

export type SocketStatus = "offline" | "connecting" | "live" | "reconnecting";

export interface SocketFrame {
  event?: string;
  data?: unknown;
  action?: string;
  [key: string]: unknown;
}

type Listener = (frame: SocketFrame) => void;

interface SocketContextValue {
  status: SocketStatus;
  send: (action: Record<string, unknown>) => boolean;
  subscribe: (listener: Listener) => () => void;
}

const SocketContext = createContext<SocketContextValue | null>(null);

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
    if (authStatus === "authenticated") connect();
    return () => {
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

export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used inside SocketProvider");
  return context;
}

export function useSocketEvent(events: string[], handler: (frame: SocketFrame) => void) {
  const { subscribe } = useSocket();
  const handlerRef = useRef(handler);
  handlerRef.current = handler;
  useEffect(() => {
    if (!events.length) return;
    return subscribe((frame) => {
      if (frame.event && events.includes(frame.event)) handlerRef.current(frame);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribe, events.join("|")]);
}
