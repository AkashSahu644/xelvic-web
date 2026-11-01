// The rest of the shelf, and how a design is read.
//
// Everything here is a reading of `theme.dart` and `theme_shop.dart` on the
// Android side: the shelf as one list, the materials a bar and a pane are made
// of, the colour tokens a Studio row may lay over a design, and the themes
// somebody mixes out of the picker's eight colours.

import {
  designedThemes,
  TONES,
  type ThemeDesign,
  type ThemePalette,
  type ThemeTokens,
  type Tone,
} from "@/theme/catalog";
import { paintedThemes } from "@/theme/painted";

/** Every design the build carries: the ones written into the catalog and the paintings. */
export const bundledThemes: ThemeDesign[] = [...designedThemes, ...paintedThemes];

/** The design called [key], or nothing when the build does not carry it. */
export function bundledByKey(key: string): ThemeDesign | null {
  const lower = key.trim().toLowerCase();
  return bundledThemes.find((design) => design.key.toLowerCase() === lower) ?? null;
}

/**
 * The bar a reading wears. See `XChrome`: a theme that named a material gets
 * it, and a theme that named none is the app's own — grey by day, charcoal at
 * night.
 */
export interface BarMaterial {
  ground: string;
  fill: number;
  quiet: string;
  edge: string;
  /** Whether this bar is a dark one, which is what a tab's colour depends on. */
  dark: boolean;
}

/** And what a pane in a glass list is made of. See `XPane`. */
export interface PaneMaterial {
  ground: string;
  fill: number;
  /** How much of the accent an unread row takes. */
  hot: number;
  edge: string;
}

/** Charcoal glass over a light page: the app's own bar at night. */
export const CHROME_DARK: BarMaterial = {
  ground: "#13131A",
  fill: 0.62,
  quiet: "#DCDCE4",
  edge: "#E3E3EC",
  dark: true,
};

/** Grey glass by day. A bar has to stop taking the colour of what scrolls under it. */
export const CHROME_GREY: BarMaterial = {
  ground: "#E7E7ED",
  fill: 0.86,
  quiet: "#55555F",
  edge: "#C3C3CE",
  dark: false,
};

/** The same glass turned inside out: a brightening of the picture, not a hole in it. */
export const CHROME_GLASS: BarMaterial = {
  ground: "#FFFFFF",
  fill: 0.46,
  quiet: "#74535F",
  edge: "#99FFFFFF",
  dark: false,
};

/** The light black a pane over a dark picture wears. */
export const PANE_INK: PaneMaterial = { ground: "#24242B", fill: 0.82, hot: 0.08, edge: "#52FFFFFF" };

/** The white glass a pane over a bright picture wears. */
export const PANE_GLASS: PaneMaterial = { ground: "#FFFFFF", fill: 0.46, hot: 0.22, edge: "#99FFFFFF" };

/** The bar [palette] asks for, resolved the app's way. */
export function barMaterial(palette: ThemePalette): BarMaterial {
  const kind = palette.chrome ?? (palette.isDark ? "dark" : "grey");
  const base = kind === "glass" ? CHROME_GLASS : kind === "dark" ? CHROME_DARK : CHROME_GREY;
  if (!palette.navGround && palette.navFill === undefined && !palette.navQuiet && !palette.navEdge) {
    return base;
  }
  return {
    ground: palette.navGround ?? base.ground,
    fill: palette.navFill ?? base.fill,
    quiet: palette.navQuiet ?? base.quiet,
    edge: palette.navEdge ?? base.edge,
    dark: base.dark,
  };
}

/** The pane [palette] asks for — its own, or the bar's material. */
export function paneMaterial(palette: ThemePalette): PaneMaterial {
  const bar = barMaterial(palette);
  const base: PaneMaterial =
    palette.pane === "glass"
      ? PANE_GLASS
      : palette.pane === "ink"
        ? PANE_INK
        : // A theme that has chosen no pane of its own takes the bar's material,
          // warmed by the number the app's own charcoal glass has always warmed
          // a waiting row by. See `X.paneHot`.
          { ground: bar.ground, fill: bar.fill, hot: 0.22, edge: bar.edge };
  if (
    !palette.paneGround &&
    palette.paneFill === undefined &&
    palette.paneHot === undefined &&
    !palette.paneEdge
  ) {
    return base;
  }
  return {
    ground: palette.paneGround ?? base.ground,
    fill: palette.paneFill ?? base.fill,
    hot: palette.paneHot ?? base.hot,
    edge: palette.paneEdge ?? base.edge,
  };
}

