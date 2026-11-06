import { useState, type CSSProperties, type ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { ConfirmDialog } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import type { Asset } from "@/types/api";

/**
 * The cover over a marked post, ported from `lib/sensitive.dart`.
 *
 * Three states, and which one a card is in is decided by two flags the server
 * sends rather than by anything worked out here. `sensitive` says the post is
 * marked; `openable` says whether *this* reader may be let past the cover, and
 * it is the server's answer, not a client's guess about age or settings —
 * `FeedItemSerializer.get_openable` reads the reader off the request and answers
 * for them. A marked post that is not openable is refused flatly and never
 * fetched, so its picture is not on the screen even as a blur.
 *
 * The cover itself is the *preview* — the same small thumbnail the card would
 * have drawn anyway — blurred, with the panel's own flat tone let down to 45%
 * over it. That is why a covered card costs nothing extra to draw and why the
 * full upload is not fetched until the press that lifts it: see the app's note
 * in `_panel` and `SensitiveVeil.hideable`.
 *
 * The tone is `accent` at 10% blended onto the card, which is how the house
 * draws a raised surface wherever one has to sit on a pane — one flat tone, no
 * ramp — and it is not left translucent because a label has to read the same on
 * a tile's ground, a rail's black and a theme's ink alike.
 */
export function SensitiveVeil({
  sensitive,
  openable,
  cover,
  note,
  hideable,
  aspect,
  frame,
  children,
}: {
  sensitive?: boolean;
  openable?: boolean;
  /** The still to blur behind the panel, when the caller has one to hand. */
  cover: Asset | null;
  /** A second line only this card has — "Yours. Everybody else sees it covered." */
  note?: string | null;
  /**
   * Whether the picture can be put back under cover once it has been opened.
   *
   * True in the feed, which is the surface somebody scrolls past a post on a
   * second later, and false on a post's own page, where the reader went to read
   * it. The re-cover control is laid on the picture's lower edge rather than
   * under it, so the card does not change height the moment somebody lifts the
   * cover — the picture's box is the box the caller set, before and after.
   */
  hideable?: boolean;
  /** The shape alone, as height over width, for a caller that reserved its own box. */
  aspect?: number;
  /**
   * The exact box, for a caller that has already worked one out.
   *
   * A card in the feed caps a clip's height and a still's shape — see `frameBox`
   * — so the cover has to be built from the same function rather than from the
   * shape its caller happened to pass, or lifting the cover changes the height
   * of the card. `aspect` stays for callers whose box is a plain shape (a rail
   * tile, a convo's picture).
   */
  frame?: CSSProperties;
  children: ReactNode;
}) {
  const [opened, setOpened] = useState(false);
  const [asking, setAsking] = useState(false);

  if (!sensitive) return <>{children}</>;
  const lift = Boolean(openable);

  if (lift && opened) {
    return (
      <div className="relative">
        {children}
        {hideable ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
            <button
              type="button"
              onClick={() => setOpened(false)}
              className="pointer-events-auto rounded-full bg-[rgb(8_8_12_/_0.62)] px-3 py-1.5 text-[11.5px] font-bold text-white backdrop-blur transition hover:bg-[rgb(8_8_12_/_0.75)]"
            >
              Hide
            </button>
          </div>
        ) : null}
      </div>
    );
  }

  const preview = cover?.thumbnail_url || cover?.content_url || null;
  const small = Boolean(aspect && aspect < 0.7);

  return (
    <div
      // The cover's box is the shape the caller reserved, so the card does not
      // change height the moment somebody lifts it — but a shape is not a size:
      // a portrait post's box is nearly twice as tall as the screen it is read
      // on, and the cover has to answer the same ceiling the picture inside it
      // answers. `frame` is that answer, worked out by the caller; without it
      // the shape is drawn at the ceiling's own share of the screen. See
      // `frameBox` in `frame.ts`.
      className={cn(
        "relative flex items-center justify-center overflow-hidden",
        frame ? "w-full" : "max-h-[78dvh]",
      )}
      style={frame ?? (aspect ? { width: "100%", aspectRatio: `1 / ${aspect}` } : undefined)}
    >
      {preview ? (
        <AuthedImage
          src={preview}
          alt=""
          aria-hidden
          className="absolute inset-0 size-full scale-110 object-cover blur-[18px]"
        />
      ) : null}
      <div
        className="relative flex size-full items-center justify-center p-3"
        style={{ backgroundColor: "color-mix(in srgb, color-mix(in srgb, var(--accent) 10%, var(--card)) 45%, transparent)" }}
      >
        <div className={cn("flex flex-col items-center text-center", small ? "max-w-[140px]" : "max-w-[260px]")}>
          <EyeOff className="size-6 text-ink" aria-hidden />
          <p className="mt-2 text-[14px] font-bold">Sensitive content</p>
          {note && !small ? <p className="mt-0.5 text-[12px] leading-[1.3] text-dim">{note}</p> : null}
          {!small ? (
            <p className="mt-1.5 text-[12.5px] leading-[1.35] text-dim">
              {lift
                ? "This is marked sensitive content."
                : "This is only for people over 18."}
            </p>
          ) : null}
          {lift ? (
            <button
              type="button"
              onClick={() => setAsking(true)}
              className="mt-0.5 min-h-8 rounded-full px-4 text-[14px] font-bold text-accent transition hover:bg-[var(--accent-soft)]"
            >
              Open now
            </button>
          ) : null}
        </div>
      </div>

      <ConfirmDialog
        open={asking}
        onClose={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          setOpened(true);
        }}
        title="Sensitive content"
        body="Open it anyway?"
        confirmLabel="Open now"
      />
    </div>
  );
}

/**
 * Whether this reader may be let past a marked post at all.
 *
 * The two flags are the server's and are read together: `sensitive` says the
 * app should draw a cover, and `openable` says whether that cover may be
 * lifted for the person holding the phone. A browser has no "18 and over" of
 * its own to ask, so nothing here invents one — and a card never draws a press
 * the server has already refused.
 */
export function veilLiftable(sensitive?: boolean, openable?: boolean): boolean {
  return Boolean(sensitive && openable);
}
