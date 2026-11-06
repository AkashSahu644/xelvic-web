/**
 * The camera's code, fetched before the camera is asked for.
 *
 * The convo's camera and its Spark button mount `CameraCapture` through a lazy
 * import, so tapping either one used to be the moment the download *began*:
 * two chunks (the camera and the picture editor behind it) plus a parse, and
 * only then `getUserMedia`, which on a phone is another few hundred
 * milliseconds on its own. That whole stack sat in front of the first frame,
 * which is what made the camera feel slow to open.
 *
 * None of it needs to wait for the tap. The camera is one of a handful of
 * things these screens can open, and the module is a few dozen kilobytes of
 * code that never changes; fetching it while the reader is looking at a convo
 * removes the download from the tap without asking for the camera, the
 * microphone or a single frame of anybody's face — `getUserMedia` still runs
 * only inside the mounted component, which is still only mounted when somebody
 * asked for it.
 *
 * A failure here is not worth showing: the `lazy()` import asks for the same
 * chunk when the button is really pressed, and that attempt gets to fail where
 * somebody is waiting and can be told.
 */

let warming: Promise<unknown> | null = null;

/**
 * Whether this connection is one the reader has asked us not to spend.
 *
 * Warming is a courtesy, and a courtesy on somebody's metered data is a bill.
 * The same rule the shell's own idle warming uses, read from the same place.
 */
function spendingIsWanted(): boolean {
  const connection = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  return !(
    connection?.saveData ||
    connection?.effectiveType === "slow-2g" ||
    connection?.effectiveType === "2g"
  );
}

/**
 * Start fetching the camera's code, and do nothing else.
 *
 * Safe to call as often as anything likes: the module loader dedupes the import
 * and this keeps the promise, so a hover, a focus and an idle callback on the
 * same screen are one download.
 */
export function warmCamera(): void {
  if (warming) return;
  if (!spendingIsWanted()) return;
  warming = import("@/features/camera/CameraCapture").catch(() => {
    // A failed warm is not a failure — the real import gets to try again, and
    // this promise is dropped so that it can.
    warming = null;
  });
}

/**
 * Warm it in the browser's own idle gap, once per screen.
 *
 * The gap is what keeps a courtesy from competing with the page somebody is
 * actually reading: the convo's own pictures and first answers are being asked
 * for at this moment, and none of them should queue behind a camera nobody has
 * opened. The timeout is the promise that a browser with no idle gaps still
 * gets to it eventually rather than postponing it forever.
 */
export function warmCameraWhenIdle(): () => void {
  if (typeof window.requestIdleCallback === "function") {
    const id = window.requestIdleCallback(() => warmCamera(), { timeout: 2500 });
    return () => window.cancelIdleCallback(id);
  }
  const id = window.setTimeout(() => warmCamera(), 700);
  return () => window.clearTimeout(id);
}
