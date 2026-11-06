/**
 * Every key this app writes into `localStorage` or `sessionStorage`.
 *
 * These were scattered: the session keys in `config/env.ts`, the remembered
 * account and the client stores each with their own literal, the search page
 * and the QR sign-in with theirs. That is how a storage key gets renamed in
 * one place and read in another — the old value simply stops being found and
 * a preference silently resets. One written record means one rename.
 *
 * The names are the same strings that were already deployed, deliberately.
 * Renaming any of them would sign every current reader out of their theme, or
 * lose their saved shelf, the first time this build loads.
 */

export const STORAGE_KEYS = {
  /** The tokens. Session storage — they end with the tab, as they always have. */
  accessToken: "xelvic.access",
  refreshToken: "xelvic.refresh",
  /** The signed-in account, kept only as long as the access token above. */
  me: "xelvic.me",

  /** Appearance, remembered per device. */
  preferences: "xelvic.preferences",
  theme: "xelvic.theme",
  mode: "xelvic.mode",

  /** Client state that belongs to this device rather than to the account. */
  soundMuted: "xelvic.sound.muted",
  vibesEnd: "xelvic.vibes.end",
  recentSearches: "xelvic.searches",
  /** The emoji the composer's picker last handed over, newest first. */
  recentEmoji: "xelvic.emoji.recent",
  callsSeen: "xelvic.calls.seen",

  /** The QR sign-in handshake: the ticket being watched and its cooldown. */
  qrSession: "xelvic.qr.session",
  qrCooldown: "xelvic.qr.cooldown",

  /**
   * The last answers the server gave, kept so a reload can draw them while the
   * fresh ones are on their way. Per-account — see `store/queryCache.ts`.
   */
  queryCache: "xelvic.query-cache",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];