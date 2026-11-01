import type { ThemeMark } from "@/theme/ThemeMarkArt";

export type ShellPage = "drops" | "moments" | "convo" | "audio" | "live";

/** The bar a reading wears. See `XChrome` on the Android side. */
export type ChromeKind = "glass" | "dark" | "grey";

/** What a pane in a glass list is made of. See `XPane`. */
export type PaneKind = "ink" | "glass";

/** Ruled rows, or panes floating over the page. See `XListStyle`. */
export type ListStyle = "flush" | "glass";

export interface ThemePalette {
  accent: string;
  accentPill: string;
  page: string;
  card: string;
  line: string;
  ink: string;
  dim: string;
  onAccent: string;
  isDark: boolean;
  scrim: number;
  /**
   * The bar this reading asks for.
   *
   * A theme that names one keeps it — a designed theme brings its own, and a
   * night that wants the charcoal says so. One that names none is the app's
   * own: grey by day, charcoal at night. See `XTheme.chrome`. Left off the
   * entries that declare nothing, so the day/night question stays open.
   */
  chrome?: ChromeKind;
  /** The pane a glass list is made of, or nothing for the bar's material. */
  pane?: PaneKind | null;
  /** Whether the convo list is panes or ruled rows. */
  list?: ListStyle;
  /** The colours a mixed theme leads with. Nothing for a designed one. */
  tones?: string[];
  /**
   * The colours a server row may lay over this reading — §2 of `theme.dart`.
   *
   * A token that is not here keeps the value the design already had, so a row
   * may say `accent` and nothing else and every other colour still comes from
   * the design. Only ever set by `paletteWithTokens`.
   */
  field?: string;
  sheet?: string;
  button?: string;
  buttonText?: string;
  buttonOff?: string;
  good?: string;
  bad?: string;
  chatTint?: string;
  bubbleOut?: string;
  bubbleOutText?: string;
  bubbleIn?: string;
  bubbleInText?: string;
  navGround?: string;
  navFill?: number;
  navQuiet?: string;
  navEdge?: string;
  navText?: string;
  paneGround?: string;
  paneFill?: number;
  paneHot?: number;
  paneEdge?: string;
  paneText?: string;
}

/**
 * One of the eight colours a theme can be mixed from, in the order the picker
 * lays them out.
 *
 * All chosen to the same rule: dark enough as text on white, lifted on the
 * pill. A bright yellow cannot be — #FFC107 as text on white is 1.7:1, which is
 * not a faint colour but an unreadable one — so "Yellow" here is the deepest
 * gold that still clears the bar, and it is the *pill* that carries the bright
 * one. See `XTones`.
 */
export interface Tone {
  name: string;
  on: string;
  pill: string;
}

export const TONES: Tone[] = [
  { name: "Pink", on: "#E31B66", pill: "#E31B66" },
  { name: "Red", on: "#C62828", pill: "#FF6B6B" },
  { name: "Yellow", on: "#9A6E00", pill: "#FFC53D" },
  { name: "Green", on: "#2E7D32", pill: "#69DB7C" },
  { name: "Teal", on: "#0E7C8C", pill: "#3DD6E8" },
  { name: "Blue", on: "#1565C0", pill: "#5AA9FF" },
  { name: "Violet", on: "#6A1B9A", pill: "#C77DFF" },
  { name: "Slate", on: "#37474F", pill: "#A9B6BF" },
];

