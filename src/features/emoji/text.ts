/**
 * The emoji inside a message body, found and measured.
 *
 * A picker tile is one emoji the table chose, so it already knows what it is
 * drawing. A message body is whatever somebody typed, and has to be taken apart
 * before anything can be drawn — and what counts as an emoji here is membership
 * of the same list the picker browses, so a body can never draw something the
 * picker has no tile for. A character the list does not hold is left as the text
 * it was typed as, and the machine's own font draws it.
 *
 * The cut is `Intl.Segmenter`'s, at grapheme granularity, because an emoji is
 * not a code point: ❤️ is two, 👋🏽 is two, 🇮🇳 is two and a family is seven.
 * Cutting on code points would halve every one of them and look up halves the
 * list has never heard of. Where the platform has no segmenter there is no cut
 * at all: a body is left whole and drawn as text, which is the honest answer —
 * the alternative is guessing at where an emoji ends.
 *
 * What it reads is `flags.ts` and not `data.ts`. The two are generated together
 * from the same measurements and say the same thing; `flags.ts` leaves out the
 * names, the groups and the search words, which are the picker's business and
 * about 55 kB of it, and a message on the first screen of every chat should not
 * have to fetch a search index to find out whether one emoji moves.
 */
import { EMOJI_FLAGS } from "./flags";
import type { EmojiDrawing } from "./model";

export interface EmojiRun {
  /** This run's text, exactly as it appeared in the body. */
  text: string;
  /** Set when the run is one emoji the list holds and can be drawn. */
  art?: EmojiDrawing;
}

/**
 * A body's split, remembered.
 *
 * The same body is split on every render of every message in a thread, and a
 * thread re-renders whenever anything in it changes. Bodies repeat, so a small
 * shelf of recent answers turns the work into a lookup; the shelf is emptied
 * whole when it is full rather than aged, because the cost of a wrong miss is
 * one split and the cost of bookkeeping is more code than the split.
 */
const shelf = new Map<string, EmojiRun[]>();
const SHELF_LIMIT = 400;

/** The five skin-tone modifiers, in the order Unicode defines them. */
const TONES = ["\u{1F3FB}", "\u{1F3FC}", "\u{1F3FD}", "\u{1F3FE}", "\u{1F3FF}"] as const;

interface Segments {
  segment(input: string): Iterable<{ segment: string }>;
}
type SegmenterMaker = new (locale?: string, options?: { granularity: "grapheme" }) => Segments;

function cutter(): Segments | null {
  try {
    const maker = (Intl as unknown as { Segmenter?: SegmenterMaker }).Segmenter;
    return maker ? new maker(undefined, { granularity: "grapheme" }) : null;
  } catch {
    return null;
  }
}

/**
 * What Google has for one emoji found in a body, or null for one it has no
 * drawing or no row for.
 *
 * The lookup is exact, which is not quite enough on its own: 👋🏽 is written
 * `1f44b 1f3fd`, and the list holds 👋 and not 👋🏽 as a name of its own. So a
 * trailing tone is read off the end and the flags are asked about the tinted
 * form, which Google answers separately and far more sparsely — of the 1,615
 * toned forms, 1,580 are drawn and 250 move, against 605 of the 1,906 plain.
 * A tone buried inside a joined sequence — 👨🏽‍🤝‍👨🏾 — is left as text, because
 * that is what it is: no row, and no drawing of it either.
 */
export function drawingOf(char: string): EmojiDrawing | null {
  const plain = EMOJI_FLAGS[char];
  if (plain) return { still: plain[1] === "1", motion: plain[2] === "1" };

  const parts = [...char];
  const last = parts.at(-1);
  const tone = last ? TONES.indexOf(last as (typeof TONES)[number]) + 1 : 0;
  if (tone === 0) return null;
  const flags = EMOJI_FLAGS[parts.slice(0, -1).join("")];
  // Digits 3–7 are the five tinted drawings and 8–12 the five tinted
  // animations, in Unicode's tone order.
  if (!flags || flags[0] !== "1" || flags.length < 3 + tone + 5) return null;
  return { still: flags[2 + tone] === "1", motion: flags[7 + tone] === "1" };
}

/** One message body, cut into the runs of text and emoji it is made of. */
export function splitEmoji(text: string): EmojiRun[] {
  const known = shelf.get(text);
  if (known) return known;
  const runs = cut(text);
  if (shelf.size >= SHELF_LIMIT) shelf.clear();
  shelf.set(text, runs);
  return runs;
}

function cut(text: string): EmojiRun[] {
  if (!text) return [];
  // Most bodies are ASCII and hold no emoji; that is the common case and it
  // should not pay for a segmenter. Anything with a character above ASCII is
  // cut and asked about, which is the only way to know whether ❤️ is the heart
  // or a heart and a variation selector the list has no row for.
  if (!/[\u0080-\u{10FFFF}]/u.test(text)) return [{ text }];
  const finder = cutter();
  if (!finder) return [{ text }];

  const runs: EmojiRun[] = [];
  let words = "";
  const flush = () => {
    if (!words) return;
    runs.push({ text: words });
    words = "";
  };

  for (const { segment } of finder.segment(text)) {
    const art = drawingOf(segment);
    if (!art) {
      words += segment;
      continue;
    }
    flush();
    runs.push({ text: segment, art });
  }
  flush();
  return runs;
}
