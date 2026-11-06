/**
 * Where the small call bar sits.
 *
 * The phone keeps a call in a window that can be dragged anywhere and docked
 * against the left or right edge — `app/lib/screens/call_window.dart`, read as
 * the reference and never written to. This is the same arithmetic, with a
 * page's coordinates instead of a Navigator's, and it is kept out of
 * `CallOverlay.tsx` because it owns no DOM: it takes rectangles and returns
 * them, so the rules can be tested without a browser.
 *
 * Three of the phone's rules are carried over exactly:
 *
 *   * it keeps a gutter clear of every side while it floats, so it is always
 *     reachable and never sits under a device's own edge gesture;
 *   * it is clamped on every draw rather than only on a drag, because a
 *     rotation or a resized window can leave a corner that was on the screen
 *     somewhere off it;
 *   * letting go *into* an edge docks it, and merely *near* one does not — a
 *     floating window is held the gutter clear, so the only way its own edge
 *     can end up inside that gutter is if somebody pushed it there.
 */

/** A point in the page's own coordinates. */
export type Spot = { left: number; top: number };

/** What is being placed. */
export type Box = { width: number; height: number };

/** What it is being placed in. */
export type View = { width: number; height: number };

/** How far the bar keeps off the sides while it floats. */
export const WINDOW_GUTTER = 12;

/** Where it sits before anybody has moved it: the bottom right corner. */
export function homeSpot(box: Box, view: View): Spot {
  return {
    left: Math.max(WINDOW_GUTTER, view.width - box.width - 16),
    top: Math.max(WINDOW_GUTTER, view.height - box.height - 16),
  };
}

/** Where it is drawn — always somewhere it can be reached. */
export function clampSpot(spot: Spot, box: Box, view: View): Spot {
  const lowX = WINDOW_GUTTER;
  const lowY = WINDOW_GUTTER;
  const highX = Math.max(lowX, view.width - box.width - WINDOW_GUTTER);
  const highY = Math.max(lowY, view.height - box.height - WINDOW_GUTTER);
  return {
    left: Math.min(Math.max(spot.left, lowX), highX),
    top: Math.min(Math.max(spot.top, lowY), highY),
  };
}

/**
 * Which edge it was let go pushed into, or `null` while it floats.
 *
 * Measured on the raw spot, not the drawn one: the drawing is clamped, so it
 * could never report a shove past the edge.
 */
export function dockEdge(
  spot: Spot,
  box: Box,
  view: View,
): "left" | "right" | null {
  if (spot.left < WINDOW_GUTTER) return "left";
  if (view.width - (spot.left + box.width) < WINDOW_GUTTER) return "right";
  return null;
}