export interface ThemeDesign {
  key: string;
  name: string;
  mood: string;
  character: string;
  mark: ThemeMark;
  price: number;
  /** The poster in its dark reading, which `coverFor` falls back to. */
  cover: string;
  /** The same poster in the light reading, or nothing for a painting. */
  coverLight?: string;
  /**
   * A face that comes *with* the theme, offered when the theme is put on.
   *
   * Not the same thing as [profileWall], and the two are deliberately kept
   * apart: this is a picture the preview offers to make the account's avatar,
   * and that is the wallpaper the profile screen draws behind it. Teddy's are
   * the same file; Anime Blue's and Alone's are not.
   */
  profile?: string;
  /** And a cover that comes with it, offered by the same switch. */
  profileCover?: string;
  /**
   * The pictures the two pushed screens draw with, which are the app's
   * `XTheme.profileWall`, `XTheme.coverArt` and `XTheme.chatWall`.
   *
   * The five tabs come from [art]; a profile and the inside of a chat are
   * routes over the shell rather than tabs of it, so the app carries their
   * pictures on the theme instead of in the backdrop — and a theme of colours
   * has none of the three.
   */
  profileWall?: string;
  /** The band drawn over [profileWall]. */
  coverArt?: string;
  /**
   * The wallpaper behind an open chat.
   *
   * It ranks *below* a wallpaper somebody picked for a thread and below a photo
   * they sent, both of which outrank a theme — see `apps.chat`'s own order.
   */
  chatWall?: string;
  art?: { page?: string } | Partial<Record<ShellPage, string>>;
  light: ThemePalette;
  dark: ThemePalette;
  /**
   * Whether this design is one the Studio authored — a row in the catalogue
   * rather than a design written into the build.
   *
   * It matters in exactly one place: the ladder. A bundled design's rung is
   * found by `tierOf`, and a design the ladder has never heard of falls back to
   * the floor — which is *included*, which would make every theme staff
   * authored free to wear. A custom design is priced by its row and gated on
   * owning it, never on a rung. See `XDesign.custom`.
   */
  custom?: boolean;
  /** The server's colour tokens, laid over the design. See `withTokens`. */
  tokens?: ThemeTokens | null;
}

/**
 * One reading's colour tokens, as the Style Studio panel writes them.
 *
 * Declared here rather than beside the reading functions in `shelf.ts` because
 * a design *carries* them: a catalogue row lays these over the palette the
 * design was built with, and the design has to be able to say what it may be
 * given. `shelf.ts` reads them; this file holds the vocabulary.
 */
export interface ThemeTokenGroup {
  accent?: string;
  text?: string;
  dim?: string;
  ink?: string;
  card?: string;
  line?: string;
  scrim?: number;
  field?: string;
  sheet?: string;
  button?: string;
  button_text?: string;
  button_disabled?: string;
  good?: string;
  bad?: string;
  chat_tint?: string;
  bubble_out?: string;
  bubble_out_text?: string;
  bubble_in?: string;
  bubble_in_text?: string;
  nav_ground?: string;
  nav_fill?: number;
  nav_quiet?: string;
  nav_edge?: string;
  nav_text?: string;
  pane_ground?: string;
  pane_fill?: number;
  pane_hot?: number;
  pane_edge?: string;
  pane_text?: string;
}

/** The vocabulary a catalogue row may speak: a light group, a dark one, and three words. */
export interface ThemeTokens {
  light?: ThemeTokenGroup;
  dark?: ThemeTokenGroup;
  /** `dark` | `grey` | `glass` — the bar's material. */
  nav?: string;
  /** `ink` | `glass` | `inherit` — the pane's. */
  panes?: string;
  /** `flush` | `glass` — the list's shape. */
  list?: string;
}

