import { createContext } from "react";
import type { PlayerContextValue } from "@/providers/PlayerProvider";

/** The music bar, as every screen reads it. See `hooks/usePlayer.ts`. */
export const PlayerContext = createContext<PlayerContextValue | null>(null);