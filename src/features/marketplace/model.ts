// What the marketplace's rows *are*, once they are off the wire.
//
// A catalogue row is the server's word about something the app already draws;
// this file is the one place that word is turned into the shapes the rest of
// the web knows — a `ThemeDesign` the provider can wear, a plate the logo shelf
// can sell, a figure the convo can stand. Ported from `XShop.byKey`,
// `XShop.studioOf`, `XLogos.shelf` and `Catalogue`'s figure helpers, rule for
// rule, because the whole point of the marketplace is that the two shelves
// agree.
//
// The reading everywhere here is §0: a row that says nothing leaves the design
// exactly as it was. Only `source == "custom"` and a key no design in this
// build answers for becomes a *new* theme; every other row is an overlay.

import type { CSSProperties } from "react";
import { designedThemes, type ShellPage, type ThemeDesign } from "@/theme/catalog";
import { bundledByKey, paletteWithTokens } from "@/theme/shelf";
import type { CatalogueLogo, CataloguePageRow, CatalogueTheme, Crop, FigurePlacement, FigurePick } from "./types";

/** The app's own theme — what a Studio row is built from. See `XThemes.own`. */
const OWN = designedThemes[0];

/** The app's own plate. See `XLogos.own`. */
export const OWN_LOGO = "pink";

/** The figure the app has always had, answered from the bundle. See `kClassicKey`. */
export const CLASSIC_FIGURE = "classic";

/** The figure's three moments, in the order the switch lays them out. */
export const FIGURE_POSES = ["wait", "typing", "bio"] as const;
export type FigurePose = (typeof FIGURE_POSES)[number];

/** The bundled poses, drawn when a row has nothing of its own. */
export const BUNDLED_POSES: Record<FigurePose, string> = {
  wait: "/char/wait.png",
  typing: "/char/typing.png",
  bio: "/char/bio.png",
};

/** A figure's three pictures, at most. Null where a pose has none. */
export interface FigureArt {
  wait?: string | null;
  typing?: string | null;
  bio?: string | null;
}

// ---------------------------------------------------------------------------
// Framing
// ---------------------------------------------------------------------------

/**
 * The crop in [value], or nothing when the row did not send one.
 *
 * Tolerant on purpose, the way `XFrame.fromJson` is: a crop that is not an
 * object, a number that is not a number, or a point outside the picture is read
 * as "no framing" rather than as a reason to fail the whole shelf. The app's own
 * framing — centre, no zoom — comes back as nothing, because a row that wrote it
 * down made no decision.
 */
export function readCrop(value: unknown): Crop | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const number = (key: string): number | null => {
    const raw = row[key];
    return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
  };
  const x = number("x");
  const y = number("y");
  const zoom = number("zoom");
  if (x === null && y === null && zoom === null) return null;
  const frame: Crop = {
    x: Math.min(1, Math.max(0, x ?? 0.5)),
    y: Math.min(1, Math.max(0, y ?? 0.5)),
    zoom: Math.min(4, Math.max(1, zoom ?? 1)),
  };
  const plain =
    Math.abs(frame.x - 0.5) < 0.0005 &&
    Math.abs(frame.y - 0.5) < 0.0005 &&
    Math.abs(frame.zoom - 1) < 0.0005;
  return plain ? null : frame;
}

/**
 * How [crop] is drawn, as CSS.
 *
 * The app's arithmetic is `left = (frame - drawn) * x` with the picture scaled
 * by `zoom` about that same point, which is exactly what `object-position`
 * does to a `cover`-fitted image plus a `scale` about that fraction of the
 * frame. One reading, so a picture framed in the panel and a picture framed on
 * the web show the same part of the same file.
 */
export function cropStyle(crop: Crop | null | undefined): CSSProperties {
  if (!crop) return {};
  const x = `${crop.x * 100}%`;
  const y = `${crop.y * 100}%`;
  return {
    objectPosition: `${x} ${y}`,
    transform: crop.zoom === 1 ? undefined : `scale(${crop.zoom})`,
    transformOrigin: `${x} ${y}`,
  };
}

