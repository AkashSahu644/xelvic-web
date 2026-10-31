import { count } from "@/lib/format";
import type { Alert } from "@/types/api";

export function alertWho(alert: Alert) {
  return alert.actor?.name || alert.actor?.username || "Somebody";
}

export function alertSelfSpoken(alert: Alert) {
  return (
    alert.kind === "verify" ||
    alert.kind === "login" ||
    alert.kind === "achievement" ||
    alert.kind === "staff"
  );
}

function milestone(alert: Alert, what: string) {
  const rung = alert.rung;
  if (rung == null) return `Your ${what} reached a milestone`;
  const people = rung === 1 ? "1 person" : `${count(rung)} people`;
  return `Congrats! ${people} shared your ${what}`;
}

export function alertLine(alert: Alert) {
  const kind = alert.kind;
  const about = alert.about;
  if (kind === "like") return about === "vibe" ? "felt your vibe" : "felt your drop";
  if (kind === "respond") return about === "vibe" ? "responded to your vibe" : "responded to your drop";
  if (kind === "note") return "left you a note";
  if (kind === "share") return about === "vibe" ? "passed your vibe on" : "passed your drop on";
  if (kind === "face") return about === "memory" ? "answered your Memory" : "answered your moment";
  if (kind === "mention") return about === "moment" ? "named you in a moment" : "named you in a respond";
  if (kind === "keep") return "started keeping you";
  if (kind === "keep_request") return "asked to keep you";
  if (kind === "call") return "tried to call you";
  if (kind === "live") return "went live";
  if (kind === "post") return about === "vibe" ? "posted a vibe" : "posted a drop";
  if (kind === "achievement") return milestone(alert, about === "vibe" ? "vibe" : "drop");
  if (kind === "verify" || kind === "login" || kind === "staff") return alert.body;
  return "did something";
}

export function alertEmoji(alert: Alert) {
  return alert.kind === "face" ? alert.body || null : null;
}

export function alertTail(alert: Alert) {
  const line = alertLine(alert);
  const emoji = alertEmoji(alert);
  return emoji ? `${emoji} ${line}` : line;
}

export function alertQuote(alert: Alert) {
  if (!alert.body) return null;
  if (alert.kind === "face") return null;
  if (alert.kind === "verify" || alert.kind === "login" || alert.kind === "staff") return null;
  return alert.body;
}

export function alertSummary(alert: Alert) {
  const line = alertLine(alert);
  if (alertSelfSpoken(alert)) return line;
  const head = `${alertWho(alert)} ${alertTail(alert)}`;
  const said = alertQuote(alert);
  return said ? `${head}: ${said}` : head;
}

export function alertMarkLabel(alert: Alert) {
  if (alert.kind === "note") return "Open the note";
  if (alert.kind === "keep") return "Keep back";
  return "Open the comments";
}

export function alertSubject(about: string): { label: string; kind: string } {
  if (about === "moment") return { label: "Moment", kind: "moment" };
  if (about === "vibe") return { label: "Vibe", kind: "vibe" };
  if (about === "memory") return { label: "Memory", kind: "memory" };
  if (about === "drop") return { label: "Drop", kind: "drop" };
  return { label: "", kind: "other" };
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayMark(value: string | null | undefined, above?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  if (above) {
    const previous = new Date(above);
    if (!Number.isNaN(previous.getTime()) && startOfDay(previous) === startOfDay(date)) {
      return null;
    }
  }
  const now = new Date();
  if (startOfDay(now) === startOfDay(date)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (startOfDay(yesterday) === startOfDay(date)) return "Yesterday";
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days > 0 && days < 7) {
    return new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(date);
  }
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(date);
}

export function alertWhen(alert: Alert) {
  if (!alert.at) return null;
  const date = new Date(alert.at);
  return Number.isNaN(date.getTime()) ? null : date;
}
