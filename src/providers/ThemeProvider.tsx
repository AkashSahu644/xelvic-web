// The theme the web is wearing, and the one place it reaches every screen.
//
// Ported from `xelvic/app/lib/theme_provider.dart`, and the port keeps the two
// properties that make the phone's version work:
//
//   * **A theme is a set of CSS variables on `document.documentElement`.** No
//     screen names a colour; the app names `X.text` in four hundred places and
//     none of them had to learn about themes. Here the same job is done by
//     `--ink`, `--accent`, `--page` and the rest, which `tailwind.config.ts`
//     exposes as `text-ink`, `bg-page`, `border-line`. A screen that says what
//     it wants to be painted in is a screen that repaints when the theme moves,
//     and a preview can move it without anything being written down.
//   * **A catalogue row is an override and never an invention.** The design
//     comes from the build, the row lays colours and pictures over it, and a
//     row that says nothing leaves the design byte for byte what it was. With
//     no catalogue at all the web behaves exactly as it did before the Style
//     Studio existed — §0, and the whole safety property.
//
// The reading is `styleDesign` in `features/marketplace/model.ts`, which is
// `_styled` and `_withPages` ported rule for rule; this file decides *which*
// design and row, and writes the result out as variables.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "@/lib/api";
import {
  designedThemes,
  type ShellPage,
  type ThemeDesign,
  type ThemePalette,
  type Tone,
} from "@/theme/catalog";
import {
  barMaterial,
  bundledByKey,
  bundledThemes,
  designForName,
  paneMaterial,
  toneNamed,
} from "@/theme/shelf";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { useCatalogue } from "@/features/marketplace/queries";
import {
  designForKey,
  rowForKey,
  shelfDesigns,
  styleDesign,
  type StyledTheme,
} from "@/features/marketplace/model";
import { convoColors, inkOn, type ConvoPalette } from "@/features/convo/skin";
import type { CatalogueTheme, Crop } from "@/features/marketplace/types";
import type { Me } from "@/types/api";

export type ThemeMode = "light" | "dark" | "system";

/**
 * A picture behind a screen, and how it is read.
 *
 * `wash` is the colour the veil is made of, and it is not the same colour on
 * every screen — the app has this written down at length in
 * `screens/backdrop.dart`. A shell page's picture is a picture drawn for a
 * light page and read with the lights off, so its wash is the app's near-black;
 * a chat's is read through the *page's own ink*, so a light theme's chat is
 * washed light and a dark theme's dark. Sending the near-black there is what
 * made a theme's chat come up black under a light theme.
 */
export interface ScreenBackdrop {
  art: string;
  /** How much of `wash` is laid over the picture, 0–1. */
  veil: number;
  wash: string;
  crop: Crop | null;
}