// ---------------------------------------------------------------------------
// One theme row
// ---------------------------------------------------------------------------

/** The row the catalogue holds for [key], or nothing when it holds none. */
export function rowForKey(themes: CatalogueTheme[], key: string | null | undefined): CatalogueTheme | null {
  const wanted = (key ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return themes.find((row) => row.key.trim().toLowerCase() === wanted) ?? null;
}

/** Whether this row is on the shelf right now. See `services.on_shelf`. */
export function isLive(row: { state: string }): boolean {
  return row.state === "live";
}

/**
 * The design a Studio row describes — the twin of `XShop.studioOf`.
 *
 * The app's own words and colours are the floor: a row that names nothing is
 * still a theme, and it is Pip's. A row for a key this build already ships is
 * **not** this function's business — see [designForRow], which hands back the
 * bundled design for those, because a row for a bundled key is an override of
 * a design rather than a design of its own.
 */
export function studioDesign(row: CatalogueTheme): ThemeDesign {
  return {
    key: row.key,
    name: row.name.trim() || row.key,
    mood: row.mood,
    character: OWN.character,
    mark: OWN.mark,
    price: row.price,
    cover: row.cover ?? "",
    coverLight: row.cover_light ?? undefined,
    profile: row.face ?? undefined,
    profileCover: row.face_cover ?? undefined,
    light: paletteWithTokens(OWN.light, row.tokens),
    dark: paletteWithTokens(OWN.dark, row.tokens),
    custom: true,
    tokens: row.tokens,
  };
}

/**
 * The design [key] names on this build, bundled or authored.
 *
 * The bundled design answers first and by key *or* name, because the two themes
 * that existed before the shop were written down by name and an account that has
 * been wearing Unicorn for a week must not lose it. A key nothing here answers
 * for is looked for among the Studio's own rows — which is the whole of "a theme
 * staff put up is a theme the app can wear".
 *
 * The overlay a row puts on a *bundled* key — its colours, its price, its
 * windows — is not applied here: it belongs to the reading, and the reading is
 * `ThemeProvider`'s. Applying it here as well would be the theme twice.
 */
export function designForKey(themes: CatalogueTheme[], key: string | null | undefined): ThemeDesign | null {
  const wanted = (key ?? "").trim();
  if (!wanted) return null;
  const lower = wanted.toLowerCase();
  const bundled = bundledByKey(wanted) ?? designedThemes.find((design) => design.name.toLowerCase() === lower);
  if (bundled) return bundled;
  const row = rowForKey(themes, wanted);
  if (!row || row.source !== "custom") return null;
  return studioDesign(row);
}

/**
 * The design a row describes, for the shelf: the bundled design when this build
 * ships the key, the Studio's own when the row authored one.
 */
export function designForRow(row: CatalogueTheme): ThemeDesign | null {
  const bundled = bundledByKey(row.key);
  if (bundled) return bundled;
  if (row.source !== "custom") return null;
  return studioDesign(row);
}

/**
 * The shelf, as the panel has it. See `_ThemeShopViewState._shelf`.
 *
 * Two rules and no third:
 *
 *   * **No catalogue, no new rule.** A fetch that never landed draws the short
 *     shelf this build ships — the default and the three paintings — exactly as
 *     it did before the Style Studio existed.
 *   * **A row that is not live is not a tile.** And **nothing beside the rows**:
 *     a payload that arrived and says nothing about a bundled key is the panel
 *     saying "not on the shelf", not the panel saying nothing. A design the
 *     catalogue has no row for is not drawn.
 */
export const FALLBACK_SHELF_KEYS = ["pink", "teddy", "animeblue", "alone"] as const;

export function shelfDesigns(rows: CatalogueTheme[]): ThemeDesign[] {
  if (rows.length === 0) {
    return FALLBACK_SHELF_KEYS.map((key) => bundledByKey(key)).filter(
      (design): design is ThemeDesign => Boolean(design),
    );
  }
  const drawn = new Set<string>();
  const out: ThemeDesign[] = [];
  for (const row of rows) {
    const design = designForRow(row);
    if (!design || drawn.has(design.key)) continue;
    if (!isLive(row)) continue;
    drawn.add(design.key);
    out.push(design);
  }
  return out;
}

// ---------------------------------------------------------------------------
// One theme's figure
// ---------------------------------------------------------------------------

/** Whether [row] carries any picture at all for [gender]. */
export function hasFigure(row: CatalogueTheme, gender: "boy" | "girl"): boolean {
  const key = gender === "boy" ? "character_boy_" : "character_girl_";
  return FIGURE_POSES.some((pose) => Boolean(row[`${key}${pose}` as keyof CatalogueTheme]));
}

/** Which of [row]'s two sets its figure is drawn from. See `drawn_gender`. */
export function drawnGender(row: CatalogueTheme): "boy" | "girl" | "" {
  const pick: FigurePick = row.figure_pick;
  if (pick && hasFigure(row, pick)) return pick;
  if (hasFigure(row, "boy")) return "boy";
  if (hasFigure(row, "girl")) return "girl";
  return "";
}

/** One pose of one of the row's two characters, through the server's chain. */
export function figurePose(row: CatalogueTheme, gender: "boy" | "girl", pose: FigurePose): string | null {
  const own = row[`character_${gender}_${pose}` as keyof CatalogueTheme];
  if (typeof own === "string" && own) return own;
  const other = gender === "boy" ? "girl" : "boy";
  const theirs = row[`character_${other}_${pose}` as keyof CatalogueTheme];
  if (typeof theirs === "string" && theirs) return theirs;
  const resolved = row[`character_${pose}` as keyof CatalogueTheme];
  return typeof resolved === "string" && resolved ? resolved : null;
}

/** The one picture a tile draws for the row's figure, or nothing. */
export function figurePreviewPose(row: CatalogueTheme): string | null {
  const gender = drawnGender(row);
  if (!gender) return null;
  return figurePose(row, gender, "wait") ?? figurePose(row, gender, "typing") ?? figurePose(row, gender, "bio");
}

// ---------------------------------------------------------------------------
// Figures on the Drip shelf
// ---------------------------------------------------------------------------

/** A figure as the Drip shelf and the theme rows both describe one. */
export interface FigureLike {
  key: string;
  name: string;
  tagline?: string;
  price?: number;
  owned?: boolean;
  worn?: boolean;
  wait?: string | null;
  typing?: string | null;
  bio?: string | null;
  placement?: FigurePlacement;
}

/**
 * Which picture of [figure] stands for [moment]. See `artFor`.
 *
 * The app's own figure is answered from the *bundle* and not from its shelf
 * row, which is the whole reason this is a function rather than three field
 * reads: the uploads on its row are only ever a copy of the art as it was the
 * day the shelf was seeded, so a build that replaced the figure would go on
 * drawing the old one on the shop's first tile while every convo drew the new
 * one.
 */
export function figureArt(figure: FigureLike, moment: FigurePose): string | null {
  if (figure.key === CLASSIC_FIGURE) return BUNDLED_POSES[moment];
  const at = figure[moment];
  return at ? at : null;
}

/** The three poses of [figure], with the fallback chain the app draws with. */
export function figurePoses(figure: FigureLike): FigureArt {
  const wait = figureArt(figure, "wait");
  const typing = figureArt(figure, "typing");
  const bio = figureArt(figure, "bio");
  return {
    wait: wait ?? typing ?? bio,
    typing: typing ?? wait ?? bio,
    // A bio is optional in a way the other two are not: an empty one means this
    // figure has nothing to say standing beside a profile, and the screen draws
    // no switch for it rather than repeating the waiting pose.
    bio: bio,
  };
}

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

/** One plate on the logo shelf. See `XLogoDesign`. */
export interface LogoPlate {
  key: string;
  name: string;
  price: number;
  /** The picture actually drawn: the upload when there is one, the bundle otherwise. */
  picture: string;
  /** The bundled file, kept for the plate's own fallback. */
  fallback: string;
  /** Whether this one is the app's own, and so free to everybody. */
  isAppDefault: boolean;
}

const BUILTIN_LOGOS: ReadonlyArray<{ key: string; name: string; price: number }> = [
  { key: "pink", name: "Pink", price: 0 },
  { key: "rose", name: "Rose", price: 60 },
  { key: "peach", name: "Peach", price: 60 },
  { key: "gold", name: "Gold", price: 60 },
  { key: "lime", name: "Lime", price: 60 },
  { key: "mint", name: "Mint", price: 60 },
  { key: "teal", name: "Teal", price: 60 },
  { key: "sky", name: "Sky", price: 60 },
  { key: "azure", name: "Azure", price: 60 },
  { key: "violet", name: "Violet", price: 60 },
  { key: "fuchsia", name: "Fuchsia", price: 60 },
  // The one plate whose ground is dark — the only logo here that is not the
  // same drawing read in another colour, and priced above the rest for it.
  { key: "midnight", name: "Midnight", price: 120 },
];

/** The plate's file in this build, derived from the key and never written twice. */
export function bundledPlate(key: string): string {
  return `/logos/${key}.webp`;
}

/** The bundled shelf, in the order the shop lays it out. */
export const builtinLogos: LogoPlate[] = BUILTIN_LOGOS.map((design) => ({
  key: design.key,
  name: design.name,
  price: design.price,
  picture: bundledPlate(design.key),
  fallback: bundledPlate(design.key),
  isAppDefault: design.price === 0,
}));

/**
 * The plate [key] names in this build, or nothing — matched without regard to
 * case, because a row's key is written by hand in the panel and comes back
 * spelled however the person typed it.
 */
export function builtinPlate(key: string | null | undefined): LogoPlate | null {
  const wanted = (key ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return builtinLogos.find((design) => design.key.toLowerCase() === wanted) ?? null;
}

/** A key spelled as a name, for a row that gave none. See `_titled`. */
function titled(key: string): string {
  if (!key) return key;
  return key
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * The shelf as the server says it is, or the bundled one when it says nothing.
 *
 * **An empty list is not an empty shelf, it is a silent server** — §0 — so this
 * hands back `builtinLogos` itself and a shelf that reached no catalogue behaves
 * exactly as it did before any of this existed. One plate per row, in the row's
 * own order, with the row's name, price and art; and two fallbacks that keep a
 * row an override rather than a stub:
 *
 *   * An empty `name` falls back to the name the build gives that key, and then
 *     to the key spelled as a name.
 *   * A row whose key this build does not carry **and** which brings no picture
 *     is skipped: there is no file for the key and no art to draw, so the plate
 *     would be a hole.
 */
export function logoPlateShelf(rows: CatalogueLogo[]): LogoPlate[] {
  if (rows.length === 0) return builtinLogos;
  const out: LogoPlate[] = [];
  for (const row of rows) {
    const bundled = builtinPlate(row.key);
    const art = row.art ?? "";
    if (!bundled && !art) continue;
    out.push({
      key: row.key,
      name: row.name || bundled?.name || titled(row.key),
      price: row.price,
      picture: art || bundled?.picture || "",
      fallback: bundled?.picture ?? "",
      isAppDefault: row.price === 0,
    });
  }
  return out;
}

/** The plate [key] names on [shelf], or nothing when that shelf lacks it. */
export function plateOnShelf(shelf: LogoPlate[], key: string | null | undefined): LogoPlate | null {
  const wanted = (key ?? "").trim().toLowerCase();
  if (!wanted) return null;
  return shelf.find((design) => design.key.toLowerCase() === wanted) ?? null;
}

/**
 * The app's own plate as [shelf] has it — renamed, repriced or redrawn if the
 * server said so — and the bundled one when the shelf is not carrying it.
 */
export function ownPlate(shelf: LogoPlate[]): LogoPlate {
  return plateOnShelf(shelf, OWN_LOGO) ?? builtinLogos[0];
}

/** Whether [design] can be worn: the app's own is everybody's, the rest want a purchase. */
export function plateIsOpen(design: LogoPlate, opened: string[]): boolean {
  if (design.isAppDefault) return true;
  const wanted = design.key.toLowerCase();
  return opened.some((key) => key.trim().toLowerCase() === wanted);
}

/** Whether [design] can be bought now: not already open, and affordable. */
export function plateCanOpen(design: LogoPlate, opened: string[], balance: number): boolean {
  return !plateIsOpen(design, opened) && balance >= design.price;
}

// ---------------------------------------------------------------------------
// Pages
// ---------------------------------------------------------------------------

/** The five tabs the shell holds, which are the pages a theme paints for it. */
export const SHELL_PAGES = ["drops", "moments", "convo", "audio", "live"] as const;

/** A picture behind a screen: which one, how hard it is washed, and its framing. */
export interface Backdrop {
  art: string;
  /** How much of the app's near-black is laid over it, 0–1. */
  veil: number;
  crop: Crop | null;
}

/** The row for [page], or nothing. */
export function pageRow(rows: CataloguePageRow[], page: string): CataloguePageRow | null {
  return rows.find((row) => row.page === page) ?? null;
}

/** The picture [row] paints for [page], or nothing when it paints none. */
export function pageArt(row: CataloguePageRow | null): string | null {
  if (!row || !row.shows) return null;
  const art = row.art;
  return art ? art : null;
}

/** The bundled design's own picture for [page]: one ground, or one per page. */
function bundledArtFor(design: ThemeDesign, page: ShellPage | null): string | null {
  const art = design.art;
  if (!art) return null;
  if ("page" in art && typeof art.page === "string") return art.page;
  if (!page) return null;
  return (art as Partial<Record<ShellPage, string>>)[page] ?? null;
}

/**
 * The design [design] with [row]'s tokens and page rows laid over it — the twin
 * of `ThemeProvider._styled`, and the whole of what a Style Studio row does to
 * a theme.
 *
 * Two halves, in the app's order: the colours first (§2, `withTokens`), then the
 * pictures (§1, `_withPages`). Both are overrides and neither can invent
 * anything: a row with no tokens and no pages — which is what every row is the
 * moment staff create one — comes back out of here as the same design it went
 * in as.
 *
 * Read one page at a time, in the app's three ways:
 *
 *   * `shows: false` — staff turned this theme's picture *off* for this page,
 *     so the page is left on the theme's own ground and the row is an absence;
 *   * `shows: true` with an `art` — that picture, over this page only;
 *   * `shows: true` with no `art` — the bundled design's own picture for the
 *     page, unchanged, which is why five empty page rows change nothing at all
 *     until somebody puts a picture on one.
 *
 * A design of *colours* has no art of its own, so the only pages that get any
 * are the ones a row actually painted. The profile and the inside of a chat are
 * not two of the five tabs — they are routes somebody pushed over the shell —
 * so their pictures land apart from the backdrop, on the fields those screens
 * already read.
 */
export interface StyledTheme {
  design: ThemeDesign;
  row: CatalogueTheme | null;
  /** One picture per shell page, or nothing for a page left on its own ground. */
  art: Partial<Record<ShellPage, string>>;
  /** How hard each page's picture is washed, where a row said so. */
  veils: Partial<Record<ShellPage, number>>;
  /** Which part of each page's picture shows, where a row framed it. */
  frames: Partial<Record<ShellPage, Crop>>;
  /** The profile's wallpaper, or nothing for a profile with none. */
  profileWall: string | null;
  profileFrame: Crop | null;
  /** The band over it. */
  coverArt: string | null;
  coverFrame: Crop | null;
  /** The wallpaper behind an open chat, below a wallpaper somebody picked. */
  chatWall: string | null;
  chatFrame: Crop | null;
  chatVeil: number | null;
}

export function styleDesign(design: ThemeDesign, row: CatalogueTheme | null): StyledTheme {
  const styled: StyledTheme = {
    design,
    row,
    art: {},
    veils: {},
    frames: {},
    profileWall: design.profileWall ?? null,
    profileFrame: null,
    coverArt: design.coverArt ?? null,
    coverFrame: null,
    chatWall: design.chatWall ?? null,
    chatFrame: null,
    chatVeil: null,
  };
  const painted = row
    ? { ...design, light: paletteWithTokens(design.light, row.tokens), dark: paletteWithTokens(design.dark, row.tokens), tokens: row.tokens }
    : design;
  styled.design = painted;
  if (!row || row.pages.length === 0) {
    // No rows, no new rule: the shell is drawn exactly as it is without a
    // catalogue, and the bundled design keeps every picture it came with.
    for (const page of SHELL_PAGES) {
      const art = bundledArtFor(painted, page);
      if (art) styled.art[page] = art;
    }
    return styled;
  }

  const take = (page: ShellPage, art: string, veil: number | null, frame: Crop | null) => {
    styled.art[page] = art;
    if (veil !== null) styled.veils[page] = veil;
    // The app's own framing is no entry at all, so a row with no crop comes out
    // of here byte for byte the theme it went in as.
    if (frame) styled.frames[page] = frame;
  };

  // The profile's two pictures land on the two fields that screen already
  // reads. §0 on every branch: a row that says nothing leaves the bundled
  // design's own wall and band exactly where they are, `shows: false` is the
  // row saying this theme paints no profile at all, and a row with one picture
  // framed and the other absent keeps the absent one as it was.
  const mine = pageRow(row.pages, "profile");
  if (mine && !mine.shows) {
    styled.profileWall = null;
    styled.coverArt = null;
    styled.profileFrame = null;
    styled.coverFrame = null;
  } else if (mine) {
    if (mine.art) {
      styled.profileWall = mine.art;
      styled.profileFrame = readCrop(mine.crop);
    }
    if (mine.cover) {
      styled.coverArt = mine.cover;
      styled.coverFrame = readCrop(mine.cover_crop);
    }
  }

  // The chat is the second pushed screen, read exactly as the profile is and
  // kept apart from it for the same reason it is kept apart from the `convo`
  // page: `convo` is the list of chats, a page of the shell, and the inside of
  // a chat is a route over it.
  const chatRow = pageRow(row.pages, "chat");
  if (chatRow && !chatRow.shows) {
    styled.chatWall = null;
    styled.chatFrame = null;
    styled.chatVeil = null;
  } else if (chatRow && chatRow.art) {
    styled.chatWall = chatRow.art;
    styled.chatFrame = readCrop(chatRow.crop);
    styled.chatVeil = typeof chatRow.veil === "number" ? chatRow.veil : null;
  }

  if (!design.art) {
    // A theme of colours has no art of its own, so the only pages that get any
    // are the ones a row actually painted.
    for (const page of row.pages) {
      if (!page.shows || !page.art) continue;
      if (!SHELL_PAGES.includes(page.page as ShellPage)) continue;
      take(page.page as ShellPage, page.art, page.veil, readCrop(page.crop));
    }
    return styled;
  }

  // A theme that already has pictures keeps them page by page: a row that
  // mentions one page changes that page and leaves the other four exactly as
  // they were, which is the whole of "a row is an override".
  for (const page of SHELL_PAGES) {
    const written = pageRow(row.pages, page);
    if (written && !written.shows) continue;
    const art = written?.art ?? bundledArtFor(painted, page);
    if (!art) continue;
    take(page, art, written?.veil ?? null, readCrop(written?.crop));
  }
  return styled;
}
