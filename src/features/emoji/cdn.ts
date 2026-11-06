/**
 * Where Google keeps an emoji's artwork.
 *
 * Three small functions with no dependency at all, in a file of their own so
 * that drawing an emoji does not have to reach through the picker's arithmetic
 * to name a URL. `model.ts` re-exports them, because a tile in the picker wants
 * the table and the naming together; `EmojiArt` imports them from here, because
 * an emoji in a message wants only the naming, and reaching through `model.ts`
 * would put the whole 95 kB table on the chat screen with it.
 *
 * Google's animated-emoji CDN — the set Gmail and Android draw — keys an emoji
 * by its own codepoints in lower-case hex joined by underscores: ❤️ is
 * `2764_fe0f` and 👋🏽 is `1f44b_1f3fd`. Every one of the 1,906 emoji in the
 * table was asked for by name before the table was generated, so a drawing is
 * never requested that is not there.
 */

/** Google's own emoji CDN — the animated set from Gmail and Android. */
const CDN = "https://fonts.gstatic.com/s/e/notoemoji/latest";

/**
 * How an emoji is spelled in a CDN path: its codepoints in lower-case hex,
 * joined by underscores. ❤️ is `2764_fe0f`, 👋🏽 is `1f44b_1f3fd`.
 */
export function cdnKey(char: string): string {
  return [...char]
    .map((one) => (one.codePointAt(0) ?? 0).toString(16))
    .join("_");
}

/** Google's still drawing of one emoji. */
export function stillUrl(char: string): string {
  return `${CDN}/${cdnKey(char)}/emoji.svg`;
}

/** Google's animation of one emoji, for the ones that have one. */
export function motionUrl(char: string): string {
  return `${CDN}/${cdnKey(char)}/lottie.json`;
}
