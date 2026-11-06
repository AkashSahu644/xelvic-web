import {
  BadgeCheck,
  Ban,
  Banknote,
  Circle,
  CircleCheck,
  Mail,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Deal, DealEvent, DealStatus, DealUser } from "@/types/api";

/**
 * The deals model — every word and every rule the three deal screens share.
 *
 * Ported from `app/lib/deals.dart` and `app/lib/screens/deals/deal_detail.dart`,
 * `deals_home.dart`, `creator_directory.dart` and `invite_compose.dart`. The app
 * keeps the status *word* out of its data layer on purpose: `DealStatus` is what
 * the server stores and what every screen matches on, so it is never translated
 * itself, and the switch that turns it into a sentence "belongs beside the
 * screen that draws it". On the web the screens are three files and this is the
 * one thing they all need, so it lives here — same division, one folder up.
 *
 * Nothing here decides *whether* an action is allowed. That is the server's
 * `can` map, read through `canDo`. A status is never turned into a permission
 * on this side of the wire.
 */

/** The closed statuses: the deal is over and nothing more will happen to it. */
export function isClosed(status: DealStatus): boolean {
  return status === "paid" || status === "declined" || status === "cancelled";
}

/**
 * The status the wire sent, with the app's default.
 *
 * `dealStatusFrom` in `lib/deals.dart` falls back to `invited` for anything it
 * does not recognise — a status this build has not been taught yet is still a
 * deal that has been sent and not yet answered, which is the least wrong thing
 * to draw, and it keeps the row tappable instead of throwing on a payload.
 */
export function statusFrom(raw: string | null | undefined): DealStatus {
  switch (raw) {
    case "accepted":
    case "declined":
    case "delivered":
    case "approved":
    case "paid":
    case "cancelled":
      return raw;
    default:
      return "invited";
  }
}

/** The one-word state, in the person's language. `Str.dealsStatus*`. */
export const STATUS_WORDS: Record<DealStatus, string> = {
  invited: "Invited",
  accepted: "Accepted",
  declined: "Declined",
  delivered: "Delivered",
  approved: "Approved",
  paid: "Paid",
  cancelled: "Cancelled",
};

export function statusWord(status: DealStatus): string {
  return STATUS_WORDS[status];
}

/**
 * Whether the server's `can` map allows an action.
 *
 * `deal.canDo(action)` on the phone, and deliberately `=== true`: a map that is
 * missing, or that carries a null, or that this build has not been taught the
 * key for, must draw *no* button. The failure mode of guessing here is a button
 * that 403s; the failure mode of refusing here is a button that is not there,
 * which is what the server said.
 */
export function canDo(deal: Deal, action: string): boolean {
  return deal.can?.[action] === true;
}

/** The party opposite me — the creator when I am the company, and the reverse. */
export function counterpart(deal: Deal): DealUser | null {
  return deal.my_role === "company" ? (deal.creator ?? null) : (deal.company ?? null);
}

/** The name to draw for a party: their name, else their handle, else nothing. */
export function userLine(user: DealUser | null | undefined): string {
  if (!user) return "";
  if (user.name) return user.name;
  if (user.username) return user.username;
  return "";
}

/**
 * The amount in the way a person reads it: a rupee sign for INR, the code in
 * front otherwise, grouped so a lakh does not read as a wall of digits.
 *
 * `_money` in `deal_detail.dart` and `_amountLine` in `deals_home.dart` are two
 * copies of this on the phone — one of them grouped the absolute value, the
 * other did not — so the two screens disagreed about a negative amount. Here
 * there is one function and `grouped` keeps the sign, which is the half of that
 * pair worth keeping.
 */
export function money(amount: number, currency: string): string {
  const value = grouped(amount);
  return currency === "INR" ? `₹${value}` : `${currency} ${value}`;
}

/** Thousands separators, with the sign kept outside them. */
export function grouped(amount: number): string {
  const digits = Math.abs(Math.trunc(amount)).toString();
  let out = "";
  for (let i = 0; i < digits.length; i += 1) {
    if (i !== 0 && (digits.length - i) % 3 === 0) out += ",";
    out += digits[i];
  }
  return `${amount < 0 ? "-" : ""}${out}`;
}

