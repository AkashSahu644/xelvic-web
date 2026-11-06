import { describe, expect, it } from "vitest";
import {
  LOSS_FLOOR_PACKETS,
  UNKNOWN_QUALITY,
  VIDEO_MAX_BITRATE,
  VIDEO_MIN_BITRATE,
  audioConstraints,
  deviceLabel,
  levelFor,
  lossPercent,
  qualityLine,
  readQuality,
  videoBitrate,
  videoConstraints,
  videoSenderParams,
  type StatEntry,
} from "./quality";

/** One inbound video stream, as `getStats` hands it over. */
function inbound(over: Record<string, unknown> = {}): StatEntry {
  return {
    type: "inbound-rtp",
    kind: "video",
    packetsReceived: 1000,
    packetsLost: 0,
    frameWidth: 1920,
    frameHeight: 1080,
    framesPerSecond: 30,
    ...over,
  };
}

/** The pair of candidates carrying it. */
function pair(over: Record<string, unknown> = {}): StatEntry {
  return {
    type: "candidate-pair",
    state: "succeeded",
    currentRoundTripTime: 0.04,
    ...over,
  };
}

describe("loss, as a percentage", () => {
  it("is the share of packets that never arrived", () => {
    expect(lossPercent(90, 10)).toBe(10);
    expect(lossPercent(99, 1)).toBe(1);
  });

  it("says nothing at all when nothing has arrived yet", () => {
    // One lost packet at the start of a stream is 100% loss and no signal.
    expect(lossPercent(0, 1)).toBeNull();
    expect(lossPercent(5, 5)).toBeNull();
    expect(lossPercent(LOSS_FLOOR_PACKETS - 1, 0)).toBeNull();
  });

  it("starts reading at the floor", () => {
    expect(lossPercent(LOSS_FLOOR_PACKETS, 0)).toBe(0);
  });

  it("refuses a counter that cannot be real", () => {
    expect(lossPercent(100, -4)).toBeNull();
    expect(lossPercent(null, 3)).toBeNull();
    expect(lossPercent(30, null)).toBeNull();
  });
});

describe("which word a reading deserves", () => {
  it("is unknown when there is nothing to say", () => {
    expect(levelFor({ rttMs: null, lossPercent: null })).toBe("unknown");
  });

  it("is good on a close, clean link", () => {
    expect(levelFor({ rttMs: 40, lossPercent: 0 })).toBe("good");
  });

  it("is fair when it starts to wobble", () => {
    expect(levelFor({ rttMs: 260, lossPercent: 0 })).toBe("fair");
    expect(levelFor({ rttMs: 40, lossPercent: 3 })).toBe("fair");
  });

  it("is weak when it drops packets or crawls", () => {
    expect(levelFor({ rttMs: 40, lossPercent: 9 })).toBe("weak");
    expect(levelFor({ rttMs: 900, lossPercent: 0 })).toBe("weak");
  });

  it("weighs loss above a round trip", () => {
    // 5% loss with a fast round trip is worse than 300 ms with none.
    expect(levelFor({ rttMs: 30, lossPercent: 5 })).toBe("fair");
    expect(levelFor({ rttMs: 300, lossPercent: 0 })).toBe("fair");
    expect(levelFor({ rttMs: 30, lossPercent: 12 })).toBe("weak");
  });

  it("decides on whichever number it actually has", () => {
    expect(levelFor({ rttMs: 50, lossPercent: null })).toBe("good");
    expect(levelFor({ rttMs: null, lossPercent: 4 })).toBe("fair");
  });
});

