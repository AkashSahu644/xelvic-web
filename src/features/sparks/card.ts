import { entryFor, peekMedia } from "@/utils/mediaCache";
import { AWARDS, awardOf, wornOf, type Award } from "@/features/sparks/model";
import type { Spark } from "@/types/api";

/**
 * The Spark as a picture — `app/lib/screens/spark_moment.dart`, ported.
 *
 * The sheet says what a run is; a card is that same run in a shape somebody
 * wants to put in front of other people: the two of them, the flame, the award
 * they are wearing and how many days it has been. It is painted rather than
 * photographed, the same way the text card is
 * (`features/moments/TextMoment.tsx`), so what leaves here is a PNG and not a
 * widget a viewer's browser has to know how to draw.
 *
 * **Nothing about it is themed.** A theme is a fact about the browser it was set
 * in, and this picture is going to be looked at in somebody else's — so the
 * card's tones are its own, fixed here, and the only colour it borrows is the
 * **award's own**, which is the one colour on it that means something. That also
 * makes the picture the same one whatever the app looks like today, which is
 * what a card meant to be kept should be.
 *
 * The award drawn is the one the run is *on* — the same rule the sheet keeps
 * (`headAward`): the highest rung worn, or the current one when nothing has been
 * worn yet. A card that showed a flame for a Blaze would be a picture of the
 * wrong week.
 *
 * **The phone draws Material glyphs and this draws the same ones** — the outlined
 * rungs outlined and the filled rungs filled, exactly as `Award.icon` is named.
 * The paths are `react-icons/md`'s own, written out because a canvas has no icon
 * component to hand it.
 */

// ---- the card's own page -------------------------------------------------

/** A phone-shaped 1080×1920 frame, fixed rather than the screen's own: the card
 * is the same picture whatever it was composed on, and 9:16 is what a moment
 * is. */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/** How much of the page a phone's cover crop takes off each side — see the
 * phone's `kSparkCardWidestCrop`. Everything the card draws lives inside what
 * is left of it. */
export const CARD_WIDEST_CROP = 120;

/** What is left of the page once the widest phone has taken its share. */
export const CARD_SAFE_WIDTH = CARD_WIDTH - CARD_WIDEST_CROP * 2;

/** The room the card's picture is drawn in, in its own units, and how far below
 * the middle of the page it sits (`kSparkCardDrop`). */
export const CARD_BOX_WIDTH = CARD_SAFE_WIDTH;
export const CARD_BOX_HEIGHT = 1520;
export const CARD_CORNER = 64;
export const CARD_DROP = 48;

/** Where the card lands on the page: centred across it and dropped a little. */
export const CARD_BOX = {
  left: (CARD_WIDTH - CARD_BOX_WIDTH) / 2,
  top: CARD_HEIGHT / 2 + CARD_DROP - CARD_BOX_HEIGHT / 2,
  width: CARD_BOX_WIDTH,
  height: CARD_BOX_HEIGHT,
};

/** The card's own words. Fixed tones, not `var(--ink)`/`var(--dim)`: a picture
 * looked at in somebody else's browser does not take the colours of the one it
 * was made in. */
export const CARD_INK = "#1B1420";
export const CARD_DIM = "#8A8394";
export const CARD_GOOD = "#0b7a44";

/** The five visual treatments available to a Spark moment card. */
export const SPARK_CARD_STYLES = [
  "classic",
  "midnight",
  "sunset",
  "aurora",
  "noir",
] as const;
export type SparkCardStyle = (typeof SPARK_CARD_STYLES)[number];

/** Pick once per share; the caller keeps this value for preview and upload. */
export function randomSparkCardStyle(): SparkCardStyle {
  return SPARK_CARD_STYLES[Math.floor(Math.random() * SPARK_CARD_STYLES.length)];
}

type CardPalette = {
  page: string;
  card: string;
  ink: string;
  dim: string;
  track: string;
};

function paletteFor(style: SparkCardStyle, award: Award): CardPalette {
  // The page behind the card is the award's tone over white for every style —
  // the award is still the only accent. What each treatment brings of its own
  // is the card's ground, and the ink that can be read on it.
  return { page: blendOverWhite(award.colour, 0.1), ...LOOKS[style] };
}

/** The faint grey the ring's track is drawn in. */
const CARD_TRACK = "#EFEAF2";

/** The air around the flame, the two faces and the last line. */
const CARD_PAD = 54;
const FACE_RADIUS = 84;
const FACE_CENTRE_Y = 200;
const FLAME_X = CARD_BOX_WIDTH / 2;
const FLAME_Y = 620;
const FLAME_RADIUS = 172;
const RING_SIZE = 200;
const RING_CENTRE_Y = 1050;
const RULE_Y = 1260;
const FOOTER_Y = 1335;

/** What the picture says under a run that broke, and under one that never
 * counted a day. */
const BROKEN = "Broken";
const NOT_STARTED = "Not started";
const FOOTER_LINE = "A little message keeps the Spark going.";

/**
 * The ground each treatment stands on.
 *
 * The first card is the app's own paper and is left exactly as it was: white,
 * the app's ink, the app's grey. The four drawn after it came off a design sheet
 * of their own, and each carries the ground that sheet gave it — three pale
 * lavenders a shade apart, and one dark card, which is the only one here whose
 * ink has to be light because nothing dark is read on it.
 */
const LOOKS: Record<SparkCardStyle, Omit<CardPalette, "page">> = {
  classic: { card: "#FFFFFF", ink: CARD_INK, dim: CARD_DIM, track: CARD_TRACK },
  midnight: {
    card: "#241548",
    ink: "#F4EFFF",
    dim: "#E4DBFF",
    track: "rgba(255, 255, 255, 0.24)",
  },
  sunset: { card: "#F4F1FC", ink: CARD_INK, dim: CARD_DIM, track: CARD_TRACK },
  aurora: { card: "#F3F2FC", ink: CARD_INK, dim: CARD_DIM, track: CARD_TRACK },
  noir: { card: "#F1EAFB", ink: CARD_INK, dim: CARD_DIM, track: CARD_TRACK },
};

/**
 * Where the four new looks put the award's name and its days.
 *
 * One set of numbers rather than four: the sheet draws all four on the same
 * skeleton — the two people at the top, the award standing in the middle, its
 * name under that and the last line at the foot — and what tells them apart is
 * the ground and the shape the award stands in, not where the words sit.
 */
/**
 * Where a look's ornament stands, and the award inside it.
 *
 * The sheet puts each card's picture a little above the middle — measured off
 * it, the planet, the ring and the stack all sit at about 0.43 of the card's
 * height — and the first card's own flame is higher again, so this is a number
 * of the four and not of the five.
 */
const LOOK_MOTIF_Y = 660;
/** Where the line between the two people runs — a little below their middles,
 * which is where the sheet draws it. */
const LOOK_CONNECT_Y = FACE_CENTRE_Y + 34;
const LOOK_NAME_Y = 985;
const LOOK_NAME_SIZE = 72;
const LOOK_COUNT_SIZE = 46;
const LOOK_COUNT_GAP = 46;
/** The room a slab keeps around the words standing on it. */
const SLAB_PAD = 36;

/**
 * The field the four pale looks stand on.
 *
 * Measured off the sheet, none of its four cards is bare paper: each is a
 * near-white field with the award's own tone collecting along the left and
 * right edges — about a twelfth of the width each side, at roughly a fifth of
 * the award's strength at the very edge and nothing by the time it reaches the
 * middle. Drawn as bands a step apart rather than as a ramp, like everything
 * else here.
 */
/** The sheet's own field, sampled off it: the commonest colour on all three of
 * its light cards. */
const LOOK_FIELD = "#F8F5FE";
const LOOK_EDGE_STEPS = 12;
const LOOK_EDGE_WIDTH = 6;

/**
 * The card's paper: the award's own tone let most of the way out over white.
 *
 * A flat blend and never a gradient — the app has no gradients and this picture
 * is no exception. The colour arrives as hex from the ladder, so the blend is
 * done in numbers rather than through `color-mix`, which a canvas cannot read.
 */
export function sparkCardPaper(
  award: Award,
  style: SparkCardStyle = "classic",
): string {
  return paletteFor(style, award).page;
}

/** `award` at `amount` over white, as the hex a canvas takes. */
function blendOverWhite(hex: string, amount: number): string {
  const rgb = rgbOf(hex);
  if (!rgb) return "#FFFFFF";
  const mix = (channel: number) =>
    Math.round(255 * (1 - amount) + channel * amount);
  return `rgb(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])})`;
}

/** A hex colour as three channels, or null for a colour this cannot read. */
function rgbOf(hex: string): [number, number, number] | null {
  const clean = hex.trim().replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((part) => part + part)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) return null;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** A colour at a fraction of its own strength — the phone's `X.fade`. */