interface ThemeContextValue {
  /** The design the web is wearing, with the catalogue's row laid over it. */
  design: ThemeDesign;
  /**
   * The design as it was chosen, with no preview on top and no row over it.
   *
   * The studio and the shop both want the design itself — its own colours, its
   * own pictures — while the app is wearing the overlaid one.
   */
  selectedDesign: ThemeDesign;
  /** The palette being read, in the light or the dark reading. */
  palette: ThemePalette;
  /**
   * The theme's colour for the `index`th thing in a run, wrapping round it.
   *
   * `XTheme.accentAt`. A run of rows on one screen — the ranked lists on
   * Insights — reads as one page rather than as the same colour eight times,
   * and a theme of a single colour answers with that colour, which is what it
   * is. Read through the provider so a theme being *previewed* repaints the run
   * with it, the same as everything else on the screen.
   */
  accentAt: (index: number) => string;
  mode: ThemeMode;
  resolvedDark: boolean;
  /** The catalogue's row for the worn theme, when there is one. */
  row: CatalogueTheme | null;
  /** Whether the catalogue has landed. Nothing new is claimed until it has. */
  catalogued: boolean;
  /** Every design this build carries, floor first. */
  themes: ThemeDesign[];
  /** The shelf the panel is drawing, which is the catalogue's own list. */
  shelf: ThemeDesign[];
  /** Put a theme on by key, for real: written to the account and to the disk. */
  setDesign: (key: string, options?: { sync?: boolean; silent?: boolean }) => Promise<boolean>;
  /** Put a design on, for real — the door the preview's Apply comes through. */
  equip: (design: ThemeDesign, options?: { sync?: boolean; silent?: boolean }) => Promise<boolean>;
  /**
   * Move the whole web onto a design without wearing it.
   *
   * The preview applies the theme *before* it opens and restores the old one
   * when it closes, which is the only way "see what this looks like" can mean
   * the whole app rather than a box in the middle of it. Nothing is written
   * down: `equip` is the decision made after looking.
   */
  previewDesign: (design: ThemeDesign | string | null) => void;
  clearPreview: () => void;
  /**
   * Look at the other reading of the design being previewed.
   *
   * The preview's Light and Dark segments move the whole web, exactly as the
   * preview's *design* does: on the phone both go through the same
   * `ThemeProvider.apply`, so switching the segment repaints every screen. This
   * is the second half of that call, and it is deliberately a preview-only
   * value — it is read only while something is being previewed, and it is
   * thrown away with the preview rather than written down. The reading somebody
   * was looking at when they pressed Apply is the one `setMode` then records.
   */
  setPreviewDark: (dark: boolean) => void;
  setMode: (mode: ThemeMode) => void;
  /** The picture behind a shell tab, or nothing. */
  artFor: (page: ShellPage | null) => string | null;
  /** The same picture with its veil and framing, or nothing. */
  backdropFor: (page: ShellPage | null) => ScreenBackdrop | null;
  /** The picture behind a profile, and the band over it. */
  profileBackdrop: ScreenBackdrop | null;
  coverBackdrop: ScreenBackdrop | null;
  /** The picture behind an open chat, below a wallpaper somebody picked. */
  chatBackdrop: ScreenBackdrop | null;
  /** Everything the row laid over the design, for a screen that wants it raw. */
  styled: StyledTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_KEY = "xelvic.theme";
const MODE_KEY = "xelvic.mode";

/** The app's own theme: the floor a build with nothing written down stands on. */
const OWN = designedThemes[0];

/**
 * The rows of a catalogue that has not landed.
 *
 * One shared empty array rather than a fresh `[]`, because `rows` is a
 * dependency of the design, the row and the styled theme: a new array on every
 * render would recompute all three on every render and re-render every screen
 * under the provider for nothing.
 */
const NO_ROWS: CatalogueTheme[] = [];

/**
 * The flat wash every chat picture is read through. See `kWallScrim`.
 *
 * 0.78 of the page's own ink, which is heavy on purpose: a chat is a column of
 * words over a photograph, and words over a photograph is the one place the app
 * cannot afford to be pretty.
 */
export const WALL_SCRIM = 0.78;

function readTheme(): string | null {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
}

/**
 * The reading the web is in.
 *
 * **The default is light**, which is not a preference: it is the app's own
 * default (`XMode.light`), and a web that opened in `system` would show a
 * person on a dark-set phone a theme nobody chose. A value already written down
 * is still honoured, including `system`, so nobody's choice is taken away.
 */
function readMode(): ThemeMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (value === "light" || value === "dark" || value === "system") return value;
  } catch {
    // fall through
  }
  return "light";
}

function persist(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // A private window can refuse storage.
  }
}

