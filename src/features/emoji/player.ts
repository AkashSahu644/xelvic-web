/**
 * The animation player, fetched the moment the first tile needs it and never
 * before.
 *
 * `lottie-web` is ~250 kB of SVG renderer, and the picker is opened for the
 * still emoji far more often than for the moving ones, so it is imported
 * dynamically: Vite puts it in its own chunk and a chat that never opens the
 * picker never downloads it. The **light** build is the one imported — it
 * renders SVG only, which is all this needs, and skips the canvas, HTML and
 * expression parts of the full player.
 *
 * One import for the whole app: `lottiePlayer()` hands the same promise to
 * every caller, so forty tiles appearing at once still fetch it once.
 */

/**
 * The little of `lottie-web`'s surface this app uses.
 *
 * `complete` is the one event listened for: an emoji that plays once when its
 * message arrives has to know when it has finished, so that it can go back to
 * being the still drawing. The light build keeps its event emitter — what it
 * leaves out is expressions, the canvas and the HTML renderer.
 */
export type LottieInstance = {
  destroy: () => void;
  addEventListener: (name: "complete", handler: () => void) => void;
};

export type LottiePlayer = {
  loadAnimation: (config: {
    container: Element;
    renderer: "svg";
    loop: boolean;
    autoplay: boolean;
    path: string;
    rendererSettings?: { preserveAspectRatio?: string };
  }) => LottieInstance;
};

let pending: Promise<LottiePlayer> | null = null;

/** The animation player, loaded once per session. */
export function lottiePlayer(): Promise<LottiePlayer> {
  pending ??= import("lottie-web/build/player/lottie_light").then((module) => {
    // The light build is UMD: through a bundler it can arrive either as the
    // module itself or under `default`, depending on how the interop lands.
    const shaped = module as unknown as { default?: LottiePlayer };
    return shaped.default ?? (module as unknown as LottiePlayer);
  });
  return pending;
}
