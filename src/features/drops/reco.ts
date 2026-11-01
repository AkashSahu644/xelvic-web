import { api } from "@/lib/api";
import type { Drop } from "@/types/api";

/**
 * What a Vibe tells the server about how it was watched.
 *
 * Ported from `lib/reco.dart`, and it is the other half of the studio: every
 * number on that page is read out of these rows (`apps/reco/models.py`), so a
 * clip watched on the web that said nothing would be a clip its creator's
 * studio draws as never watched. Nothing here is a new measurement — the player
 * already knows every one of these numbers — and nothing here is invented: a
 * value that was not measured is sent as `null`, which the server keeps as the
 * absence it is.
 *
 * Two shapes, as the app has them:
 *
 *   * `served` — the clips drawn on a screen, with where each sat. This is what
 *     "impressions" and "reached" are counted from, and why a shelf dealt but
 *     not swiped through still says something.
 *   * `views` — how much of one clip one look watched, reported when the look
 *     ends. The server folds several looks in a day into one row holding the
 *     longest, the play count, and how many of those plays were abandoned.
 *
 * The app buffers these in a queue on the phone; a browser has a connection
 * that is already open for the next request, so each look is posted as it ends
 * and a failure is dropped rather than held. `POST /reco/signals/` answers the
 * size of the batch and never what it kept — see `SignalsView` — so there is
 * nothing to read back and nothing to retry for.
 *
 * The session id is one per page load: a sitting is a walk somebody just
 * opened, and the server uses it to read what a person is into right now. Two
 * tabs are two sittings, which is the same answer two phones get.
 */
const session =
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function note(body: Record<string, unknown>) {
  void api.post("/reco/signals/", { session, ...body }).catch(() => undefined);
}

/** The clips a shelf drew, in the order it drew them — `Reco.served`. */
export function reportVibesShown(rows: Drop[]) {
  if (!rows.length) return;
  note({
    surface: "vibes",
    served: rows.map((row, pos) => ({
      kind: "vibe",
      id: row.id,
      surface: "vibes",
      pos,
    })),
  });
}

/** Everything one look at a clip measured, as the player knows it. */
export interface VibeLook {
  /** How much of the clip actually played, in milliseconds. */
  ms: number;
  /** That as a fraction of the clip's own length, `0..1`. */
  pct: number;
  /** Whether the clip reached its own end during this look. */
  completed: boolean;
  /** Wall time the clip was on screen, buffering and pauses included. */
  visibleMs: number | null;
  /** The clip's own length, or null when the player had none to give. */
  durationMs: number | null;
  /** How long it held the screen before the person swiped it away, or null. */
  toSwipeMs: number | null;
  /** Deliberate backward seeks. A clip looping is not one. */
  rewinds: number | null;
  /** The part of the visible time somebody had it stopped by hand. */
  pausedMs: number | null;
  /** Whether the look started itself rather than being asked for. */
  autoplay: boolean | null;
}

/**
 * One look at one clip, handed over.
 *
 * Every field is written even when it is null: the server's shape is fixed and
 * a missing key is a field it has to guess at, while an explicit null is the
 * player saying it has no measurement. See `_view_row` in
 * `apps/reco/services.py`.
 */
export function reportVibeLook(drop: Drop, look: VibeLook) {
  if (look.ms <= 0) return;
  note({
    surface: "vibes",
    views: [
      {
        kind: "vibe",
        id: drop.id,
        ms: Math.round(look.ms),
        pct: Math.min(1, Math.max(0, look.pct)),
        completed: look.completed,
        visible_ms: look.visibleMs,
        duration_ms: look.durationMs,
        to_swipe_ms: look.toSwipeMs,
        rewinds: look.rewinds,
        paused_ms: look.pausedMs,
        autoplay: look.autoplay,
      },
    ],
  });
}