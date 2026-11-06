import { createContext } from "react";
import type { PreferencesContextValue } from "@/providers/PreferencesProvider";

/** This phone's settings, as every screen reads them. See `hooks/usePreferences.ts`. */
export const PreferencesContext = createContext<PreferencesContextValue | null>(null);