import { createContext } from "react";
import type { AuthContextValue } from "@/providers/AuthProvider";

/**
 * The account, as every screen reads it.
 *
 * The context lives in its own module so that `hooks/useAuth.ts` can read it
 * without importing the provider's implementation — the provider imports the
 * context, the hook imports the context, and neither has to know the other.
 * The type comes from the provider as a type-only import, which disappears at
 * build time. This is the shape all six contexts in this folder share.
 */
export const AuthContext = createContext<AuthContextValue | null>(null);