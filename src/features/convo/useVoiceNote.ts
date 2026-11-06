/**
 * The composer's hold-to-record mic, in the browser.
 *
 * This is the web side of what `chat.dart`'s `_holdStart`/`_holdEnd` and
 * `recording_controller.dart` do on the phone: a press on the mic opens the
 * microphone, the finger's release sends what it recorded, a slide left throws
 * it away and a slide up parks it so the finger can come off. The rules
 * themselves live in `voicehold.ts`; this file is the microphone, the recorder
 * and the four ways a hold can end.
 *
 * Three things about the browser shaped this:
 *
 * - **The start is asynchronous.** Asking for the microphone takes a moment,
 *   and a hold can easily be over before it resolves — a quick tap is exactly
 *   that case. So a release never stops a recorder that does not exist yet: it
 *   leaves a note of what the finger wanted (`wanted`) and the start follows
 *   through the moment the recorder is running. Without this, a tap would do
 *   nothing at all and a short hold would send a note that had no beginning.
 * - **A pointer is captured, not followed.** The mic takes the pointer on the
 *   way down, so a finger that slides up or left is still delivered here
 *   instead of to whatever it slid over. This is why the strip only has to
 *   draw the travel: nothing else can steal the gesture.
 * - **The loudness bars are measured, not invented.** An analyser reading the
 *   same stream the recorder is writing gives the 0–100 samples the phone
 *   keeps, and they travel with the note so the phone's bubble can draw them.
 *   The picture in the strip while recording is those same readings.
 *
 * The container is the browser's own guess at what the device can play: MP4/AAC
 * first, because that is what an iPhone will play back, and WebM/Opus — which
 * is what a desktop Chrome is usually left with — after it. See
 * `XELVIC_MOBILE_FEATURE_INVENTORY.md` for what that costs on the other side.
 */
import { useEffect, useRef, useState } from "react";
import {
  amplitudeBar,
  holdSlide,
  MAX_VOICE_BYTES,
  MAX_VOICE_MS,
  MIN_VOICE_MS,
  WAVEFORM_SAMPLE_MS,
  withReading,
  type HoldSlide,
} from "./voicehold";

/** One finished note, ready to be uploaded and sent. */
export interface VoiceNote {
  file: File;
  durationMs: number;
  waveform: number[];
}

export interface VoiceHold {
  /** What the mic is doing: nothing, being held, or parked with nobody on it. */
  phase: "idle" | "recording" | "locked";
  /** Which way the finger has taken the hold, for the strip to draw. */
  slide: HoldSlide;
  /** How far the finger has travelled from the mic, in pixels. */
  travel: { x: number; y: number };
  /** Seconds since the recording started. */
  seconds: number;
  /** The loudness readings so far, oldest first, 0–100 each. */
  levels: number[];
  start: (event: React.PointerEvent<HTMLButtonElement>) => void;
  move: (event: React.PointerEvent<HTMLButtonElement>) => void;
  end: (event: React.PointerEvent<HTMLButtonElement>) => void;
  /** The gesture was taken off us — a scroll, or another pointer. Throws away. */
  drop: () => void;
  /** The bin, which only exists while locked. */
  discard: () => void;
  /** The Send, which only exists while locked. */
  send: () => void;
}

/** What the browser will record in, most widely playable first. */
const CONTAINERS = [
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
];

function pickContainer(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return undefined;
  }
  return CONTAINERS.find((one) => MediaRecorder.isTypeSupported(one));
}

function extensionFor(mime: string): string {
  const base = mime.split(";")[0]?.trim();
  if (base === "audio/mp4") return "m4a";
  if (base === "audio/ogg") return "ogg";
  if (base === "audio/webm") return "webm";
  return "audio";
}

/** What the finger asked for, kept until there is a recorder to answer it. */
type Wanted = "none" | "send" | "discard" | "lock";

interface Session {
  wanted: Wanted;
  /** The recorder is running; there is something to stop. */
  armed: boolean;
  recorder: MediaRecorder | null;
  stream: MediaStream | null;
  context: AudioContext | null;
  analyser: AnalyserNode | null;
  buffer: Uint8Array<ArrayBuffer> | null;
  sampler: number | null;
  clock: number | null;
  chunks: Blob[];
  bytes: number;
  bars: number[];
  startedAt: number;
}

