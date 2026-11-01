import type { ConvoCatalog, ConvoTint, ConvoWall } from "@/types/api";

export const VANISH_DAYS = [1, 3, 7, 30, 90];
export const VANISH_DEFAULT_DAYS = 7;
export const PIN_MAX = 3;
export const WALLPAPER_OPACITY = 0.78;
export const CONVO_WASH = 0.20;
export const CONVO_EDGE = 0.30;
export const CONVO_DIM_ALPHA = 0.78;

export const TINT_HEX: Record<string, string> = {
  default: "#7c5cff",
  cyan: "#22d3ee",
  mint: "#34d399",
  amber: "#ffb020",
  rose: "#ff4d6d",
  magenta: "#e879f9",
};

export const FALLBACK_WALLS: ConvoWall[] = [
  { key: "default", name: "Default" },
  { key: "xellom", name: "Xellom" },
  { key: "sheher", name: "Sheher" },
  { key: "safar", name: "Safar" },
  { key: "studio", name: "Studio" },
  { key: "raat", name: "Raat" },
  { key: "mehfil", name: "Mehfil" },
];

export const FALLBACK_TINTS: ConvoTint[] = Object.entries(TINT_HEX).map(([key, hex]) => ({
  key,
  name: key.charAt(0).toUpperCase() + key.slice(1),
  hex,
}));

export function catalogWalls(catalog?: ConvoCatalog | null): ConvoWall[] {
  return catalog?.walls?.length ? catalog.walls : FALLBACK_WALLS;
}

export function catalogTints(catalog?: ConvoCatalog | null): ConvoTint[] {
  return catalog?.tints?.length ? catalog.tints : FALLBACK_TINTS;
}

export function wallUrl(key?: string | null): string | null {
  if (!key || key === "default") return null;
  return `/walls/${key}.jpg`;
}

export function tintHex(key?: string | null): string | null {
  if (!key || key === "default") return null;
  return TINT_HEX[key] ?? null;
}

export function vanishLabel(mode?: string | null, days?: number | null): string {
  if (mode === "instant") return "Instant";
  if (mode === "timed") {
    const n = Number(days) || VANISH_DEFAULT_DAYS;
    return `${n} ${n === 1 ? "day" : "days"}`;
  }
  return "Off";
}

export function wallpaperOpacity(): number {
  return WALLPAPER_OPACITY;
}

/**
 * Alpha-blend two hex colors: `top` at `alpha` over `bottom`.
 * Returns a hex color string.
 */