describe("reading the browser's own report", () => {
  it("finds the picture, its size, and the round trip", () => {
    const quality = readQuality([inbound(), pair()]);
    expect(quality).toEqual({
      level: "good",
      rttMs: 40,
      lossPercent: 0,
      width: 1920,
      height: 1080,
      fps: 30,
    });
  });

  it("reads nothing from a call that has not connected", () => {
    expect(readQuality([])).toEqual(UNKNOWN_QUALITY);
  });

  it("counts only the pair that is actually carrying the call", () => {
    const quality = readQuality([
      pair({ state: "waiting", currentRoundTripTime: 9 }),
      pair({ state: "succeeded", currentRoundTripTime: 0.12 }),
    ]);
    expect(quality.rttMs).toBe(120);
  });

  it("prefers the video stream's counters to the audio stream's", () => {
    const quality = readQuality([
      { type: "inbound-rtp", kind: "audio", packetsReceived: 500, packetsLost: 400 },
      inbound({ packetsReceived: 1000, packetsLost: 0 }),
    ]);
    expect(quality.lossPercent).toBe(0);
  });

  it("reads the audio stream when audio is all there is", () => {
    const quality = readQuality([
      { type: "inbound-rtp", kind: "audio", packetsReceived: 100, packetsLost: 4 },
    ]);
    expect(quality.lossPercent).toBeCloseTo(3.85, 2);
    expect(quality.width).toBeNull();
    expect(quality.level).toBe("fair");
  });

  it("ignores rows that are not about the link", () => {
    const quality = readQuality([
      { type: "codec", mimeType: "video/VP8" },
      { type: "transport", bytesReceived: 100 },
      inbound(),
      pair(),
    ]);
    expect(quality.width).toBe(1920);
  });

  it("leaves the round trip empty when the browser did not report one", () => {
    const quality = readQuality([pair({ currentRoundTripTime: undefined })]);
    expect(quality.rttMs).toBeNull();
  });
});

describe("the line under the clock", () => {
  it("says nothing when the call is fine", () => {
    expect(qualityLine(UNKNOWN_QUALITY)).toBe("");
    expect(qualityLine({ ...UNKNOWN_QUALITY, level: "good", rttMs: 40 })).toBe("");
  });

  it("says when it is not", () => {
    expect(qualityLine({ ...UNKNOWN_QUALITY, level: "fair" })).toBe(
      "Unsettled connection",
    );
    expect(qualityLine({ ...UNKNOWN_QUALITY, level: "weak" })).toBe(
      "Weak connection",
    );
  });
});

describe("what the camera is asked for", () => {
  it("asks for a sharp picture, with a floor a small camera can meet", () => {
    const shape = videoConstraints();
    expect(shape.width).toEqual({ ideal: 1920, min: 640 });
    expect(shape.height).toEqual({ ideal: 1080, min: 480 });
    expect(shape.frameRate).toEqual({ ideal: 30, max: 30 });
  });

  it("names the front camera rather than refusing to choose", () => {
    expect(videoConstraints().facingMode).toBe("user");
  });

  it("names a chosen device instead, and not both", () => {
    const chosen = videoConstraints("cam-2");
    expect(chosen.deviceId).toEqual({ exact: "cam-2" });
    // Naming a device and a facing at once is a constraint some browsers
    // answer by refusing the camera outright.
    expect(chosen.facingMode).toBeUndefined();
  });

  it("asks the microphone for the app's own three answers", () => {
    expect(audioConstraints()).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    });
    expect(audioConstraints("mic-1").deviceId).toEqual({ exact: "mic-1" });
  });
});

describe("how much a picture may spend", () => {
  it("scales with the size of the picture", () => {
    expect(videoBitrate(1920, 1080)).toBeGreaterThan(videoBitrate(640, 480));
  });

  it("does not starve a small picture", () => {
    expect(videoBitrate(320, 240)).toBe(VIDEO_MIN_BITRATE);
  });

  it("does not ask for a link nobody has", () => {
    expect(videoBitrate(3840, 2160)).toBe(VIDEO_MAX_BITRATE);
  });

  it("tells the encoder to keep the picture rather than the frames", () => {
    const params = videoSenderParams();
    expect(params.degradationPreference).toBe("maintain-resolution");
    expect(params.maxBitrate).toBe(VIDEO_MAX_BITRATE);
    expect(params.maxFramerate).toBe(30);
  });
});

describe("a device's name", () => {
  it("uses the browser's own label when it has one", () => {
    expect(deviceLabel({ label: "FaceTime HD", kind: "videoinput" }, 0)).toBe(
      "FaceTime HD",
    );
  });

  it("numbers what the browser will not name", () => {
    expect(deviceLabel({ label: "", kind: "videoinput" }, 1)).toBe("Camera 2");
    expect(deviceLabel({ kind: "audioinput" }, 0)).toBe("Microphone 1");
    expect(deviceLabel({ kind: "audiooutput" }, 2)).toBe("Speaker 3");
  });

  it("treats a blank label as no label", () => {
    expect(deviceLabel({ label: "   ", kind: "videoinput" }, 0)).toBe("Camera 1");
  });
});