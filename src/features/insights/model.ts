/**
 * What a page has been doing, as the Insights screen reads it.
 *
 * Ported from `app/lib/insights.dart`, which says the same thing in the same
 * order. The server works all of this out — `apps/social/insights.py` — and
 * nothing here counts anything: it parses, it holds, and it answers the handful
 * of questions the screen asks of the answer so that no component has to walk
 * the payload itself.
 *
 * Two things are worth reading twice, because they are the difference between a
 * dashboard that informs and one that flatters.
 *
 * **A day with nothing on it is a zero and not a gap.** The server sends every
 * day of the window; the length of a series is the length of the window. A chart
 * drawn from only the days something happened would draw a quiet fortnight as
 * though it were a busy one.
 *
 * **`InsightChange.up` is three-valued.** `true` and `false` are the two arrows
 * and `null` is *no arrow* — it covers both "nothing to compare against" and
 * "nothing moved". Drawing an up arrow on a flat week is the whole of what a
 * dishonest dashboard does, so the flat case is a state of its own rather than a
 * `>=` that quietly rounds it up.
 */

export interface InsightPoint {
  /** The day, as `YYYY-MM-DD` — the server's own date, kept as text. */
  day: string;
  value: number;
}

/** This window against the one before it. */
export interface InsightChange {
  /**
   * Which way it went: `true` up, `false` down, `null` **draw no arrow** —
   * either there is nothing to compare against or nothing moved.
   */
  up: boolean | null;
  /** How much it moved, as a fraction of the period before. `null` for a rise from nothing. */
  ratio: number | null;
  from: number;
  to: number;
}

/** One number the screen draws, with or without its history. */
export interface InsightMetric {
  key: string;
  title: string;
  /** Which heading it belongs under — `reach`, `keeps`, `actions`, `made`. */
  group: string;
  /** What the number counts, for a card that wants to say it. `count` today. */
  unit: string;
  total: number;
  previous: number;
  change: InsightChange;
  points: InsightPoint[];
}

/** A heading the screen groups metrics under, as the server named it. */
export interface InsightGroup {
  key: string;
  title: string;
}

/** How much of the audience did anything, against how many turned up. */
export interface InsightEngagement {
  /** Everything everybody did, repeats included. */
  interactions: number;
  /** The people who came *and* did something, counted once each. */
  engaged: number;
  /** The people who opened the page. */
  reached: number;
  rate: number | null;
}

/** One thing that was put up, ranked. */
export interface InsightContent {
  id: string;
  /** `drop`, `vibe` — or `moment`, which carries the three fields below. */
  kind: string;
  body: string;
  likes: number;
  comments: number;
  shares: number;
  score: number;
  day: string | null;
  watchers?: number | null;
  faces?: number | null;
  items?: number | null;
}

/** One face and how often it was used. */
export interface InsightTally {
  label: string;
  count: number;
}

/**
 * Everything ranked, in one place.
 *
 * The audience halves — where the people looking are, and what phone they are
 * on — were dropped by the owner's ask on 2026-10-26: *"where they are, what
 * they are on ye sab hatao bhot bura lag raha"*. The server still sends them in
 * `audience`, because a build already on a phone reads that key, but this app no
 * longer parses or draws either.
 */
export interface InsightBreakdown {
  moments: InsightContent[];
  content: InsightContent[];
  reactions: InsightTally[];
}

/** One whole reading of a page: the window, the numbers, and the people. */
export interface Reads {
  from: string;
  to: string;
  days: number;
  generatedAt: string | null;
  groups: InsightGroup[];
  /** The keys the screen leads with, in the order the server put them. */
  headline: string[];
  metrics: InsightMetric[];
  engagement: InsightEngagement;
  breakdown: InsightBreakdown;
  /**
   * Every look at every Vibe ever, with no history behind it.
   *
   * The one number on the screen that cannot be drawn as a series. Kept apart
   * from `metrics` on purpose so that no component can accidentally draw it as
   * a month.
   */
  vibeViews: number;
}

/** The metric a key names, or nothing. */
export function metricOf(reads: Reads, key: string): InsightMetric | null {
  return reads.metrics.find((one) => one.key === key) ?? null;
}

