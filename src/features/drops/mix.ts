/**
 * The feed with Vibes woven into it — `mix.ts` is `app/lib/drops.dart`'s
 * `mixedFeed`, `_mixSlots`, `shelfOrder` and `shelfKey`, carried over whole.
 *
 * A Vibe is not a second kind of post on a phone. It is a card in the same feed
 * as everything else, and the server says how many of a page's cards should be
 * Vibes rather than sending an arrangement: `DropFeedView` answers
 * `vibe_share`, worked out per reader by `services.feed_vibe_share` — twenty
 * per cent for a reader the place already knows, forty for a cold start — and
 * the app does the weaving. Nothing here is a second opinion about that number;
 * it arrives on the page and this places the clips.
 *
 * The arrangement is a *block* of ten rather than a coin flip per card. A flip
 * gives a binomial count, so one page of ten could honestly contain no Vibe at
 * all and the next four, and a reader who scrolled one screen would be told the
 * mix is twenty per cent and shown nought or forty. A block holds exactly
 * `share × 10` clips — two at twenty per cent, four at the cold start — at
 * positions drawn from a seeded shuffle: the count is the promise and the
 * places are chance.
 *
 * **Deterministic for a salt.** The same salt and the same lists answer the
 * same arrangement, which is what lets a rebuild — a heart landing, a sheet
 * closing — leave every card where the thumb left it, and what lets a page that
 * grows underneath keep the Vibes already on screen where they were: block
 * `i ~/ 10` depends on the card's position and the salt, not on how many cards
 * happen to be in hand.
 *
 * Everything here is arithmetic over ids, so it is the one part of the feed
 * that can be *known* to agree with the phone rather than hoped to: see
 * `mix.test.ts`, which carries the phone's own numbers.
 */

import { dropIsVibe } from "./model";
import type { Drop } from "@/types/api";

/** How many feed cards one block of the weave covers. The app's `kMixBlock`. */
export const MIX_BLOCK = 10;

/**
 * The share the app falls back to when the server has not said.
 *
 * `Drops.vibeShare`, and it is a constant here for the same reason it is one
 * there: a first page arriving from a server too old to carry the number is
 * mixed with something, and the app's answer to "something" is the share a
 * reader with no history is shown. The server's own number replaces it the
 * moment a page carries one.
 */
export const FEED_VIBE_SHARE_FALLBACK = 0.2;

/**
 * Where one Vibe falls in the shelf's order: FNV-1a over its id, salted.
 *
 * Written out rather than reached for. The hash a platform offers is either
 * seeded per run or a different algorithm, and a rail that moved about between
 * two openings of the page would be a rail rearranging itself under the thumb
 * already reaching for a card.
 *
 * `Math.imul` rather than `*` for the multiply, and this is the one place the
 * port could have gone quietly wrong: the phone's `int` holds the whole product
 * before it is masked, and a JavaScript number does not — `(hash ^ unit) *
 * 16777619` passes 2^53 and rounds, answering a different hash for the same id.
 * `Math.imul` is the low thirty-two bits of the product exactly, which is what
 * the phone's `& 0xFFFFFFFF` keeps.
 */
export function shelfKey(id: string, salt: number): number {
  let hash = (2166136261 ^ salt) >>> 0;
  for (let at = 0; at < id.length; at++) {
    hash = Math.imul(hash ^ id.charCodeAt(at), 16777619) >>> 0;
  }
  return hash;
}

/**
 * The shelf's order: every Vibe, shuffled once and then left alone.
 *
 * The rail above the feed is there to be looked at rather than read, and it is
 * the first thing on the page: a shelf drawn in the server's own order — the
 * same order as the top of the page underneath it — is a second telling of the
 * first thing anybody sees.
 *
 * A sort on a salted key rather than a shuffle, because a shuffle is a decision
 * about the *list* and the list is replaced every time the shelf is fetched, so
 * a shuffled-once list would have to be remembered and re-applied by somebody —
 * state that can fall out of step with the list it describes. A key is a
 * decision about the *Vibe*, so asking for the order again answers the same
 * thing with nothing carried anywhere.
 */
export function shelfOrder(vibes: Drop[], salt: number): Drop[] {
  const rows = [...vibes];
  rows.sort((a, b) => {
    const by = shelfKey(String(a.id), salt) - shelfKey(String(b.id), salt);
    // Two ids are two different ids, so this only ever decides a real tie
    // between two hashes — but a comparator that may call two different things
    // equal is a sort whose answer depends on the order it was handed, and the
    // one thing this order must never do is depend on that. Compared by code
    // unit, which is what the phone's `String.compareTo` does.
    return by !== 0 ? by : compareIds(String(a.id), String(b.id));
  });
  return rows;
}

