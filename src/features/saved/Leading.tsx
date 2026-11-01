import { Bookmark, type LucideIcon } from "lucide-react";
import { AuthedImage } from "@/components/Media";
import { CoverArt, seedOf, trackIsPodcast } from "@/features/audio/parts";
import { cardOf, kindIcon } from "@/features/saved/model";
import type { SavedThing } from "@/types/api";

/**
 * The square at the head of a row: the thing's own picture where it has one.
 *
 * The app draws this twice — `_Leading` in `screens/saved.dart` and
 * `_ActivityLeading` in `screens/activity.dart` — as two near-copies with the
 * same numbers, and the copies have already drifted in one way worth naming:
 * the shelf falls back to `bookmark_border` for a row it could not read at all
 * and the activity list falls back to `favorite_border`, because "put by" and
 * "felt" are the two things those two screens are about. That difference is
 * the [emptyIcon] and everything else is shared, which is what this file is.
 *
 * 66 across and radius 18, the app's numbers, and a track wears the catalogue's
 * own sleeve — what a track is recognised by everywhere else — rather than the
 * grey box a save of a song would otherwise be.
 */
export function SavedRowLeading({
  thing,
  emptyIcon: EmptyIcon = Bookmark,
}: {
  thing: SavedThing;
  /** The mark for a row with no card at all. `Bookmark` on the shelf, `Heart` on activity. */
  emptyIcon?: LucideIcon;
}) {
  const card = cardOf(thing);
  const track = thing.track;

  if (track) {
    const cover = track.cover?.thumbnail_url || track.cover?.content_url || track.cover_url;
    const fallback = (
      <CoverArt seed={seedOf(track.seed)} podcast={trackIsPodcast(track)} size={66} radius={18} />
    );
    return (
      <span className="size-[66px] shrink-0 overflow-hidden rounded-[18px]">
        {cover ? (
          <AuthedImage src={cover} alt="" className="size-full object-cover" fallback={fallback} />
        ) : (
          fallback
        )}
      </span>
    );
  }

  const still = card?.asset?.thumbnail_url;
  if (still) {
    return (
      <span className="size-[66px] shrink-0 overflow-hidden rounded-[18px]">
        <AuthedImage
          src={still}
          alt=""
          className="size-full object-cover"
          fallback={<Glyph thing={thing} EmptyIcon={EmptyIcon} />}
        />
      </span>
    );
  }

  return <Glyph thing={thing} EmptyIcon={EmptyIcon} />;
}

/**
 * What stands in for a picture a drop never had — the same bargain initials make
 * for a face, and the same one the card in the feed makes.
 */
function Glyph({ thing, EmptyIcon }: { thing: SavedThing; EmptyIcon: LucideIcon }) {
  const Icon = cardOf(thing) ? kindIcon(thing) : EmptyIcon;
  return (
    <span className="flex size-[66px] shrink-0 items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-[color-mix(in_srgb,var(--ink)_34%,transparent)]">
      <Icon className="size-[26px]" aria-hidden />
    </span>
  );
}
