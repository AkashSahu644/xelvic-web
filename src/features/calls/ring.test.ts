import { describe, expect, it } from "vitest";
import {
  CLASSIC_LEVEL,
  CLASSIC_RING,
  EDGE_SECONDS,
  RINGBACK,
  RINGBACK_LEVEL,
  RINGTONE_URL,
  Ringer,
  VIBRATE_INCOMING,
  loopSeconds,
  ringSource,
  samplesFor,
} from "./ring";

/** An `<audio>` that records what was done to it. */
function fakeAudio(play?: () => Promise<void>) {
  const calls = { plays: 0, pauses: 0, loads: 0 };
  const element = {
    preload: "",
    loop: false,
    volume: 1,
    currentTime: 0,
    play: () => {
      calls.plays += 1;
      return play ? play() : Promise.resolve();
    },
    pause: () => {
      calls.pauses += 1;
    },
    load: () => {
      calls.loads += 1;
    },
    addEventListener: () => undefined,
  };
  return { element: element as unknown as HTMLAudioElement, calls };
}

/** Just enough of an `AudioContext` to build and play a written tone. */
class FakeContext {
  sampleRate = 22050;
  state = "running";
  destination = {};
  started = 0;
  stopped = 0;

  createBuffer(_channels: number, length: number) {
    return { length, copyToChannel: () => undefined };
  }

  createBufferSource() {
    return {
      buffer: null as unknown,
      loop: false,
      connect: () => ({ connect: () => undefined }),
      start: () => {
        this.started += 1;
      },
      stop: () => {
        this.stopped += 1;
      },
      disconnect: () => undefined,
    };
  }

  createGain() {
    return {
      gain: { value: 1 },
      connect: () => undefined,
      disconnect: () => undefined,
    };
  }

  resume() {
    return Promise.resolve();
  }

  close() {
    return Promise.resolve();
  }
}

