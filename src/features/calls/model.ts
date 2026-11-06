import type { SocketFrame } from "@/providers/SocketProvider";
import type { CallParty, CallSeat } from "@/services/calls.service";

/**
 * The shape of a call, with no browser in it.
 *
 * Everything here is a decision that can be made about strings and numbers —
 * which phase a frame leaves the call in, whether two crossed offers mean this
 * end gives way, what a goodbye says — so it can be tested without a
 * microphone, a socket or a server. `engine.ts` is the half that owns the
 * `RTCPeerConnection`s and the devices; it asks these questions rather than
 * answering them itself.
 */

/** Where a call is. The phone's `CallPhase`, with the same five words. */
export type CallPhase = "idle" | "dialling" | "ringing" | "live" | "over";

export type CallKind = "audio" | "video";

/** How long a ring lasts, when the server has not said otherwise. */
export const DEFAULT_RING_SECONDS = 45;

/** How long the goodbye stays on screen before the call is put away. */
export const GOODBYE_MS = 1400;

/** How long one request may wait for the server's own word on it. */
export const ASK_TIMEOUT_MS = 15_000;

/** The line a call with nobody left on it leaves behind. */
export const MISSED_CALL = "Missed call";
export const CALL_ENDED = "Call ended";
export const NO_ANSWER = "No answer";

/** A whole number of seconds, or the default — a frame cannot make a ring endless. */
export function ringSeconds(party: CallParty | null | undefined): number {
  const said = Number(party?.ring_seconds);
  if (!Number.isFinite(said) || said <= 0) return DEFAULT_RING_SECONDS;
  return Math.floor(said);
}

/** `"video"` or `"audio"`, from whatever a frame happened to carry. */
export function callKind(value: unknown): CallKind {
  return value === "video" ? "video" : "audio";
}

/**
 * Which end starts the negotiation again when two offers cross.
 *
 * Until a call could change kind, two offers could not cross: who offered was
 * settled when the call was placed, and the newcomer only ever answered. An
 * audio call that can become a video one adds a second reason to offer, and
 * two people turning their cameras on at the same instant is two ends
 * describing the same connection in opposite directions. A description cannot
 * be read against a connection that is midway through describing itself, so
 * both are thrown away and one of them starts again.
 *
 * Both ends run this on the same pair of ids and must reach *opposite*
 * answers: one that had both of them give way would leave the call with no
 * connection at all, and one that had neither would leave it with two. The ids
 * are uuids, so they never compare equal and there is no third answer.
 *
 * `compareTo` on the phone is code-unit order, and so is `<` here.
 */
export function offersAfterCollision(mine: string, theirs: string): boolean {
  return mine > theirs;
}

/** How much a picture's shape has to move before it is a different source. */
export const SHAPE_SHIFT = 0.12;

/**
 * Whether the far end is now sending a different shape of picture.
 *
 * A camera does not change its own frame in the middle of a call, so a picture
 * that does is the far end switching what it sends — a camera for a screen, or
 * back. The distinction matters because a shared screen is wide and the stage
 * is usually upright: drawn to fill, only its middle is visible, which is the
 * owner's report of 2026-11-06. `before` is the previous height-over-width and
 * `after` the one just measured; a shape that has never been measured gives
 * `false`, because there is nothing to have changed from.
 */
export function sourceChanged(before: number, after: number): boolean {
  if (!(before > 0) || !(after > 0)) return false;
  return Math.abs(after - before) / before > SHAPE_SHIFT;
}

/** The `data` object of a frame, or an empty one for a frame with none. */
export function frameData(frame: SocketFrame): Record<string, unknown> {
  return frame.data && typeof frame.data === "object"
    ? (frame.data as Record<string, unknown>)
    : {};
}

/** One id out of a frame field, or null for a field that names nobody. */
export function text(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const out = String(value);
  return out.length ? out : null;
}

/** A party frame read off the wire, with only the fields that were really there. */
export function partyOf(data: Record<string, unknown>): CallParty | null {
  const call = text(data.call);
  if (!call) return null;
  return data as unknown as CallParty;
}

/** The seat for one person, if they are on this call. */
export function seatOf(party: CallParty | null, userId: string | null): CallSeat | null {
  if (!party?.members || !userId) return null;
  return party.members.find((seat) => seat.user === userId) ?? null;
}

/** Everybody on the call except this end. */
export function otherSeats(party: CallParty | null, selfId: string): CallSeat[] {
  return (party?.members ?? []).filter((seat) => seat.user !== selfId);
}

/** The person a screen draws for a one-to-one call. */
export function otherPerson(
  party: CallParty | null,
  selfId: string,
): CallSeat | null {
  return otherSeats(party, selfId)[0] ?? null;
}

/** What to call somebody: their name, their handle, or a neutral word. */
export function personName(seat: CallSeat | null | undefined): string {
  if (!seat) return "Someone";
  return (seat.name ?? "").trim() || seat.username || "Someone";
}

/** The people a one-to-one call is between, for a title. */
export function callTitle(
  party: CallParty | null,
  selfId: string,
  kind: CallKind,
): string {
  const others = otherSeats(party, selfId).filter((seat) => seat.state !== "left");
  if (others.length === 0) return kind === "video" ? "Video call" : "Audio call";
  if (others.length === 1) return personName(others[0]);
  return `${personName(others[0])} + ${others.length - 1}`;
}

/** Whether a seat is still in the call, for a tile that should still be drawn. */
export function seatIsHere(seat: CallSeat): boolean {
  return seat.state !== "left" && seat.state !== "declined";
}

/**
 * The goodbye line, decided from what this end knows.
 *
 * The first reason wins on the phone, and it wins here for the same reason:
 * this end usually knows before the server says — it knows a ring ran out, and
 * it knows the call it just cancelled — and a later frame must not talk it out
 * of the better answer.
 */
export function goodbyeLine(input: {
  phase: CallPhase;
  by: string | null;
  selfId: string;
  answered: boolean;
  party: CallParty | null;
}): string {
  if (input.phase === "ringing") return MISSED_CALL;
  if (input.by === null || input.by === input.selfId) return CALL_ENDED;
  if (input.phase === "dialling" && !input.answered) return NO_ANSWER;
  const them = seatOf(input.party, input.by);
  if (!them) return CALL_ENDED;
  return `${personName(them)} left`;
}

/**
 * The line under the name on a ringing or dialling screen.
 *
 * `reachable` is the server's own answer about whether a phone can be woken at
 * all — the difference between "Ringing" and somebody who will never hear it —
 * and `online` is narrower: the app being open right now. A ringing seat with a
 * registered phone is ringing, not away, which is why both are read.
 */
export function ringLine(input: {
  phase: CallPhase;
  seat: CallSeat | null;
  kind: CallKind;
  answered: boolean;
}): string {
  const what = input.kind === "video" ? "video call" : "call";
  if (input.phase === "ringing") {
    return `Incoming ${what}`;
  }
  if (input.phase === "dialling") {
    if (input.answered || input.seat?.state === "joined") return "Connecting…";
    if (input.seat && input.seat.reachable === false) return "Offline";
    return "Ringing…";
  }
  return "";
}