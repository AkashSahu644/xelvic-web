import { describe, expect, it } from "vitest";
import {
  needsRebuild,
  readSignal,
  receiveOnlyKinds,
  whoOffers,
} from "./mesh";

describe("who makes the offer", () => {
  it("is the lower id, so both ends of a pair agree", () => {
    expect(whoOffers({ mine: "a", theirs: "b", hearOnly: false })).toBe(true);
    expect(whoOffers({ mine: "b", theirs: "a", hearOnly: false })).toBe(false);
  });

  it("compares by code unit, not by alphabet or locale", () => {
    // The phone compares with Dart's `compareTo`, which is code unit order. A
    // locale-aware comparison would sort "B" before "a" and put the two ends of
    // one pair on different sides of the same question — each waiting for the
    // other, and neither ever offering.
    expect(whoOffers({ mine: "B", theirs: "a", hearOnly: false })).toBe(true);
    expect(whoOffers({ mine: "a", theirs: "B", hearOnly: false })).toBe(false);
  });

  it("offers to everybody when this tab is only listening", () => {
    // The audience is a count and never a list, so a listener cannot wait to be
    // offered to: nobody on the stage knows they are there.
    expect(whoOffers({ mine: "z", theirs: "a", hearOnly: true })).toBe(true);
    expect(whoOffers({ mine: "a", theirs: "z", hearOnly: true })).toBe(true);
  });

  it("never offers to itself, or to nobody", () => {
    expect(whoOffers({ mine: "a", theirs: "a", hearOnly: true })).toBe(false);
    expect(whoOffers({ mine: "", theirs: "a", hearOnly: true })).toBe(false);
    expect(whoOffers({ mine: "a", theirs: "", hearOnly: true })).toBe(false);
  });
});

describe("whether a room has to be built again", () => {
  it("does not, when there is nothing to tear down", () => {
    expect(needsRebuild(null, { call: "c1", hearOnly: true })).toBe(false);
  });

  it("does not, when the room is the same room", () => {
    expect(
      needsRebuild({ call: "c1", hearOnly: false }, { call: "c1", hearOnly: false }),
    ).toBe(false);
  });

  it("does, when the room moved to a different call", () => {
    expect(
      needsRebuild({ call: "c1", hearOnly: false }, { call: "c2", hearOnly: false }),
    ).toBe(true);
  });

  it("does, when the person changed sides", () => {
    // A phone brought onto the stage has connections the wrong shape: one side
    // of them carries nothing, and a track cannot be added to a connection that
    // already exists.
    expect(
      needsRebuild({ call: "c1", hearOnly: true }, { call: "c1", hearOnly: false }),
    ).toBe(true);
    expect(
      needsRebuild({ call: "c1", hearOnly: false }, { call: "c1", hearOnly: true }),
    ).toBe(true);
  });
});

describe("a signal off the relay", () => {
  it("reads an offer and an answer", () => {
    expect(readSignal({ type: "offer", sdp: "v=0" })).toEqual({
      kind: "offer",
      sdp: "v=0",
    });
    expect(readSignal({ type: "answer", sdp: "v=0" })).toEqual({
      kind: "answer",
      sdp: "v=0",
    });
  });

  it("reads a candidate with the line it belongs to", () => {
    expect(
      readSignal({
        type: "candidate",
        candidate: { candidate: "candidate:1 1 udp 1 1.0.0.1 1 typ host", sdpMid: "0", sdpMLineIndex: 0 },
      }),
    ).toEqual({
      kind: "candidate",
      candidate: {
        candidate: "candidate:1 1 udp 1 1.0.0.1 1 typ host",
        sdpMid: "0",
        sdpMLineIndex: 0,
      },
    });
  });

  it("keeps a candidate that names no line, rather than inventing one", () => {
    expect(readSignal({ type: "candidate", candidate: { candidate: "c" } })).toEqual({
      kind: "candidate",
      candidate: { candidate: "c" },
    });
  });

  it("refuses anything that is not a signal, instead of throwing", () => {
    // An exception in an ICE callback is a connection that quietly never
    // completes, so everything unrecognised has to come back as nothing.
    expect(readSignal(null)).toBeNull();
    expect(readSignal("offer")).toBeNull();
    expect(readSignal({ type: "hold" })).toBeNull();
    expect(readSignal({ type: "offer" })).toBeNull();
    expect(readSignal({ type: "offer", sdp: "" })).toBeNull();
    expect(readSignal({ type: "candidate" })).toBeNull();
    expect(readSignal({ type: "candidate", candidate: "candidate:1" })).toBeNull();
    expect(readSignal({ type: "candidate", candidate: { candidate: "" } })).toBeNull();
  });
});

describe("the lines a listener offers", () => {
  it("asks for a voice in an audio room", () => {
    expect(receiveOnlyKinds(false)).toEqual(["audio"]);
  });

  it("asks for a voice and a picture in a stream", () => {
    expect(receiveOnlyKinds(true)).toEqual(["audio", "video"]);
  });
});
