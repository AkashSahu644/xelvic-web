/**
 * The sound of a phone being rung — and of a phone ringing somebody else.
 *
 * A call that arrives in silence is a call nobody in the next room knows about,
 * and the app settled this long ago: `app/lib/ringtone.dart` rings with a real
 * recording (`assets/ringtone/call.wav`, the same file this build serves from
 * `/ringtone/call.wav`) and falls back to a written tone when there is no asset
 * to play. Both halves are here, in the same order and for the same reason.
 *
 * Three things are worth knowing before reading on.
 *
 *   * **The ring is a loop, the ringback is not the ring.** What the *called*
 *     phone hears is the ringtone; what the *caller* hears is a different shape
 *     on purpose — one long tone and a long silence, the "trring... trring..." of
 *     a line that is open and waiting. A caller who heard their own ringtone
 *     would think somebody was calling them (`ringtone.dart`, [Ringback]).
 *
 *   * **The written tone is the fallback, not the ring.** The asset is what a
 *     ring is supposed to sound like, and it is warmed before it is wanted: a
 *     sound fetched over the network starts after the caller has given up. The
 *     written tone — the same two bursts `sounds.dart`'s `_classicRing` writes,
 *     640 Hz then 510 Hz, twice, a breath apart — is what plays if the asset is
 *     missing. It is synthesised through WebAudio rather than shipped as a
 *     second file, exactly as the app synthesises it.
 *
 *   * **A browser can refuse to play anything at all.** An audio element told to
 *     play before the person has touched the page is refused outright, and a
 *     refused ring is not a quiet ring — it is a call that never announced
 *     itself. [Ringer.blocked] says so rather than swallowing it, and the screen
 *     turns that into one tap that starts the sound for real. Nothing here
 *     pretends a ring was heard.
 */

/** The app's own ringtone, already in this build's `public/`. */
export const RINGTONE_URL = "/ringtone/call.wav";

/** One written tone: the frequencies sounded together, and for how long. */
export interface Tone {
  hz: number[];
  seconds: number;
}

/**
 * The classic ring, written — `sounds.dart`'s `_classicRing`, tone for tone.
 *
 * Two bursts of two notes a third apart, a breath between them, then a longer
 * quiet: the shape a telephone has always made. `LEVEL` and the 6 ms edge are
 * the app's own numbers, and the edge is not decoration — a tone that starts at
 * full amplitude is a click, and a click every three seconds is what a ringtone
 * sounds like when it is wrong.
 */
export const CLASSIC_LEVEL = 0.85;
export const RINGBACK_LEVEL = 0.7;
/** How long a tone takes to reach full amplitude, at each end. */
export const EDGE_SECONDS = 0.006;

/** The written ring, as the app writes it: burst, breath, burst, quiet. */
export const CLASSIC_RING: Tone[] = [
  { hz: [640], seconds: 0.4 },
  { hz: [], seconds: 0.05 },
  { hz: [510], seconds: 0.4 },
  { hz: [], seconds: 0.05 },
  { hz: [], seconds: 0.35 },
  { hz: [640], seconds: 0.4 },
  { hz: [], seconds: 0.05 },
  { hz: [510], seconds: 0.4 },
  { hz: [], seconds: 0.05 },
  { hz: [], seconds: 0.95 },
];

/**
 * The ringback, written — one second of two notes a fifth apart, two of quiet.
 *
 * Deliberately not the ring's shape; see the note at the top of the file.
 */
export const RINGBACK: Tone[] = [
  { hz: [440, 480], seconds: 1 },
  { hz: [], seconds: 2 },
];

/** How long one pass of a written tone lasts. */
export function loopSeconds(tones: Tone[]): number {
  return tones.reduce((total, tone) => total + tone.seconds, 0);
}

/**
 * The buzz of a phone ringing, in the vibration API's own language.
 *
 * Milliseconds, alternating off and on, starting with off — `[0, 500, 300,
 * 400]` is "wait none, buzz half a second, pause, buzz". It rides the same
 * clock as the ring: it is repeated for as long as the ring is, and a browser
 * that ignores it (most desktops, and any page the person has not touched) is
 * simply a phone that does not buzz.
 */
