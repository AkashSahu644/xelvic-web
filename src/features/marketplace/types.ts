// What the marketplace reads off the wire.
//
// These are the shapes `apps/studio/services.py` sends, field for field: the
// catalogue's three shelves and its occasions, and the Drip shelf's own
// reading. They are written down once here rather than inline in each card, so
// a field that moves on the server breaks one file rather than five.
//
// Every picture URL arrives absolute (`_absolute_theme` and friends run
// `request.build_absolute_uri` over them), so nothing here needs the media
// helper: these are public files behind a plain `<img src>`.

import type { ThemeTokens } from "@/theme/catalog";

/** Which part of a picture shows. See `XFrame` and `services.validate_crops`. */
export interface Crop {
  /** 0–1 across the picture, 0.5 the centre the app draws at today. */
  x: number;
  /** 0–1 down it. */
  y: number;
  /** How much closer than `cover`, 1–4. */
  zoom: number;
}

/** The seven screens a theme can paint, in the server's own order. */
export const PAGE_ORDER = ["drops", "moments", "convo", "audio", "live", "profile", "chat"] as const;

export type CataloguePageName = (typeof PAGE_ORDER)[number];

/** One screen of a theme: whether its picture sits behind it, and which. */
export interface CataloguePageRow {
  page: CataloguePageName;
  /** `false` is the row saying this theme paints no picture for this screen. */
  shows: boolean;
  art: string | null;
  /** The profile's second picture — the band over the wall. */
  cover: string | null;
  crop: Crop | null;
  cover_crop: Crop | null;
  /** How hard the single-tone wash over `art` is, 0–1. */
  veil: number | null;
}

/** Which of a theme's two characters this account is drawn as. */
export type FigurePick = "boy" | "girl" | "";

/** `both` | `profile` | `chat` | `none` — where a figure stands. */
export type FigurePlacement = "both" | "profile" | "chat" | "none";

export interface CatalogueTheme {
  key: string;
  name: string;
  mood: string;
  /** `custom` for a Studio row, `builtin` for one seeded from a design. */
  source: string;
  /** What it costs today — nothing while it is free. */
  price: number;
  /** What it costs once the free window is over. */
  full_price: number;
  free_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  /** `live` | `scheduled` | `ended` | `off`. */
  state: string;
  occasion: string;
  owned: boolean;
  worn: boolean;
  tokens: ThemeTokens;
  mark: string;
  mark_name: string;
  mark_size: number;
  pages: CataloguePageRow[];
  cover: string | null;
  cover_light: string | null;
  /** A face that comes with the theme, offered when it is put on. */
  face: string | null;
  face_cover: string | null;
  /** The figure this theme is worn with — its key, or empty for none. */
  character: string;
  character_boy_wait: string | null;
  character_boy_typing: string | null;
  character_boy_bio: string | null;
  character_girl_wait: string | null;
  character_girl_typing: string | null;
  character_girl_bio: string | null;
  /** The three the app actually draws, through `_figure_picture`'s chain. */
  character_wait: string | null;
  character_typing: string | null;
  character_bio: string | null;
  figure_pick: FigurePick;
  figure_size: number;
  figure_peek: number;
  figure_placement: FigurePlacement;
}

export interface CatalogueLogo {
  key: string;
  name: string;
  source: string;
  price: number;
  full_price: number;
  free_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  state: string;
  occasion: string;
  owned: boolean;
  worn: boolean;
  /** Empty means the app's bundled plate for `key`. */
  art: string | null;
}

export interface CatalogueCharacter {
  key: string;
  name: string;
  tagline: string;
  price: number;
  full_price: number;
  free_until: string | null;
  starts_at: string | null;
  ends_at: string | null;
  state: string;
  occasion: string;
  owned: boolean;
  worn: boolean;
  size: number;
  peek_size: number;
  placement: FigurePlacement;
  wait: string | null;
  typing: string | null;
  bio: string | null;
}

/** A strip above everything — the line a festival or an event wears. */
export interface CatalogueOccasion {
  id: string;
  title: string;
  body: string;
  image: string | null;
  accent: string;
  surface: string;
  dismissible: boolean;
  theme: string | null;
  character: string | null;
  ends_at: string | null;
}

export interface Catalogue {
  now: string;
  themes: CatalogueTheme[];
  logos: CatalogueLogo[];
  characters: CatalogueCharacter[];
  occasions: CatalogueOccasion[];
}

/** One figure on the Drip shelf, as `apps/drip` reads it. */
export interface DripCharacter {
  key: string;
  name: string;
  tagline: string;
  price: number;
  starts_at: string | null;
  ends_at: string | null;
  wait: string | null;
  typing: string | null;
  bio: string | null;
  owned: boolean;
  worn: boolean;
}

export interface DripReading {
  characters: DripCharacter[];
  balance: number;
  /** The key this account wears, or empty for nothing chosen. */
  worn: string;
  /** Whether the figure stands beside the bio on the profile. */
  show_character: boolean;
}

/**
 * `GET /sparks/wallet/`, read as the marketplace reads it.
 *
 * The shape itself belongs to the Sparks feature and is imported rather than
 * written again, because the wallet is one reading of one ledger and two
 * interfaces for it would be two chances to disagree. What the shop uses:
 * `balance` decides what can be paid for, `earned` (every day ever credited)
 * decides which rungs are reached, and `owned` is the list of theme keys the
 * ladder counts its opened slots off.
 */
export type { WalletData as MarketplaceWallet } from "@/features/sparks/types";

/** What a purchase answers with: the price charged and the balance left. */
export interface PurchaseAnswer {
  key: string;
  price: number;
  charged: boolean;
  balance: number;
}
