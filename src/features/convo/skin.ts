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
function inkOn(ground: string): string {
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
 * Conversation bubble color tokens. These mirror `convo_theme.dart`:
 * - convoBubbleWash: 20% accent over page ink (my bubble background)
 * - convoBubbleEdge: 30% accent (my bubble border)
 * - convoBubbleRun: gradient of theme tones over ink (multi-color themes)
 * - convoOutInk: text color on my bubble
 * - convoOutDim: quiet text on my bubble (78%)
 * - convoInWash: their bubble background (card or theme bubbleIn)
 * - convoInEdge: their bubble border
 * - convoInInk: text color on their bubble
 * - convoInDim: quiet text on their bubble (78%)
 */
export function convoColors(accent: string, palette: {
  page: string;
  card: string;
  line: string;
  ink: string;
  dim: string;
}) {
  const pageInk = palette.ink;
  const card = palette.card;
  const line = palette.line;
  const isMultiColorTheme = false; // TODO: detect from theme tones

  // My bubble wash: 20% accent over page ink
  const convoBubbleWash = alphaBlend(accent, CONVO_WASH, pageInk);
  // My bubble edge: 30% accent
  const convoBubbleEdge = alphaBlend(accent, CONVO_EDGE, pageInk);
  // My bubble text: readable on wash
  const convoOutInk = inkOn(convoBubbleWash);
  // My bubble quiet text: 78% of out ink
  const convoOutDim = alphaBlend(convoOutInk, CONVO_DIM_ALPHA, pageInk);

  // Their bubble: card (or theme bubbleIn)
  const convoInWash = card;
  // Their bubble edge: line (or theme bubbleIn)
  const convoInEdge = line;
  // Their bubble text: readable on card
  const convoInInk = inkOn(convoInWash);
  // Their bubble quiet text: 78% of in ink
  const convoInDim = alphaBlend(convoInInk, CONVO_DIM_ALPHA, card);

  return {
    convoBubbleWash,
    convoBubbleEdge,
    convoBubbleRun: isMultiColorTheme ? `linear-gradient(to right, ${convoBubbleWash} 0%, ${convoBubbleWash} 100%)` : "none",
    convoOutInk,
    convoOutDim,
    convoInWash,
    convoInEdge,
    convoInInk,
    convoInDim,
  };
}