/** The metrics of one group, in the order the server sent them. */
export function inGroup(reads: Reads, key: string): InsightMetric[] {
  return reads.metrics.filter((one) => one.group === key);
}

/**
 * The headline cards, in the server's order, with anything it does not count
 * left out rather than drawn as a zero.
 */
export function cardsOf(reads: Reads): InsightMetric[] {
  return reads.headline
    .map((key) => metricOf(reads, key))
    .filter((one): one is InsightMetric => Boolean(one));
}

/** The busiest day in the window, or null when nothing happened at all. */
export function bestOf(metric: InsightMetric): InsightPoint | null {
  if (metric.points.length === 0) return null;
  let top = metric.points[0];
  for (const point of metric.points) {
    if (point.value > top.value) top = point;
  }
  return top.value === 0 ? null : top;
}

/** Whether anybody did more than one thing — the case the two counts are worth telling apart for. */
export function repeats(engagement: InsightEngagement): boolean {
  return engagement.interactions > engagement.engaged;
}

/** Whether there is anything at all behind the ranked sections. */
export function breakdownEmpty(breakdown: InsightBreakdown): boolean {
  return (
    breakdown.moments.length === 0 &&
    breakdown.content.length === 0 &&
    breakdown.reactions.length === 0
  );
}

// ---- the window and how it is drawn -------------------------------------

/**
 * The ranges the screen offers.
 *
 * A week, a month and a quarter, because those are the three questions somebody
 * actually asks of their own page: what happened this week, how is this month
 * going, and is any of this working over a season. Ninety rather than thirty-one
 * because the comparison each one draws is against the window before it, and a
 * "this month" that changes length by three days is a card that goes up every
 * March.
 */
export const RANGES = [
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
] as const;

/** How the growth chart gathers its days up. */
export type Buckets = "day" | "week" | "month";

export const BUCKETS: { key: Buckets; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
];

/** The first day of the bucket a day falls in. See the app's `_floor`. */
function floorOf(day: string, by: Buckets): string {
  if (by === "day") return day;
  const [year, month, date] = day.split("-").map(Number);
  if (by === "month") return `${year}-${String(month).padStart(2, "0")}-01`;
  // A week starts on Monday, because that is the day a seven-day span is counted
  // from everywhere this app is used, and an ISO week number would be a thing to
  // look up rather than a thing to draw.
  const at = new Date(Date.UTC(year, month - 1, date));
  const back = (at.getUTCDay() + 6) % 7;
  at.setUTCDate(at.getUTCDate() - back);
  return at.toISOString().slice(0, 10);
}

/**
 * The same series, gathered into days, weeks or months.
 *
 * A bucket is dated by **the day it starts on** — Monday for a week, the first
 * for a month — so the chart can label a point without knowing which kind of
 * bucket it came out of. The first and last buckets of a window are usually
 * part-weeks or part-months, and they are drawn as what they are: the sum of the
 * days that fell inside the window.
 *
 * It is a **sum of the days in the bucket**: nothing is averaged and nothing is
 * dropped, which is why the buckets always add back up to the total on the card
 * beside them.
 */
export function bucket(points: InsightPoint[], by: Buckets): InsightPoint[] {
  if (by === "day" || points.length < 2) return points;
  const sums = new Map<string, number>();
  for (const point of points) {
    const key = floorOf(point.day, by);
    sums.set(key, (sums.get(key) ?? 0) + point.value);
  }
  return [...sums.entries()].map(([day, value]) => ({ day, value }));
}

/**
 * Whether a metric has enough in the window to be worth gathering up.
 *
 * Two buckets at the least: one point is not a line, and a chart of a single
 * month is a number with a picture of a number next to it. A seven-day window
 * can therefore be looked at a day at a time and nothing else, which is the
 * truth about a week.
 */
export function fits(metric: InsightMetric, by: Buckets): boolean {
  return bucket(metric.points, by).length >= 2;
}

