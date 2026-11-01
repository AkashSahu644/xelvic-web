// The three pictures a marketplace card is made of: a theme's character mark,
// its poster, and a figure's pose.
//
// Ported from `theme_marks.dart` and `characters.dart`. Each one is a reading of
// the design *and the catalogue row over it*, because §0's rule reaches here
// too: a row that names nothing leaves the bundled design's own mark, size and
// character exactly as they were.

import { ThemeMarkArt, type ThemeMark } from "@/theme/ThemeMarkArt";
import { cn } from "@/lib/cn";
import type { ThemeDesign, ThemePalette } from "@/theme/catalog";
import { coverFor } from "@/theme/shelf";
import type { CatalogueTheme } from "./types";

/** The shapes this build knows how to draw, so a row naming a newer one falls back. */
const MARKS: readonly string[] = [
  "blob", "horn", "cloud", "cup", "bolt", "flower", "shell", "flame", "star",
  "blossom", "sun", "ribbon", "shard", "feather", "ring", "swirl", "eclipse",
  "paw", "wing", "fox", "tiara", "headset", "visor", "knot", "hood", "toon",
  "bubble", "snout", "aerial", "patch", "helmet", "bear", "moon",
];

/**
 * The mark [name] names, or nothing when this build has no such shape.
 *
 * The name arrives as the server's own identifier — one of `MARKS` in
 * `backend/apps/studio/marks.py` — so a miss is either the empty string or a
 * mark from a newer list than this build holds. Both are answered the same way:
 * draw the bundled design's own.
 */
export function markNamed(name: string | null | undefined): ThemeMark | null {
  const wanted = (name ?? "").trim();
  if (!wanted) return null;
  return MARKS.includes(wanted) ? (wanted as ThemeMark) : null;
}

/**
 * The character this design wears *here*: the row's mark when it sets one this
 * build can draw, the bundled design's own otherwise.
 */
export function characterFor(design: ThemeDesign, row: CatalogueTheme | null): { name: string; mark: ThemeMark } {
  const mark = markNamed(row?.mark);
  if (!mark) return { name: design.character, mark: design.mark };
  const name = (row?.mark_name ?? "").trim();
  return { name: name || design.character, mark };
}

/**
 * How big that character is drawn.
 *
 * `tile` is the shop tile, which draws at 0.75 of the row's size — 30 when
 * `mark_size` is 40, which is what it drew before any of this existed. The
 * row's number is honoured whenever the row sets a mark at all: the tile is a
 * ratio of the poster and not a second setting, so one number on the row moves
 * both. A mark this build happens not to draw still leaves the size the row's,
 * because the size is a number that can be honoured even when the shape is one
 * that cannot — only the shape falls back, in [characterFor].
 */
export function markSizeFor(row: CatalogueTheme | null, tile = false): number {
  const size = row && row.mark ? row.mark_size : 40;
  return tile ? size * 0.75 : size;
}

/** One theme's character, drawn in that theme's own colours. */
export function CharacterMark({
  design,
  row,
  palette,
  size,
  className,
}: {
  design: ThemeDesign;
  row: CatalogueTheme | null;
  palette: ThemePalette;
  size: number;
  className?: string;
}) {
  const character = characterFor(design, row);
  return (
    <ThemeMarkArt
      mark={character.mark}
      accent={palette.accent}
      ink={palette.ink}
      ground={palette.card}
      size={size}
      className={className}
    />
  );
}

/**
 * The picture on the shelf: the poster in the reading being drawn, and the
 * theme's own face or scene when it has no poster of its own.
 */
export function ThemeCover({ design, dark, className }: { design: ThemeDesign; dark: boolean; className?: string }) {
  const src = coverFor(design, dark);
  if (!src) return null;
  return <img src={src} alt="" className={className} draggable={false} />;
}

/**
 * One figure's pose.
 *
 * The app draws this as `Image(fit: BoxFit.contain)` inside a `SizedBox`, so the
 * art is fitted into a box the surrounding layout chose and never cropped.
 * `fill` is that shape: the picture takes the box it is given, and the caller
 * sizes the box. Without it the picture *is* the box, at [size] on both sides —
 * which is what a pose drawn on its own is.
 *
 * A missing address draws nothing at all, and a URL that will not load leaves a
 * blank box rather than a broken picture: a figure that has not landed should
 * look like a figure standing still, not like a mistake.
 */
export function Pose({
  src,
  size = 0,
  fill = false,
  className,
}: {
  src: string | null | undefined;
  size?: number;
  fill?: boolean;
  className?: string;
}) {
  if (!src) return null;
  if (fill) {
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        className={cn("h-full w-full object-contain", className)}
      />
    );
  }
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ objectFit: "contain", width: size, height: size }}
    />
  );
}