/** mm:ss for a clip's length, as the preview badge carries it. */
export function clockMs(ms: number): string {
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
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

function parse(value: string | null | undefined): Date | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** A day written out: '25 Sep 2026'. `fullDay` on the phone. */
export function fullDay(value: string | Date | null | undefined): string {
  const at = value instanceof Date ? value : parse(value);
  if (!at) return "";
  return `${at.getDate()} ${MONTHS[at.getMonth()]} ${at.getFullYear()}`;
}

/**
 * `ago` and `shortDay` live in `lib/format` now.
 *
 * They were written here for the timeline when deals was the only screen in the
 * port that needed the app's own ladder rather than the browser's `Intl` word,
 * and the devices screen needs exactly the same two — the same ladder, not a
 * second copy of it that can drift. Re-exported so this folder's screens go on
 * reading them from here, beside the `stamp` that is deliberately a *different*
 * ladder.
 */
export { ago, shortDay } from "@/utils/format";

/**
 * The short stamp a list row carries: `stamp` on the phone — 'now', '5m', '3h',
 * '2d'. Not the same ladder as `ago`, and not the same as the date, because a
 * row wants the shortest thing that answers "how fresh is this".
 */
export function stamp(value: string | null | undefined): string {
  const at = parse(value);
  if (!at) return "";
  const minutes = Math.floor((Date.now() - at.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

/**
 * The line at the right of a row: when it is due if it has a deadline, and
 * otherwise when it was sent — `Str.dealsDue` over `stamp`.
 */
export function stampLine(
  deadline: string | null | undefined,
  createdAt: string | null | undefined,
): string {
  if (deadline) return `due ${stamp(deadline)}`;
  if (createdAt) return stamp(createdAt);
  return "";
}

/* ---------------------------------------------------------------- timeline -- */

/** The event's word. `_eventLabel`. An unknown kind is capitalised, not hidden. */
export function eventWord(kind: string): string {
  switch (kind) {
    case "invited":
      return "Invited";
    case "accepted":
      return "Accepted";
    case "declined":
      return "Declined";
    case "delivered":
      return "Deliverable uploaded";
    case "approved":
      return "Approved";
    case "paid":
      return "Marked paid";
    case "cancelled":
      return "Cancelled";
    default:
      return kind ? kind[0].toUpperCase() + kind.slice(1) : "Updated";
  }
}

/** The dot's glyph. `_eventIcon`, as the same-named lucide icons. */
export const EVENT_ICONS: Record<string, LucideIcon> = {
  invited: Mail,
  accepted: CircleCheck,
  declined: Ban,
  delivered: Upload,
  approved: BadgeCheck,
  paid: Banknote,
  cancelled: X,
};

export function eventIcon(kind: string): LucideIcon {
  return EVENT_ICONS[kind] ?? Circle;
}

/**
 * The dot's colour: the bad colour for the two ways a deal can end badly, the
 * good colour for the two that mean the work landed, the accent for everything
 * else. A CSS variable rather than a hex, so a theme moves it.
 */
export function eventTone(kind: string): string {
  if (kind === "declined" || kind === "cancelled") return "var(--bad)";
  if (kind === "approved" || kind === "paid") return "var(--good)";
  return "var(--accent)";
}

/** Who did it, when the server said. `Str.dealsBy`. */
export function eventByName(event: DealEvent): string {
  const by = event.by;
  if (!by) return "";
  return by.name || by.username || "";
}

/* ------------------------------------------------------------ deliverable -- */

/** The four things a deliverable can be, in the order the row lays them out. */
export const DELIVERABLE_KINDS = ["video", "image", "moment", "drop"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

const KIND_WORDS: Record<string, string> = {
  video: "Video",
  image: "Image",
  moment: "Moment",
  drop: "Drop",
};

export function kindWord(kind: string): string {
  return KIND_WORDS[kind] ?? kind;
}

/**
 * The clause the invite form opens with — `Str.inviteAgreementDefault`.
 *
 * Prefilled so the terms are never an empty box: the company edits it if it
 * wants, but a sensible default is what most invites go out on, and it names
 * the three things both sides then read off the deal.
 */
export function agreementDefault(kind: string): string {
  return (
    `This agreement covers one ${kindWord(kind).toLowerCase()} made to the brief above. ` +
    "The creator uploads the deliverable for approval; payment of the agreed amount is " +
    "released only after the company has approved the delivered content. Either side may " +
    "cancel before the creator accepts."
  );
}
