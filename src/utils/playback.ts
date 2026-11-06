/**
 * One ear for the whole app.
 *
 * The feed is a column of cards and some of them carry a sound: a clip that
 * plays by itself, a picture's music, a sound drop. Before this file every one
 * of them started on its own and nothing told the others to stop, so opening
 * Drops with three clips in a page meant three decoders talking at once — the
 * owner's report of 2026-11-02, *"drop page open karne par multiple song play
 * hone lagta hai"*.
 *
 * The phone has had the same rule for longer and in more places than one: a
 * clip holds the ear only while it is the one on screen, a soundtrack starting
 * takes it off the clip, and the Vibes walk keeps a single player for all of
 * its slides (see `feedPlayer`, `_playingClip` and `_shouldPlay` in
 * `screens/drops.dart`). The web's answer is the same rule in one place rather
 * than three: a media element that is *heard* claims the ear, and claiming it
 * stops whatever held it before.
 *
 * It is deliberately element-shaped and not state-shaped. Every road that makes
 * a noise in this app ends in an `HTMLMediaElement` — `AuthedVideo` for the
 * clips and `PlayerProvider`'s `<audio>` for the music bar — so one registry of
 * elements covers all of them without a provider of its own or a second account
 * of what is playing.
 */

const holders = new Set<HTMLMediaElement>();

/** Take the ear. Whatever was playing gives it up first. */
export function claimEar(element: HTMLMediaElement): void {
  for (const other of holders) {
    if (other === element) continue;
    holders.delete(other);
    try {
      other.pause();
    } catch {
      // An element the browser will not pause is one that was not heard anyway.
    }
  }
  holders.add(element);
}

/** Give the ear up, without claiming it for anybody else. */
export function releaseEar(element: HTMLMediaElement): void {
  holders.delete(element);
}

/** Whether this element is the one being heard — for a caller that has to ask. */
export function holdsEar(element: HTMLMediaElement): boolean {
  return holders.has(element);
}