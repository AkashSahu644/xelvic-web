import { useContext } from "react";
import { ThemeContext } from "@/context/theme";

export type {
  ScreenBackdrop,
  ThemeContextValue,
  ThemeMode,
} from "@/providers/ThemeProvider";

/** The design the web is wearing, and the ways it can be changed. */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}