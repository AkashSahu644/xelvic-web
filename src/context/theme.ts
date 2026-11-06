import { createContext } from "react";
import type { ThemeContextValue } from "@/providers/ThemeProvider";

/** The design the web is wearing. See `hooks/useTheme.ts`. */
export const ThemeContext = createContext<ThemeContextValue | null>(null);