/** Whether the convo list is panes rather than ruled rows. */
export function isGlassList(palette: ThemePalette): boolean {
  return palette.list === "glass";
}

/** The six-digit colour in [value], or nothing when it is not one. */
function hexOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return /^#[0-9a-fA-F]{6}$/.test(text) || /^#[0-9a-fA-F]{3}$/.test(text) ? text.toUpperCase() : null;
}

/** [value] held between nothing and one, or nothing when it is not a number. */
function boundedOrNull(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/**
 * The same reading with the server's colour tokens laid over it — §2 of
 * `theme.dart`, ported one rule at a time.
 *
 * The vocabulary is a `light` and a `dark` group of the colours the app draws
 * with, the numbers a glass surface is made of, and three words for the bar's
 * material, the pane's and the list's shape. The group read is the one this
 * reading *is*, because what is being overlaid is the palette the app is
 * actually wearing. A token that is not there keeps the value the bundled
 * design already had: a row may say `accent` and nothing else, and every other
 * colour still comes from the design.
 */
export function paletteWithTokens(palette: ThemePalette, tokens?: ThemeTokens | null): ThemePalette {
  if (!tokens) return palette;
  const group = (palette.isDark ? tokens.dark : tokens.light) ?? {};
  const accent = hexOrNull(group.accent);
  const navKind =
    tokens.nav === "dark" || tokens.nav === "grey" || tokens.nav === "glass" ? tokens.nav : undefined;
  // `inherit` is a decision and not the absence of one: a row that says it gets
  // the bar's material, where a row that says nothing keeps its own pane.
  const paneKind: "ink" | "glass" | null | undefined =
    tokens.panes === "ink"
      ? "ink"
      : tokens.panes === "glass"
        ? "glass"
        : tokens.panes === "inherit"
          ? null
          : undefined;
  const listKind = tokens.list === "flush" || tokens.list === "glass" ? tokens.list : undefined;
  return {
    ...palette,
    // The accent is one colour and a theme's own tone is a pair — the deep
    // reading and the one that shows on the dark bar. Staff name one, so it
    // becomes both, which is what the app's own pink already is.
    accent: accent ?? palette.accent,
    accentPill: accent ?? palette.accentPill,
    page: hexOrNull(group.ink) ?? palette.page,
    card: hexOrNull(group.card) ?? palette.card,
    line: hexOrNull(group.line) ?? palette.line,
    ink: hexOrNull(group.text) ?? palette.ink,
    dim: hexOrNull(group.dim) ?? palette.dim,
    scrim: boundedOrNull(group.scrim) ?? palette.scrim,
    chrome: navKind ?? palette.chrome,
    pane: paneKind === undefined ? palette.pane : paneKind,
    list: listKind ?? palette.list,
    field: hexOrNull(group.field) ?? palette.field,
    sheet: hexOrNull(group.sheet) ?? palette.sheet,
    button: hexOrNull(group.button) ?? palette.button,
    buttonText: hexOrNull(group.button_text) ?? palette.buttonText,
    buttonOff: hexOrNull(group.button_disabled) ?? palette.buttonOff,
    good: hexOrNull(group.good) ?? palette.good,
    bad: hexOrNull(group.bad) ?? palette.bad,
    chatTint: hexOrNull(group.chat_tint) ?? palette.chatTint,
    bubbleOut: hexOrNull(group.bubble_out) ?? palette.bubbleOut,
    bubbleOutText: hexOrNull(group.bubble_out_text) ?? palette.bubbleOutText,
    bubbleIn: hexOrNull(group.bubble_in) ?? palette.bubbleIn,
    bubbleInText: hexOrNull(group.bubble_in_text) ?? palette.bubbleInText,
    navGround: hexOrNull(group.nav_ground) ?? palette.navGround,
    navFill: boundedOrNull(group.nav_fill) ?? palette.navFill,
    navQuiet: hexOrNull(group.nav_quiet) ?? palette.navQuiet,
    navEdge: hexOrNull(group.nav_edge) ?? palette.navEdge,
    navText: hexOrNull(group.nav_text) ?? palette.navText,
    paneGround: hexOrNull(group.pane_ground) ?? palette.paneGround,
    paneFill: boundedOrNull(group.pane_fill) ?? palette.paneFill,
    paneHot: boundedOrNull(group.pane_hot) ?? palette.paneHot,
    paneEdge: hexOrNull(group.pane_edge) ?? palette.paneEdge,
    paneText: hexOrNull(group.pane_text) ?? palette.paneText,
  };
}

/** How many colours one theme may hold. See `XThemes.most`. */
export const TONES_MOST = 3;

/** The colour called [name], or nothing when nothing here is. */
export function toneNamed(name: string): Tone | null {
  const wanted = name.trim().toLowerCase();
  return TONES.find((tone) => tone.name.toLowerCase() === wanted) ?? null;
}

/** A theme built from [tones], in the order they were chosen. */
export function tonesOf(tones: Tone[]): Tone[] {
  return tones.length === 0 ? [TONES[0]] : tones.slice(0, TONES_MOST);
}

/**
 * The two readings of a theme somebody mixed: the app's own page, with [tones]
 * leading it.
 *
 * A mixed theme was chosen against white and has no second reading to be found
 * anywhere, so the night is the smallest honest thing — the page goes dark, the
 * words go to the app's ink turned inside out, and each colour becomes the one
 * the app was *already* drawing on a dark bar.
 */
export function mixedPalettes(tones: Tone[]): { light: ThemePalette; dark: ThemePalette } {
  const picked = tonesOf(tones);
  const names = picked.map((tone) => tone.name);
  const lead = picked[0];
  return {
    light: {
      accent: lead.on,
      accentPill: lead.on,
      page: "#F7F7FB",
      card: "#FFFFFF",
      line: "#E3E3EC",
      ink: "#13131A",
      dim: "#6B6B7B",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
      chrome: "grey",
      pane: null,
      list: "flush",
      tones: names,
    },
    dark: {
      accent: lead.pill,
      accentPill: lead.pill,
      page: "#12121A",
      card: "#1C1C26",
      line: "#2C2C38",
      ink: "#F2F2F7",
      dim: "#A9A9BC",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
      chrome: "dark",
      pane: null,
      list: "flush",
      tones: names,
    },
  };
}

/**
 * A theme mixed out of [tones], as a design.
 *
 * Its name *is* its colours joined with ' + ', exactly as the app names them —
 * so choosing Teal and then Pink is a different theme from choosing Pink and
 * then Teal, and a choice written down survives a restart without a stored hex.
 */
export function mixedDesign(tones: Tone[]): ThemeDesign {
  const picked = tonesOf(tones);
  const name = picked.map((tone) => tone.name).join(" + ");
  const palettes = mixedPalettes(picked);
  return {
    key: name,
    name,
    mood: "A theme you mixed yourself, out of the eight colours.",
    character: picked[0].name,
    mark: "blob",
    price: 0,
    cover: "",
    light: palettes.light,
    dark: palettes.dark,
  };
}

/**
 * The design written down as [name], or nothing when nothing here is.
 *
 * A designed theme is looked for first and by its own name, because that is
 * what was written down and its colours are not what it is called. What is left
 * is the mixed themes, whose name *is* their colours joined with ' + ' — so a
 * theme somebody built themselves survives a restart, and a name written by a
 * build that had themes this one does not falls back rather than crashing.
 */
export function designForName(name: string | null | undefined): ThemeDesign | null {
  const wanted = (name ?? "").trim();
  if (!wanted) return null;
  const lower = wanted.toLowerCase();
  const designed = bundledThemes.find((design) => design.key.toLowerCase() === lower);
  if (designed) return designed;
  const tones: Tone[] = [];
  for (const part of wanted.split("+")) {
    const tone = toneNamed(part);
    if (tone) tones.push(tone);
  }
  return tones.length === 0 ? null : mixedDesign(tones);
}

/** The colours a mixed theme leads with, for the swatches that drew it. */
export function tonesIn(design: ThemeDesign, dark: boolean): Tone[] {
  const names = (dark ? design.dark : design.light).tones;
  if (!names) return [];
  return names.map((name) => toneNamed(name)).filter((tone): tone is Tone => Boolean(tone));
}

/** The picture on the shelf, in the reading the app is in. See `XDesign.coverFor`. */
export function coverFor(design: ThemeDesign, dark: boolean): string {
  const light = design.coverLight;
  const poster = dark || !light ? design.cover : light;
  if (poster) return poster;
  if (design.profileCover) return design.profileCover;
  return design.profile ?? "";
}

/** The reading [design] asks for, with whatever the server said laid over it. */
export function paletteOf(design: ThemeDesign, dark: boolean): ThemePalette {
  return paletteWithTokens(dark ? design.dark : design.light, design.tokens);
}
