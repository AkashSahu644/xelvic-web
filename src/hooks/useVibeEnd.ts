import { useCallback, useState } from "react";
import { readVibeEnd, writeVibeEnd, type VibeEnd } from "@/store/vibeEnd";

export type { VibeEnd } from "@/store/vibeEnd";

/**
 * The Vibe reel's end behaviour: the remembered word, and the setter.
 *
 * The persistence is `store/vibeEnd.ts`; this is the component-facing half.
 */
export function useVibeEnd(): [VibeEnd, (end: VibeEnd) => void] {
  const [end, setEnd] = useState<VibeEnd>(readVibeEnd);

  const choose = useCallback((next: VibeEnd) => {
    setEnd(next);
    writeVibeEnd(next);
  }, []);

  return [end, choose];
}