function alphaBlend(top: string, alpha: number, bottom: string): string {
  const toRgb = (hex: string) => {
    const v = hex.replace("#", "");
    const full = v.length === 3 ? v.split("").map((p) => p + p).join("") : v;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [tr, tg, tb] = toRgb(top);
  const [br, bg, bb] = toRgb(bottom);
  const r = Math.round(tr * alpha + br * (1 - alpha));
  const g = Math.round(tg * alpha + bg * (1 - alpha));
  const b = Math.round(tb * alpha + bb * (1 - alpha));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

/**
 * Returns a hex color that reads on `ground` (white or near-black).
 */
export function inkOn(ground: string): string {
  const toRgb = (hex: string) => {
    const v = hex.replace("#", "");
    const full = v.length === 3 ? v.split("").map((p) => p + p).join("") : v;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r, g, b] = toRgb(ground);
  // Relative luminance (WCAG)
  const part = (c: number) => {
    const c2 = c / 255;
    return c2 <= 0.03928 ? c2 / 12.92 : Math.pow((c2 + 0.055) / 1.055, 2.4);
  };
  const lum = 0.2126 * part(r) + 0.7152 * part(g) + 0.0722 * part(b);
  const whiteLum = 1;
  const blackLum = 0;
  const contrastWhite = (whiteLum + 0.05) / (lum + 0.05);
  const contrastBlack = (lum + 0.05) / (blackLum + 0.05);
  return contrastWhite >= contrastBlack ? "#FFFFFF" : "#13131A";
}

/**
 * What an open convo is coloured in, taken from the theme the account is
 * wearing rather than from a setting of the convo's own.
 *
 * Ported from `convo_theme.dart` rule for rule. The owner asked on 2026-10-24
 * for a conversation to stop carrying an accent picked per chat: *"convo theme
 * ko uski main theme se connect kar do — pink theme hai to pink dikhe, bg multi
 * colour hai to mere message multi colour me rahe"*. So a `tint` the server
 * still sends is simply not read, and everything below comes off the palette.
 */
export interface ConvoPalette {
  accent: string;
  /** The page's own ground. Every wash is mixed over this and not over nothing. */
  page: string;
  card: string;
  line: string;
  /** The theme's word colour. */
  ink: string;
  dim: string;
  /** The colour this theme's chats lead with, where it named one. */
  chatTint?: string;
  /** The theme's own colours, in their order, where it is a theme of colours. */
  tones?: string[];
  bubbleOut?: string;
  bubbleOutText?: string;
  bubbleIn?: string;
  bubbleInText?: string;
}

/**
 * The colour a convo leads with.
 *
 * The theme's own chat tint where it named one — Anime Blue and Alone do, so
 * their chats stay the colour their drawings were measured for — and the
 * theme's accent otherwise. `chatTint` is a theme saying what its chats are
 * coloured; where it says nothing, the accent every other page leads with is
 * the answer.
 */
export function convoAccent(palette: ConvoPalette): string {
  return palette.chatTint ?? palette.accent;
}

/**
 * Conversation bubble color tokens — the two washes, their edges, the inks read
 * on them, and the run a theme of colours draws across my own bubble.
 *
 *   - convoBubbleWash: 20% accent over the page's ink (my bubble)
 *   - convoBubbleEdge: 30% accent (its hairline)
 *   - convoBubbleRun:  the theme's own colours, in order, across the bubble
 *   - convoOutInk / convoOutDim: the words in my bubble and the quiet ones
 *   - convoInWash / convoInEdge / convoInInk / convoInDim: their side
 */
export function convoColors(palette: ConvoPalette) {
  const accent = convoAccent(palette);
  const pageInk = palette.page;
  const card = palette.card;
  const line = palette.line;
  const tones = palette.tones ?? [];
  const isMultiColorTheme = tones.length > 1;

  // A named `bubble_out` is one colour said outright, and nothing is blended
  // over it: the whole bubble is controllable from the panel, and a wash of the
  // accent on top would be the web choosing where the theme had already spoken.
  const convoBubbleWash = palette.bubbleOut ?? alphaBlend(accent, CONVO_WASH, pageInk);
  const convoBubbleEdge = palette.bubbleOut ?? alphaBlend(accent, CONVO_EDGE, pageInk);
  // The ink that reads on the ground the bubble actually got — white on a dark
  // bubble, near black on a pale one — rather than the theme's word colour,
  // which was chosen for the page and not for the bubble.
  const convoOutInk = palette.bubbleOutText ?? (palette.bubbleOut ? inkOn(palette.bubbleOut) : palette.ink);
  const convoOutDim =
    palette.bubbleOut == null && palette.bubbleOutText == null
      ? palette.dim
      : alphaBlend(convoOutInk, CONVO_DIM_ALPHA, convoBubbleWash);

  const convoInWash = palette.bubbleIn ?? card;
  const convoInEdge = palette.bubbleIn ?? line;
  const convoInInk = palette.bubbleInText ?? (palette.bubbleIn ? inkOn(palette.bubbleIn) : palette.ink);
  const convoInDim =
    palette.bubbleIn == null && palette.bubbleInText == null
      ? palette.dim
      : alphaBlend(convoInInk, CONVO_DIM_ALPHA, convoInWash);

  // A run of the theme's own colours, or none for a theme that named one colour
  // of its own. Null is deliberate and is the whole safety rule: a flat theme
  // stays flat. Each stop is the same wash the flat bubble draws, so the panel
  // is exactly as safe to write on; only the hue changes across it. A theme
  // carrying a `chatTint` is the same answer from the other side — it has said
  // in one colour what its chats are drawn in.
  const convoBubbleRun =
    palette.bubbleOut == null && isMultiColorTheme && palette.chatTint == null
      ? `linear-gradient(to right, ${tones
          .map((tone) => alphaBlend(tone, CONVO_WASH, pageInk))
          .join(", ")})`
      : "none";

  return {
    convoBubbleWash,
    convoBubbleEdge,
    convoBubbleRun,
    convoOutInk,
    convoOutDim,
    convoInWash,
    convoInEdge,
    convoInInk,
    convoInDim,
  };
}