/**
 * The y axis' top, rounded up to something a person would have chosen.
 *
 * A chart labels its top gridline, and a top of 137 makes that label read `137`
 * — which looks like a measurement rather than the edge of a scale. The
 * candidates are the ones anybody picks by hand: one, two or five of some power
 * of ten, and then even, so that the line halfway up is a whole number too.
 */
export function niceTop(raw: number): number {
  if (raw <= 4) return 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  let top = raw;
  for (const step of [1, 2, 5, 10]) {
    const candidate = Math.ceil(step * magnitude);
    if (candidate >= raw) {
      top = candidate;
      break;
    }
  }
  return top % 2 === 1 ? top + 1 : top;
}

// ---- reading the server's own shapes ------------------------------------

function int(raw: unknown): number {
  return typeof raw === "number" && Number.isFinite(raw) ? Math.trunc(raw) : 0;
}

function number(raw: unknown): number | null {
  return typeof raw === "number" && Number.isFinite(raw) ? raw : null;
}

function text(raw: unknown): string {
  return raw === null || raw === undefined ? "" : String(raw);
}

function list(raw: unknown): Record<string, unknown>[] {
  return Array.isArray(raw) ? (raw as Record<string, unknown>[]) : [];
}

function readChange(raw: unknown): InsightChange {
  const one = (raw ?? {}) as Record<string, unknown>;
  return {
    up: one.up === true ? true : one.up === false ? false : null,
    ratio: number(one.ratio),
    from: int(one.from),
    to: int(one.to),
  };
}

function readMetric(raw: Record<string, unknown>): InsightMetric {
  return {
    key: text(raw.key),
    // l10n-free: a server value, sent in the language the request asked for.
    title: text(raw.title),
    group: text(raw.group),
    unit: text(raw.unit) || "count",
    total: int(raw.total),
    previous: int(raw.previous),
    change: readChange(raw.change),
    points: list(raw.points).map((point) => ({
      day: text(point.date),
      value: int(point.value),
    })),
  };
}

function readContent(raw: Record<string, unknown>, kind: string): InsightContent {
  return {
    id: text(raw.id),
    kind: kind || text(raw.kind),
    body: text(raw.body),
    likes: int(raw.likes),
    comments: int(raw.comments),
    shares: int(raw.shares),
    score: int(raw.score),
    day: raw.day === null || raw.day === undefined ? null : text(raw.day),
    watchers: raw.watchers === null || raw.watchers === undefined ? null : int(raw.watchers),
    faces: raw.faces === null || raw.faces === undefined ? null : int(raw.faces),
    items: raw.items === null || raw.items === undefined ? null : int(raw.items),
  };
}

/** The whole answer, as the screen reads it. */
export function readsFrom(payload: unknown): Reads {
  const json = (payload ?? {}) as Record<string, unknown>;
  const lifetime = (json.lifetime ?? {}) as Record<string, unknown>;
  const breakdown = (json.breakdown ?? {}) as Record<string, unknown>;
  const engagement = (json.engagement ?? {}) as Record<string, unknown>;
  return {
    from: text(json.from),
    to: text(json.to),
    days: int(json.days),
    generatedAt: json.generated_at ? text(json.generated_at) : null,
    groups: list(json.groups).map((group) => ({
      key: text(group.key),
      title: text(group.title), // l10n-free: a server value.
    })),
    headline: list(json.headline).map((key) => text(key)),
    metrics: list(json.series).map(readMetric),
    engagement: {
      interactions: int(engagement.interactions),
      engaged: int(engagement.engaged),
      reached: int(engagement.reached),
      rate: number(engagement.rate),
    },
    breakdown: {
      // A moment carries `watchers`, `faces` and `items` and none of the three
      // counts a drop has, because a moment is answered with a face rather than
      // with a like. `score` is its watchers, which is what the bar is drawn
      // against.
      moments: list(breakdown.moments).map((row) => readContent(row, "moment")),
      content: list(breakdown.content).map((row) => readContent(row, text(row.kind))),
      reactions: list(breakdown.reactions).map((row) => ({
        label: text(row.emoji),
        count: int(row.count),
      })),
    },
    vibeViews: int(lifetime.vibe_views),
  };
}
