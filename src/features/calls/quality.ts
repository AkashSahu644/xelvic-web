/**
 * How good the call actually is, and how to ask for a good one.
 *
 * Two halves of the same complaint. The first is what the browser is *told* to
 * send — a camera asked for "any picture at all" hands back a 640×480 one, and
 * an encoder left at its own defaults drops a face to mush the moment the link
 * dips. The second is what the browser *reports* about the link it ended up
 * with, read from `getStats()` rather than guessed at.
 *
 * Everything here is arithmetic over plain values, so it can be tested without
 * a camera, a connection or a browser. Nothing in this file invents a number:
 * a reading that is not there is null, and the screen draws nothing for it.
 */

/** What a connection is like, in words a screen can draw. */
export type QualityLevel = "good" | "fair" | "weak" | "unknown";

export interface CallQuality {
  level: QualityLevel;
  /** Round trip, in milliseconds, as the browser measured it. */
  rttMs: number | null;
  /** Packets lost, as a percentage of the packets that should have arrived. */
  lossPercent: number | null;
  /** The picture being received, when there is one. */
  width: number | null;
  height: number | null;
  fps: number | null;
}

export const UNKNOWN_QUALITY: CallQuality = {
  level: "unknown",
  rttMs: null,
  lossPercent: null,
  width: null,
  height: null,
  fps: null,
};

/** One `RTCStats` row, flattened — what `report.forEach` hands over. */
export interface StatEntry {
  type?: string;
  [key: string]: unknown;
}

function number(value: unknown): number | null {
  const out = typeof value === "number" ? value : Number.NaN;
  return Number.isFinite(out) ? out : null;
}

/**
 * A lost-packet percentage that cannot be nonsense.
 *
 * The two counters are lifetime totals for the stream, and a stream that has
 * just started has received almost nothing — so a single lost packet at the
 * beginning reads as a catastrophic loss. Below a handful of packets the ratio
 * is not a measurement, it is arithmetic on noise, and it is reported as
 * nothing rather than as a fault.
 */
export const LOSS_FLOOR_PACKETS = 20;

export function lossPercent(received: number | null, lost: number | null): number | null {
  if (received === null || lost === null) return null;
  const total = received + lost;
  if (total < LOSS_FLOOR_PACKETS || lost < 0) return null;
  return (lost / total) * 100;
}

/** Which of the three words a reading deserves. */
export function levelFor(input: {
  rttMs: number | null;
  lossPercent: number | null;
}): QualityLevel {
  const { rttMs, lossPercent: loss } = input;
  if (rttMs === null && loss === null) return "unknown";
  // Loss first: a link that is dropping packets is a link that stutters,
  // whatever its round trip says.
  if (loss !== null && loss >= 8) return "weak";
  if (rttMs !== null && rttMs >= 500) return "weak";
  if (loss !== null && loss >= 2) return "fair";
  if (rttMs !== null && rttMs >= 220) return "fair";
  return "good";
}

/**
 * Read a `getStats()` report.
 *
 * The two rows that matter are the inbound stream and the pair of candidates
 * carrying it: the first knows what arrived and how much of it was lost, the
 * second knows how long a round trip takes. Everything else — codecs, the
 * transport, the certificates — is not this screen's business.
 */
export function readQuality(entries: StatEntry[]): CallQuality {
  const out: CallQuality = { ...UNKNOWN_QUALITY };
  let received: number | null = null;
  let lost: number | null = null;

  for (const entry of entries) {
    if (entry.type === "inbound-rtp") {
      // Audio and video are both `inbound-rtp`; the video one is the one that
      // carries a picture, and its counters are the ones worth reading when
      // there is one.
      const hasPicture = number(entry.frameWidth) !== null;
      const entryReceived = number(entry.packetsReceived);
      const entryLost = number(entry.packetsLost);
      if (hasPicture) {
        out.width = number(entry.frameWidth);
        out.height = number(entry.frameHeight);
        out.fps = number(entry.framesPerSecond);
      }
      // The picture's own counters when there is a picture, the audio's
      // otherwise: one reading, from the stream that is actually moving.
      if (hasPicture || received === null) {
        received = entryReceived ?? received;
        lost = entryLost ?? lost;
      }
      continue;
    }
    if (entry.type === "candidate-pair") {
      const state = entry.state;
      // Only the pair that is actually carrying the call.
      if (state !== "succeeded") continue;
      const rtt = number(entry.currentRoundTripTime);
      if (rtt === null) continue;
      out.rttMs = Math.round(rtt * 1000);
    }
  }

  out.lossPercent = lossPercent(received, lost);
  out.level = levelFor({ rttMs: out.rttMs, lossPercent: out.lossPercent });
  return out;
}

