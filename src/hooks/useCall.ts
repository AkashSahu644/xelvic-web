import { useContext, useSyncExternalStore } from "react";
import { CallContext } from "@/context/call";
import type { CallEngine, CallSnapshot } from "@/features/calls/engine";

/**
 * The call this tab is on, and the buttons that change it.
 *
 * The snapshot is read through `useSyncExternalStore` rather than copied into
 * React state: the engine is the one place a call lives, and a copy kept beside
 * it would be a second answer to the same question — the two disagreeing for
 * exactly as long as it took the copy to catch up.
 */
export function useCall(): CallSnapshot & { engine: CallEngine } {
  const engine = useContext(CallContext);
  if (!engine) throw new Error("useCall must be used inside CallProvider");
  const snapshot = useSyncExternalStore(engine.subscribe, engine.getSnapshot);
  return { ...snapshot, engine };
}

/** The engine alone, for callers that do not need to redraw with it. */
export function useCallEngine(): CallEngine {
  const engine = useContext(CallContext);
  if (!engine) throw new Error("useCall must be used inside CallProvider");
  return engine;
}