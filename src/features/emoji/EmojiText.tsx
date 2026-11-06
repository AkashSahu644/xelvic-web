/**
 * A message body: its words in the machine's font, its emoji in Google's.
 *
 * The picker draws emoji that somebody is choosing between; this draws the ones
 * somebody already said. They are the same drawing and the same animation — an
 * emoji in a bubble moves where an emoji in a grid moves, and both stop when the
 * app is asked for less motion — but they are not the same thing on the page.
 * A tile is a button in a grid; an emoji in a sentence is part of the sentence,
 * so `mode="text"` keeps the character selectable and readable, which a tile has
 * no reason to be.
 *
 * A body with no drawable emoji in it — which is most of them — is handed back
 * as the plain string it was, so the common case adds no element at all.
 *
 * Nothing here moves on its own. An emoji in a message plays when a pointer
 * rests on it, and plays once when `burst` changes — which is how a message
 * that has just been sent or has just arrived says so.
 */
import { Fragment } from "react";
import { EmojiArt } from "./EmojiArt";
import { splitEmoji } from "./text";

/** An emoji in a sentence sits just above the baseline, at the text's own size. */
const INLINE = "inline-grid size-[1.15em] align-[-0.2em]";

export function EmojiText({ text, burst }: { text: string; burst?: number }) {
  const runs = splitEmoji(text);
  if (!runs.some((run) => run.art)) return <>{text}</>;
  return (
    <>
      {runs.map((run, index) =>
        run.art ? (
          <EmojiArt
            key={index}
            char={run.text}
            motion={run.art.motion}
            still={run.art.still}
            mode="text"
            burst={burst}
            className={INLINE}
          />
        ) : (
          <Fragment key={index}>{run.text}</Fragment>
        ),
      )}
    </>
  );
}
