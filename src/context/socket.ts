import { createContext } from "react";
import type { SocketContextValue } from "@/providers/SocketProvider";

/** The account's live connection. See `hooks/useSocket.ts`. */
export const SocketContext = createContext<SocketContextValue | null>(null);