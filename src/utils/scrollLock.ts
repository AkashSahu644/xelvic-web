/**
 * One lock on the page's scrolling, counted rather than remembered.
 *
 * The document is what scrolls here — `AppShell` has no inner scroll box, its
 * `main` is `min-h-dvh` and grows — so `document.body.style.overflow = "hidden"`
 * is the whole of "the screen behind this overlay does not move".
 *
 * Four overlays do that: the modal, the Vibe walk, the moment viewer and the
 * convo's Spark viewer. Each of them used to keep the value it found and write
 * it back when it closed, which is correct for exactly one lock at a time and
 * wrong for two — and two happen:
 *
 * - two overlays open at once, the first closing before the second: A reads
 *   `""`, writes `hidden`; B reads `hidden`, writes `hidden`. A closes and puts
 *   `""` back, so B is open over a page that scrolls; B closes and puts
 *   `hidden` back, and the page is now locked with nothing on it.
 * - an effect that re-runs while it is open. The Vibe walk's effect depends on
 *   the clip it is on and the viewer's own callbacks, so it re-runs as the walk
 *   moves; the moment viewer's depends on the moment it is showing and on each
 *   of its sheets. A re-run cleans up first, and the cleanup writes back the
 *   value that was read *before* whatever opened meanwhile — so the lock that
 *   is still on screen is released, and the one that was read as the "original"
 *   is what gets restored when that overlay closes. The page then scrolls
 *   nowhere until it is reloaded, which is the shape this was reported in:
 *   arriving at a page and finding it will not move, fixed by a refresh.
 *
 * Counting fixes both. The original value is read once, by the first lock, and
 * written back once, by the last release; a re-run in the middle changes
 * nothing; a double release cannot take an unrelated lock with it.
 */

/** How many overlays are holding the page still. Module scope: one document. */
let held = 0;

/** What `body.style.overflow` said before the first of them. */
let restoreTo = "";

/**
 * Stop the page scrolling until the returned release runs.
 *
 * The release is idempotent — calling it twice is not two releases — so a
 * component can run it from an effect's cleanup and from a click handler
 * without a second thought.
 */
export function lockScroll(): () => void {
  if (typeof document === "undefined") return () => {};

  if (held === 0) {
    restoreTo = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  held += 1;

  let released = false;
  return () => {
    if (released) return;
    released = true;
    held -= 1;
    if (held <= 0) {
      held = 0;
      document.body.style.overflow = restoreTo;
    }
  };
}
