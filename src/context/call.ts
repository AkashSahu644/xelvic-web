import { createContext } from "react";
import type { CallEngine } from "@/features/calls/engine";

/** The tab's one call engine. See `hooks/useCall.ts`. */
export const CallContext = createContext<CallEngine | null>(null);