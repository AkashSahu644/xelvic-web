/**
 * When an emoji is allowed to move.
 *
 * Three rules, kept out of the component because they own no DOM — they take
 * counts and flags and answer yes or no, which is what makes them testable
 * without a browser. Getting them wrong is not a crash; it is a screen that
 * moves when nobody asked it to, or one that stays still when somebody did,
 * and both are things a person notices and a test does not unless it is told
 * where to look.
 *
 * **A tile in the picker moves while it is on screen.** That grid exists to be
 * looked at and one emoji is being chosen from it; movement is the preview.
 *
 * **An emoji in a message does not.** A message is read, not browsed, and a
 * thread where every bubble is running its own animation for as long as it is
 * on screen is a thread nobody can read — which is what it did until the owner
 * said so: *"ye jo continue animate ho raha hai jabki send karne par aur hover
 * karne par animate hona chahiye"*. So it moves when it is **hovered**, and it
 * moves **once** when the message it belongs to is sent or arrives (`EmojiArt`'s
 * `burst`), and otherwise it is the still drawing.
 *
 * **A pointer resting on one buys it a place past the budget.** The budget is
 * real — a few dozen Lottie players is a stutter — but the emoji somebody has
 * walked up to and is deciding about is the one that most deserves to be in it.
 * There is only ever one of those, so it may go one over; and it gives that
 * place back when the pointer leaves, because otherwise walking a pointer along
 * a row would leave every tile it crossed running for good.
 */

/** How many emoji may move at once for the whole app. */
export const MOST_MOVING = 24;

/** What a drawing is part of: a tile in a grid, or an emoji in a sentence. */
export type Mode = "tile" | "text";

/** What a drawing is doing. */
export type Phase = "off" | "loading" | "playing";

/** Whether this drawing should be moving at all, where it is and what it is. */
export function wanted(mode: Mode, inView: boolean, hovered: boolean): boolean {
  return mode === "tile" ? inView : hovered;
}

/**
 * Whether there is room for it to start.
 *
 * A pointer is the one thing allowed past the budget, and it is asked with
 * `hovered` rather than through a separate argument because the answer is the
 * same question: who is asking.
 */
export function spare(moving: number, hovered: boolean, cap = MOST_MOVING): boolean {
  return hovered || moving < cap;
}

/**
 * Whether a drawing that took its place because a pointer was on it should give
 * that place back.
 *
 * Only when the budget is actually overdrawn. A pointer that landed while there
 * was room took a place it was entitled to, and keeps it.
 */
export function giveBack(
  byPointer: boolean,
  hovered: boolean,
  moving: number,
  cap = MOST_MOVING,
): boolean {
  return byPointer && !hovered && moving > cap;
}