function fade(hex: string, amount: number): string {
  const rgb = rgbOf(hex);
  if (!rgb) return hex;
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${amount})`;
}

/**
 * A colour lifted `lift` of the way to white and then let out at `amount`.
 *
 * The award is chosen to sit on white, so on the dark card its own tone is a
 * hole rather than an accent. Lifting it first is what lets the same award light
 * a night sky — and it is the same arithmetic as `blendOverWhite`, so there is
 * still only one way this card mixes a colour.
 */
function washOf(hex: string, lift: number, amount: number): string {
  const rgb = rgbOf(hex);
  if (!rgb) return hex;
  const mix = (channel: number) => Math.round(255 * (1 - lift) + channel * lift);
  return `rgba(${mix(rgb[0])}, ${mix(rgb[1])}, ${mix(rgb[2])}, ${amount})`;
}

/** The award the card draws: the highest rung worn, or the one the run is on. */
export function sparkCardAward(spark: Spark): Award {
  const worn = wornOf(spark);
  if (worn.length) return worn[worn.length - 1];
  return awardOf(spark.stage) ?? AWARDS[0];
}

/**
 * The words beside that award: how long the run is, in the one way it can be
 * said. A run that broke is not on nought days, it is broken.
 */
export function sparkCardDays(spark: Spark): string {
  if (spark.broken) return BROKEN;
  const days = spark.count ?? 0;
  if (days <= 0) return NOT_STARTED;
  return days === 1 ? "1 day" : `${days} days`;
}

// ---- the glyphs ----------------------------------------------------------

/** One node of a filled Material glyph, in its own 24×24 box. */
type GlyphNode =
  | { kind: "path"; d: string }
  | { kind: "circle"; cx: number; cy: number; r: number };

/**
 * The glyphs the card draws, by award key.
 *
 * The phone draws Material's own glyphs, so this does too; the path data is the
 * same set's (`react-icons/md`) written out because a canvas cannot be handed a
 * component. The outlined rungs use the outlined path and the filled ones the
 * filled path, exactly as `Award.icon` does.
 */
const AWARD_GLYPHS: Record<string, GlyphNode[]> = {
  ember: [
    {
      kind: "path",
      d: "m16 6-.44.55c-.42.52-.98.75-1.54.75C13 7.3 12 6.52 12 5.3V2S4 6 4 13c0 4.42 3.58 8 8 8s8-3.58 8-8c0-2.96-1.61-5.62-4-7m-4 13c-1.1 0-2-.87-2-1.94 0-.51.2-.99.58-1.36L12 14.3l1.43 1.4c.37.37.57.85.57 1.36 0 1.07-.9 1.94-2 1.94m3.96-1.5c.04-.36.22-1.89-1.13-3.22L12 11.5l-2.83 2.78C7.81 15.62 8 17.16 8.04 17.5A5.98 5.98 0 0 1 6 13c0-3.16 2.13-5.65 4.03-7.25a4.024 4.024 0 0 0 3.99 3.55c.78 0 1.54-.23 2.18-.66A6.18 6.18 0 0 1 18 13c0 1.79-.79 3.4-2.04 4.5",
    },
  ],
  flame: [
    {
      kind: "path",
      d: "m12 12.9-2.13 2.09c-.56.56-.87 1.29-.87 2.07C9 18.68 10.35 20 12 20s3-1.32 3-2.94c0-.78-.31-1.52-.87-2.07z",
    },
    {
      kind: "path",
      d: "m16 6-.44.55C14.38 8.02 12 7.19 12 5.3V2S4 6 4 13c0 2.92 1.56 5.47 3.89 6.86-.56-.79-.89-1.76-.89-2.8 0-1.32.52-2.56 1.47-3.5L12 10.1l3.53 3.47c.95.93 1.47 2.17 1.47 3.5 0 1.02-.31 1.96-.85 2.75 1.89-1.15 3.29-3.06 3.71-5.3.66-3.55-1.07-6.9-3.86-8.52",
    },
  ],
  blaze: [
    {
      kind: "path",
      d: "M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67M11.71 19c-1.78 0-3.22-1.4-3.22-3.14 0-1.62 1.05-2.76 2.81-3.12 1.77-.36 3.6-1.21 4.62-2.58.39 1.29.59 2.65.59 4.04 0 2.65-2.15 4.8-4.8 4.8",
    },
  ],
  comet: [
    {
      kind: "path",
      d: "M6 15c-.83 0-1.58.34-2.12.88C2.7 17.06 2 22 2 22s4.94-.7 6.12-1.88A2.996 2.996 0 0 0 6 15m.71 3.71c-.28.28-2.17.76-2.17.76s.47-1.88.76-2.17c.17-.19.42-.3.7-.3a1.003 1.003 0 0 1 .71 1.71m10.71-5.06c6.36-6.36 4.24-11.31 4.24-11.31S16.71.22 10.35 6.58l-2.49-.5a2.03 2.03 0 0 0-1.81.55L2 10.69l5 2.14L11.17 17l2.14 5 4.05-4.05c.47-.47.68-1.15.55-1.81zM7.41 10.83l-1.91-.82 1.97-1.97 1.44.29c-.57.83-1.08 1.7-1.5 2.5m6.58 7.67-.82-1.91c.8-.42 1.67-.93 2.49-1.5l.29 1.44zM16 12.24c-1.32 1.32-3.38 2.4-4.04 2.73l-2.93-2.93c.32-.65 1.4-2.71 2.73-4.04 4.68-4.68 8.23-3.99 8.23-3.99s.69 3.55-3.99 8.23M15 11c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2",
    },
  ],
  nova: [
    {
      kind: "path",
      d: "M20 8.69V4h-4.69L12 .69 8.69 4H4v4.69L.69 12 4 15.31V20h4.69L12 23.31 15.31 20H20v-4.69L23.31 12zm-2 5.79V18h-3.52L12 20.48 9.52 18H6v-3.52L3.52 12 6 9.52V6h3.52L12 3.52 14.48 6H18v3.52L20.48 12zM12 6.5c-3.03 0-5.5 2.47-5.5 5.5s2.47 5.5 5.5 5.5 5.5-2.47 5.5-5.5-2.47-5.5-5.5-5.5m0 9c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5",
    },
  ],
  supernova: [
    {
      kind: "path",
      d: "m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25zM11.5 9.5 9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zm-1.51 3.49L9 15.17l-.99-2.18L5.83 12l2.18-.99L9 8.83l.99 2.18 2.18.99z",
    },
  ],
  century: [
    {
      kind: "path",
      d: "M9.68 13.69 12 11.93l2.31 1.76-.88-2.85L15.75 9h-2.84L12 6.19 11.09 9H8.25l2.31 1.84zM20 10c0-4.42-3.58-8-8-8s-8 3.58-8 8c0 2.03.76 3.87 2 5.28V23l6-2 6 2v-7.72A7.96 7.96 0 0 0 20 10m-8-6c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6 2.69-6 6-6m0 15-4 1.02v-3.1c1.18.68 2.54 1.08 4 1.08s2.82-.4 4-1.08v3.1z",
    },
  ],
};

/** A word, on the line between a face and the flame. */
const CHAT_GLYPH: GlyphNode[] = [
  {
    kind: "path",
    d: "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2",
  },
];

/** A call, on the same line. */
const CALL_GLYPH: GlyphNode[] = [
  {
    kind: "path",
    d: "M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.98.98 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99",
  },
];

/** The mark before the last line, and the one after it. */
const SPARK_GLYPH: GlyphNode[] = [
  {
    kind: "path",
    d: "m19 9 1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25z",
  },
];

const HEART_GLYPH: GlyphNode[] = [
  {
    kind: "path",
    d: "m12 21.35-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z",
  },
];

/**
 * A rocket, nose up, in the same 24×24 box as the rest.
 *
 * The four looks after the first card all launch something, so the sheet draws
 * the same mark on all four: in the planet on the first, in the moon on the
 * second, in the ring on the third, on top of the stack on the fourth. It is
 * drawn here rather than taken from an icon set because it is the one mark on
 * the sheet drawn flat and filled, and the sets this app uses draw it outlined.
 */
const ROCKET_BODY: GlyphNode[] = [
  {
    kind: "path",
    d: "M12 1.4c2.8 3 4.3 6.7 4.3 10.6 0 1.2-.1 2.3-.4 3.4H8.1c-.3-1.1-.4-2.2-.4-3.4 0-3.9 1.5-7.6 4.3-10.6z",
  },
  {
    kind: "path",
    d: "M8.1 13.6 4.8 16.9c-.5.5-.8 1.2-.8 1.9V22l4.5-3.2c-.2-1.7-.3-3.5-.4-5.2z",
  },
  {
    kind: "path",
    d: "M15.9 13.6l3.3 3.3c.5.5.8 1.2.8 1.9V22l-4.5-3.2c.2-1.7.3-3.5.4-5.2z",
  },
  {
    kind: "path",
    d: "M9.9 15.6h4.2c0 2-.7 3.8-2.1 5.8-1.4-2-2.1-3.8-2.1-5.8z",
  },
];

/** Where the rocket's window sits in its own box, so it can be cut back out. */
const ROCKET_WINDOW = { dx: 0, dy: -3.8, r: 1.7 };

/** A camera, for the row of round buttons on the third look. */
const VIDEO_GLYPH: GlyphNode[] = [
  {
    kind: "path",
    d: "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11z",
  },
];

/** The seven award marks, exported so a test can prove every rung has one. */
export const AWARD_GLYPH_KEYS = Object.keys(AWARD_GLYPHS);

/** The glyph an award is drawn with. A rung this build has no mark for draws
 * the flame rather than nothing at all. */
function glyphFor(award: Award): GlyphNode[] {
  return AWARD_GLYPHS[award.key] ?? AWARD_GLYPHS.ember;
}

// ---- painting ------------------------------------------------------------

const FONT =
  '"Manrope Variable", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif';

/** How tall one line of words is, for laying a block out. The phone measures
 * its own painter; a canvas is measured here, and one factor for every line
 * keeps the block's arithmetic the same as the phone's. */
function lineHeight(size: number): number {
  return size * 1.2;
}

function setFont(
  ctx: CanvasRenderingContext2D,
  size: number,
  weight: number,
  spacing = 0,
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  // Chrome and Safari take it; a browser that does not simply draws the line
  // without the tracking, which is the letter-spaced award name and nothing
  // else.
  (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
    `${spacing}px`;
}

/** Words cut to the room they have, the way the phone's painters ellipsise. */
function fitted(
  ctx: CanvasRenderingContext2D,
  words: string,
  maxWidth: number,
): string {
  if (maxWidth <= 0 || ctx.measureText(words).width <= maxWidth) return words;
  let cut = words;
  while (cut.length > 1) {
    cut = cut.slice(0, -1);
    if (ctx.measureText(`${cut}…`).width <= maxWidth) return `${cut}…`;
  }
  return "…";
}

/** One line of words, centred on `y` and aligned on `x`. */
function words(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  {
    size,
    weight,
    colour,
    align = "center",
    spacing = 0,
    maxWidth,
  }: {
    size: number;
    weight: number;
    colour: string;
    align?: CanvasTextAlign;
    spacing?: number;
    maxWidth?: number;
  },
): number {
  setFont(ctx, size, weight, spacing);
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  ctx.fillStyle = colour;
  const drawn = maxWidth === undefined ? text : fitted(ctx, text, maxWidth);
  ctx.fillText(drawn, x, y);
  return ctx.measureText(drawn).width;
}

/** A filled Material glyph, drawn in its own 24×24 box and scaled to `size`. */
function glyph(
  ctx: CanvasRenderingContext2D,
  nodes: GlyphNode[],
  cx: number,
  cy: number,
  size: number,
  colour: string,
) {
  const scale = size / 24;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.translate(-12, -12);
  ctx.fillStyle = colour;
  for (const node of nodes) {
    if (node.kind === "circle") {
      ctx.beginPath();
      ctx.arc(node.cx, node.cy, node.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fill(new Path2D(node.d));
    }
  }
  ctx.restore();
}

/** A four-pointed star, drawn rather than typed: there is no glyph for it that
 * every browser is guaranteed to have. */
function sparkle(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
) {
  const waist = 0.26;
  ctx.beginPath();
  for (let index = 0; index < 4; index += 1) {
    const tip = (index * Math.PI) / 2;
    const thin = tip + Math.PI / 4;
    const ax = cx + Math.cos(tip) * r;
    const ay = cy + Math.sin(tip) * r;
    const bx = cx + Math.cos(thin) * r * waist;
    const by = cy + Math.sin(thin) * r * waist;
    if (index === 0) ctx.moveTo(ax, ay);
    else ctx.lineTo(ax, ay);
    ctx.lineTo(bx, by);
  }
  ctx.closePath();
  ctx.fill();
}

/** A cubic through four points, at `t`. */
function cubicPoint(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number,
): [number, number] {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
  ];
}

/**
 * Where `fraction` of the curve's *length* lands, the phone's
 * `getTangentForOffset(metric.length * at)`.
 *
 * A Bézier parameter and a distance along the line are not the same number: the
 * line speeds up where its control points pull it, so placing the badges by `t`
 * would put them slightly off the spots the phone puts them.
 */
function alongCubic(
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  fraction: number,
): [number, number] {
  const steps = 200;
  const lengths = [0];
  let total = 0;
  let previous = cubicPoint(p0, p1, p2, p3, 0);
  for (let index = 1; index <= steps; index += 1) {
    const point = cubicPoint(p0, p1, p2, p3, index / steps);
    total += Math.hypot(point[0] - previous[0], point[1] - previous[1]);
    lengths.push(total);
    previous = point;
  }
  const target = total * Math.min(1, Math.max(0, fraction));
  let index = 1;
  while (index < lengths.length && lengths[index] < target) index += 1;
  const before = lengths[index - 1] ?? 0;
  const after = lengths[index] ?? total;
  const between = after === before ? 0 : (target - before) / (after - before);
  return cubicPoint(p0, p1, p2, p3, (index - 1 + between) / steps);
}

/**
 * A person's name as a string, whatever the payload actually carried.
 *
 * The serializer promises a string, but a card is painted from a row that may
 * have come out of a cache written by an older build, a partial refresh, or a
 * server that sends `null`. A name that is not a string is a name this card
 * cannot set — and it must not be a card that fails to paint, so it is read as
 * nothing and drawn as the initials plate.
 */
function nameOf(who: CardFace | null | undefined): string {
  const name: unknown = who?.name;
  return typeof name === "string" ? name : name == null ? "" : String(name);
}

/** The initials the list itself falls back to. */
function initialsOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  return trimmed
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.slice(0, 1).toUpperCase())
    .join("");
}

/**
 * The only parts of a person a card draws.
 *
 * Not the whole `UserCard`: a card is two names and two faces, and the row a
 * card is opened from sometimes knows a name and nothing else — the phone draws
 * its thread's own title in that case (`widget.them ?? SparkFace(name:
 * widget.title)`). Asking for a full user card would force that fallback to
 * invent an id it does not have.
 */
export type CardFace = {
  name?: string | null;
  avatar?: string | null;
  online?: boolean | null;
};

/**
 * Where a same-origin reader for public media lives.
 *
 * The sheet, the convo rows and every `<img>` in this app draw a face straight
 * off the CDN, and that is right for them: a picture element does not care what
 * headers come back with the bytes. A **canvas** does. It may only be exported
 * if every picture on it was same-origin or CORS-clean, and this CDN answers
 * neither — measured 2026-11-04, on a real avatar: no `access-control-allow-origin`
 * on the file, a bare `403` to the preflight, and `fetch`/XHR both handing back
 * zero bytes for an opaque answer. So the two roads left are the two bad ones:
 * draw it plainly and lose the export to a tainted canvas, or ask for it with
 * `crossOrigin` and lose the picture to a blocked load. What is on the card now
 * is the second one — initials where two photographs belong.
 *
 * The answer is the third road: read the bytes through this page's own origin.
 * `vite.config.ts` proxies the prefix below in development, and
 * `public/_redirects` asks a Pages deployment to do the same. A host that does
 * neither answers the prefix with its own HTML shell, which is not a picture,
 * so the direct address is still tried after it — see `faceImage`.
 *
 * Configurable because the deployment is not this repository's to decide: point
 * `VITE_MEDIA_PROXY` at a real proxy, or at `""` to turn this off entirely.
 */
const MEDIA_PROXY: string =
  import.meta.env.VITE_MEDIA_PROXY ?? "/__xelvic_cdn";

/**
 * A public picture's address as a same-origin one, or `null` when it already is.
 *
 * Only a picture on another origin needs this; a blob or a same-origin path is
 * already readable by the canvas. The query string is kept, because a cache
 * key lives there.
 */
function sameOriginFace(url: string): string | null {
  if (!MEDIA_PROXY) return null;
  try {
    const parsed = new URL(url, window.location.href);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    if (parsed.host === window.location.host) return null;
    // Absolute on this origin rather than a bare path: `mediaCache` joins a path
    // to the API origin, and this prefix is the *page's*, not the API's.
    return `${window.location.origin}${MEDIA_PROXY.replace(/\/+$/, "")}${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
}

