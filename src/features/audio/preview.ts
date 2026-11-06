import { useCallback, useEffect, useRef } from "react";
import { usePlayer } from "@/hooks/usePlayer";
import type { Track } from "@/types/api";

/**
 * Hearing a sound before it is chosen.
 *
 * The player is the app's one music bar, shared with every list behind whatever
 * sheet is open, so a sheet that closed it on the way out would be stopping
 * music it never started. This is the flag that says who started what, written
 * once because two sheets now audition sounds — the picker, and the part
 * chooser behind it — and a second copy of the rule is a second chance to get
 * it wrong.
 *
 * The three moves:
 *
 * - `start(track)` — put this on, and remember that *this* hook is what put it
 *   there. A track already on is not restarted, because a preview that jumps
 *   back to the beginning every time a thumb lands on it is a preview nobody
 *   can hear the end of.
 * - `stop()` — take it off again, but only if this hook started it. A sheet
 *   closing over somebody else's music leaves the music alone.
 * - `handOver()` — give the player away without stopping it. The part chooser
 *   does this on "Use": what plays next is the part that was just chosen, and
 *   the caller — the editor's document, or the Spark card's own row — is what
 *   closes it from there. Stopping it here would silence the thing the person
 *   just asked for.
 *
 * Unmounting stops it, so a sheet closed by anything at all — a route change, a
 * list reloading out from under it — gives the ear back.
 */
export function useSoundPreview() {
  const player = usePlayer();
  const close = player.close;
  const started = useRef(false);

  useEffect(
    () => () => {
      if (started.current) {
        started.current = false;
        close();
      }
    },
    [close],
  );

  const start = useCallback(
    (track: Track) => {
      started.current = true;
      if (player.current?.id === track.id) {
        if (!player.playing) player.toggle();
        return;
      }
      player.play(track, [track]);
    },
    [player],
  );

  const stop = useCallback(() => {
    if (!started.current) return;
    started.current = false;
    close();
  }, [close]);

  const handOver = useCallback(() => {
    started.current = false;
  }, []);

  return { player, start, stop, handOver };
}
