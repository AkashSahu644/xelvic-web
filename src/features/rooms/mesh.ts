/**
 * The rules a room's mesh is built on, as arithmetic over plain values.
 *
 * A room's sound is a mesh: every phone on the stage holds one connection to
 * every other phone that can hear it, and the server never touches the audio.
 * A mesh has no host to ask who connects to whom, so the ordering has to be
 * something both ends can work out alone, from the same two ids, without a
 * round trip — which is the whole of this file.
 *
 * It is kept apart from `stage.ts` because none of it needs a browser: the
 * rules can be read, tested and argued about without a microphone, and the
 * connection code next door is then only the plumbing.
 */

/**
 * Who makes the offer, for one pair.
 *
 * The lower id offers, so the two ends of a pair always agree on which of them
 * starts — a comparison both can make, needing no server and no handshake.
 * With one exception, and it is the exception the listening half of a room
 * rests on: a listener is nobody the stage has ever heard of. The audience is a
 * count and never a list, so a listener cannot wait to be offered to — nobody
 * knows they are there — and offers to everybody on the stage instead.
 *
 * The comparison is by code unit, which is what Dart's `compareTo` does and
 * what the phone relies on; a locale-aware comparison would put two phones on
 * different sides of the same pair.
 */
export function whoOffers(input: {
  mine: string;
  theirs: string;
  hearOnly: boolean;
}): boolean {
  if (!input.mine || !input.theirs || input.mine === input.theirs) return false;
  return input.hearOnly || input.mine < input.theirs;
}

/**
 * Whether the room a phone is in has become a different room to be in.
 *
 * A connection's tracks are decided when it is built and this mesh never
 * renegotiates, so a phone brought onto the stage — or taken off it — cannot
 * bend the connections it already has: the microphone is what changed, and a
 * track cannot be added to a connection that exists. The room is built again
 * instead, and this is the question that says so.
 */
export function needsRebuild(
  current: { call: string; hearOnly: boolean } | null,
  next: { call: string; hearOnly: boolean },
): boolean {
  if (!current) return false;
  return current.call !== next.call || current.hearOnly !== next.hearOnly;
}

/** One signal off the relay, as this side reads it. */
export type RoomSignal =
  | { kind: "offer"; sdp: string }
  | { kind: "answer"; sdp: string }
  | { kind: "candidate"; candidate: RTCIceCandidateInit };

/**
 * What a `signal` field means, or null for anything that is not one.
 *
 * The relay carries whatever the sender put in it, so this is where a frame
 * from a phone running a different build stops — and it stops rather than
 * throwing, because an exception in an ICE callback is a connection that
 * quietly never completes.
 */
export function readSignal(value: unknown): RoomSignal | null {
  if (!value || typeof value !== "object") return null;
  const signal = value as Record<string, unknown>;
  if (signal.type === "offer" || signal.type === "answer") {
    const sdp = typeof signal.sdp === "string" ? signal.sdp : "";
    if (!sdp) return null;
    return { kind: signal.type, sdp };
  }
  if (signal.type === "candidate") {
    const raw = signal.candidate;
    if (!raw || typeof raw !== "object") return null;
    const candidate = raw as Record<string, unknown>;
    const line =
      typeof candidate.candidate === "string" ? candidate.candidate : "";
    if (!line) return null;
    const out: RTCIceCandidateInit = { candidate: line };
    if (typeof candidate.sdpMid === "string") out.sdpMid = candidate.sdpMid;
    if (typeof candidate.sdpMLineIndex === "number") {
      out.sdpMLineIndex = candidate.sdpMLineIndex;
    }
    return { kind: "candidate", candidate: out };
  }
  return null;
}

/**
 * The lines an offer names when the offerer sends nothing.
 *
 * A connection with no tracks and no transceivers has no m-lines at all, so the
 * offer that goes out is an SDP with nothing in it and the answer comes back
 * the same — the far end then has no line to put a voice on, and that is a
 * listener sitting in the relay hearing nothing. An offer's m-lines are the
 * offerer's to name, and a listener is always the one who offers, so a listener
 * names the lines it wants to receive on: receive-only, which says the whole of
 * it — nothing goes out from here, and the stage has somewhere to answer into.
 */
export function receiveOnlyKinds(video: boolean): ("audio" | "video")[] {
  return video ? ["audio", "video"] : ["audio"];
}