/**
 * A face, decoded, or nothing at all.
 *
 * Through the tab's own media cache and not the network directly, because a
 * private avatar cannot be read by an `<img>` with no Authorization header —
 * the bytes are fetched by `utils/mediaCache.ts` and handed back as a blob URL,
 * which a canvas may draw without tainting itself.
 *
 * **A picture off another origin has to be read through this page's origin.**
 * A cross-origin picture drawn into a canvas taints it, and a tainted canvas
 * throws on `toBlob` — that was the "Could not draw that card" page. Asking the
 * same picture for CORS instead fixed the taint and lost the picture, because
 * this CDN sends no `access-control-allow-origin` at all; the card then came out
 * with initials where two photographs belong. So the bytes are read through a
 * same-origin proxy (`sameOriginFace`), the direct address is still a second
 * road for a host with no proxy, and only a face that fails both ends up as the
 * initials plate. A card with two initials on it still posts.
 */
async function faceImage(
  url: string | null | undefined,
): Promise<ImageBitmap | HTMLImageElement | null> {
  if (!url) return null;
  /*
   * Two roads, in order, and the second is the reason the first exists.
   *
   * A blob or a same-origin path is already readable by the canvas, so it is
   * asked for and drawn. A picture on another origin is asked for through the
   * same-origin proxy; a host with nothing behind that prefix answers it with
   * its own HTML shell, which does not decode as a picture, so the direct
   * address is tried after it. That second road draws but taints, and a tainted
   * canvas still encodes on every browser that matters — what is lost there is
   * only the ability to re-edit the file, and what is not lost is the faces.
   */
  const sources = [sameOriginFace(url), url].filter(
    (source): source is string => Boolean(source),
  );
  for (const source of sources) {
    try {
      // Both kinds of face come through the same cache: one the app serves behind
      // its own credentials, and one the public CDN serves off its custom domain.
      // The cache already knows the difference — a public address is handed back
      // as it is, without a request — so asking it here is all a card needs to do.
      const src = peekMedia(source) ?? (await entryFor(source).promise);
      if (!src) continue;
      const image = new Image();
      // Each road is asked for the only way it can be answered: a same-origin
      // path needs no ask, and a cross-origin one must ask or its bytes poison
      // the canvas.
      if (/^https?:/i.test(src)) image.crossOrigin = "anonymous";
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error("no face"));
        image.src = src;
      });
      return image;
    } catch {
      // The next road, or — after the last one — initials: a face that will not
      // come is not a hole, and the plate the list itself uses is the answer.
    }
  }
  return null;
}

