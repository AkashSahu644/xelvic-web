import { count } from "@/lib/format";
import type { Alert } from "@/types/api";

export function alertWho(alert: Alert) {
  return alert.actor?.name || alert.actor?.username || "Somebody";
}

/**
 * Whether this row is the app telling the account about itself.
 *
 * Ported from `Alert.selfSpoken`. Five kinds arrive with nobody in front of
 * them — a badge that changed, a device that signed in, a post of the reader's
 * that reached a rung of the share ladder, a sentence from the place itself, and
 * news from the shelf — and all five read as one sentence rather than a name
 * plus a tail, and wear their own glyph where a face would be.
 *
 * `studio` is here even though `alerts.dart`'s own `apply` switch does not name
 * it: the shelf writes the whole sentence and puts nobody in front of it, which
 * is the rule this getter is, and a row with a blank where a name belongs is the
 * one drawing worse than naming somebody who did not say it.
 */
export function alertSelfSpoken(alert: Alert) {
  return (
    alert.kind === "verify" ||
    alert.kind === "login" ||
    alert.kind === "achievement" ||
    alert.kind === "staff" ||
    alert.kind === "studio"
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
  // Somebody the reader keeps has put something on their day. One sentence and
  // no detail, because there is nothing worth saying about a moment the reader
  // has not watched yet — the row exists to take them to it. See
  // `Alert.Kind.FRIEND_MOMENT` on the server.
  if (kind === "friend_moment") return "posted something on their day";
  if (kind === "achievement") return milestone(alert, about === "vibe" ? "vibe" : "drop");
  // The shelf's news is written by the studio and arrives whole, with no actor
  // in front of it — the same shape as a verify, a sign-in and a staff notice.
  if (kind === "verify" || kind === "login" || kind === "staff" || kind === "studio") {
    return alert.body;
  }
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
  // A verify alert's body is its whole sentence, drawn as the line — quoting it
  // under the line would say the same thing twice. A sign-in, a message from
  // the team and a studio announcement are the same shape.
  if (
    alert.kind === "verify" ||
    alert.kind === "login" ||
    alert.kind === "staff" ||
    alert.kind === "studio"
  ) {
    return null;
  }
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
  // The shelf's news opens the thing itself rather than a conversation about
  // it, and "Open the comments" would be a sentence about a post.
  if (alert.kind === "studio") return "Open it";
  // The door onto a friend's day is the moment itself, not a conversation
  // about it.
  if (alert.kind === "friend_moment") return "Open the moment";
  return "Open the comments";
}

/**
 * Which colour of the theme's ladder the badge on the face wears.
 *
 * Ported from `Alert.tone`. An index rather than a hex, because the row says
 * what kind of thing happened and the screen decides what that looks like on
 * the theme being worn — `useTheme().accentAt` is the other half, and it is the
 * same call the app's `X.accentAt` makes. On a theme of one colour every badge
 * is that colour, which is the honest drawing: this is a mark on a face rather
 * than a category.
 */
export function alertTone(alert: Alert) {
  switch (alert.kind) {
    case "like":
      return 0;
    case "respond":
      return 5;
    case "note":
      return 2;
    case "share":
      return 4;
    case "face":
      return 6;
    case "mention":
      return 5;
    case "keep":
    case "keep_request":
      return 3;
    case "call":
    case "live":
      return 1;
    case "post":
      return 4;
    case "friend_moment":
      return 4;
    case "achievement":
      return 2;
    case "verify":
      return 5;
    case "login":
    case "staff":
    case "studio":
      return 7;
    default:
      return 0;
  }
}

/**
 * What a tap on the picture at the far end of a row is called out loud.
 *
 * Written per subject rather than built from the tag's bare noun, exactly as
 * `_openLabel` is: "Open the drop", "Open the moment", and plain "Open it" on a
 * kind this build has no word for — which is also the row whose tag is blank.
 */
export function alertOpenLabel(alert: Alert) {
  switch (alert.about) {
    case "moment":
      return "Open the moment";
    case "vibe":
      return "Open the vibe";
    case "memory":
      return "Open the memory";
    case "drop":
      return "Open the drop";
    default:
      return "Open it";
  }
}

/**
 * Where a tap on a row goes, as a web path — or null when there is nowhere.
 *
 * The phone's `_open` in one function, because three surfaces ask it now: the
 * list, the in-app banner and the system notification a background tab raises.
 * A second table would be a second chance to send the same row to two places.
 *
 * Studio news names no row of this database: its `target` is null and its
 * `route` says where it goes. `/theme/<key>`, `/c/<key>`, `/o/<id>` and
 * `/l/<key>` are the server's vocabulary; on the web the two that have a shelf
 * of their own land on it — the shop's themes and its logos — and the other two
 * land on the shop itself, which is what the app does when a figure or an
 * occasion it was told about is no longer on the shelf.
 */
export function alertPath(alert: Alert): string | null {
  const route = (alert.route ?? "").trim();
  if (route) {
    const parts = route.split("/").filter(Boolean);
    if (parts.length === 2) {
      if (parts[0] === "theme") return "/app/settings?section=marketplace&tab=themes";
      if (parts[0] === "l") return "/app/settings?section=marketplace&tab=logos";
      if (parts[0] === "c" || parts[0] === "o") return "/app/settings?section=marketplace";
    }
    // A route this build does not recognise still lands somewhere: the shop is
    // the shelf every one of those links came from.
    return "/app/settings?section=marketplace";
  }
  // A keep request's subject is a person rather than a thing: its two answers
  // are on the row, and what the row body opens is who is asking.
  if (alert.kind === "keep_request") {
    return alert.actor ? `/app/u/${encodeURIComponent(alert.actor.username)}` : null;
  }
  const target = alert.target;
  if (!target) return null;
  if (target.kind === "drop") return `/app/drops/${encodeURIComponent(String(target.id))}`;
  if (target.kind === "vibe") return `/app/drops?vibe=${encodeURIComponent(String(target.id))}`;
  if (target.kind === "moment") return `/app/moments?moment=${encodeURIComponent(String(target.id))}`;
  if (target.kind === "thread") return `/app/convo/${encodeURIComponent(String(target.id))}`;
  if (target.kind === "profile") {
    return alert.actor ? `/app/u/${encodeURIComponent(alert.actor.username)}` : null;
  }
  // A Memory is the one subject the web has no reader for yet; the list says so
  // rather than opening nothing. See `openAlert` in `AlertsPage`.
  return null;
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
