import { useContext } from "react";
import { PreferencesContext } from "@/context/preferences";

export type {
  AppLanguage,
  MessageSound,
  Preferences,
  PreferencesContextValue,
  Ringtone,
} from "@/providers/PreferencesProvider";

/** This phone's settings: language, sounds, notifications, the logo. */
export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("usePreferences must be used inside PreferencesProvider");
  return context;
}

/**
 * The same value, or `null` outside the provider.
 *
 * `components/Brand.tsx` draws the mark on the sign-in page too, which is
 * outside the shell but still inside the provider today; this keeps it honest
 * if it ever is not.
 */
export function useOptionalPreferences() {
  return useContext(PreferencesContext);
}