// The picture a screen stands on, and the wash it is read through.
//
// Ported from `xelvic/app/lib/screens/backdrop.dart`, whose whole job is this
// and which is one widget rather than a background on each page for a reason it
// states itself: a background on each page *"would be five copies of the same
// photograph being decoded five times and five chances for one of them to be a
// slightly different size."* The web has the same three callers the app has —
// the shell's own pages, a page pushed over them, and the theme preview — so it
// gets the same one copy.
//
// It draws two things and nothing else:
//
//   * **The picture**, edge to edge, cropped where the design's row framed it.
//     `cover` and never `contain`: the picture is a ground rather than a
//     subject, and the one thing it must never do is leave a band of the page's
//     own colour down one side of a screen it was not drawn for.
//   * **One tone over it**, at whatever alpha the caller's veil named. Never a
//     second colour and never a gradient: the wash has one job, which is to keep
//     words readable on somebody's painting.
//
// Everything about *which* picture and *how hard* is the provider's answer, not
// this file's — see `backdropFor`, and `ThemeBackdrop`'s own note that a picture
// drawn for a light page and read in dark mode is the only reason a veil exists
// at all.

import { cn } from "@/utils/cn";
import type { ScreenBackdrop } from "@/hooks/useTheme";

/** `#13131A` as the three channels CSS wants for `rgb(19 19 26 / 0.5)`. */
function rgbTriple(hex: string): string {
  const value = hex.replace("#", "");
  const number = Number.parseInt(value, 16);
  if (!Number.isFinite(number)) return "19 19 26";
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

/**
 * [backdrop] laid down behind everything on the page, or nothing at all.
 *
 * Nothing at all is the common case — every theme but the painted ones — and it
 * draws nothing rather than forcing the caller to ask what theme is on, which is
 * `ThemeBackdrop`'s own design and the reason a theme added later cannot be a
 * theme some page was never told about.
 *
 * `position` says how the layer is anchored, and the two answers are the two
 * kinds of page the web has. A shell page pins it to the viewport, because the
 * shell's own content turns over inside a scroll view of its own and the picture
 * must not travel with it. A pushed page keeps it inside its own box, because a
 * page on the web *is* what scrolls — pinning it there would put it over the
 * shell's own bar, which is painted earlier in the tree and would be covered.
 *
 * Both layers are drawn at a **negative** stack level, and that is the whole of
 * how a ground works in CSS. A positioned element at `z-index: auto` paints at
 * step 6 of its stacking context — *after* step 3, where the backgrounds of
 * every plain `<div>` above it in the tree are painted — so a layer left at
 * `auto` covers every card and every line of text on the page it was meant to
 * sit under. At `-10` it paints at step 2, which is immediately above the host's
 * own background and below everything else, which is exactly what
 * `ThemeBackdrop`'s first child is in Flutter. The host must therefore be a
 * stacking context (`isolate`, or a `fixed` element with a `z-index` of its own)
 * or the layer escapes to an outer context and lands behind the host's own
 * background instead of over it.
 */
export function Backdrop({
  backdrop,
  position = "fixed",
}: {
  backdrop: ScreenBackdrop | null;
  position?: "fixed" | "absolute";
}) {
  if (!backdrop) return null;
  const crop = backdrop.crop;
  const layer = cn("pointer-events-none inset-0 -z-10", position === "fixed" ? "fixed" : "absolute");
  return (
    <>
      <div
        className={cn(layer, "bg-cover")}
        style={{
          backgroundImage: `url(${backdrop.art})`,
          backgroundPosition: crop ? `${crop.x * 100}% ${crop.y * 100}%` : "center",
          // The zoom is about the same point the alignment put the picture's
          // focus on, so the point somebody framed stays exactly where they put
          // it — the app's `FramedPicture`, and the panel's own numbers.
          ...(crop && crop.zoom !== 1
            ? {
                transform: `scale(${crop.zoom})`,
                transformOrigin: `${crop.x * 100}% ${crop.y * 100}%`,
              }
            : {}),
        }}
        aria-hidden
      />
      {backdrop.veil > 0 ? (
        <div
          className={layer}
          style={{ background: `rgb(${rgbTriple(backdrop.wash)} / ${backdrop.veil})` }}
          aria-hidden
        />
      ) : null}
    </>
  );
}
