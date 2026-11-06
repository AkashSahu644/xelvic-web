export function count(value: number | null | undefined): string {
  if (value === null || value === undefined) return "\u2014";
  if (value < 1000) return String(value);
  if (value < 10_000) {
    const short = (value / 1000).toFixed(1).replace(/\.0$/, "");
    return `${short}k`;
  }
  if (value < 1_000_000) return `${Math.round(value / 1000)}k`;
  const millions = (value / 1_000_000).toFixed(1).replace(/\.0$/, "");
  return `${millions}m`;
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const seconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(seconds);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(seconds), "second");
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute");
  if (abs < 86_400) return rtf.format(Math.round(seconds / 3600), "hour");
  if (abs < 604_800) return rtf.format(Math.round(seconds / 86_400), "day");
  if (abs < 2_592_000) return rtf.format(Math.round(seconds / 604_800), "week");
  if (abs < 31_536_000) return rtf.format(Math.round(seconds / 2_592_000), "month");
  return rtf.format(Math.round(seconds / 31_536_000), "year");
}

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function parse(value: string | Date | null | undefined): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const at = value instanceof Date ? value : new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** A day: '25 Sep'. The app's `shortDay`. */
export function shortDay(value: string | Date | null | undefined): string {
  const at = parse(value);
  if (!at) return "";
  return `${at.getDate()} ${MONTHS[at.getMonth()]}`;
}

/** The same day with its year: '25 Sep 2026'. The app's `fullDay`. */
export function fullDay(value: string | Date | null | undefined): string {
  const at = parse(value);
  if (!at) return "";
  return `${shortDay(at)} ${at.getFullYear()}`;
}

/**
 * A month by its name: 'Sep'.
 *
 * For a series gathered up by month, where every point *is* a month and a day
 * printed against it would be a date nobody asked about. The app's `monthName`.
 */
export function monthName(value: string | Date | null | undefined): string {
  const at = parse(value);
  if (!at) return "";
  return MONTHS[at.getMonth()];
}

/**
 * How long ago, in the app's own ladder.
 *
 * Not `relativeTime` above: that is the browser's `Intl` word, which says
 * "2 minutes ago" in a sentence this app does not write and says "yesterday"
 * where the phone says "1 day ago". This is `ago()` in
 * `app/lib/screens/widgets.dart`, word for word — under a minute is "just now",
 * then minutes, hours and days to a week, and past a week the date itself
 * ("25 Sep"), because "34 days ago" is a number somebody has to work out rather
 * than a day they recognise.
 *
 * Four strings, and the app writes all four as constants while the browser
 * would translate them into eleven languages' worth of grammar; the words are
 * the app's, in English, the same way the rest of this port carries them.
 */
export function ago(value: string | Date | null | undefined): string {
  const at = parse(value);
  if (!at) return "";
  const seconds = Math.floor((Date.now() - at.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "1 day ago" : `${days} days ago`;
  return shortDay(at);
}

export function clock(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
}

export function dayLabel(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return clock(value);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function duration(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "0:00";
  const whole = Math.floor(seconds);
  const mins = Math.floor(whole / 60);
  const secs = whole % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}:${String(mins % 60).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${mins}:${String(secs).padStart(2, "0")}`;
}

export function initialsOf(name: string, fallback = "?") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return fallback;
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

export function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export function plural(value: number, one: string, many = `${one}s`) {
  return `${count(value)} ${value === 1 ? one : many}`;
}

export function timeAgoShort(value: string | null | undefined) {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(then));
}
