import type { ThemeDesign } from "@/theme/catalog";
import { designForName } from "@/theme/shelf";
import type { Asset, Moment, TrayMoment } from "@/types/api";

/**
 * Which colour a face in the rail wears, and why.
 *
 * Ported from `momentRingColour`/`themeAccent`/`momentRingFor` in
 * `screens/moments.dart`. A ring means one thing — there is something of theirs
 * you have not watched — and it is drawn in the colour the person *wears*: the
 * leading colour of the theme their own account publishes, looked up off the
 * key on their card. A face edged in yellow is a face whose day is still to
 * watch and whose phone is wearing the yellow theme, which is the same costume
 * everybody meets them in everywhere else.
 *
 * A person who has never chosen a theme keeps the wheel of twelve. One colour
 * for all of them would take back the thing the wheel is there to do: two faces
 * beside each other are two colours, so the rail does not read as one long
 * warning stripe.
 *
 * Twelve raw hexes rather than design tokens, the same as the backgrounds in
 * `TextMoment` and for the same reason: a token is a *named* colour this design
 * agrees on, and a wheel of twelve is a list rather than a name. They are the
 * band that survives both a light page and a dark one — a mid-tone vanishes
 * against a bright page and a near-black edge against a dark one.
 */
export const MOMENT_RING_PALETTE = [
  "#6C5CE7",
  "#0984E3",
  "#00B894",
  "#E17055",
  "#D63031",
  "#E84393",
  "#FDCB6E",
  "#00CEC9",
  "#A29BFE",
  "#2ED573",
  "#FF7675",
  "#9B59B6",
];

/**
 * The ring colour a face wears, keyed to `seed` — who they are, never where
 * they sit.
 *
 * The seed is the author's id, and their handle where a card carries no id.
 * That is the whole point: the rail re-sorts itself on every refresh — the
 * people whose day is freshest move up, the ones already watched move down —
 * and a colour taken off the position in the list would change under the thumb
 * while the page was being read. Off the person, the same face is the same
 * colour every time it is drawn.
 *
 * FNV-1a written out here rather than a `hashCode`, which is only promised for
 * the life of one run: a colour that depended on it would survive one refresh
 * and change the next time the page was opened, which is exactly the thing this
 * is here to stop. The 32-bit mask is applied at every step so the arithmetic
 * wraps the way Dart's does instead of losing precision on an overflow nobody
 * asked it to check.
 */
export function momentRingColour(seed: string): string | null {
  if (!seed) return null;
  let hash = 0x811c9dc5;
  for (let at = 0; at < seed.length; at += 1) {
    hash ^= seed.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return MOMENT_RING_PALETTE[hash % MOMENT_RING_PALETTE.length];
}

/**
 * The leading colour of the theme `key` names, or null when it names none.
 *
 * One door, because two things have to agree about it: the ring in the rail and
 * anything that later wants to draw somebody in their own colour. The key is
 * what the account card sends and what the account publishes.
 *
 * `dark` is the *reader's* own mode, not the author's: a theme has a light
 * palette and a dark one, and what is being drawn is a ring on this screen,
 * beside this reader's own furniture. The colour is still the person's.
 *
 * The catalogue is looked in first, because a theme off the server shelf is not
 * in this build; what is bundled is looked up after, which is also what answers
 * the mixed themes whose name is their colours.
 */
export function themeAccent(
  key: string | null | undefined,
  designs: ThemeDesign[],
  dark: boolean,
): string | null {
  const wanted = (key ?? "").trim();
  if (!wanted) return null;
  const lower = wanted.toLowerCase();
  const found = designs.find((design) => design.key.toLowerCase() === lower) ?? designForName(wanted);
  if (!found) return null;
  return (dark ? found.dark : found.light).accent || null;
}

/**
 * The ring for a row in the rail, or null for a face with nothing left to
 * watch.
 *
 * The one place the rule lives — a card is new when the server has not called
 * every one of its moments watched, which is the same `seen` the rail sorts the
 * watched faces to the end by. A person who answered *and* has something new
 * still wears the ring, because the two are different questions and the ring
 * answers whether there is anything to open, not whether anything was said.
 */
export function momentRingFor(
  row: TrayMoment,
  designs: ThemeDesign[],
  dark: boolean,
): string | null {
  if (row.seen) return null;
  const author = row.author;
  const worn = themeAccent(author?.theme, designs, dark);
  if (worn) return worn;
  return momentRingColour(author?.id ? String(author.id) : author?.username ?? "");
}

/** The still a rail card draws, or null when the person put up no pictures. */
export function railStill(row: TrayMoment): string | null {
  return row.cover?.thumbnail_url || row.cover?.content_url || null;
}

/**
 * The picture this account's own card draws, which is the first thing it has up.
 *
 * Off the moments themselves rather than off the tray, because the tray's own
 * row arrives inside a rail that is meant for other people. A Vibe supplies the
 * frame when it is the first thing in the day — the item holds no upload of its
 * own — which is the same fallback `TrayMomentSerializer.get_cover` makes.
 */
export function momentStill(moment: Moment | undefined): Asset | null {
  if (!moment) return null;
  for (const item of moment.items ?? []) {
    if (item.asset) return item.asset;
    if (item.vibe?.asset) return item.vibe.asset;
  }
  return null;
}
