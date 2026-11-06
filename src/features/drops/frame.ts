/**
 * The box a card's picture or clip is drawn in - the app's `_MediaFrame` in
 * `screens/drops.dart`, read one way for a feed column that is now a post's
 * width rather than the whole page.
 *
 * **The card is a post.** A figure fills the width it is given and answers a
 * shape taller than four-to-five by cropping, which is what the feed this is
 * modelled on does and what keeps the card from growing a column of empty space
 * beside a picture. A clip is treated the same way as a still: a nine-by-sixteen
 * upload is drawn at four-to-five and cropped top and bottom, and it is always
 * the full width of the card.
 *
 * **Why no screen-height ceiling any more.** The phone caps a playing clip at
 * 62% of the screen so the row of acts stays under it, and this file carried that
 * cap as `max-height`. On a browser that cap fought the box's own
 * `aspect-ratio`: the height was clamped and the width came with it, leaving a
 * narrow picture in the middle of a wide white card. That is exactly what the
 * owner photographed on 2026-11-06 - *"inner card ki width kam kiye jisse design
 * bahut hi kharab lag raha hai"* - so the cap is gone. A tall post is allowed to
 * be tall; the feed scrolls, and the actions sit under the picture rather than
 * having to share one screen with it.
 *
 * `width`, `minWidth` and `maxWidth` are all stated because the browser will
 * otherwise use `max-height` and the aspect ratio to narrow a box whose width it
 * considers automatic. `dvh` is not used here any more for the same reason: the
 * height of the viewport is not the height of a post.
 */

import type { CSSProperties } from "react";

/**
 * The tallest a frame stands, as height over width - four to five.
 *
 * The shape a feed gives a portrait post, and the shape a card reserves when the
 * payload carried no ratio at all.
 */
export const TALLEST_FRAME = 1.25;

/** A real, usable shape from the wire, or the card's own default. */
function readShape(ratio: number | null | undefined): number {
  if (typeof ratio !== "number" || !Number.isFinite(ratio) || ratio <= 0) return TALLEST_FRAME;
  return ratio;
}

/** The shape a frame is drawn at: the poster's, up to four-to-five. */
export function frameShape(ratio: number | null | undefined): number {
  return Math.min(readShape(ratio), TALLEST_FRAME);
}

/**
 * The box, as inline style.
 *
 * The width is pinned three ways and the shape is capped at four-to-five, so a
 * portrait picture or clip fills the card and is cropped rather than narrowing
 * itself to keep its whole height. See the note at the top of this file.
 */
export function frameBox(ratio: number | null | undefined): CSSProperties {
  return {
    width: "100%",
    minWidth: "100%",
    maxWidth: "100%",
    aspectRatio: `1 / ${frameShape(ratio)}`,
  };
}
