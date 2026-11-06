import { useContext } from "react";
import { PlayerContext } from "@/context/player";

export type { PlayerContextValue } from "@/providers/PlayerProvider";

/**
 * The music bar's own state — what is playing, and the five things that move
 * it. See `providers/PlayerProvider.tsx` and `components/PlayerBar.tsx`.
 */
export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) throw new Error("usePlayer must be used inside PlayerProvider");
  return context;
}