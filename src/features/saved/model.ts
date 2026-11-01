import {
  AudioLines,
  Bookmark,
  Clapperboard,
  FileText,
  Image,
  Images,
  BarChart3,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { SavedThing } from "@/types/api";

/**
 * What is on the shelf, and what to call it.
 *
 * Ported from the foot of `app/lib/screens/saved.dart` — `kindOf`, `kindLabel`
 * and the leading square's `_icon`. Two different questions are answered here
 * and they are deliberately not the same one:
 *
 * - **The shelf's kinds** are `drop`, `vibe`, `track`, and those are what the
 *   chips at the top are named after.
 * - **A row's kind** is the thing's own kind — a poll, a gallery, a picture, an
 *   episode — and that is the word printed under its name.
 *
 * A row that said "drop" under a photograph and under a poll would be a row that
 * told the reader nothing, which is why the two vocabularies are kept apart.
 */

/**
 * The chip order: the shelf's own three kinds, in this order.
 *
 * Not alphabetical and not by size. A row of chips that reordered itself as
 * things were saved would be a row somebody has to read again every time it
 * moves, so the order is fixed and only the counts change. The whole shelf comes
 * first, and is drawn whether or not it is the only chip.
 */
export const SHELF_KINDS: { kind: string; word: string }[] = [
  { kind: "drop", word: "Drops" },
  { kind: "vibe", word: "Vibes" },
  { kind: "track", word: "Music" },
];

/** The live card on a shelf row, whichever of the two keys it is under. */
export function cardOf(thing: SavedThing) {
  return thing.drop ?? thing.vibe ?? null;
}

/** Whether a shelf row is a song or an episode rather than something posted. */
export function isTrack(thing: SavedThing) {
  return thing.track != null;
}

/**
 * What a thing on the shelf is, in one word.
 *
 * `kindOf` in `saved.dart`. The order of the tests is the app's and it matters:
 * a gallery is also an image and a poll is also a note, so the most particular
 * answer has to be asked first or the general one swallows it.
 *
 * The words are English literals here rather than a table of keys, because the
 * web's `t()` is a lookup on the English sentence itself — the key *is* the
 * word, which is why every one of these is written exactly as `en.dart` writes
 * it.
 */
export function kindOf(thing: SavedThing): string {
  const track = thing.track;
  if (track) return track.kind === "podcast" ? "Episode" : "Song";

  const drop = cardOf(thing);
  if (!drop) return "Saved";
  if (drop.kind === "vibe") return "Vibe";
  if (drop.poll) return "Poll";
  if (drop.asset?.kind === "audio" || drop.kind === "audio") return "Audio";
  // `get_gallery` answers [] below two, so a non-empty run is the whole test.
  if ((drop.gallery?.length ?? 0) > 1) return "Gallery";
  if (drop.kind === "image") return "Picture";
  if (drop.kind === "video") return "Video";
  if (drop.kind === "text") return "Note";
  return "Drop";
}

/**
 * The mark that stands in for a picture a drop never had.
 *
 * The same bargain initials make for a face: something rather than a hole. A
 * track never reaches this — it has its own sleeve, drawn from its seed — so the
 * null case is a drop the store could not read at all, which the server never
 * sends but which must not be drawn as a blank square either.
 */
export function kindIcon(thing: SavedThing): LucideIcon {
  const drop = cardOf(thing);
  if (!drop) return Bookmark;
  if (drop.kind === "vibe") return Clapperboard;
  if (drop.poll) return BarChart3;
  if (drop.asset?.kind === "audio" || drop.kind === "audio") return AudioLines;
  if ((drop.gallery?.length ?? 0) > 1) return Images;
  if (drop.kind === "image") return Image;
  if (drop.kind === "video") return Video;
  return FileText;
}