export const designedThemes: ThemeDesign[] = [
  {
    key: "pink",
    name: "Pink",
    mood: "The app as it was drawn. Nothing to explain.",
    character: "Pip",
    mark: "blob",
    price: 0,
    cover: "/themes/covers/pink.png",
    coverLight: "/themes/covers/pink_light.png",
    light: {
      accent: "#E31B66",
      accentPill: "#E31B66",
      page: "#F7F7FB",
      card: "#FFFFFF",
      line: "#E3E3EC",
      ink: "#13131A",
      dim: "#6B6B7B",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#E8558A",
      accentPill: "#E31B66",
      page: "#12121A",
      card: "#1C1C26",
      line: "#2C2C38",
      ink: "#F2F2F7",
      dim: "#A9A9BC",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "unicorn",
    name: "Unicorn",
    mood: "A page somebody painted, and the ink that reads on it.",
    character: "Nix",
    mark: "horn",
    price: 0,
    cover: "/themes/covers/unicorn.png",
    coverLight: "/themes/covers/unicorn_light.png",
    art: { page: "/themes/unicorn/page.jpg" },
    light: {
      accent: "#9C0E4A",
      accentPill: "#9C0E4A",
      page: "#F7F7FB",
      card: "#FFFFFF",
      line: "#E3E3EC",
      ink: "#9C0E4A",
      dim: "#8A4462",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FFD9E6",
      accentPill: "#FF9EC6",
      page: "#241020",
      card: "#30182C",
      line: "#452138",
      ink: "#FFD9E6",
      dim: "#E0A9C0",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0.65,
    },
  },
  {
    key: "catgirl",
    name: "Cat Girl",
    mood: "A rooftop over a city that never turns its lights off.",
    character: "Nya",
    mark: "cloud",
    price: 0,
    cover: "/themes/covers/catgirl.png",
    art: {
      drops: "/themes/catgirl/drops.jpg",
      moments: "/themes/catgirl/moment.jpg",
      convo: "/themes/catgirl/convo.jpg",
      audio: "/themes/catgirl/audio.jpg",
      live: "/themes/catgirl/live.jpg",
    },
    light: {
      accent: "#FF5AA0",
      accentPill: "#FF6FAE",
      page: "#0B050C",
      card: "#1B0F1D",
      line: "#33203A",
      ink: "#FFE3EF",
      dim: "#C79BB4",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
    dark: {
      accent: "#FF7FB8",
      accentPill: "#FF6FAE",
      page: "#050208",
      card: "#120A14",
      line: "#2A1930",
      ink: "#F3D9E6",
      dim: "#B08CA0",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0.45,
    },
  },
  {
    key: "monsoon",
    name: "Monsoon",
    mood: "Rain on the window and the blue hour after it.",
    character: "Drip",
    mark: "cup",
    price: 60,
    cover: "/themes/covers/monsoon.png",
    coverLight: "/themes/covers/monsoon_light.png",
    light: {
      accent: "#1B4E7A",
      accentPill: "#3D9BE9",
      page: "#EFF3F9",
      card: "#FFFFFF",
      line: "#DCE4EF",
      ink: "#10243A",
      dim: "#4E6379",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#7FC4FF",
      accentPill: "#3D9BE9",
      page: "#0B1219",
      card: "#141E29",
      line: "#222E3C",
      ink: "#E6EEF7",
      dim: "#9FB2C4",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "chai",
    name: "Chai",
    mood: "A glass of it on a marble table, and the smell of the leaves.",
    character: "Sip",
    mark: "bolt",
    price: 60,
    cover: "/themes/covers/chai.png",
    coverLight: "/themes/covers/chai_light.png",
    light: {
      accent: "#8C4A1E",
      accentPill: "#E08A3C",
      page: "#FBF6EF",
      card: "#FFFFFF",
      line: "#EBDCC9",
      ink: "#3A2418",
      dim: "#7A6350",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#F0A85E",
      accentPill: "#E08A3C",
      page: "#191210",
      card: "#231A16",
      line: "#33261F",
      ink: "#F6EDE4",
      dim: "#C4AE9A",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "neon",
    name: "Neon",
    mood: "A sign left on in an empty arcade.",
    character: "Volt",
    mark: "flower",
    price: 60,
    cover: "/themes/covers/neon.png",
    coverLight: "/themes/covers/neon_light.png",
    light: {
      accent: "#7A6C00",
      accentPill: "#E8FF3D",
      page: "#F2F4EC",
      card: "#FFFFFF",
      line: "#DDE2D0",
      ink: "#161A0C",
      dim: "#616B44",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#D7F53C",
      accentPill: "#E8FF3D",
      page: "#0C0F08",
      card: "#14180D",
      line: "#232A17",
      ink: "#EAF7D8",
      dim: "#A7B48C",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "orchid",
    name: "Orchid",
    mood: "One stem in a glass bottle, and the light through it.",
    character: "Bloom",
    mark: "shell",
    price: 200,
    cover: "/themes/covers/orchid.png",
    coverLight: "/themes/covers/orchid_light.png",
    light: {
      accent: "#7B2D8E",
      accentPill: "#D982F0",
      page: "#F8F2FB",
      card: "#FFFFFF",
      line: "#E6D8EE",
      ink: "#3B1B45",
      dim: "#7A5B85",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#D98CF0",
      accentPill: "#D982F0",
      page: "#160E1C",
      card: "#1F1526",
      line: "#2E2038",
      ink: "#F3E7F8",
      dim: "#BCA6C6",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "tidepool",
    name: "Tidepool",
    mood: "Knee-deep, looking straight down at the bottom.",
    character: "Cowrie",
    mark: "flame",
    price: 200,
    cover: "/themes/covers/tidepool.png",
    coverLight: "/themes/covers/tidepool_light.png",
    light: {
      accent: "#0F6E79",
      accentPill: "#3FD8E8",
      page: "#EDF6F6",
      card: "#FFFFFF",
      line: "#D2E6E6",
      ink: "#0E3A3F",
      dim: "#4A757A",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#5FE4F0",
      accentPill: "#3FD8E8",
      page: "#07161A",
      card: "#0F2026",
      line: "#1C3038",
      ink: "#E2F3F5",
      dim: "#96B6BC",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "ember",
    name: "Ember",
    mood: "The last hour of a fire, when it is all glow and no flame.",
    character: "Cinder",
    mark: "star",
    price: 200,
    cover: "/themes/covers/ember.png",
    coverLight: "/themes/covers/ember_light.png",
    light: {
      accent: "#A3301B",
      accentPill: "#FF7043",
      page: "#FBF2EC",
      card: "#FFFFFF",
      line: "#EBD8CA",
      ink: "#45180F",
      dim: "#86604F",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FF8A5C",
      accentPill: "#FF7043",
      page: "#150D0A",
      card: "#1E1310",
      line: "#2E1D18",
      ink: "#F7E8E0",
      dim: "#C5A597",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "cosmos",
    name: "Cosmos",
    mood: "A clear night away from every city.",
    character: "Nova",
    mark: "blossom",
    price: 450,
    cover: "/themes/covers/cosmos.png",
    coverLight: "/themes/covers/cosmos_light.png",
    light: {
      accent: "#1B3F8F",
      accentPill: "#6E9BFF",
      page: "#EEF1FA",
      card: "#FFFFFF",
      line: "#D8DEEE",
      ink: "#101A3A",
      dim: "#4E5C85",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#8FB4FF",
      accentPill: "#6E9BFF",
      page: "#080C1C",
      card: "#111731",
      line: "#1F2745",
      ink: "#E4E9FA",
      dim: "#9AA6C8",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "sakura",
    name: "Sakura",
    mood: "A week in spring, and then the pavement is pink.",
    character: "Momo",
    mark: "sun",
    price: 450,
    cover: "/themes/covers/sakura.png",
    coverLight: "/themes/covers/sakura_light.png",
    light: {
      accent: "#B02B62",
      accentPill: "#FF8FB0",
      page: "#FDF2F5",
      card: "#FFFFFF",
      line: "#EFD9E0",
      ink: "#4A1B2E",
      dim: "#8A6472",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FF9EC0",
      accentPill: "#FF8FB0",
      page: "#170F14",
      card: "#20161C",
      line: "#301F27",
      ink: "#FAE6EE",
      dim: "#C6A3AF",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "marigold",
    name: "Marigold",
    mood: "Strung across a doorway for somebody coming home.",
    character: "Sunny",
    mark: "ribbon",
    price: 450,
    cover: "/themes/covers/marigold.png",
    coverLight: "/themes/covers/marigold_light.png",
    light: {
      accent: "#96610A",
      accentPill: "#FFB01F",
      page: "#FDF6E8",
      card: "#FFFFFF",
      line: "#EFE0C2",
      ink: "#4B3407",
      dim: "#826839",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FFC24D",
      accentPill: "#FFB01F",
      page: "#16110A",
      card: "#1F1810",
      line: "#2F2418",
      ink: "#FBF0D8",
      dim: "#C9B58C",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "aurora",
    name: "Aurora",
    mood: "Standing outside at two in the morning, too cold to talk.",
    character: "Vela",
    mark: "shard",
    price: 1500,
    cover: "/themes/covers/aurora.png",
    coverLight: "/themes/covers/aurora_light.png",
    light: {
      accent: "#1F7A6E",
      accentPill: "#4FE3C1",
      page: "#EEF7F5",
      card: "#FFFFFF",
      line: "#D5E9E4",
      ink: "#123027",
      dim: "#48695F",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#6BEDCE",
      accentPill: "#4FE3C1",
      page: "#0A1512",
      card: "#122019",
      line: "#1E2F28",
      ink: "#E2F6EF",
      dim: "#9CC4B8",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "obsidian",
    name: "Obsidian",
    mood: "Black stone with one warm seam running through it.",
    character: "Flint",
    mark: "feather",
    price: 1500,
    cover: "/themes/covers/obsidian.png",
    coverLight: "/themes/covers/obsidian_light.png",
    light: {
      accent: "#3C4450",
      accentPill: "#A9B6BF",
      page: "#F3F4F6",
      card: "#FFFFFF",
      line: "#DFE1E5",
      ink: "#232A33",
      dim: "#66707C",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#C3CED6",
      accentPill: "#A9B6BF",
      page: "#0D1013",
      card: "#161A1F",
      line: "#232931",
      ink: "#EDEFF2",
      dim: "#A3ACB6",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "peacock",
    name: "Peacock",
    mood: "One feather, held up to the light at the right angle.",
    character: "Plume",
    mark: "ring",
    price: 1500,
    cover: "/themes/covers/peacock.png",
    coverLight: "/themes/covers/peacock_light.png",
    light: {
      accent: "#0E5C7A",
      accentPill: "#38C7E8",
      page: "#EEF6F9",
      card: "#FFFFFF",
      line: "#D3E5EC",
      ink: "#0C3243",
      dim: "#456A7A",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#5CD7F0",
      accentPill: "#38C7E8",
      page: "#061318",
      card: "#0D1E26",
      line: "#1A2D37",
      ink: "#E1F1F7",
      dim: "#93AFBB",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "solaris",
    name: "Solaris",
    mood: "Midday in a hot country, shutters half closed.",
    character: "Helio",
    mark: "swirl",
    price: 4000,
    cover: "/themes/covers/solaris.png",
    coverLight: "/themes/covers/solaris_light.png",
    light: {
      accent: "#8F5B00",
      accentPill: "#FFB627",
      page: "#FCF6EA",
      card: "#FFFFFF",
      line: "#EDE0C6",
      ink: "#4A2E06",
      dim: "#87693A",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FFC44D",
      accentPill: "#FFB627",
      page: "#15100A",
      card: "#1E1710",
      line: "#2E2318",
      ink: "#FBEFD6",
      dim: "#C7B187",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "nebula",
    name: "Nebula",
    mood: "Something enormous, very far away, and mostly pink.",
    character: "Nimbus",
    mark: "eclipse",
    price: 4000,
    cover: "/themes/covers/nebula.png",
    coverLight: "/themes/covers/nebula_light.png",
    light: {
      accent: "#A02E8B",
      accentPill: "#F06FD8",
      page: "#FAF1F7",
      card: "#FFFFFF",
      line: "#EBD7E6",
      ink: "#3D1038",
      dim: "#7E5477",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#F78FE4",
      accentPill: "#F06FD8",
      page: "#160B16",
      card: "#1F1020",
      line: "#2E1B2E",
      ink: "#F7E4F4",
      dim: "#C4A3C0",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
  {
    key: "eclipse",
    name: "Eclipse",
    mood: "The ring of light left round something black.",
    character: "Corona",
    mark: "paw",
    price: 4000,
    cover: "/themes/covers/eclipse.png",
    coverLight: "/themes/covers/eclipse_light.png",
    light: {
      accent: "#8A3D0F",
      accentPill: "#FF8A3D",
      page: "#F6F2FA",
      card: "#FFFFFF",
      line: "#E2DAEE",
      ink: "#2A1E42",
      dim: "#675C82",
      onAccent: "#FFFFFF",
      isDark: false,
      scrim: 0,
    },
    dark: {
      accent: "#FF9E5C",
      accentPill: "#FF8A3D",
      page: "#0E0A16",
      card: "#171024",
      line: "#241A34",
      ink: "#EFE8FB",
      dim: "#B0A2CE",
      onAccent: "#13131A",
      isDark: true,
      scrim: 0,
    },
  },
];

