import { useSyncExternalStore } from "react";
import {
  readClipMuted,
  setClipMuted,
  subscribeClipSound,
} from "@/store/sound";

/**
 * The feed's global sound setting: the answer, and the one way to change it.
 *
 * The store is in `store/sound.ts`; this is only the React binding. Every card
 * reads the same value, which is why turning the speaker on once turns it on
 * for the feed rather than for the card under the thumb.
 */
export function useClipSound(): { muted: boolean; toggle: () => void } {
  const current = useSyncExternalStore(
    subscribeClipSound,
    readClipMuted,
    readClipSound,
  );
  return { muted: current, toggle: () => setClipMuted(!current) };
}

/** Server render has no localStorage; the default is the honest answer there. */
function readClipSound(): boolean {
  return true;
}