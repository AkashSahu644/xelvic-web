import { createContext } from "react";
import type { ToastContextValue } from "@/providers/ToastProvider";

/** The toast queue, as every screen reads it. See `hooks/useToast.ts`. */
export const ToastContext = createContext<ToastContextValue | null>(null);