import { useCallback, useState } from "react";

/**
 * What a Vibe does when it runs out, remembered.
 *
 * Ported from `lib/vibe_end.dart`. A clip that ends has exactly two honest
 * answers — go on to the next one, or play this one again — and which is right
 * is a matter of what somebody came here for rather than a fact about the clip,
 * so it is theirs to say. It is said once and kept, because the answer does not
 * change from one Vibe to the next and being asked again on every clip would be
 * the app asking a question it has already been given the answer to.
 *
 * The stored value is a word and not an index, the app's own choice: an index
 * is a fact about the order this list happens to be written in, and that order
 * is allowed to change without everybody's saved answer changing with it.
 */
export type VibeEnd = "next" | "replay";

const KEY = "xelvic.vibes.end";

/**
 * On to the next Vibe, until somebody says otherwise.
 *
 * The default is a decision rather than an accident, and it is the app's: a
 * clip that starts itself again never says it has finished and the only way
 * past it is a swipe. A feed's own answer is the one to start from, and the
 * loop is a press away for anybody who wants it.
 */
function remembered(): VibeEnd {
  try {
    return localStorage.getItem(KEY) === "replay" ? "replay" : "next";
  } catch {
    // A browser that will not read its store is not a reason to fail: next is
    // the default either way.
    return "next";
  }
}

export function useVibeEnd(): [VibeEnd, (end: VibeEnd) => void] {
  const [end, setEnd] = useState<VibeEnd>(remembered);

  const choose = useCallback((next: VibeEnd) => {
    setEnd(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // Set for this walk even if the browser would not write it down.
    }
  }, []);

  return [end, choose];
}