/** The phone's `String.compareTo`: code unit by code unit, then by length. */
function compareIds(a: string, b: string): number {
  const least = Math.min(a.length, b.length);
  for (let at = 0; at < least; at++) {
    const by = a.charCodeAt(at) - b.charCodeAt(at);
    if (by !== 0) return by;
  }
  return a.length - b.length;
}

/**
 * The card offsets inside block [block] that carry a Vibe, in order.
 *
 * A partial Fisher–Yates over ten slots, seeded by [shelfKey] of the block and
 * the salt.
 *
 * A Lehmer generator rather than the usual `x * 1103515245 + 12345`: the
 * product there passes 2^53, and on the web build integers are doubles, so the
 * phone and the browser would answer different shuffles for one salt. Every
 * step here stays under `2147483647 × 48271 ≈ 1.04e14`, which is exact in both,
 * so the arrangement is the same arithmetic everywhere.
 */
export function mixSlots(salt: number, block: number, want: number): number[] {
  const slots = Array.from({ length: MIX_BLOCK }, (_, at) => at);
  let state = shelfKey(`mix:${block}`, salt);
  if (state === 0) state = 2463534242;
  for (let at = 0; at < want; at++) {
    state = (state * 48271) % 2147483647;
    const j = at + (state % (MIX_BLOCK - at));
    const held = slots[at];
    slots[at] = slots[j];
    slots[j] = held;
  }
  return slots.slice(0, want).sort((a, b) => a - b);
}

/** How many Vibes a block of ten carries, for a share the server sent. */
export function mixPerBlock(share: number): number {
  if (!Number.isFinite(share) || share <= 0) return 0;
  return Math.min(MIX_BLOCK, Math.max(0, Math.round(share * MIX_BLOCK)));
}

/**
 * How many clips the rail above the feed holds once the feed is filled.
 *
 * The owner's words on 2026-10-24: *"upar 10 rail chalegi uske baad neeche ke
 * cards dikhao"* — ten in the rail, and the shelf's own tail as the cards below
 * it. See [filledWithVibes].
 */
export const RAIL_CLIPS = 10;

/**
 * The cards a page draws when the feed has run out: the shelf's own tail.
 *
 * A `seen=strict` feed runs out. The server stops re-dealing what this reader
 * has already been shown and says so with `caught_up`, and the app's answer to
 * an exhausted feed is not a sentence about having read everything — it is the
 * clips the shelf is still holding. They begin *where the rail stops* rather
 * than at the shelf's head, because a fill that started there put the same ten
 * clips, in the same order, right under the ten already on the strip:
 * *"vibe or drop alag alag ho gaya sahi hai par dono pe hi data aa raha line
 * se"* (2026-10-24). The shelf is not emptied into the feed either — the rail
 * keeps its ten.
 *
 * Empty until the shelf has more than the rail can show, which is also the
 * signal for "this page is the rail over cards" rather than the weave.
 */
export function filledWithVibes(shelf: Drop[], rail: number = RAIL_CLIPS): Drop[] {
  return shelf.length <= rail ? [] : shelf.slice(rail);
}

/**
 * The feed with Vibes woven into it, `share` clips per card value.
 *
 * `drops` in their dealt order, and one Vibe lifted off `vibes` in order before
 * each slot the block's shuffle picked. A Vibe already woven in is never woven
 * twice, and a vibe list that runs out leaves the rest of the feed as drops
 * rather than inventing filler.
 */
export function mixedFeed(input: {
  drops: Drop[];
  vibes: Drop[];
  share: number;
  salt: number;
}): Drop[] {
  const { drops, vibes } = input;
  const want = mixPerBlock(input.share);
  if (!want || !vibes.length) return [...drops];
  const taken = new Set<string>(
    // A Vibe that is already a card of its own — the server does not send one
    // in the drops page, and the weave must not double it if it ever does.
    drops.filter(dropIsVibe).map((row) => String(row.id)),
  );
  const out: Drop[] = [];
  let next = 0;
  let block = -1;
  let slots: Set<number> = new Set();
  for (let at = 0; at < drops.length; at++) {
    const which = Math.floor(at / MIX_BLOCK);
    // Asked once per block rather than once per card. The answer depends on the
    // block number and the salt alone, so asking again inside the block would
    // be the same shuffle worked out ten times.
    if (which !== block) {
      block = which;
      slots = new Set(mixSlots(input.salt, which, want));
    }
    if (slots.has(at % MIX_BLOCK)) {
      while (next < vibes.length && taken.has(String(vibes[next].id))) next++;
      if (next < vibes.length) {
        taken.add(String(vibes[next].id));
        out.push(vibes[next]);
        next++;
      }
    }
    out.push(drops[at]);
  }
  return out;
}

