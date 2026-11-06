import { useContext, useEffect, useRef } from "react";
import { SocketContext } from "@/context/socket";
import type { SocketFrame } from "@/providers/SocketProvider";

export type { SocketFrame, SocketStatus } from "@/providers/SocketProvider";

/** The account's live connection, its status, and its own `send`. */
export function useSocket() {
  const context = useContext(SocketContext);
  if (!context) throw new Error("useSocket must be used inside SocketProvider");
  return context;
}

/**
 * One listener for a set of named frames.
 *
 * `events` is taken as a list but compared by its joined text, so a caller that
 * writes the array inline does not re-subscribe on every render — and the
 * handler is held in a ref for the same reason: what a frame does may change
 * with the screen, while the subscription should not.
 */
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