export const VIBRATE_INCOMING: number[] = [0, 500, 300, 400, 300, 500, 1200];

/** One pass of the written ring, as samples, with both ends rounded. */
export function samplesFor(tones: Tone[], rate: number): Float32Array<ArrayBuffer> {
  const total = Math.round(loopSeconds(tones) * rate);
  const out = new Float32Array(total);
  let at = 0;
  for (const tone of tones) {
    const count = Math.round(tone.seconds * rate);
    const level = tone.hz.length ? CLASSIC_LEVEL / tone.hz.length : 0;
    for (let i = 0; i < count && at + i < total; i += 1) {
      if (!tone.hz.length) continue;
      const edge = Math.min(
        1,
        Math.min(i, count - 1 - i) / Math.max(1, rate * EDGE_SECONDS),
      );
      let wave = 0;
      for (const hz of tone.hz) wave += Math.sin((2 * Math.PI * hz * i) / rate);
      out[at + i] = wave * level * edge;
    }
    at += count;
  }
  return out;
}

/** Which ring a browser ends up playing, and whether it has one at all. */
export type RingSource = "asset" | "written" | "none";

/**
 * Which sound a ring is made of.
 *
 * The asset is believed whenever it is there, because it is the real ringtone
 * and the written tone is only ever its stand-in. `none` is the honest answer
 * for a browser with no audio at all — nothing is played and nothing claims to
 * have been.
 */
export function ringSource(input: {
  assetOk: boolean;
  audioOk: boolean;
}): RingSource {
  if (!input.audioOk) return "none";
  return input.assetOk ? "asset" : "written";
}

/** An audio element, or whatever answers like one. Injected so this is testable. */
export interface Speaker {
  play(): Promise<void>;
  pause(): void;
  load(): void;
}

interface Ringing {
  kind: "in" | "out";
  stop: () => void;
}

/**
 * The tab's one ringer.
 *
 * One object rather than a sound per call, because two rings at once is a
 * sound nobody can act on: an incoming ring that arrives while this tab is
 * already ringing somebody replaces nothing and starts nothing (`start` is a
 * no-op while it is ringing), and the end of a call always stops whatever was
 * playing.
 */
export class Ringer {
  private audio: HTMLAudioElement | null = null;
  private context: AudioContext | null = null;
  private source: AudioBufferSourceNode | null = null;
  private now: Ringing | null = null;
  private wanted = false;
  private vibrate: ReturnType<typeof setInterval> | null = null;
  private assetFailed = false;

  /** Whether a ring asked for was refused by the browser's own autoplay rule. */
  blocked = false;

  /** Told when a ring could not start, so a screen can offer a tap. */
  onBlocked: (() => void) | null = null;

  constructor(
    private makeAudio: () => HTMLAudioElement = () =>
      new Audio(RINGTONE_URL),
    private buzz: (pattern: number[]) => void = (pattern) => {
      // A browser with no vibration API, or a desktop, is not an error.
      try {
        navigator.vibrate?.(pattern);
      } catch {
        // Some browsers expose the function and refuse to use it.
      }
    },
  ) {}

  /**
   * The ringtone, fetched before it is wanted.
   *
   * Called when a call is first heard of rather than when it is answered — a
   * ring has no second to spare, and an asset that begins downloading on the
   * first ring arrives after the caller has hung up. Safe to call repeatedly.
   */
  warm(): void {
    if (this.audio || this.assetFailed) return;
    try {
      const element = this.makeAudio();
      element.preload = "auto";
      element.loop = true;
      element.volume = 1;
      element.load();
      element.addEventListener("error", () => {
        // No asset, or one this browser will not decode: the written tone is
        // what the rest of this file is for.
        this.assetFailed = true;
        this.audio = null;
      });
      this.audio = element;
    } catch {
      this.assetFailed = true;
    }
  }