/** A picture, drawn into a circle without being pulled out of shape. */
function coverInto(
  ctx: CanvasRenderingContext2D,
  image: ImageBitmap | HTMLImageElement,
  cx: number,
  cy: number,
  r: number,
) {
  const width = "width" in image ? image.width : 0;
  const height = "height" in image ? image.height : 0;
  if (!width || !height) return;
  const scale = Math.max((r * 2) / width, (r * 2) / height);
  ctx.drawImage(
    image,
    cx - (width * scale) / 2,
    cy - (height * scale) / 2,
    width * scale,
    height * scale,
  );
}

/** How a treatment draws one person's circle without changing the classic one. */
type FaceOptions = {
  radius?: number;
  nameSize?: number;
  nameMaxWidth?: number;
  nameGap?: number;
};

/** One person: the circle, their picture, their name. */
function face(
  ctx: CanvasRenderingContext2D,
  award: Award,
  palette: CardPalette,
  who: CardFace | null,
  photo: ImageBitmap | HTMLImageElement | null,
  cx: number,
  cy: number,
  options: FaceOptions = {},
) {
  const r = options.radius ?? FACE_RADIUS;
  // The ring the list draws for anybody with a moment behind them, in the
  // award's colour: it is what says the two circles belong to this card.
  ctx.beginPath();
  ctx.arc(cx, cy, r + 6, 0, Math.PI * 2);
  ctx.strokeStyle = fade(award.colour, 0.35);
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  // A picture that will not draw is a picture that did not come: the whole
  // card is not lost for one face, because a card with initials on it posts
  // and a card that was never painted posts nothing.
  let picture = false;
  if (photo) {
    try {
      coverInto(ctx, photo, cx, cy, r);
      picture = true;
    } catch {
      picture = false;
    }
  }
  if (!picture) {
    // Nobody's picture is not an empty plate — the same answer the list gives:
    // the award's tone, and their initials on it.
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = fade(award.colour, 0.3);
    ctx.fill();
  }
  ctx.restore();

  if (!picture) {
    words(ctx, initialsOf(nameOf(who)), cx, cy, {
      size: r * 0.8,
      weight: 700,
      colour: "#FFFFFF",
    });
  }

  if (who?.online) {
    const dotX = cx + r * 0.72;
    const dotY = cy + r * 0.72;
    const dot = options.radius ? Math.max(14, r * 0.26) : 22;
    ctx.beginPath();
    ctx.arc(dotX, dotY, dot, 0, Math.PI * 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dotX, dotY, dot * 0.73, 0, Math.PI * 2);
    ctx.fillStyle = CARD_GOOD;
    ctx.fill();
  }

  const nameSize = options.nameSize ?? 40;
  const nameGap = options.nameGap ?? 26;
  const name = nameOf(who).trim() || "—";
  words(ctx, name, cx, cy + r + nameGap + lineHeight(nameSize) / 2, {
    size: nameSize,
    weight: 700,
    colour: palette.ink,
    maxWidth: options.nameMaxWidth ?? 300,
  });
}

/** The two people, and the lines that join them to the flame. */
function twoOfUs(
  ctx: CanvasRenderingContext2D,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  const cy = FACE_CENTRE_Y;
  const leftCx = CARD_PAD + FACE_RADIUS;
  const rightCx = CARD_BOX_WIDTH - CARD_PAD - FACE_RADIUS;

  // The lines first, so both faces sit on top of where they start.
  const startY = 450;
  const left: [[number, number], [number, number], [number, number], [number, number]] = [
    [leftCx, startY],
    [leftCx, startY + 150],
    [FLAME_X - 200, FLAME_Y],
    [FLAME_X - 120, FLAME_Y],
  ];
  const right: typeof left = [
    [rightCx, startY],
    [rightCx, startY + 150],
    [FLAME_X + 200, FLAME_Y],
    [FLAME_X + 120, FLAME_Y],
  ];
  ctx.strokeStyle = fade(award.colour, 0.3);
  ctx.lineWidth = 5;
  ctx.lineCap = "round";
  for (const line of [left, right]) {
    ctx.beginPath();
    ctx.moveTo(line[0][0], line[0][1]);
    ctx.bezierCurveTo(
      line[1][0],
      line[1][1],
      line[2][0],
      line[2][1],
      line[3][0],
      line[3][1],
    );
    ctx.stroke();
  }

  // A word and a call on each line — the two things a spark is kept by. Placed
  // *on* the curve at a parameter rather than at coordinates typed in, so they
  // stay on it if the curve is ever moved.
  for (const line of [left, right]) {
    for (const [at, mark] of [
      [0.3, CHAT_GLYPH],
      [0.62, CALL_GLYPH],
    ] as const) {
      const [bx, by] = alongCubic(line[0], line[1], line[2], line[3], at);
      ctx.beginPath();
      ctx.arc(bx, by, 34, 0, Math.PI * 2);
      ctx.fillStyle = "#FFFFFF";
      ctx.fill();
      ctx.strokeStyle = fade(award.colour, 0.45);
      ctx.lineWidth = 3;
      ctx.stroke();
      glyph(ctx, mark, bx, by, 34, award.colour);
    }
  }

  face(ctx, award, palette, them, themPhoto, rightCx, cy);
  face(ctx, award, palette, me, mePhoto, leftCx, cy);
}

/** The flame, and a little light around it. */
function flame(ctx: CanvasRenderingContext2D, award: Award) {
  // One flat disc and not a glow: a glow is a ramp, and this product does not
  // have them. What is left is the light the flame is standing in.
  ctx.beginPath();
  ctx.arc(FLAME_X, FLAME_Y, FLAME_RADIUS, 0, Math.PI * 2);
  ctx.fillStyle = fade(award.colour, 0.1);
  ctx.fill();
  ctx.fillStyle = fade(award.colour, 0.45);
  for (const [sx, sy] of [
    [FLAME_X - 124, FLAME_Y - 190],
    [FLAME_X + 132, FLAME_Y - 196],
    [FLAME_X - 6, FLAME_Y + 186],
  ]) {
    sparkle(ctx, sx, sy, 15);
  }
  glyph(ctx, glyphFor(award), FLAME_X, FLAME_Y, 234, award.colour);
}

/** The award being worn, its name, and the days. */
function rung(ctx: CanvasRenderingContext2D, spark: Spark, award: Award, palette: CardPalette) {
  const days = sparkCardDays(spark);
  const nameSize = 78;
  const countSize = 45;
  const mark = 42;
  const gap = 14;

  setFont(ctx, nameSize, 900, 3);
  const nameWidth = ctx.measureText(award.name.toUpperCase()).width;
  setFont(ctx, countSize, 700);
  const countWidth = ctx.measureText(days).width;

  const lineWidth = mark + gap + countWidth;
  const blockWidth = Math.max(nameWidth, lineWidth);
  const total = RING_SIZE + 46 + blockWidth;
  const start = (CARD_BOX_WIDTH - total) / 2;

  const nameHeight = lineHeight(nameSize);
  const countHeight = lineHeight(countSize);
  const blockHeight = nameHeight + 20 + countHeight;
  const top = RING_CENTRE_Y - blockHeight / 2;

  const ringX = start + RING_SIZE / 2;
  ctx.beginPath();
  ctx.arc(ringX, RING_CENTRE_Y, RING_SIZE / 2 - 5, 0, Math.PI * 2);
  ctx.strokeStyle = palette.track;
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.stroke();

  const fraction = spark.alive
    ? Math.min(1, Math.max(0, spark.pct ?? 0))
    : 0;
  if (fraction > 0) {
    ctx.beginPath();
    ctx.arc(
      ringX,
      RING_CENTRE_Y,
      RING_SIZE / 2 - 5,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * fraction,
    );
    ctx.strokeStyle = award.colour;
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.stroke();
  }
  glyph(ctx, glyphFor(award), ringX, RING_CENTRE_Y, 84, award.colour);

  const blockX = start + RING_SIZE + 46;
  words(ctx, award.name.toUpperCase(), blockX, top + nameHeight / 2, {
    size: nameSize,
    weight: 900,
    colour: palette.ink,
    align: "left",
    spacing: 3,
  });
  glyph(
    ctx,
    glyphFor(award),
    blockX + mark / 2,
    top + nameHeight + 20 + countHeight / 2,
    mark,
    award.colour,
  );
  words(ctx, days, blockX + mark + gap, top + nameHeight + 20 + countHeight / 2, {
    size: countSize,
    weight: 700,
    colour: palette.dim,
    align: "left",
  });

  // The rule, and the one line that says what a spark is for.
  ctx.beginPath();
  ctx.moveTo(CARD_PAD, RULE_Y);
  ctx.lineTo(CARD_BOX_WIDTH - CARD_PAD, RULE_Y);
  ctx.strokeStyle = fade(palette.ink, 0.14);
  ctx.lineWidth = 2;
  ctx.stroke();

  footerLine(ctx, award, palette);
}