/** A window with, or without, the audio a written tone needs. */
function withWindow(audio: boolean, body: () => Promise<void>) {
  const scope = globalThis as unknown as { window?: unknown };
  const before = scope.window;
  scope.window = audio ? { AudioContext: FakeContext } : {};
  return body().finally(() => {
    scope.window = before;
  });
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("the ring's shape", () => {
  it("is served from this build, not fetched from somewhere else", () => {
    expect(RINGTONE_URL).toBe("/ringtone/call.wav");
  });

  it("writes the app's own classic ring: two notes, twice, then quiet", () => {
    expect(CLASSIC_RING.map((tone) => tone.hz)).toEqual([
      [640],
      [],
      [510],
      [],
      [],
      [640],
      [],
      [510],
      [],
      [],
    ]);
    expect(loopSeconds(CLASSIC_RING)).toBeCloseTo(3.1, 5);
  });

  it("writes a ringback that is not the ring", () => {
    // The whole point: a caller who heard their own ringtone would think they
    // were being called.
    expect(RINGBACK).toEqual([
      { hz: [440, 480], seconds: 1 },
      { hz: [], seconds: 2 },
    ]);
    expect(loopSeconds(RINGBACK)).toBe(3);
  });

  it("leaves a gap long enough to be a ring rather than a drone", () => {
    const silent = CLASSIC_RING.filter((tone) => tone.hz.length === 0).reduce(
      (total, tone) => total + tone.seconds,
      0,
    );
    expect(silent).toBeGreaterThan(1);
  });

  it("buzzes off, on, off, on", () => {
    // The pattern is milliseconds alternating buzz and pause, and it opens
    // with a pause so the buzz lands with the first tone rather than before it.
    expect(VIBRATE_INCOMING[0]).toBe(0);
    expect(VIBRATE_INCOMING.length).toBeGreaterThan(3);
    expect(VIBRATE_INCOMING.every((ms) => Number.isFinite(ms) && ms >= 0)).toBe(
      true,
    );
  });
});

describe("the written tone", () => {
  it("is exactly one loop long", () => {
    const samples = samplesFor(CLASSIC_RING, 22050);
    expect(samples).toHaveLength(Math.round(3.1 * 22050));
  });

  it("is silent where the ring is silent", () => {
    const samples = samplesFor(CLASSIC_RING, 22050);
    const quietAt = Math.round(0.42 * 22050);
    expect(Math.abs(samples[quietAt])).toBeLessThan(1e-6);
  });

  it("sounds where the ring sounds", () => {
    const samples = samplesFor(CLASSIC_RING, 22050);
    const peak = Math.max(...samples.subarray(0, 2000));
    expect(peak).toBeGreaterThan(CLASSIC_LEVEL * 0.5);
    expect(peak).toBeLessThanOrEqual(CLASSIC_LEVEL + 1e-6);
  });

  it("starts and ends at nothing rather than at a click", () => {
    const samples = samplesFor(CLASSIC_RING, 22050);
    expect(Math.abs(samples[0])).toBeLessThan(1e-6);
    const edge = Math.round(EDGE_SECONDS * 22050);
    // The first burst is loudest in its middle, not at its first sample.
    const early = Math.max(...samples.subarray(0, edge));
    const middle = Math.max(
      ...samples.subarray(Math.round(edge * 1.5), Math.round(0.35 * 22050)),
    );
    expect(middle).toBeGreaterThan(early);
  });

  it("keeps a two-note ringback inside the same ceiling", () => {
    const samples = samplesFor(RINGBACK, 8000);
    const peak = Math.max(...samples.subarray(0, 1000));
    expect(peak).toBeGreaterThan(0.2);
    expect(peak).toBeLessThanOrEqual(CLASSIC_LEVEL + 1e-6);
    expect(RINGBACK_LEVEL).toBeLessThan(1);
  });
});

describe("which sound a ring ends up being", () => {
  it("plays the recording when there is one", () => {
    expect(ringSource({ assetOk: true, audioOk: true })).toBe("asset");
  });

  it("falls back to the written tone when the recording is missing", () => {
    expect(ringSource({ assetOk: false, audioOk: true })).toBe("written");
  });

  it("says so when there is no audio at all", () => {
    expect(ringSource({ assetOk: true, audioOk: false })).toBe("none");
    expect(ringSource({ assetOk: false, audioOk: false })).toBe("none");
  });
});

describe("the ringer", () => {
  it("is silent until it is asked to ring", () => {
    const { element } = fakeAudio();
    const ringer = new Ringer(() => element);
    expect(ringer.ringing).toBe(false);
    expect(element.loop).toBe(false);
  });

  it("warms the recording once, however often it is asked", () => {
    const { element, calls } = fakeAudio();
    const ringer = new Ringer(() => element);
    ringer.warm();
    ringer.warm();
    expect(calls.loads).toBe(1);
    expect(element.loop).toBe(true);
    expect(ringer.ringing).toBe(false);
  });

  it("rings an incoming call with the recording", async () => {
    const { element, calls } = fakeAudio();
    const ringer = new Ringer(() => element);
    ringer.start("in");
    await tick();
    expect(ringer.ringing).toBe(true);
    expect(calls.plays).toBe(1);
  });

  it("stops what it started, and can stop twice", async () => {
    const { element, calls } = fakeAudio();
    const ringer = new Ringer(() => element);
    ringer.start("in");
    await tick();
    ringer.stop();
    ringer.stop();
    expect(ringer.ringing).toBe(false);
    expect(calls.pauses).toBeGreaterThanOrEqual(1);
    expect(element.currentTime).toBe(0);
  });

  it("does not start a second sound over one that is already ringing", async () => {
    const { element, calls } = fakeAudio();
    const ringer = new Ringer(() => element);
    ringer.start("in");
    ringer.start("out");
    await tick();
    expect(calls.plays).toBe(1);
    expect(ringer.ringing).toBe(true);
  });

  it("buzzes while it rings and stops buzzing when it stops", async () => {
    const { element } = fakeAudio();
    const buzzes: number[][] = [];
    const ringer = new Ringer(
      () => element,
      (pattern) => buzzes.push(pattern),
    );
    ringer.start("in");
    await tick();
    expect(buzzes.length).toBe(1);
    ringer.stop();
    expect(buzzes.at(-1)).toEqual([0]);
  });

  it("falls back to the written tone when the recording will not play", async () => {
    await withWindow(true, async () => {
      const { element } = fakeAudio(() =>
        Promise.reject(new Error("NotAllowedError")),
      );
      const ringer = new Ringer(
        () => element,
        () => undefined,
      );
      ringer.start("in");
      await tick();
      // Not silence: the browser refused the file, not the sound.
      expect(ringer.ringing).toBe(true);
      expect(ringer.blocked).toBe(false);
      ringer.stop();
    });
  });

  it("says a ring could not be heard rather than pretending it rang", async () => {
    await withWindow(false, async () => {
      let told = 0;
      // No recording to play and no audio to write a tone with: the one case
      // that is a ring nobody can hear.
      const ringer = new Ringer(
        () => {
          throw new Error("no audio element");
        },
        () => undefined,
      );
      ringer.onBlocked = () => {
        told += 1;
      };
      ringer.start("in");
      await tick();
      expect(ringer.blocked).toBe(true);
      expect(ringer.ringing).toBe(false);
      expect(told).toBe(1);
    });
  });

  it("clears the refusal when it is asked to try again", async () => {
    await withWindow(true, async () => {
      const { element } = fakeAudio();
      const ringer = new Ringer(
        () => element,
        () => undefined,
      );
      ringer.start("in");
      await tick();
      ringer.stop();
      ringer.start("in");
      await tick();
      expect(ringer.blocked).toBe(false);
      ringer.stop();
    });
  });
});