/**
 * The clips the strip above the feed draws — the app's `Drops.rail`, with its
 * exclusion read one screen narrower.
 *
 * A clip that is a card in the feed beneath the strip and a tile on the strip at
 * the same time is the same clip met twice on one screen, at two addresses, with
 * two counters that a like would have to move together. The owner's ask of
 * 2026-10-19 was that the *two shapes* stay — *"dono rahe"* — not that a clip
 * appear in both at once, so a woven clip leaves the strip for as long as it is
 * woven.
 *
 * **Where this is read differently, and the report that made it so.** The app
 * asks that question of the whole feed it is holding. A phone holds a page or
 * two at a time; a browser holds every page the reader has scrolled to, so the
 * question is asked again each time the reader goes further down, and the answer
 * shrinks: a shelf of eight clips against a feed of two pages of ten, at the
 * cold-start share of forty per cent, is eight clips woven and a strip with
 * nothing on it at all. That is what the owner saw on 2026-11-06 — *"for you ke
 * upar jo vibes ka section tha wo bhi hat gya hai, please use rakhiye"* — a
 * section gone from the page because the reader had scrolled past it. Past the
 * first block the strip is off the top of the window and the clips the feed is
 * drawing are screens below it, so the exclusion here reaches over the feed's
 * first block: `head` cards, which is what "at once" means on one screen.
 *
 * A second promise, and it is the owner's own words too: **a shelf with clips on
 * it always draws a strip.** A shelf of four clips or fewer can be woven whole
 * — four is the cold-start share's own block — and the strip is then its whole
 * self, a clip drawn twice rather than a heading over nothing. That is the
 * smaller of the two wrongs, and the only one a reader can undo by scrolling.
 *
 * A *filled* page — the feed exhausted and drawing the shelf's tail — deals
 * nothing, so nothing is excluded: the strip is the shelf's first [rail] clips
 * and the cards below begin where it stops. See [filledWithVibes].
 */
export function railClips(input: {
  shelf: Drop[];
  /** The feed as it is drawn, Vibes woven in. */
  woven: Drop[];
  /** Whether the page is a filled one — the feed has run out. */
  filling?: boolean;
  rail?: number;
  head?: number;
}): Drop[] {
  const rail = input.rail ?? RAIL_CLIPS;
  const held = input.filling ? input.shelf.slice(0, rail) : input.shelf;
  if (input.filling) return held;
  const head = new Set(
    input.woven
      .slice(0, input.head ?? MIX_BLOCK)
      .filter(dropIsVibe)
      .map((row) => String(row.id)),
  );
  const free = held.filter((row) => !head.has(String(row.id)));
  return (free.length ? free : held).slice(0, rail);
}

/**
 * The list the walk is handed: the shelf, with a clip the shelf has never held
 * in front of it.
 *
 * A plain video in the feed is not a Vibe, so it is not on the shelf — and the
 * app does not open it on a screen of its own, which was the report of
 * 2026-10-19: *"agar drop sirf single video hai to click karne pe single screen
 * pe ja raha, hata kar vibe pe play hona chahiye"*. It opens where a Vibe opens.
 * The phone's `Drops.it.carry(one)` is the same promise: *"a single video pressed
 * in the feed is not on the shelf — it is not a Vibe — and a walk handed `[it,
 * ...shelf]` is one this screen may not lengthen"*, so it is given to the store's
 * tail and the walk opens on it. The owner asked for it here on 2026-11-06:
 * *"app me drops ke for you post me video post par click karne par ek dusare page
 * me wo video open hota hai waise isme nahi ho raha hai"*.
 *
 * The lead is first, so the clip under the thumb is the clip the walk opens on;
 * the shelf keeps its own order behind it, so a swipe from the pressed clip goes
 * on the way the strip would have gone. A lead the shelf *does* hold is not drawn
 * twice — it is moved to the head rather than repeated, which is the same
 * promise one row along: the walk opens on what was pressed.
 *
 * A walk of one clip and nothing else is still a walk: a shelf that has not
 * arrived yet hands back `[lead]` rather than `[]`, which is the difference
 * between a video that opens and a press that appears to do nothing.
 */
export function walkOf(shelf: Drop[], lead: Drop | null): Drop[] {
  if (!lead) return shelf;
  return [lead, ...shelf.filter((row) => String(row.id) !== String(lead.id))];
}
