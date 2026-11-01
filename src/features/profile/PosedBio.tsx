import { useEffect, useMemo, useRef, useState } from "react";
import { BUNDLED_POSES, figurePoses, CLASSIC_FIGURE } from "@/features/marketplace/model";
import { useDripShelf } from "@/features/marketplace/queries";
import { cn } from "@/lib/cn";

/**
 * A bio with the person's figure standing beside it, saying it.
 *
 * Ported from `PosedBio` in `app/lib/screens/widgets.dart`. A bio is normally a
 * paragraph under a name, read as something the page is stating; this draws it
 * as something *said* — the sentence in a bubble, the figure that says it at the
 * bubble's right, both stood on the same floor. The owner asked for it on
 * 2026-10-02: *"profile me jo bio hai aisa likhe ki charector bio ko bol raha"*.
 *
 * The figure is the one the person is actually wearing. The chain is the
 * convo's, unchanged — the Drip key, then the app's own figure. The app has one
 * more rung the web cannot take: a theme's bundled figure. The web's catalogue
 * carries the figure's *name* but not its pictures, so an account wearing no
 * shop figure falls back to the bundled one rather than to the theme's own.
 * That is a limit of the assets this build ships, not a different rule, and the
 * lens is recorded in `XELVIC_FEATURE_PARITY_MATRIX.md`.
 *
 * The sentence arrives *written* rather than printed. The typing is the app's:
 * 34 ms a letter, capped at 2.6 s however long the bio is, and skipped entirely
 * for a reader who asked for less motion. The writing figure stands in its
 * `typing` pose while letters are still arriving and its `wait` pose after, and
 * there is only ever one figure on the page — the app had two stacked once and
 * the owner reported the double image on 2026-10-03.
 */
export function PosedBio({
  text,
  character,
  show,
  className,
}: {
  /** What the figure is saying. */
  text: string;
  /**
   * The Drip key the person wears, or null on my own page — which is the one
   * page that must read the shelf live, because the session's copy of my
   * account is what it was when I signed in.
   */
  character?: string | null;
  /**
   * Whether a figure stands beside the sentence at all. Null means "ask the
   * shelf" — my own page, where the switch is live. Somebody else's page passes
   * their `show_character`, because whether a figure introduces them is their
   * choice and not mine.
   */
  show?: boolean | null;
  className?: string;
}) {
  const shelf = useDripShelf();

  const figure = useMemo(() => {
    const key = (character ?? "").trim() || (shelf.data?.worn ?? "").trim();
    if (!key || key === CLASSIC_FIGURE) return null;
    return shelf.data?.characters?.find((row) => row.key === key) ?? null;
  }, [character, shelf.data]);

  /**
   * The three pictures, with the same fallback the shop's tiles use: a figure
   * with no `bio` pose has nothing to say standing beside a profile, and the
   * app's chain is applied rather than a second one invented here.
   */
  const art = figure ? figurePoses(figure) : BUNDLED_POSES;

  /**
   * Null means "read the shelf". A session that has not answered yet reads as
   * shown, which is the app's own default (`show_character` ships on), so the
   * figure does not pop in a moment after the page.
   */
  const shows = show ?? shelf.data?.show_character ?? true;

  const letters = useMemo(() => Array.from(text), [text]);
  const [written, setWritten] = useState(0);
  const asked = useRef(false);

  useEffect(() => {
    // A new sentence starts again. The app rebuilds the controller for the
    // same reason: this widget is drawn once per profile and the text is that
    // profile's.
    asked.current = false;
    setWritten(0);
  }, [text]);

  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    const reduce =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || letters.length === 0) {
      setWritten(letters.length);
      return;
    }
    // `_writeTime`: a letter is 34 ms and the whole sentence is capped at 2.6 s,
    // so a long bio comes faster rather than making the reader wait longer.
    const total = Math.min(letters.length * 34, 2600);
    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const share = Math.min(1, (now - started) / total);
      setWritten(Math.round(share * letters.length));
      if (share < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [letters.length]);

  const writing = written < letters.length;

  return (
    <div className={cn("flex items-end gap-2.5 px-[18px] pt-3", className)}>
      <div className="min-w-0 flex-1 rounded-[14px] border border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)] px-[13px] py-[11px]">
        {/* The bio's own type, unchanged from the bare paragraph this
            replaced: the bubble is a new frame around the same words. */}
        <p className="whitespace-pre-wrap text-[13px] font-semibold leading-[1.45] text-[color-mix(in_srgb,var(--ink)_85%,transparent)]">
          {Array.from(text).slice(0, written).join("")}
        </p>
      </div>
      {shows ? (
        <img
          src={writing ? art.typing ?? art.wait ?? art.bio ?? "" : art.bio ?? art.wait ?? ""}
          alt=""
          aria-hidden
          width={92}
          height={92}
          className="h-[92px] w-[92px] shrink-0 object-contain"
          draggable={false}
        />
      ) : null}
    </div>
  );
}