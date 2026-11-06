import {
  Flame,
  FlameKindling,
  Medal,
  Rocket,
  Sparkles,
  Sun,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { count, plural } from "@/utils/format";
import type { Spark, SparkTier } from "@/types/api";

/**
 * The Spark as the app reads it — the run of days two people keep a
 * conversation going.
 *
 * Ported from `app/lib/sparks.dart` and `app/lib/screens/spark.dart`. Every
 * figure here is the server's and the server is the only place it is worked
 * out: nothing in this file counts anything. What it holds is the part the
 * server has no opinion about — what each award is called, what it is drawn
 * with, what colour it is — plus the sentences the sheet builds out of the two
 * clocks, which are read off dates the one payload already carried so a sheet
 * left open counts down without asking again.
 *
 * **The clock runs per person.** A message from either side keeps the run
 * going, and each person's own clock starts again the moment their own message
 * lands. There is no shared "today": past 24 hours of one person's silence a
 * small timer appears beside the spark, and at 48 hours the run breaks to 0. A
 * broken run is kept for two days — the next day the two of them both send
 * something starts it again at 1 — and then it leaves the list.
 */

/** The window one person may stay silent in before the run breaks. */
export const SPARK_WINDOW_MS = 48 * 3600 * 1000;

/** How long one person may stay silent before their timer shows. */
export const SPARK_TIMER_MS = 24 * 3600 * 1000;

/** The day the Century award is won on, and where the count starts again. */
export const CENTURY_DAY = 100;

// ---- the seven awards ---------------------------------------------------

/** One rung of the ladder. */
export interface Award {
  key: string;
  name: string;

  /**
   * The glyph.
   *
   * The prototype draws each award as its own SVG path and the app has no SVG
   * renderer, so the phone draws the ladder out of Material glyphs and this
   * draws it out of the icon set the rest of this client already uses. The
   * mapping is this table and nothing else, which is what makes swapping in
   * the real paths one edit rather than a hunt.
   */
  Icon: LucideIcon;

  colour: string;

  /** The days it covers, counted from the start of its lap. */
  from: number;

  /** Null on Century, which does not end. */
  to: number | null;
}

/**
 * The ladder, in order, exactly as `streaks.js` has it and as `sparks.dart`
 * copies it: same keys, same names, same days, same seven colours.
 *
 * The server sends the same list and the server's *keys* win — `awardOf` looks
 * a tier up here by key, so a server that learns an eighth award before this
 * client does draws it in this table's first colour rather than throwing inside
 * a chat row. What it does not do is take the server's names: the app never
 * has, and a ladder drawn half in the server's words and half in the app's
 * would be two ladders.
 */
export const AWARDS: Award[] = [
  { key: "ember", name: "Ember", Icon: Flame, colour: "#C07A12", from: 1, to: 3 },
  { key: "flame", name: "Flame", Icon: FlameKindling, colour: "#CE3F62", from: 4, to: 7 },
  { key: "blaze", name: "Blaze", Icon: Zap, colour: "#B02E9B", from: 8, to: 15 },
  { key: "comet", name: "Comet", Icon: Rocket, colour: "#6C46D6", from: 16, to: 30 },
  { key: "nova", name: "Nova", Icon: Sun, colour: "#1B87AC", from: 31, to: 60 },
  { key: "supernova", name: "Supernova", Icon: Sparkles, colour: "#11836A", from: 61, to: 99 },
  { key: "century", name: "Century", Icon: Medal, colour: "#A8870F", from: 100, to: null },
];

/** The warning amber the row and the sheet share. */
export const AMBER = "#C07A12";

/** The last rung, which is the one that never goes away. */
export const CENTURY = AWARDS[AWARDS.length - 1];

/**
 * One rung by its key, or null for a key this build does not know.
 *
 * Both shapes are accepted because the payload has carried the tier two ways: a
 * nested object (`{"key": "nova", ...}`) and, on older cards, the bare key.
 */
export function awardOf(tier: SparkTier | string | null | undefined): Award | null {
  const key = typeof tier === "string" ? tier : tier?.key;
  if (!key) return null;
  return AWARDS.find((award) => award.key === key) ?? null;
}

/*
 * `sparks.dart` also carries `awardAt(pos)` — "the way back", a lap position
 * turned into the rung it sits on. It is left out here for the reason it is dead
 * on the phone too: nothing calls it. `Spark.pos` is on the payload and no
 * screen reads it, and a function ported to be called by nobody is a function
 * the next reader has to prove is unused. It comes back the day something draws
 * a lap position.
 */

/** The days a rung covers, as the ladder writes them under it. */
export function awardDays(award: Award): string {
  return award.to === null ? `${award.from}+ days` : `${award.from}–${award.to} days`;
}

/** The rung's key, so a tinted glyph and a lit name can be asked of one thing. */
export function litKeys(spark: Spark): string[] {
  return (spark.ladder ?? []).filter((row) => row?.lit).map((row) => String(row.key));
}

// ---- what the payload adds up to ---------------------------------------

/** Whether the count is past a hundred, which is drawn as the medal. */
export function hasCentury(spark: Spark): boolean {
  return (spark.laps ?? 0) > 0;
}

/**
 * The awards to draw, in drawing order.
 *
 * Century first when there is one, because it is the one that never goes away.
 * A run that broke still wears the rung it broke on, drawn cold, for the two
 * days it is kept: "it broke" is a thing about a run that reached somewhere,
 * and a blank row would say nothing at all.
 */
export function wornOf(spark: Spark): Award[] {
  const stage = awardOf(spark.stage) ?? AWARDS[0];
  const second = awardOf(spark.second);
  const worn: Award[] = [];
  if (hasCentury(spark)) worn.push(CENTURY);
  if (spark.alive) worn.push((hasCentury(spark) ? second : null) ?? stage);
  if (spark.broken && !spark.alive && !hasCentury(spark)) worn.push(stage);
  return worn;
}

/**
 * Whether a row should show anything at all.
 *
 * A run that ended before it got anywhere shows nothing; one that broke, or one
 * that ended after a Century, keeps its mark. A run hidden for me shows
 * nothing either — and the run goes on counting for both of us either way.
 */
export function showsSpark(spark: Spark | null | undefined): boolean {
  if (!spark) return false;
  return !spark.off && Boolean(spark.alive || spark.broken || hasCentury(spark));
}

/** Lit but not running: the glyph goes faded rather than absent. */
export function isCold(spark: Spark): boolean {
  return !spark.alive;
}

/** The rung the ring and the big glyph are drawn from. */
export function headAward(spark: Spark): Award {
  const worn = wornOf(spark);
  if (worn.length) return worn[worn.length - 1];
  return awardOf(spark.stage) ?? AWARDS[0];
}

// ---- the two clocks -----------------------------------------------------

function leftOf(last: string | null | undefined, said: number | null | undefined, now: number) {
  if (!last) return said ?? null;
  const at = Date.parse(last);
  if (Number.isNaN(at)) return said ?? null;
  const left = Math.floor((at + SPARK_WINDOW_MS - now) / 1000);
  return left < 0 ? 0 : left;
}

/**
 * Seconds until my own clock runs out.
 *
 * Read off my own last message where the server sent one, so a sheet left open
 * counts down by itself, and off the server's own reading otherwise.
 */
export function mineSecondsLeft(spark: Spark, now: number): number | null {
  return leftOf(spark.mine_last, spark.mine_left, now);
}

/** The same for their side. Never mixed with mine: the two clocks start at
 * different moments and run out at different moments. */
export function theirsSecondsLeft(spark: Spark, now: number): number | null {
  return leftOf(spark.theirs_last, spark.theirs_left, now);
}

/** "3 hours", "1 hour", "40 minutes" — a span, for a sentence. */
export function spanWords(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return plural(hours, "hour");
  const minutes = Math.min(59, Math.max(1, Math.floor(seconds / 60)));
  return plural(minutes, "minute");
}

/**
 * How long one side's clock has left, in words. Empty when there is nothing to
 * say.
 *
 * Read off that side's own deadline and never a shared one: each person's clock
 * runs from their own last message, so "yours" and "theirs" run out at
 * different moments and the sheet says each of them separately. Empty on a run
 * that is not going — hidden, broken, or never started.
 */
export function sparkLeftWords(spark: Spark, mine: boolean, now: number): string {
  if (spark.off || spark.broken || !spark.alive) return "";
  const seconds = mine ? mineSecondsLeft(spark, now) : theirsSecondsLeft(spark, now);
  if (seconds === null || seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  if (hours >= 1) return `${plural(hours, "hour")} left`;
  const minutes = Math.floor(seconds / 60);
  return `${plural(minutes, "minute")} left`;
}

/**
 * The one sentence that asks somebody to do something, for a run whose clock is
 * nearly out.
 *
 * It names the side it is about: this client must not tell somebody their run is
 * about to break without saying whose clock is running out. The hours come off
 * `seconds_left`, which is the earlier of the two, and the side off that
 * person's own deadline.
 */
export function closingLine(spark: Spark, now: number): string {
  const near = 6 * 3600;
  const mineAt = mineSecondsLeft(spark, now);
  const theirsAt = theirsSecondsLeft(spark, now);
  const mineNear = mineAt !== null && mineAt <= near;
  const theirsNear = theirsAt !== null && theirsAt <= near;
  const when = spanWords(spark.seconds_left ?? 0);
  if (mineNear && theirsNear) {
    return `Both clocks are nearly out — this spark breaks in ${when}.`;
  }
  if (mineNear) {
    return `Your clock is nearly out — send a line in the next ${when} or this spark breaks.`;
  }
  return `Their clock is nearly out — this spark breaks in ${when} unless they send.`;
}

// ---- the offer on a broken run -----------------------------------------

/**
 * The price of buying the run back, while it is broken and inside its two days.
 *
 * Both keys or neither: half an offer is not an offer, and a sheet that drew one
 * out of a payload it did not understand would be asking for sparks against a
 * number it invented.
 */
export function offerOf(spark: Spark): { price: number; count: number } | null {
  const offer = spark.offer;
  if (!offer) return null;
  const price = Number(offer.price);
  const days = Number(offer.count);
  if (!Number.isFinite(price) || !Number.isFinite(days)) return null;
  return { price, count: days };
}

/**
 * "Offer ends in 1 day 4 hours" — how long the buy-back still has to run.
 *
 * Read off `hold_until`, which is the same moment the entry leaves the list: the
 * two days a broken pair is held for and the two days the offer is open are one
 * window. Empty when there is nothing to say, which is the same rule the
 * payload's own null offer follows.
 */
export function offerEndsWords(spark: Spark, now: number): string {
  if (!offerOf(spark)) return "";
  if (!spark.hold_until) return "";
  const until = Date.parse(spark.hold_until);
  if (Number.isNaN(until)) return "";
  const seconds = Math.floor((until - now) / 1000);
  if (seconds <= 0) return "";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  let span: string;
  if (days >= 1) {
    span = `${plural(days, "day")}${hours >= 1 ? ` ${spanWords(hours * 3600)}` : ""}`;
  } else if (hours >= 1) {
    span = spanWords(hours * 3600);
  } else {
    // A window with under an hour on it reads in minutes, and the last of those
    // minutes is one minute rather than nought — the offer is still open until
    // the second it closes.
    span = spanWords(Math.min(59, Math.max(1, Math.floor(seconds / 60))) * 60);
  }
  return `Offer ends in ${span}`;
}

// ---- what is coming -----------------------------------------------------

/** The days left before the next rung, off the run's own two numbers. */
export function daysLeft(spark: Spark): number {
  return (spark.next_at ?? 0) - (spark.count ?? 0);
}

/**
 * "Nova in 9 days — day 31", or the reading for a run whose next rung is due.
 *
 * Empty on a run that is not going: a broken run's count is a nought and "Nova
 * in 131 days" off it would be a promise about a run that no longer exists.
 */
export function nextWords(spark: Spark): string {
  if (spark.off || spark.broken) return "";
  const next = awardOf(spark.next_stage);
  if (!next) return "";
  const left = daysLeft(spark);
  if (left <= 0) return `${next.name} any day now`;
  return `${next.name} in ${plural(left, "day")} — day ${spark.next_at ?? 0}`;
}

/**
 * The number under the ring, and the one place a spark is ever a figure.
 *
 * The chat list draws the award and never a count — a figure beside a name turns
 * a conversation into a scoreboard — so this is the sheet's, where the number
 * lives along with everything the number cannot say on its own.
 */
export function figure(spark: Spark): { big: string; small: string } {
  if (spark.off) return { big: "Hidden", small: "" };
  if (spark.broken) return { big: "Broken", small: "" };
  if (!spark.count) {
    return {
      big: hasCentury(spark) ? "Count starts again" : "Not started",
      small: "",
    };
  }
  // The word alone under the figure, not the figure twice: the number is the
  // line above it, and "12 days" under a 12 is the same fact said twice.
  return { big: count(spark.count), small: spark.count === 1 ? "day" : "days" };
}
