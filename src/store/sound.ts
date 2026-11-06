/**
 * Whether the feed's clips make a noise, for the whole app and across visits.
 *
 * Ported from `Sound` in `app/lib/sound.dart`, and kept as the same kind of
 * answer: one setting rather than one per clip. A feed is scrolled, not
 * chosen — a speaker that belonged to the card under the thumb would mean
 * turning the sound on for every card, or turning it on once and then watching
 * the next one silently and reaching for the button to find out whether it
 * worked. What is being chosen is how this browser plays clips.
 *
 * **Silent by default**, because that is what a feed of strangers has to be,
 * and it is also the honest answer to how a page arrives: an autoplaying clip
 * with sound is a page that talks before anybody has read a word of it. The
 * choice is written down, so it is still the answer the next time the site is
 * opened. `localStorage` and not `sessionStorage`: a decision about the device
 * is not a decision about a tab.
 *
 * A tiny external store rather than a context, for the same reason
 * `utils/playback` is a registry: the two readers are a card and the button on
 * it, and neither is an ancestor of the other. The React binding is
 * `hooks/useClipSound.ts`.
 */

import { STORAGE_KEYS } from "@/constants/storage";

const KEY = STORAGE_KEYS.soundMuted;

let muted = true;
let loaded = false;
const listeners = new Set<() => void>();

/** The current answer, loading it from the browser once. */
export function readClipMuted(): boolean {
  if (loaded) return muted;
  loaded = true;
  try {
    const remembered = window.localStorage.getItem(KEY);
    if (remembered === "0") muted = false;
    else if (remembered === "1") muted = true;
  } catch {
    // Nothing remembered, and the default is still the honest one.
  }
  return muted;
}

export function subscribeClipSound(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setClipMuted(next: boolean): void {
  if (readClipMuted() === next) return;
  muted = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // Set for this visit even if the browser would not write it down.
  }
  for (const listener of listeners) listener();
}