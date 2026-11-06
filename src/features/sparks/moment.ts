import type { Spark, UserCard } from "@/types/api";
import type { SparksData } from "@/services/sparks.service";

/**
 * The person a spark moment names without being asked.
 *
 * The phone's rule, in two steps (`spark_moment.dart::_them` and then
 * `moment_composer.dart::sparkMomentMention`):
 *
 * 1. **The run's own `other`.** The card being posted is *this* run's, so a page
 *    opened before the chat list has loaded still knows who it is about.
 * 2. **The one live run.** When the payload does not carry them, the single run
 *    this account keeps that is still going names its other person — and only
 *    when there is *exactly* one. Two live runs have no honest default: a
 *    composer that picked one would be guessing, and a guessed name on a moment
 *    is somebody's name in front of a thing that was not about them.
 *
 * A run hidden from me (`off`) does not count either, because what is hidden is
 * not a person the app should put its own name into a moment for. My own id is
 * never an answer — `_clean_mentions` on the server refuses a moment that names
 * its own author.
 *
 * Read off the cache (`SparksData`) and never fetched: this is asked while a
 * page opens, which is no place for a request, and a browser that has not been
 * told anything answers nobody — the same answer the phone's unloaded store
 * gives.
 */
export function momentMention(
  run: Spark,
  book: Pick<SparksData, "sparks"> | undefined,
  meId: string | number | null | undefined,
): UserCard | null {
  const mine = String(meId ?? "");
  const usable = (person: UserCard | null | undefined): UserCard | null =>
    person && person.id && person.username && String(person.id) !== mine
      ? person
      : null;

  const onTheRun = usable(run.other);
  if (onTheRun) return onTheRun;

  let live: Spark | null = null;
  for (const candidate of book?.sparks ?? []) {
    if (!candidate.alive || candidate.off) continue;
    if (live) return null;
    live = candidate;
  }
  return usable(live?.other);
}