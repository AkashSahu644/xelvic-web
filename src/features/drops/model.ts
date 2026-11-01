import { api } from "@/lib/api";
import type { Asset, Drop, Poll } from "@/types/api";

/**
 * What a drop *is*, asked in one place.
 *
 * The app answers every one of these off the row it was handed — `Drop.isPoll`,
 * `isPicture`, `isSound`, `isVibe` in `lib/drops.dart` — and the web used to
 * answer them by sniffing `asset.mime` in the card, which is a second reading of
 * the same fact and the one that drifts. `kind` is the server's own word
 * (`apps/drops/models.py`: `text`, `image`, `video`, `audio`, `poll`, and
 * `vibe` for the other table), so it is the one that is read here.
 */
export function dropIsVibe(drop: Drop): boolean {
  return drop.kind === "vibe";
}

export function dropIsPoll(drop: Drop): boolean {
  return drop.kind === "poll";
}

export function dropIsPicture(drop: Drop): boolean {
  return drop.kind === "image" || drop.kind === "video";
}

export function dropIsSound(drop: Drop): boolean {
  return drop.kind === "audio";
}

/**
 * The pictures a card pages through, in order.
 *
 * The server answers `gallery: []` for anything with fewer than two uploads —
 * `DropSerializer.get_gallery` says so and says why — so a non-empty list *is*
 * the whole test for "this pages", and the single-upload card falls back to
 * `asset` exactly as the app's `media` does.
 */
export function dropPictures(drop: Drop): Asset[] {
  const run = (drop.gallery ?? []).filter(Boolean);
  if (run.length > 1) return run;
  return drop.asset ? [drop.asset] : [];
}

export function dropIsGallery(drop: Drop): boolean {
  return dropPictures(drop).length > 1;
}

/**
 * The still a tile draws for this row.
 *
 * A sound's own asset *is* the audio, so the picture on its square is a second
 * upload and never the first: the app's `Drop.still` is `isSound ? cover :
 * asset`. Handed the mp3 instead, a tile puts a blank where the artwork goes.
 */
export function dropStill(drop: Drop): Asset | null {
  return dropIsSound(drop) ? drop.cover ?? null : drop.asset ?? null;
}

/** "1 answer" / "4 answers" — `_answers` in `screens/drops.dart`. */
export function dropAnswers(value: number): string {
  return value === 1 ? "1 answer" : `${value} answers`;
}

/**
 * How long a poll has left, in the coarsest unit that still says something.
 *
 * A countdown to an absolute deadline the *server* set, and never a decision
 * about it: `closed` is the server's word and this only draws the time left
 * beside it. The app's ladder is days, then hours, then minutes, then "under a
 * minute", and a deadline already gone reads as the word `closed` rather than
 * as a negative number.
 */
export function dropPollLeft(poll: Poll, now: number = Date.now()): string {
  const at = poll.closes_at ? new Date(poll.closes_at).getTime() : Number.NaN;
  if (!Number.isFinite(at)) return "";
  const left = at - now;
  if (left < 0) return "closed";
  const hours = Math.floor(left / 3_600_000);
  if (hours >= 24) return `${Math.floor(hours / 24)}d left`;
  if (hours >= 1) return `${hours}h left`;
  const minutes = Math.floor(left / 60_000);
  if (minutes >= 1) return `${minutes}m left`;
  return "under a minute";
}

/**
 * The line under a poll's answers: how many answered, how long is left, and
 * how many answers it takes.
 *
 * Three parts in the app's own order and its own separator — see `_pollFoot`:
 * a lock and "Closed · 12 answers" once the poll is shut, otherwise the count
 * when there is one and the countdown, joined by `·`, with "Any number" at the
 * far end when the poll takes more than one.
 */
export function dropPollFoot(poll: Poll, answers: number): string {
  if (poll.closed) return `Closed · ${dropAnswers(answers)}`;
  return [
    answers > 0 ? dropAnswers(answers) : "",
    dropPollLeft(poll),
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * The address prefix this row lives under.
 *
 * A vibe and a drop are two tables with two families of routes — `drops/vibes/`
 * and `drops/` — and the app keeps the choice in one place (`Drops._path`) for
 * the same reason: every other call on either kind is the same call with a
 * different prefix, and a card that worked out the prefix itself is a card that
 * can work it out differently from the one beside it.
 */
export function dropBase(drop: Drop): string {
  // No leading slash: every caller writes `/${dropBase(drop)}/…` or joins it
  // after one, and a prefix that carried its own slash asked each of them to
  // remember which of the two it was — the eight call sites had already drifted
  // into both, and `//drops/…` is not a route the server serves.
  return dropIsVibe(drop) ? "drops/vibes" : "drops";
}

/** The one address of this row: what a card opens, and what a menu acts on. */
export function dropPath(drop: Drop): string {
  return `/${dropBase(drop)}/${drop.id}`;
}

/** How many answered, counted the way the app counts it: options, never votes. */
export function dropPollAnswers(poll: Poll): number {
  return poll.votes ?? poll.options.reduce((sum, option) => sum + (option.votes ?? 0), 0);
}

/** The fraction of the room behind one answer, or zero when nobody answered. */
export function dropPollShare(poll: Poll, optionVotes: number): number {
  const total = dropPollAnswers(poll);
  // Nothing to compare against with nobody answered, and a bar of zero width is
  // what a share of nothing would be.
  if (!poll.results || total <= 0) return 0;
  return Math.min(1, Math.max(0, optionVotes / total));
}

/**
 * One look at a drop, reported the way the app reports it.
 *
 * A drop has no page of its own in this app — a picture, a poll or a text post
 * is read where it sits — so the look is counted from the card that filled the
 * eye, which is the only place it can be counted from. Two rules ride with it,
 * both the app's (`Drops.seen`): my own post is never a look, and one post is
 * reported once a day however often it comes back. The once-a-day memory is
 * here rather than at the call site so the second card that draws the same drop
 * cannot report a second look, and it is forgotten again if the request fails —
 * a look lost to one bad request is a look its author never sees, and the server
 * is what stops it counting twice anyway.
 */
const looksDay = { value: "" };
const looksSent = new Set<string>();

export async function reportDropLook(drop: Drop): Promise<void> {
  if (drop.mine) return;
  const day = new Date().toISOString().slice(0, 10);
  if (day !== looksDay.value) {
    looksDay.value = day;
    looksSent.clear();
  }
  if (looksSent.has(drop.id)) return;
  looksSent.add(drop.id);
  try {
    await api.post(`/${dropBase(drop)}/${drop.id}/seen/`, {});
  } catch {
    looksSent.delete(drop.id);
  }
}
