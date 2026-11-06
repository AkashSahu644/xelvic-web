import { useContext } from "react";
import { ToastContext } from "@/context/toast";

export type { ToastContextValue } from "@/providers/ToastProvider";

/** Put a line at the foot of the screen. See `providers/ToastProvider.tsx`. */
export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context;
}