  get ringing(): boolean {
    return this.wanted;
  }

  /** Start ringing: the ringtone for a call coming in, the ringback for one going out. */
  start(kind: "in" | "out"): void {
    if (this.wanted) return;
    this.wanted = true;
    this.blocked = false;
    if (kind === "in") this.warm();
    void this.begin(kind);
  }

  /** Stop. Safe when nothing is ringing, and safe twice. */
  stop(): void {
    this.wanted = false;
    if (this.vibrate) {
      clearInterval(this.vibrate);
      this.vibrate = null;
      this.buzz([0]);
    }
    this.now?.stop();
    this.now = null;
  }

  private async begin(kind: "in" | "out"): Promise<void> {
    if (kind === "in" && this.audio) {
      try {
        await this.audio.play();
        if (this.wanted) {
          this.now = {
            kind,
            stop: () => {
              this.audio?.pause();
              if (this.audio) this.audio.currentTime = 0;
            },
          };
          this.startBuzz();
          return;
        }
        this.audio.pause();
        return;
      } catch (error) {
        // Autoplay refused, or the asset turned out not to be playable. Both
        // are answered the same way: try the written tone, and if that is
        // refused too, say so.
        this.report(error);
      }
    }
    const written = this.startWritten(kind === "in" ? CLASSIC_RING : RINGBACK);
    if (!written) {
      this.wanted = false;
      // No way to make a sound at all. In a browser that is a ring nobody can
      // hear and the screen is told to offer a tap; somewhere with no window
      // at all — a test, a server render — there is nobody to tell and nothing
      // wrong with the ring.
      if (typeof window !== "undefined") {
        this.blocked = true;
        this.onBlocked?.();
      }
      return;
    }
    if (!this.wanted) {
      written();
      return;
    }
    this.now = { kind, stop: written };
    this.startBuzz();
  }

  /** The buzz, repeated on the ring's own cadence until the ring stops. */
  private startBuzz(): void {
    if (this.vibrate) return;
    this.buzz(VIBRATE_INCOMING);
    const pass = loopSeconds(CLASSIC_RING) * 1000;
    this.vibrate = setInterval(() => {
      if (this.wanted) this.buzz(VIBRATE_INCOMING);
    }, Math.max(1000, pass));
  }

  /**
   * Play a written tone on a loop.
   *
   * Returns the way to stop it, or null when this browser has no audio at all —
   * a `AudioContext` a browser will not start is a ring that cannot be heard,
   * and saying so is the only honest answer.
   */
  private startWritten(tones: Tone[]): (() => void) | null {
    const Context =
      typeof window === "undefined"
        ? undefined
        : window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
    if (!Context) return null;
    try {
      this.context ??= new Context();
      const context = this.context;
      // A context built outside a gesture starts suspended; asking it to start
      // is free when it is already running.
      void context.resume().catch(() => undefined);
      const buffer = context.createBuffer(
        1,
        Math.max(1, samplesFor(tones, context.sampleRate).length),
        context.sampleRate,
      );
      buffer.copyToChannel(samplesFor(tones, context.sampleRate), 0);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = context.createGain();
      // The ring is loud enough to be heard from the next room and no louder.
      gain.gain.value = tones === RINGBACK ? 0.6 : 1;
      source.connect(gain).connect(context.destination);
      source.start();
      this.source = source;
      return () => {
        try {
          source.stop();
        } catch {
          // Already stopped.
        }
        try {
          source.disconnect();
          gain.disconnect();
        } catch {
          // Already disconnected.
        }
        if (this.source === source) this.source = null;
      };
    } catch (error) {
      this.report(error);
      return null;
    }
  }

  private report(error: unknown): void {
    console.debug(`ring: ${String(error)}`);
  }

  /** Let go of the audio context. Called when the tab is finished with calls. */
  close(): void {
    this.stop();
    const context = this.context;
    this.context = null;
    if (context) void context.close().catch(() => undefined);
  }
}
