import { useContext } from "react";
import { AuthContext } from "@/context/auth";

export type { AuthStatus, AuthContextValue } from "@/providers/AuthProvider";

/**
 * The account this tab is signed in as.
 *
 * Reads the context that `providers/AuthProvider.tsx` fills in. The context
 * itself lives in `context/auth.ts` so this hook and the provider do not have
 * to import each other.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}