/** The last line: a mark, the sentence, and a mark. */
function footerLine(
  ctx: CanvasRenderingContext2D,
  award: Award,
  palette: CardPalette,
  /** A fill for a slab under the whole line, or nothing to leave the line on
   * the card itself, which is what the first card does. */
  slabFill?: string,
) {
  const mark = 36;
  const gap = 18;
  // The line is measured against the room it has and not against the sentence
  // it would like to be: two marks and two gaps come out of the card's own
  // width first, and the words take what is left. A footer that ran off both
  // edges of the card would be the one thing on it that is not on it.
  const room = CARD_BOX_WIDTH - CARD_PAD * 2 - mark * 2 - gap * 2;
  setFont(ctx, 36, 600);
  const text = fitted(ctx, FOOTER_LINE, room);
  const textWidth = ctx.measureText(text).width;
  const total = mark + gap + textWidth + gap + mark;
  const start = (CARD_BOX_WIDTH - total) / 2;
  if (slabFill) {
    slab(ctx, CARD_BOX_WIDTH / 2, FOOTER_Y, total + SLAB_PAD * 2, 92, slabFill);
  }
  glyph(ctx, SPARK_GLYPH, start + mark / 2, FOOTER_Y, mark, fade(award.colour, 0.9));
  words(ctx, text, start + mark + gap, FOOTER_Y, {
    size: 36,
    weight: 600,
    colour: palette.dim,
    align: "left",
  });
  glyph(
    ctx,
    HEART_GLYPH,
    start + total - mark / 2,
    FOOTER_Y,
    mark,
    fade(award.colour, 0.9),
  );
}

/** A rounded rectangle, on the browsers that have `roundRect` and off one that
 * does not. */
function roundedRect(
  ctx: CanvasRenderingContext2D,
  box: { left: number; top: number; width: number; height: number },
  radius: number,
) {
  ctx.beginPath();
  // `roundRect` is newer than the rest of the canvas, so a browser that has not
  // got it walks the four corners itself rather than drawing a card with square
  // ones.
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(box.left, box.top, box.width, box.height, radius);
    return;
  }
  const { left, top, width, height } = box;
  ctx.moveTo(left + radius, top);
  ctx.arcTo(left + width, top, left + width, top + height, radius);
  ctx.arcTo(left + width, top + height, left, top + height, radius);
  ctx.arcTo(left, top + height, left, top, radius);
  ctx.arcTo(left, top, left + width, top, radius);
  ctx.closePath();
}

/**
 * A filled rounded slab for a line of words to stand on.
 *
 * The four new looks stand their count and their last line on one, which is
 * most of what tells them apart from the first card at a glance — and it is
 * also what keeps the last line readable on the dark one.
 */
function slab(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  fill: string,
) {
  roundedRect(
    ctx,
    { left: cx - width / 2, top: cy - height / 2, width, height },
    height / 2,
  );
  ctx.fillStyle = fill;
  ctx.fill();
}

// ---- the four looks' own shapes -------------------------------------------

/**
 * The shapes the four new looks are built from, and the first card is not.
 *
 * They are all flat. The house has one rule about colour and this file keeps
 * it: a wash is one tone at one alpha and a soft edge is a stack of flat shapes
 * a step apart, never a ramp. That is why the planet, the moon and the waves
 * below are written as rings of numbers rather than as the radial gradients
 * they would be anywhere else — the sheet these four came off draws all of them
 * as gradients, and this is that softness built out of flat steps.
 */

/** A flat disc. */
function disc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  fill: string,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** A flat ellipse, turned by `turn`. */
function ellipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  fill: string,
  turn = 0,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, turn, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** An ellipse's outline, turned by `turn`. */
function ellipseRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  turn: number,
  colour: string,
  width: number,
) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, turn, 0, Math.PI * 2);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.stroke();
}

/**
 * A soft edge made of steps rather than a ramp.
 *
 * Each step is the same shape one size down and one alpha up, so the middle
 * comes out denser than the rim and the eye reads a glow. Flat tones only: the
 * app has no gradients and this picture is no exception.
 */
function softEllipse(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  colour: string,
  steps: readonly (readonly [number, number])[],
  /** How far the tone is lifted towards white first. Nought on paper, most of
   * the way on the dark card, where the award's own colour would be a hole. */
  lift = 0,
) {
  for (const [scale, alpha] of steps) {
    ellipse(ctx, cx, cy, rx * scale, ry * scale, washOf(colour, lift, alpha));
  }
}

/** A ring of dashes: the segmented track the third look stands its run on. */
function dashedRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  colour: string,
  width: number,
  dash: number,
) {
  const count = Math.max(8, Math.round((2 * Math.PI * r) / (dash * 2)));
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  for (let index = 0; index < count; index += 1) {
    const from = (index / count) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, from, from + (Math.PI * 2 * 0.55) / count);
    ctx.stroke();
  }
  ctx.restore();
}

/** A run of dashes between two points. */
function dashed(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  colour: string,
  width: number,
  dash: number,
  gap: number,
) {
  ctx.save();
  ctx.setLineDash([dash, gap]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
  ctx.restore();
}

/**
 * The rocket, with its window cut back out of it.
 *
 * `glyph` fills every node of a mark in one colour, so a window drawn as a node
 * would be the same tone as the body and invisible. It is drawn after, in the
 * tone the rocket is standing on, which is what makes it read as a window
 * rather than as a lump.
 */
function rocketMark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  colour: string,
  ground: string,
) {
  glyph(ctx, ROCKET_BODY, cx, cy, size, colour);
  const unit = size / 24;
  disc(
    ctx,
    cx + ROCKET_WINDOW.dx * unit,
    cy + ROCKET_WINDOW.dy * unit,
    ROCKET_WINDOW.r * unit,
    ground,
  );
}

/** A cloud: overlapping flat discs, which is the only way a flat cloud is. */
function cloud(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  colour: string,
) {
  const r = width * 0.17;
  disc(ctx, cx - width * 0.3, cy + r * 0.2, r, colour);
  disc(ctx, cx + width * 0.3, cy + r * 0.26, r * 0.82, colour);
  disc(ctx, cx - width * 0.1, cy - r * 0.42, r * 0.94, colour);
  disc(ctx, cx + width * 0.14, cy - r * 0.24, r * 1.14, colour);
}

/**
 * A wave across the card's width.
 *
 * Stroked when it is a line, and closed down to `bottom` and filled when it is
 * a body of water — a wave that is filled is the shape a foot of a card is
 * drawn with, and one that is stroked is the hairline the sheet rides over it.
 */