function newSession(): Session {
  return {
    wanted: "none",
    armed: false,
    recorder: null,
    stream: null,
    context: null,
    analyser: null,
    buffer: null,
    sampler: null,
    clock: null,
    chunks: [],
    bytes: 0,
    bars: [],
    startedAt: 0,
  };
}

export function useVoiceNote({
  onSend,
  onSay,
}: {
  onSend: (note: VoiceNote) => void;
  /** A sentence for the person, when something needs saying. */
  onSay: (message: string) => void;
}): VoiceHold {
  const [phase, setPhase] = useState<VoiceHold["phase"]>("idle");
  const [slide, setSlide] = useState<HoldSlide>("none");
  const [travel, setTravel] = useState({ x: 0, y: 0 });
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState<number[]>([]);

  const live = useRef<Session | null>(null);
  const origin = useRef({ x: 0, y: 0 });
  const travelled = useRef({ x: 0, y: 0 });
  const alive = useRef(true);
  // The two answers, held in refs so the recorder's own callbacks — which are
  // made once and outlive the render that made them — never call a stale one.
  const sayRef = useRef(onSay);
  const sendRef = useRef(onSend);
  sayRef.current = onSay;
  sendRef.current = onSend;

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      const session = live.current;
      if (session) {
        session.wanted = "discard";
        stopEverything(session, { silent: true });
      }
      live.current = null;
    };
  }, []);

  /** Let the microphone, the analyser and the clocks go. */
  function stopEverything(session: Session, options: { silent?: boolean } = {}) {
    if (session.sampler !== null) window.clearInterval(session.sampler);
    if (session.clock !== null) window.clearInterval(session.clock);
    session.sampler = null;
    session.clock = null;
    session.stream?.getTracks().forEach((track) => track.stop());
    session.stream = null;
    void session.context?.close().catch(() => undefined);
    session.context = null;
    session.analyser = null;
    session.recorder = null;
    session.armed = false;
    if (!options.silent && alive.current) {
      setPhase("idle");
      setSlide("none");
      setTravel({ x: 0, y: 0 });
      setSeconds(0);
      setLevels([]);
    }
  }

  /** Stop the recorder and drop what it holds — the slide-left ending. */
  function throwAway(session: Session) {
    const recorder = session.recorder;
    if (recorder && recorder.state !== "inactive") {
      // Nobody is listening for this one: a thrown-away note is not a note.
      recorder.onstop = null;
      recorder.ondataavailable = null;
      try {
        recorder.stop();
      } catch {
        /* already stopping */
      }
    }
    stopEverything(session);
    if (live.current === session) live.current = null;
  }

  /** Stop the recorder and send what it holds, if it is worth sending. */
  function commit(session: Session) {
    const recorder = session.recorder;
    if (!recorder || !session.armed || recorder.state === "inactive") {
      throwAway(session);
      return;
    }
    const elapsed = Math.round(performance.now() - session.startedAt);
    const bars = session.bars;
    recorder.onstop = () => {
      const type = recorder.mimeType || "audio/webm";
      const blob = new Blob(session.chunks, { type });
      stopEverything(session);
      if (live.current === session) live.current = null;
      if (!blob.size || elapsed < MIN_VOICE_MS) {
        // Hold is a thing fingers do by accident as well as on purpose, and a
        // second of pocket noise is worse than nothing at all.
        sayRef.current("Hold the mic to record — a tap is too short to send.");
        return;
      }
      sendRef.current({
        file: new File([blob], `voice-${Date.now()}.${extensionFor(type)}`, { type }),
        durationMs: elapsed,
        waveform: bars,
      });
    };
    recorder.stop();
  }

  /** Do what the finger asked for, now that there is something to do it to. */
  function resolve(session: Session) {
    if (!session.armed || live.current !== session) return;
    if (session.wanted === "discard") throwAway(session);
    else if (session.wanted === "lock") {
      setSlide("none");
      setTravel({ x: 0, y: 0 });
      setPhase("locked");
    } else if (session.wanted === "send") commit(session);
  }

  /** Ask for the microphone, start the recorder, and follow through. */
  async function arm(session: Session) {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      live.current = null;
      if (alive.current) setPhase("idle");
      sayRef.current("This browser cannot record a voice note.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      live.current = null;
      if (alive.current) setPhase("idle");
      sayRef.current("Allow the microphone to record a voice note.");
      return;
    }
    // The finger may be off the button already — a tap, or a slide-and-release
    // that happened while the permission prompt was up.
    if (live.current !== session) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    session.stream = stream;

    const container = pickContainer();
    let recorder: MediaRecorder;
    try {
      recorder = container ? new MediaRecorder(stream, { mimeType: container }) : new MediaRecorder(stream);
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stopEverything(session);
        if (alive.current) setPhase("idle");
        sayRef.current("This browser cannot record a voice note.");
        return;
      }
    }

    session.recorder = recorder;
    session.chunks = [];
    session.bytes = 0;
    recorder.ondataavailable = (event) => {
      if (!event.data.size) return;
      session.chunks.push(event.data);
      session.bytes += event.data.size;
    };
    try {
      // A second at a time, so the size ceiling is a real number while the
      // note is still being recorded rather than a surprise at the end.
      recorder.start(1000);
    } catch {
      stopEverything(session);
      if (alive.current) setPhase("idle");
      sayRef.current("This browser cannot record a voice note.");
      return;
    }
    session.armed = true;
    session.startedAt = performance.now();

    // The loudness meter. Feeding a silent gain node is what makes the
    // analyser run at all: a node nothing pulls on is never processed, and
    // the meter would read silence however loud the room was.
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (Ctor) {
        const context = new Ctor();
        const source = context.createMediaStreamSource(stream);
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        const quiet = context.createGain();
        quiet.gain.value = 0;
        source.connect(analyser);
        analyser.connect(quiet);
        quiet.connect(context.destination);
        session.context = context;
        session.analyser = analyser;
        session.buffer = new Uint8Array(new ArrayBuffer(analyser.fftSize));
      }
    } catch {
      // A note without a picture of its own sound is still a note.
    }

    session.sampler = window.setInterval(() => {
      const analyser = session.analyser;
      const buffer = session.buffer;
      let bar = 0;
      if (analyser && buffer) {
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (const one of buffer) {
          const value = (one - 128) / 128;
          sum += value * value;
        }
        bar = amplitudeBar(Math.sqrt(sum / buffer.length));
      }
      session.bars = withReading(session.bars, bar);
      if (alive.current) setLevels(session.bars);

      const elapsed = performance.now() - session.startedAt;
      if (elapsed >= MAX_VOICE_MS || session.bytes >= MAX_VOICE_BYTES) {
        sayRef.current(
          elapsed >= MAX_VOICE_MS
            ? "That is the longest voice note there is — sending it as it stands."
            : "That voice note is as big as one can be — sending it as it stands.",
        );
        session.wanted = "send";
        resolve(session);
      }
    }, WAVEFORM_SAMPLE_MS);

    session.clock = window.setInterval(() => {
      if (alive.current) setSeconds((performance.now() - session.startedAt) / 1000);
    }, 200);

    if (session.wanted !== "none") resolve(session);
  }

  const start = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (live.current || (event.pointerType === "mouse" && event.button !== 0)) return;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      /* a pointer that cannot be captured is still followed by the handlers */
    }
    origin.current = { x: event.clientX, y: event.clientY };
    travelled.current = { x: 0, y: 0 };
    const session = newSession();
    live.current = session;
    setPhase("recording");
    setSlide("none");
    setTravel({ x: 0, y: 0 });
    setSeconds(0);
    setLevels([]);
    void arm(session);
  };

  const move = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = live.current;
    if (!session || session.wanted === "lock") return;
    const next = {
      x: event.clientX - origin.current.x,
      y: event.clientY - origin.current.y,
    };
    travelled.current = next;
    setTravel(next);
    setSlide(holdSlide(next));
  };

  const end = (event: React.PointerEvent<HTMLButtonElement>) => {
    const session = live.current;
    if (!session) return;
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      /* already released */
    }
    // Read the finger's travel rather than the rendered slide: a release can
    // arrive in the same frame as the move that decided it.
    const way = holdSlide(travelled.current);
    session.wanted = way === "cancel" ? "discard" : way === "lock" ? "lock" : "send";
    resolve(session);
  };

  const drop = () => {
    const session = live.current;
    if (!session) return;
    session.wanted = "discard";
    resolve(session);
  };

  const discard = () => {
    const session = live.current;
    if (!session) return;
    session.wanted = "discard";
    resolve(session);
  };

  const send = () => {
    const session = live.current;
    if (!session) return;
    session.wanted = "send";
    resolve(session);
  };

  return { phase, slide, travel, seconds, levels, start, move, end, drop, discard, send };
}
