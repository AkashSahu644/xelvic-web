/**
 * How long the chosen part of a sound may be, and where the menu that offers it
 * opens.
 *
 * Both are here rather than inside `PhotoEditor.tsx` because both were wrong in
 * ways a screenshot of the finished control would not show:
 *
 * - **The list was six long.** Ten to thirty-five in fives, where the phone
 *   offers ten to sixty (`_WindowViewState._durationSeconds`,
 *   `app/lib/screens/audio_picker.dart`), so a forty-second part could not be
 *   asked for at all on the web.
 * - **The menu is measured against the window, not the sheet it is opened
 *   from.** The seconds pill sits in a bottom sheet that scrolls, so a menu
 *   laid out inside that scroll box is clipped by it — which is why the
 *   placement is arithmetic on two rectangles rather than a CSS class, and why
 *   it is written down where a test can reach it.
 */

/** The phone's own list of part lengths: ten to sixty seconds, in fives. */
export const PART_LENGTHS_MS = [
  10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60,
].map((seconds) => seconds * 1000);

/** One row of the menu, and the strip of it that says which one is on. */
export const PART_ROW_HEIGHT = 40;
export const PART_MENU_PADDING = 8;

/** The height the menu wants, before the window has a say. */
export const PART_MENU_HEIGHT =
  PART_LENGTHS_MS.length * PART_ROW_HEIGHT + PART_MENU_PADDING * 2;

export interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
  width: number;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface PartMenuPlacement {
  left: number;
  width: number;
  /** Set when the menu hangs below the pill; `bottom` is set instead when it opens up. */
  top?: number;
  bottom?: number;
  /** What the list may be scrolled within, when neither side has the full room. */
  maxHeight: number;
  /** True when the menu opened above the pill. */
  opensUp: boolean;
}

const GUTTER = 8;

/** The narrowest a menu of `10s`…`60s` reads at, and the widest it grows to. */
const MIN_WIDTH = 132;
const MAX_WIDTH = 220;

/**
 * Where to draw the menu for a pill at `anchor`.
 *
 * It opens upwards whenever the room above the pill is at least as good as the
 * room below, because the pill lives at the foot of a bottom sheet and the
 * space under it is the home indicator. Whichever side it takes, it never runs
 * off the window: it is pulled back inside both edges, and if neither side has
 * the full height it takes the taller one and scrolls inside it.
 */
export function placePartMenu(
  anchor: RectLike,
  viewport: Viewport,
  menuHeight = PART_MENU_HEIGHT,
): PartMenuPlacement {
  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, Math.round(anchor.width)),
  );
  const left = Math.min(
    Math.max(GUTTER, anchor.right - width),
    Math.max(GUTTER, viewport.width - width - GUTTER),
  );

  const roomAbove = Math.max(0, anchor.top - GUTTER);
  const roomBelow = Math.max(0, viewport.height - anchor.bottom - GUTTER);
  const opensUp = roomAbove >= roomBelow;
  const room = opensUp ? roomAbove : roomBelow;

  return {
    left,
    width,
    ...(opensUp
      ? { bottom: Math.max(GUTTER, viewport.height - anchor.top + GUTTER) }
      : { top: anchor.bottom + GUTTER }),
    maxHeight: Math.max(PART_ROW_HEIGHT, Math.min(menuHeight, room)),
    opensUp,
  };
}