function wave(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  y: number,
  amplitude: number,
  wavelength: number,
  phase: number,
  colour: string,
  width: number,
  bottom?: number,
) {
  const step = 6;
  ctx.beginPath();
  for (let x = left; x <= right; x += step) {
    const py = y + Math.sin((x / wavelength) * Math.PI * 2 + phase) * amplitude;
    if (x === left) ctx.moveTo(x, py);
    else ctx.lineTo(x, py);
  }
  if (bottom !== undefined) {
    ctx.lineTo(right, bottom);
    ctx.lineTo(left, bottom);
    ctx.closePath();
    ctx.fillStyle = colour;
    ctx.fill();
    return;
  }
  ctx.strokeStyle = colour;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

/** A row of fine waves: the contour bed the fourth look's foot stands on. */
function contours(
  ctx: CanvasRenderingContext2D,
  left: number,
  right: number,
  top: number,
  rows: number,
  step: number,
  colour: string,
  width: number,
  amplitude: number,
  wavelength: number,
) {
  for (let row = 0; row < rows; row += 1) {
    wave(
      ctx,
      left,
      right,
      top + row * step,
      amplitude,
      wavelength,
      row * 0.8,
      colour,
      width,
    );
  }
}

/** A rounded square, stood on a corner by `turn`. */
function tiltedSlab(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  height: number,
  radius: number,
  turn: number,
  fill: string,
  edge?: string,
) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(turn);
  roundedRect(
    ctx,
    { left: -width / 2, top: -height / 2, width, height },
    radius,
  );
  ctx.fillStyle = fill;
  ctx.fill();
  if (edge !== undefined) {
    ctx.strokeStyle = edge;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * The near-white field, and the tone collecting along the two edges of it.
 *
 * Nothing here is drawn for the first card: it is the app's own paper and it is
 * left exactly as it was.
 */
function lookField(
  ctx: CanvasRenderingContext2D,
  style: SparkCardStyle,
  award: Award,
) {
  // The first card is the app's own white paper and the night sky is its own
  // dark ground; only the three pale looks have a field to lay.
  if (style === "classic" || style === "midnight") return;
  ctx.beginPath();
  roundedRect(ctx, CARD_BOX, CARD_CORNER);
  ctx.fillStyle = LOOK_FIELD;
  ctx.fill();

  for (let step = 0; step < LOOK_EDGE_STEPS; step += 1) {
    const alpha = 0.18 * (1 - step / LOOK_EDGE_STEPS);
    const inset = step * LOOK_EDGE_WIDTH;
    ctx.fillStyle = fade(award.colour, alpha);
    ctx.fillRect(
      CARD_BOX.left + inset,
      CARD_BOX.top,
      LOOK_EDGE_WIDTH,
      CARD_BOX.height,
    );
    ctx.fillRect(
      CARD_BOX.left + CARD_BOX.width - inset - LOOK_EDGE_WIDTH,
      CARD_BOX.top,
      LOOK_EDGE_WIDTH,
      CARD_BOX.height,
    );
  }
}

/** One of the round buttons the third look stands around its ring. */
function iconButton(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  r: number,
  nodes: GlyphNode[],
  colour: string,
  ground: string,
  edge: string,
) {
  disc(ctx, cx, cy, r, ground);
  ctx.beginPath();
  ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 2;
  ctx.stroke();
  glyph(ctx, nodes, cx, cy, r * 1.02, colour);
}

function styleDecorations(
  ctx: CanvasRenderingContext2D,
  style: SparkCardStyle,
  award: Award,
  palette: CardPalette,
) {
  ctx.save();
  ctx.beginPath();
  roundedRect(ctx, CARD_BOX, CARD_CORNER);
  ctx.clip();

  const left = CARD_BOX.left;
  const top = CARD_BOX.top;
  const width = CARD_BOX.width;
  const right = left + width;
  const cx = left + width / 2;
  const motifY = top + LOOK_MOTIF_Y;

  lookField(ctx, style, award);

  if (style === "sunset") {
    // A planet: soft at the rim, solid at the core, with an orbit around it and
    // a rocket riding the orbit. The award stands at the planet's middle, which
    // the painter draws — the sheet draws a rocket there because the sheet has
    // no run to draw, and a card that drew one would be a picture of the wrong
    // week.
    softEllipse(ctx, cx, motifY, 300, 240, award.colour, [
      [1, 0.05],
      [0.88, 0.06],
      [0.76, 0.07],
    ]);
    // Solid, not a wash: measured off the sheet, the planet's body is a flat
    // lavender rather than a tint of the field, and a card standing on paper
    // needs something for the award to stand on.
    ellipse(ctx, cx, motifY, 250, 190, blendOverWhite(award.colour, 0.3));

    // The orbit, and the rocket going round it.
    const turn = -0.34;
    ellipseRing(ctx, cx, motifY, 356, 128, turn, fade(award.colour, 0.45), 5);
    const [ox, oy] = [356 * Math.cos(-1.05), 128 * Math.sin(-1.05)];
    rocketMark(
      ctx,
      cx + ox * Math.cos(turn) - oy * Math.sin(turn),
      motifY + ox * Math.sin(turn) + oy * Math.cos(turn),
      104,
      award.colour,
      palette.card,
    );

    for (const [sx, sy, size] of [
      [cx - 296, motifY - 232, 26],
      [cx + 318, motifY - 186, 20],
      [cx - 246, motifY + 236, 17],
      [cx + 268, motifY + 214, 24],
    ] as const) {
      ctx.fillStyle = fade(award.colour, 0.55);
      sparkle(ctx, sx, sy, size);
    }

    // The body of tone the foot of the card sits in. One whole period across
    // the card, trough in the middle: the tone climbs the two edges and dips
    // through the centre, which is the shape the sheet draws. A stripe of even
    // height was tried first and read as a band, not as a foot.
    wave(ctx, left, right, top + 1180, 110, width, -Math.PI / 2, fade(award.colour, 0.16), 0, top + CARD_BOX.height);
    wave(ctx, left, right, top + 1188, 110, width, -Math.PI / 2, fade(award.colour, 0.34), 3);
  } else if (style === "midnight") {
    // A night sky: a low pool of light, a pale moon, a rocket climbing off it,
    // stars, two shooting ones, and cloud at the foot. Nothing here is drawn
    // over the two people at the top, so they stay photographs.
    for (const [radius, alpha] of [
      [520, 0.07],
      [420, 0.08],
      [320, 0.09],
      [220, 0.1],
    ] as const) {
      disc(ctx, cx, motifY + 60, radius, washOf(award.colour, 0.78, alpha));
    }

    // The moon: solid, because a sky is the one place the award's own tone
    // cannot be read on, so the light has to be a body and not a tint. Its rim
    // is a stack of flat discs, which is the only soft edge this file has.
    softEllipse(ctx, cx, motifY, 274, 274, award.colour, [
      [1, 0.06],
      [0.9, 0.07],
      [0.8, 0.08],
    ], 0.74);
    disc(ctx, cx, motifY, 204, blendOverWhite(award.colour, 0.14));
    ellipseRing(ctx, cx, motifY, 204, 204, 0, "rgba(255, 255, 255, 0.22)", 2);

    // The rocket, off the moon's shoulder and climbing, with the trail behind
    // it. Its window is cut in the sky's own tone because that is what is
    // behind it up there.
    const rx = cx + 178;
    const ry = motifY - 236;
    ctx.beginPath();
    ctx.moveTo(cx + 96, motifY - 138);
    ctx.lineTo(rx - 22, ry + 46);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.34)";
    ctx.lineWidth = 7;
    ctx.setLineDash([16, 20]);
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.setLineDash([]);
    rocketMark(ctx, rx, ry, 132, palette.ink, palette.card);

    for (const [x, y, r] of [
      [64, 386, 5],
      [176, 462, 3],
      [286, 408, 4],
      [width - 74, 432, 5],
      [width - 178, 512, 3],
      [width - 268, 368, 4],
      [width / 2 - 96, 486, 3],
      [width / 2 + 132, 396, 4],
    ] as const) {
      disc(ctx, left + x, top + y, r, "rgba(255, 255, 255, 0.46)");
    }

    for (const [fromX, fromY, toX, toY] of [
      [150, 330, 292, 396],
      [width - 138, 300, width - 300, 374],
    ] as const) {
      ctx.beginPath();
      ctx.moveTo(left + fromX, top + fromY);
      ctx.lineTo(left + toX, top + toY);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
      ctx.lineWidth = 4;
      ctx.lineCap = "round";
      ctx.stroke();
      disc(ctx, left + toX, top + toY, 7, "#FFFFFF");
    }

    for (const [cloudX, cloudY, cloudWidth, alpha] of [
      [cx - 196, motifY + 528, 300, 0.2],
      [cx + 208, motifY + 574, 348, 0.16],
    ] as const) {
      cloud(ctx, cloudX, cloudY, cloudWidth, washOf(award.colour, 0.6, alpha));
    }
  } else if (style === "aurora") {
    // A run still going: a faint outer ring, a segmented track, and the four
    // things a Spark is kept by standing round it as buttons. The award and its
    // progress arc stand in the middle, which the painter draws.
    ellipseRing(ctx, cx, motifY, 386, 386, 0, fade(award.colour, 0.22), 3);
    dashedRing(ctx, cx, motifY, 268, fade(award.colour, 0.5), 14, 26);

    for (const [dx, dy, mark] of [
      [-286, -286, CHAT_GLYPH],
      [286, -286, HEART_GLYPH],
      [-286, 286, CALL_GLYPH],
      [286, 286, VIDEO_GLYPH],
    ] as const) {
      iconButton(
        ctx,
        cx + dx,
        motifY + dy,
        58,
        mark,
        award.colour,
        "#FFFFFF",
        fade(award.colour, 0.34),
      );
    }

    // The foot: a shallow body of water with one hairline riding it.
    wave(ctx, left, right, top + 1258, 20, 340, 0, fade(award.colour, 0.1), 0, top + CARD_BOX.height);
    wave(ctx, left, right, top + 1258, 20, 340, 0, fade(award.colour, 0.3), 3);
  } else if (style === "noir") {
    // A stack of three cards, the back two turned, with the award on the front
    // one — and the fine contour bed the whole thing stands on.
    const stackY = motifY + 30;
    softEllipse(ctx, cx, stackY, 452, 396, award.colour, [
      [1, 0.05],
      [0.86, 0.06],
      [0.72, 0.07],
    ]);

    // Measured off the sheet: the stack is most of the card's width, and each
    // slab keeps a rim, which is what tells three of them apart from one wash.
    const rim = fade(award.colour, 0.3);
    tiltedSlab(ctx, cx - 96, stackY - 40, 420, 420, 72, -0.34, blendOverWhite(award.colour, 0.34), rim);
    tiltedSlab(ctx, cx + 104, stackY - 18, 420, 420, 72, 0.3, blendOverWhite(award.colour, 0.26), rim);
    tiltedSlab(
      ctx,
      cx + 4,
      stackY + 14,
      432,
      432,
      76,
      0.04,
      blendOverWhite(award.colour, 0.16),
      fade(award.colour, 0.36),
    );

    wave(ctx, left, right, top + 1210, 110, width, -Math.PI / 2, fade(award.colour, 0.14), 0, top + CARD_BOX.height);
    contours(
      ctx,
      left,
      right,
      top + 1176,
      6,
      26,
      fade(award.colour, 0.2),
      2,
      9,
      220,
    );
  }

  ctx.restore();
}

/** The ring that carries a treatment's award glyph, at the size it is drawn. */
function awardRing(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  cx: number,
  cy: number,
  radius: number,
  thickness: number,
  track: string = palette.track,
) {
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.strokeStyle = track;
  ctx.lineWidth = thickness;
  ctx.lineCap = "round";
  ctx.stroke();

  const fraction = spark.alive ? Math.min(1, Math.max(0, spark.pct ?? 0)) : 0;
  if (fraction > 0) {
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      radius,
      -Math.PI / 2,
      -Math.PI / 2 + Math.PI * 2 * fraction,
    );
    ctx.strokeStyle = award.colour;
    ctx.lineWidth = thickness;
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

/** An award's name and count, centred or ranged left, for the new treatments. */
function awardText(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  x: number,
  y: number,
  {
    align = "center",
    nameSize = 68,
    countSize = 46,
    gap = 18,
    spacing = 4,
    countSlab,
    countIcon,
    countIconColour,
  }: {
    align?: CanvasTextAlign;
    nameSize?: number;
    countSize?: number;
    gap?: number;
    spacing?: number;
    /** A fill for the slab behind the count, or nothing for the count standing
     * on the card itself, which is what the first card does. */
    countSlab?: string;
    /** A mark to stand in front of the count inside that slab — the sheet's
     * little rocket, on all four of the looks drawn after the first card. */
    countIcon?: GlyphNode[];
    countIconColour?: string;
  } = {},
) {
  words(ctx, award.name.toUpperCase(), x, y, {
    size: nameSize,
    weight: 900,
    colour: palette.ink,
    align,
    spacing,
  });

  const days = sparkCardDays(spark);
  const countY = y + lineHeight(nameSize) / 2 + gap + lineHeight(countSize) / 2;
  if (countSlab) {
    // The slab is sized to the words it carries and not to a number typed in,
    // so a card that says "Not started" gets a wider slab than one that says
    // "1 day" and neither of them clips.
    setFont(ctx, countSize, 700);
    const textWidth = ctx.measureText(days).width;
    const icon = countIcon ? countSize : 0;
    const iconGap = countIcon ? countSize * 0.36 : 0;
    const inner = icon + iconGap + textWidth;
    slab(
      ctx,
      x,
      countY,
      inner + SLAB_PAD * 2,
      lineHeight(countSize) + 26,
      countSlab,
    );
    if (countIcon) {
      glyph(
        ctx,
        countIcon,
        x - inner / 2 + icon / 2,
        countY,
        icon,
        countIconColour ?? award.colour,
      );
      words(ctx, days, x - inner / 2 + icon + iconGap, countY, {
        size: countSize,
        weight: 700,
        colour: palette.dim,
        align: "left",
      });
      return;
    }
  }
  words(ctx, days, x, countY, {
    size: countSize,
    weight: 700,
    colour: palette.dim,
    align,
  });
}

/**
 * The line the sheet joins the two people with.
 *
 * One shape per look and the same span for all four: the gap between the two
 * photographs, at the height of their hearts rather than of their middles,
 * because that is where the sheet draws it. Drawn before the faces so it runs
 * under them rather than up to them.
 */
function lookConnector(
  ctx: CanvasRenderingContext2D,
  style: SparkCardStyle,
  award: Award,
  palette: CardPalette,
) {
  const y = LOOK_CONNECT_Y;
  const from = CARD_PAD + FACE_RADIUS * 2 + 10;
  const to = CARD_BOX_WIDTH - CARD_PAD - FACE_RADIUS * 2 - 10;
  const mid = CARD_BOX_WIDTH / 2;
  const dark = style === "midnight";
  const line = dark
    ? "rgba(255, 255, 255, 0.34)"
    : fade(award.colour, style === "noir" ? 0.32 : 0.42);

  if (style === "aurora") {
    // The bare one: the sheet draws a plain line here and nothing on it.
    ctx.beginPath();
    ctx.moveTo(from, y);
    ctx.lineTo(to, y);
    ctx.strokeStyle = line;
    ctx.lineWidth = 3;
    ctx.stroke();
    return;
  }

  if (dark) {
    // A heartbeat rather than a run of dashes: level, one beat left of the
    // middle, level again. The beat sits off the middle so the mark at the
    // middle has somewhere to stand.
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(from, y);
    ctx.lineTo(mid - 150, y);
    ctx.lineTo(mid - 122, y - 44);
    ctx.lineTo(mid - 94, y + 44);
    ctx.lineTo(mid - 64, y - 26);
    ctx.lineTo(mid - 36, y);
    ctx.lineTo(to, y);
    ctx.strokeStyle = line;
    ctx.lineWidth = 5;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
    ctx.restore();
  } else {
    dashed(ctx, from, y, to, y, line, 5, 14, 14);
  }

  // The mark where it is broken: a heart on two of them and the sheet's rocket
  // on the fourth, standing on a disc of the card so the line does not run
  // through it.
  disc(ctx, mid, y, style === "noir" ? 40 : 32, palette.card);
  if (style === "noir") rocketMark(ctx, mid, y, 66, award.colour, palette.card);
  else {
    glyph(
      ctx,
      HEART_GLYPH,
      mid,
      y,
      52,
      dark ? blendOverWhite(award.colour, 0.72) : award.colour,
    );
  }
}

/**
 * The foot all four looks share.
 *
 * The sheet draws the same foot on every one of its four cards: the award's
 * name, the days on a pill with a little rocket in front of them, and the last
 * line on a pill of its own. Only the fills change, and they change with the
 * ground.
 */
function lookWords(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  countFill: string,
  countInk: string,
  footFill: string,
) {
  awardText(ctx, spark, award, palette, CARD_BOX_WIDTH / 2, LOOK_NAME_Y, {
    nameSize: LOOK_NAME_SIZE,
    countSize: LOOK_COUNT_SIZE,
    gap: LOOK_COUNT_GAP,
    countSlab: countFill,
    countIcon: ROCKET_BODY,
    countIconColour: countInk,
  });
  footerLine(ctx, award, palette, footFill);
}

/**
 * The four looks drawn after the first card.
 *
 * All four keep the first card's skeleton — the two people at the top, the
 * award standing in the middle, its name under that, the last line at the foot
 * — because that is what the sheet they came from draws. What separates them is
 * the ground, the shape the award stands in, and the slab the count and the
 * last line sit on. None of them touches the first card's own painter.
 */

/** The two people, at the size and place every one of the four draws them. */
function lookFaces(
  ctx: CanvasRenderingContext2D,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  face(ctx, award, palette, me, mePhoto, CARD_PAD + FACE_RADIUS, FACE_CENTRE_Y);
  face(
    ctx,
    award,
    palette,
    them,
    themPhoto,
    CARD_BOX_WIDTH - CARD_PAD - FACE_RADIUS,
    FACE_CENTRE_Y,
  );
}

/** Sunset: the award at the middle of a planet, on its own orbit. */
function sunsetCard(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  lookConnector(ctx, "sunset", award, palette);
  lookFaces(ctx, award, palette, me, them, mePhoto, themPhoto);
  // The first card's ring is drawn on paper white, where the app's own track
  // colour reads. These three grounds are a tint of the award already, so the
  // track has to be a tint of it too or the ring is an arc with no circle.
  awardRing(
    ctx,
    spark,
    award,
    palette,
    FLAME_X,
    LOOK_MOTIF_Y,
    252,
    8,
    fade(award.colour, 0.24),
  );
  glyph(ctx, glyphFor(award), FLAME_X, LOOK_MOTIF_Y, 208, award.colour);
  lookWords(
    ctx,
    spark,
    award,
    palette,
    fade(award.colour, 0.12),
    award.colour,
    fade(award.colour, 0.08),
  );
}

/** Midnight: the award at the middle of the moon, in a night sky. */
function midnightCard(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  lookConnector(ctx, "midnight", award, palette);
  lookFaces(ctx, award, palette, me, them, mePhoto, themPhoto);
  awardRing(ctx, spark, award, palette, FLAME_X, LOOK_MOTIF_Y, 262, 8);
  // The award's own tone lifted most of the way to white: on this ground its
  // own colour would be a hole rather than an accent.
  glyph(
    ctx,
    glyphFor(award),
    FLAME_X,
    LOOK_MOTIF_Y,
    216,
    blendOverWhite(award.colour, 0.58),
  );
  lookWords(
    ctx,
    spark,
    award,
    palette,
    fade(award.colour, 0.78),
    palette.ink,
    fade(award.colour, 0.58),
  );
}

/** Aurora: a segmented ring the award stands in, with four buttons round it. */
function auroraCard(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  lookConnector(ctx, "aurora", award, palette);
  lookFaces(ctx, award, palette, me, them, mePhoto, themPhoto);
  awardRing(
    ctx,
    spark,
    award,
    palette,
    FLAME_X,
    LOOK_MOTIF_Y,
    176,
    12,
    fade(award.colour, 0.3),
  );
  glyph(ctx, glyphFor(award), FLAME_X, LOOK_MOTIF_Y, 196, award.colour);
  lookWords(
    ctx,
    spark,
    award,
    palette,
    fade(award.colour, 0.12),
    award.colour,
    fade(award.colour, 0.08),
  );
}

/** Noir: the award on the front of a stack of three, on a contour bed. */
function noirCard(
  ctx: CanvasRenderingContext2D,
  spark: Spark,
  award: Award,
  palette: CardPalette,
  me: CardFace | null,
  them: CardFace | null,
  mePhoto: ImageBitmap | HTMLImageElement | null,
  themPhoto: ImageBitmap | HTMLImageElement | null,
) {
  lookConnector(ctx, "noir", award, palette);
  lookFaces(ctx, award, palette, me, them, mePhoto, themPhoto);
  awardRing(
    ctx,
    spark,
    award,
    palette,
    FLAME_X,
    LOOK_MOTIF_Y,
    190,
    8,
    fade(award.colour, 0.24),
  );
  glyph(ctx, glyphFor(award), FLAME_X, LOOK_MOTIF_Y, 186, award.colour);
  lookWords(
    ctx,
    spark,
    award,
    palette,
    fade(award.colour, 0.12),
    award.colour,
    fade(award.colour, 0.08),
  );
}

/**
 * Paint the whole card: paper, card, two people, the flame, the rung.
 *
 * Exported so the geometry can be checked without a browser — the card is a
 * thing no test can look at, but the numbers it was drawn from are things a
 * test can check.
 */
export function paintSparkCard(
  ctx: CanvasRenderingContext2D,
  {
    spark,
    me,
    them,
    mePhoto,
    themPhoto,
    style = "classic",
  }: {
    spark: Spark;
    me: CardFace | null;
    them: CardFace | null;
    mePhoto: ImageBitmap | HTMLImageElement | null;
    themPhoto: ImageBitmap | HTMLImageElement | null;
    style?: SparkCardStyle;
  },
) {
  const award = sparkCardAward(spark);
  const palette = paletteFor(style, award);

  // The ground, and the card's lift under it. One flat tone, never a ramp.
  ctx.fillStyle = palette.page;
  ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.2)";
  ctx.shadowBlur = 26;
  roundedRect(ctx, CARD_BOX, CARD_CORNER);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.restore();

  // The card's own outline at the size it is on the page and not inside the
  // scale below: a hairline that grew with the card would stop being one. On
  // the dark card the award's own hairline would be lost in the ground, so
  // there the outline is the light rather than the accent.
  roundedRect(ctx, CARD_BOX, CARD_CORNER);
  ctx.strokeStyle =
    style === "midnight" ? "rgba(255, 255, 255, 0.22)" : fade(award.colour, 0.18);
  ctx.lineWidth = 3;
  ctx.stroke();

  styleDecorations(ctx, style, award, palette);

  ctx.save();
  ctx.translate(CARD_BOX.left, CARD_BOX.top);
  if (style === "sunset") {
    sunsetCard(ctx, spark, award, palette, me, them, mePhoto, themPhoto);
  } else if (style === "midnight") {
    midnightCard(ctx, spark, award, palette, me, them, mePhoto, themPhoto);
  } else if (style === "aurora") {
    auroraCard(ctx, spark, award, palette, me, them, mePhoto, themPhoto);
  } else if (style === "noir") {
    noirCard(ctx, spark, award, palette, me, them, mePhoto, themPhoto);
  } else {
    twoOfUs(ctx, award, palette, me, them, mePhoto, themPhoto);
    flame(ctx, award);
    rung(ctx, spark, award, palette);
  }
  ctx.restore();
}

/**
 * How long one face is waited for before the card is painted without it.
 *
 * The phone's own number, and the phone's own rule (`Faces.patience`): a socket
 * that has gone quiet without closing hands back neither bytes nor an error,
 * and a picture that waits for one is a picture that never arrives. The wait is
 * on *this* reader and never on the fetch — the bytes are still coming for
 * every other thing on the screen that wants them, and whoever opens this
 * composer again reads them straight off the cache.
 *
 * In the ordinary case nothing waits at all: the sheet this page is opened from
 * drew both faces through the same cache, so `peekMedia` answers on the first
 * look and the clock below is never started.
 */
export const FACE_PATIENCE_MS = 15_000;

/**
 * How long the card is held back for the app's own font.
 *
 * Short, because the font is this app's own file and has been loading since the
 * tab opened: a composer opened by a person is opened long after the face is
 * there. The wait exists at all so the words are the app's words rather than
 * whatever the browser falls back to — but a font that has not come by now is a
 * card set in the fallback face, not a card that never arrives.
 */
export const FONT_PATIENCE_MS = 2_000;

/**
 * `work`, or nothing at all once `ms` have gone by.
 *
 * A bound on waiting and not on the work: `work` is left running, so a read
 * that is shared with the rest of the screen still fills the cache. Written out
 * rather than reached for, because `AbortSignal.timeout` would cancel the
 * shared request — and one card giving up is not a reason for every other
 * avatar in the app to fail. Exported for its own test.
 */
export async function within<T>(work: Promise<T>, ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<null>((resolve) => {
        timer = setTimeout(() => resolve(null), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * The bytes, ready to be uploaded.
 *
 * Painted onto a canvas rather than photographed off the screen, which is the
 * one way this client makes a picture of its own — see
 * `features/moments/TextMoment.tsx`.
 *
 * **Nothing in here may wait for ever.** Both things this paint wants from the
 * outside — the app's font and the two faces — are waited for under a bound
 * (`FONT_PATIENCE_MS`, `FACE_PATIENCE_MS`), because the one failure a person
 * cannot do anything about is a card that never appears at all: the page shows
 * a spinner, the button stays dead, and there is nothing on screen to say why.
 * A card with initials on it posts; a card that was never painted posts
 * nothing — which is also why a paint that fails is tried once more without
 * either picture before this rejects at all.
 */
export async function renderSparkCard({
  spark,
  me,
  them,
  style = randomSparkCardStyle(),
}: {
  spark: Spark;
  me: CardFace | null;
  them: CardFace | null;
  style?: SparkCardStyle;
}): Promise<File> {
  try {
    return await paintOnce({ spark, me, them, photos: true, style });
  } catch {
    /*
     * The same rule the faces already keep, applied to the picture as a whole:
     * a face that will not come is initials, and a card with initials on it
     * posts where a card that was never painted posts nothing. Tried once more,
     * on a fresh canvas and with neither picture, before the page is allowed to
     * say it could not draw one.
     *
     * A fresh canvas and not the same one, because the failure this is here for
     * is a picture that will not draw or an encode that will not happen — both
     * of which leave the first canvas in a state worth not reusing. If the
     * second paint fails too, its error is the one the caller sees.
     */
    return await paintOnce({ spark, me, them, photos: false, style });
  }
}

/** One attempt at the card. `photos` false draws both faces as initials. */
async function paintOnce({
  spark,
  me,
  them,
  photos,
  style,
}: {
  spark: Spark;
  me: CardFace | null;
  them: CardFace | null;
  photos: boolean;
  style: SparkCardStyle;
}): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("The card would not paint.");

  // The words are set in the app's own font, so the card is held back until it
  // is there: a card painted a frame before the face loads would be a card in
  // the browser's fallback font, permanently. Only until it is there, though —
  // a font that has not come by now is not worth a card that never does
  // (`FONT_PATIENCE_MS`).
  await within(
    Promise.resolve(document.fonts?.ready).then(
      () => true,
      () => true, // A browser with no font set still paints; it just paints in its own.
    ),
    FONT_PATIENCE_MS,
  );

  // Both faces at once, and neither of them for longer than the phone waits for
  // a face. A card that waited on a request to paint a picture of two people
  // would be a card that came out with initials on a train — and a card that
  // waited for ever would be no card at all.
  const [mePhoto, themPhoto] = photos
    ? await Promise.all([
        within(faceImage(me?.avatar), FACE_PATIENCE_MS),
        within(faceImage(them?.avatar), FACE_PATIENCE_MS),
      ])
    : [null, null];

  paintSparkCard(ctx, { spark, me, them, mePhoto, themPhoto, style });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error("The card would not encode.")),
      "image/png",
    );
  });
  return new File([blob], "spark-moment.png", { type: "image/png" });
}
