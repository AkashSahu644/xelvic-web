/**
 * The one question every screen with a cake on it asks — the phone's
 * `app/lib/birthday.dart`, value layer.
 *
 * The server sends a birthday as `MM-DD` and never as a date, because a year is
 * nobody's business here: the mark is about a day of the year and nothing else.
 * That is also why this is one module rather than a compare written at each
 * caller — the row in the convo list, my own profile and somebody else's all ask
 * the same question of the same string, and three copies of a date rule is three
 * answers waiting to disagree.
 *
 * **The parse is the check.** A pair that is not a real day is refused rather
 * than rolled forward: the calendar turns the 31st of February into the 2nd of
 * March, so a built date is only trusted when it reads back as the pair that
 * built it. Every real day round-trips and nothing else does, which is the
 * phone's rule and the reason a malformed value never puts a cake on a row.
 */

/** A day of the year, with no year attached to it. */
export interface MonthDay {
  month: number;
  day: number;
}

/**
 * The pair the server sent, or null when it is not a day of the year.
 *
 * Unpadded is accepted (`11-3` is the 3rd of November) because it is a day
 * either way and the pad is the sender's business rather than the reader's.
 */
export function birthdayFromMonthDay(value: unknown): MonthDay | null {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return null;
  const parts = text.split("-");
  if (parts.length !== 2) return null;
  const month = Number.parseInt(parts[0], 10);
  const day = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(month) || !Number.isFinite(day)) return null;
  // The round trip, which is the whole check: a pair that is not a day does not
  // come back as itself.
  const built = new Date(2000, month - 1, day);
  if (built.getMonth() + 1 !== month || built.getDate() !== day) return null;
  return { month, day };
}

/** Today as the server writes it — `MM-DD`, padded. */
export function todayMonthDay(now: Date = new Date()): string {
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

/** Whether a birthday string is today. A payload with no birthday answers false. */
export function isBirthdayToday(value: unknown, now: Date = new Date()): boolean {
  const day = birthdayFromMonthDay(value);
  if (!day) return false;
  return day.month === now.getMonth() + 1 && day.day === now.getDate();
}

/**
 * The same question asked of whatever the caller is holding.
 *
 * A thread row's `other`, a whole profile and my own card all carry the field
 * under the same name, and a payload that has not arrived yet has no birthday on
 * it and so answers false — which is the honest answer for a screen that has not
 * read the person yet.
 */
export function isBirthdayTodayIn(
  who: { birthday?: string | null } | null | undefined,
  now: Date = new Date(),
): boolean {
  return isBirthdayToday(who?.birthday, now);
}