/** The line under the clock, or nothing when there is nothing to say. */
export function qualityLine(quality: CallQuality): string {
  if (quality.level === "unknown") return "";
  if (quality.level === "good") return "";
  return quality.level === "weak" ? "Weak connection" : "Unsettled connection";
}

/**
 * What a camera is asked for.
 *
 * The app asks for 1280×720 at 30 (`calls.dart`), which is a phone's own
 * sensible middle; a laptop's camera can do better and a call between a laptop
 * and a phone looks its worst when the laptop is the one sending a small
 * picture. So the ask is 1080p at 30 with 720p as the floor — `ideal` and
 * `min` rather than `exact`, because a camera that cannot do 1080p must still
 * be used rather than refused.
 *
 * `facingMode` is only named when no particular camera was chosen: naming both
 * a device and a facing is a constraint some browsers resolve by refusing.
 */
export function videoConstraints(deviceId?: string | null): MediaTrackConstraints {
  const size = {
    width: { ideal: 1920, min: 640 },
    height: { ideal: 1080, min: 480 },
    frameRate: { ideal: 30, max: 30 },
  };
  if (deviceId) return { ...size, deviceId: { exact: deviceId } };
  return { ...size, facingMode: "user" };
}

/** What a microphone is asked for — the app's own three answers. */
export function audioConstraints(deviceId?: string | null): MediaTrackConstraints {
  const shape = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };
  if (deviceId) return { ...shape, deviceId: { exact: deviceId } };
  return shape;
}

/**
 * How much a picture is allowed to spend, from its own size.
 *
 * Left alone, an encoder picks a bitrate for the resolution it was given and
 * then, under pressure, throws resolution away to keep the frame rate — which
 * is exactly the "blurry" this exists to stop. The number is bits per second
 * for a camera picture: about 0.1 bits per pixel per frame at 30 fps, floored
 * so a small picture is still not starved and capped so a 4K camera does not
 * ask for a link nobody has.
 */
export const VIDEO_MIN_BITRATE = 600_000;
export const VIDEO_MAX_BITRATE = 4_000_000;

export function videoBitrate(width: number, height: number, fps = 30): number {
  const wanted = Math.round(width * height * fps * 0.1);
  return Math.min(VIDEO_MAX_BITRATE, Math.max(VIDEO_MIN_BITRATE, wanted));
}

/** What the sender is told, once it has a track. */
export function videoSenderParams(): {
  degradationPreference: RTCDegradationPreference;
  maxBitrate: number;
  maxFramerate: number;
} {
  return {
    // "Keep the picture sharp and drop frames if you must" — the opposite of
    // the browser's own default, and the whole of why a face stops smearing.
    degradationPreference: "maintain-resolution",
    maxBitrate: videoBitrate(1920, 1080, 30),
    maxFramerate: 30,
  };
}

/** A camera or microphone's name, for a menu that has to draw something. */
export function deviceLabel(
  device: { label?: string; kind?: string },
  index: number,
): string {
  const named = (device.label ?? "").trim();
  if (named) return named;
  // A browser hides labels until permission has been given, and a menu of
  // blank rows is worse than a menu of numbered ones.
  return `${device.kind === "audioinput" ? "Microphone" : device.kind === "audiooutput" ? "Speaker" : "Camera"} ${index + 1}`;
}