/** The three channels of a colour, for `rgb(var(--x) / <alpha>)`. */
function rgbChannels(hex: string): string {
  const value = hex.replace("#", "");
  const six =
    value.length === 3
      ? value
          .split("")
          .map((part) => part + part)
          .join("")
      : value.slice(0, 6);
  const number = Number.parseInt(six, 16);
  if (!Number.isFinite(number)) return "19 19 26";
  return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

/** A colour at an alpha, as CSS. The app's `X.fade`. */
function fade(hex: string, alpha: number): string {
  return `rgb(${rgbChannels(hex)} / ${alpha})`;
}

/** The theme's colours, in their order, as hexes. See `XTheme.accentAt`. */
function toneColors(palette: ThemePalette): string[] {
  const names = palette.tones;
  if (!names || names.length === 0) return [];
  return names
    .map((name) => toneNamed(name))
    .filter((tone): tone is Tone => Boolean(tone))
    .map((tone) => (palette.isDark ? tone.pill : tone.on));
}

/**
 * The colour for the [index]th thing in a run, wrapping round the theme.
 *
 * `XTheme.accentAt`, and deliberately not [toneColors] above: that pair is the
 * two *readings* of a colour, and which of the two is asked for is the surface's
 * question. A nav pill sits on the bar and takes the dark reading; a chart is
 * drawn on the page and takes the light one — `tone.on`, which is what the phone
 * hands a series too. A theme of one colour answers with that colour every time,
 * which is the honest answer rather than a made-up second hue.
 */
export function accentAt(palette: ThemePalette, index: number): string {
  const names = palette.tones ?? [];
  const tones = names
    .map((name) => toneNamed(name))
    .filter((tone): tone is Tone => Boolean(tone));
  if (tones.length === 0) return palette.accent;
  const at = ((index % tones.length) + tones.length) % tones.length;
  return tones[at].on;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { status, user, updateUser } = useAuth();
  const { toast } = useToast();
  const { data: catalogue } = useCatalogue();
  const rows = useMemo(() => catalogue?.themes ?? NO_ROWS, [catalogue]);

  const [storedKey, setStoredKey] = useState<string | null>(readTheme);
  const [previewed, setPreviewed] = useState<ThemeDesign | null>(null);
  /** The reading the preview is being looked at in, or nothing for the web's own. */
  const [previewDark, setPreviewDarkState] = useState<boolean | null>(null);
  const [mode, setModeState] = useState<ThemeMode>(readMode);
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches,
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  // What the account says, and the disk behind it. The account is the only
  // thing that knows a theme somebody paid for on another phone, and the disk
  // is the only thing that knows what was chosen *here* — so the account wins
  // when it has something to say and the disk is the floor beneath it. A key
  // this build cannot draw falls through to the app's own colour rather than
  // being refused loudly, which is the same answer the phone gives.
  const wornKey = useMemo(() => {
    const asked = status === "authenticated" ? (user?.theme ?? "").trim() : "";
    if (asked) return asked;
    return (storedKey ?? "").trim() || OWN.key;
  }, [status, user, storedKey]);

  const selectedDesign = useMemo(
    () =>
      designForKey(rows, wornKey) ??
      designForName(wornKey) ??
      bundledByKey(wornKey) ??
      OWN,
    [rows, wornKey],
  );

  const selectedRow = useMemo(
    () => rowForKey(rows, selectedDesign.key) ?? rowForKey(rows, wornKey),
    [rows, selectedDesign.key, wornKey],
  );

  const styled = useMemo(() => styleDesign(selectedDesign, selectedRow), [selectedDesign, selectedRow]);

  /** The reading the web would be in with nothing being previewed. */
  const baseDark = mode === "dark" || (mode === "system" && systemDark);

  /**
   * The reading the web is in *now*, which the preview may have moved.
   *
   * Only while something is being previewed: outside a preview this is the
   * setting and nothing else, so a reader who never opens the shop is in exactly
   * the reading they chose.
   */
  const resolvedDark = previewed && previewDark !== null ? previewDark : baseDark;

  /** What the web is actually drawing right now: the preview when there is one. */
  const shown: StyledTheme = useMemo(
    () => (previewed ? styleDesign(previewed, null) : styled),
    [previewed, styled],
  );
  const design = shown.design;
  const palette = resolvedDark ? design.dark : design.light;

  useEffect(() => {
    const root = document.documentElement;
    const bar = barMaterial(palette);
    const pane = paneMaterial(palette);
    // The pill is the accent read on the *bar*, and the bar is the ground a tab
    // label sits on. `XTone` keeps a colour read on a light ground and the same
    // colour lifted for a dark one, so which of the two is asked for is the
    // material's question rather than the theme's — a yellow lifted until it
    // shows on charcoal is a yellow that disappears on grey.
    const pill = bar.dark ? palette.accentPill : palette.accent;
    const convoPalette: ConvoPalette = {
      accent: palette.accent,
      page: palette.page,
      card: palette.card,
      line: palette.line,
      ink: palette.ink,
      dim: palette.dim,
      chatTint: palette.chatTint,
      tones: toneColors(palette),
      bubbleOut: palette.bubbleOut,
      bubbleOutText: palette.bubbleOutText,
      bubbleIn: palette.bubbleIn,
      bubbleInText: palette.bubbleInText,
    };
    const convo = convoColors(convoPalette);
    // The app's green and red, as words on the app's own surface: the light
    // pair held to read on white, the night pair lifted until they read on a
    // dark card. A theme may name its own, which is what `paletteWithTokens`
    // puts here.
    const good = palette.good ?? (palette.isDark ? "#4BD68E" : "#0B7A44");
    const bad = palette.bad ?? (palette.isDark ? "#FF7B7B" : "#D92B2B");
    const field = palette.field ?? palette.card;
    const sheet = palette.sheet ?? palette.card;
    const button = palette.button ?? palette.accent;
    const buttonText = palette.buttonText ?? (palette.button ? inkOn(palette.button) : palette.onAccent);

    const vars: Record<string, string> = {
      "--accent": palette.accent,
      "--accent-rgb": rgbChannels(palette.accent),
      "--accent-pill": pill,
      "--accent-pill-rgb": rgbChannels(pill),
      "--accent-ink": palette.onAccent,
      "--on-accent": palette.onAccent,
      "--on-accent-rgb": rgbChannels(palette.onAccent),
      "--page": palette.page,
      "--page-rgb": rgbChannels(palette.page),
      "--card": palette.card,
      "--card-rgb": rgbChannels(palette.card),
      "--line": palette.line,
      "--line-rgb": rgbChannels(palette.line),
      "--ink": palette.ink,
      "--ink-rgb": rgbChannels(palette.ink),
      "--dim": palette.dim,
      "--dim-rgb": rgbChannels(palette.dim),
      // The near-black the app draws *with* rather than writes in: a scrim over
      // a picture, a shadow under a card, the slab behind white words. Fixed on
      // every theme, because a picture theme's ink is a pale wash and a pale
      // scrim darkens nothing.
      "--solid": "#13131A",
      "--solid-rgb": rgbChannels("#13131A"),
      "--accent-soft": fade(palette.accent, 0.12),
      "--accent-chip": `color-mix(in srgb, ${palette.accent} 12%, ${palette.card})`,
      "--accent-strong": `color-mix(in srgb, ${palette.accent} 18%, ${palette.card})`,
      "--surface-2": `color-mix(in srgb, ${palette.ink} 6%, ${palette.card})`,
      "--surface-3": `color-mix(in srgb, ${palette.ink} 3.5%, ${palette.card})`,
      // A pane is one material wherever it is laid down, and a theme that chose
      // none takes the bar's — which is what every theme written before panes
      // existed carries, drawn exactly as it always was.
      "--pane": fade(pane.ground, pane.fill),
      "--pane-ground-rgb": rgbChannels(pane.ground),
      "--pane-fill": String(pane.fill),
      "--pane-hot": String(pane.hot),
      "--pane-edge": pane.edge,
      "--pane-text": palette.paneText ?? palette.ink,
      // The bar. Charcoal glass over a light page, grey by day, white glass over
      // a painting — the theme's own material where it named one.
      "--nav": rgbChannels(bar.ground),
      "--nav-fill": String(bar.fill),
      "--nav-ink": palette.navText ?? palette.ink,
      "--nav-quiet": bar.quiet,
      "--nav-edge": bar.edge,
      // The three the app's own widgets are made of.
      "--field": field,
      "--sheet": sheet,
      "--button": button,
      "--button-text": buttonText,
      "--button-off": palette.buttonOff ?? fade(palette.ink, 0.35),
      "--good": good,
      "--good-rgb": rgbChannels(good),
      "--bad": bad,
      "--bad-rgb": rgbChannels(bad),
      "--on-good": inkOn(good),
      "--on-bad": inkOn(bad),
      // How hard a shell page's picture is washed, and the colour a chat's is.
      "--scrim": String(palette.scrim),
      "--wall-scrim": String(WALL_SCRIM),
      "--convo-accent": convoPalette.chatTint ?? palette.accent,
      "--convo-bubble-wash": convo.convoBubbleWash,
      "--convo-bubble-edge": convo.convoBubbleEdge,
      "--convo-bubble-run": convo.convoBubbleRun,
      "--convo-out-ink": convo.convoOutInk,
      "--convo-out-dim": convo.convoOutDim,
      "--convo-in-wash": convo.convoInWash,
      "--convo-in-edge": convo.convoInEdge,
      "--convo-in-ink": convo.convoInInk,
      "--convo-in-dim": convo.convoInDim,
    };
    Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
    root.style.colorScheme = palette.isDark ? "dark" : "light";
    root.dataset.theme = design.key;
    root.dataset.dark = String(palette.isDark);
    root.dataset.glassList = String(palette.list === "glass");
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", palette.page);
  }, [palette, design.key, resolvedDark]);

  /**
   * Write a design down and tell the account about it.
   *
   * The order matters and is the app's: the disk first, so the choice survives a
   * reload even if the request never lands, and then the account, because the
   * account is what other people's phones read. A refusal rolls the disk back —
   * a theme the server would not let this person wear must not be left looking
   * worn.
   */
  const equip = useCallback(
    async (next: ThemeDesign, options: { sync?: boolean; silent?: boolean } = {}) => {
      const previous = storedKey;
      setStoredKey(next.key);
      persist(THEME_KEY, next.key);
      setPreviewed(null);
      setPreviewDarkState(null);
      if (!(options.sync ?? true) || status !== "authenticated") {
        if (!options.silent) toast({ title: `${next.name} is on`, tone: "success" });
        return true;
      }
      try {
        const me = await api.patch<Me>("/auth/me/theme/", { theme: next.key });
        updateUser(me);
        if (!options.silent) toast({ title: `${next.name} is on`, tone: "success" });
        return true;
      } catch (error) {
        setStoredKey(previous);
        if (previous) persist(THEME_KEY, previous);
        toast({
          title: "That theme was not applied",
          description: error instanceof Error ? error.message : "The server refused it.",
          tone: "error",
        });
        return false;
      }
    },
    [status, storedKey, toast, updateUser],
  );

  const setDesign = useCallback(
    async (key: string, options: { sync?: boolean; silent?: boolean } = {}) => {
      const next = designForKey(rows, key) ?? designForName(key) ?? bundledByKey(key);
      if (!next) {
        toast({
          title: "This build does not have that theme",
          description: `The server named "${key}", which the web shelf does not carry yet.`,
          tone: "error",
        });
        return false;
      }
      return equip(next, options);
    },
    [rows, equip, toast],
  );

  const previewDesign = useCallback(
    (next: ThemeDesign | string | null) => {
      // A preview opens in the reading the web is already in, so the first thing
      // it shows is the theme as it will actually arrive. See the app's
      // `showThemePreview`, which applies `design.palette(dark: current)`.
      setPreviewDarkState(null);
      if (next === null) {
        setPreviewed(null);
        return;
      }
      if (typeof next !== "string") {
        setPreviewed(next);
        return;
      }
      const design = designForKey(rows, next) ?? designForName(next) ?? bundledByKey(next);
      if (design) setPreviewed(design);
    },
    [rows],
  );

  const clearPreview = useCallback(() => {
    setPreviewed(null);
    setPreviewDarkState(null);
  }, []);

  const setPreviewDark = useCallback((dark: boolean) => setPreviewDarkState(dark), []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    persist(MODE_KEY, next);
  }, []);

  const artFor = useCallback(
    (page: ShellPage | null) => {
      // A screen that is not one of the shell's five tabs has no painted
      // backdrop of its own: it is a route somebody pushed over the shell and
      // reads on the theme's own ground.
      if (!page) return null;
      return shown.art[page] ?? null;
    },
    [shown],
  );

  const backdropFor = useCallback(
    (page: ShellPage | null): ScreenBackdrop | null => {
      const art = artFor(page);
      if (!art) return null;
      const pageVeil = page ? shown.veils[page] : undefined;
      return {
        art,
        // The page's own veil when a row gave one, the theme's scrim otherwise.
        // Every theme the app ships carries one scrim and reads it everywhere,
        // and it is zero on every theme read light — which is why a light theme
        // has never been drawn under a slab.
        veil: pageVeil ?? palette.scrim,
        wash: "#13131A",
        crop: (page ? shown.frames[page] : undefined) ?? null,
      };
    },
    [artFor, shown, palette.scrim],
  );

  const profileBackdrop = useMemo<ScreenBackdrop | null>(() => {
    if (!shown.profileWall) return null;
    return {
      art: shown.profileWall,
      veil: palette.scrim,
      wash: "#13131A",
      crop: shown.profileFrame,
    };
  }, [shown.profileWall, shown.profileFrame, palette.scrim]);

  const coverBackdrop = useMemo<ScreenBackdrop | null>(() => {
    if (!shown.coverArt) return null;
    return { art: shown.coverArt, veil: 0, wash: "#13131A", crop: shown.coverFrame };
  }, [shown.coverArt, shown.coverFrame]);

  const chatBackdrop = useMemo<ScreenBackdrop | null>(() => {
    if (!shown.chatWall) return null;
    return {
      art: shown.chatWall,
      // The flat wash every built-in wallpaper is read through, or the veil its
      // own row named in the panel.
      veil: shown.chatVeil ?? WALL_SCRIM,
      // The page's own ink and not the near-black scrim a shell page's picture
      // is darkened with: a chat is a page of words behind a picture at
      // whatever hour the app is being read.
      wash: palette.page,
      crop: shown.chatFrame,
    };
  }, [shown.chatWall, shown.chatVeil, shown.chatFrame, palette.page]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      design,
      selectedDesign,
      palette,
      accentAt: (index: number) => accentAt(palette, index),
      mode,
      resolvedDark,
      row: selectedRow,
      catalogued: Boolean(catalogue),
      themes: bundledThemes,
      shelf: shelfDesigns(rows),
      setDesign,
      equip,
      previewDesign,
      clearPreview,
      setPreviewDark,
      setMode,
      artFor,
      backdropFor,
      profileBackdrop,
      coverBackdrop,
      chatBackdrop,
      styled: shown,
    }),
    [
      design,
      selectedDesign,
      palette,
      mode,
      resolvedDark,
      selectedRow,
      catalogue,
      rows,
      setDesign,
      equip,
      previewDesign,
      clearPreview,
      setPreviewDark,
      setMode,
      artFor,
      backdropFor,
      profileBackdrop,
      coverBackdrop,
      chatBackdrop,
      shown,
    ],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
