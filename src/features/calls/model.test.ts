import { describe, expect, it } from "vitest";
import type { CallParty, CallSeat } from "@/services/calls.service";
import {
  CALL_ENDED,
  DEFAULT_RING_SECONDS,
  MISSED_CALL,
  NO_ANSWER,
  callKind,
  callTitle,
  frameData,
  goodbyeLine,
  offersAfterCollision,
  otherSeats,
  partyOf,
  personName,
  ringLine,
  ringSeconds,
  seatIsHere,
  seatOf,
  sourceChanged,
  text,
} from "./model";

function seat(over: Partial<CallSeat> & { user: string }): CallSeat {
  return {
    state: "joined",
    name: over.user === "me" ? "Me" : "Them",
    username: over.user,
    avatar: null,
    ...over,
  };
}

const party: CallParty = {
  call: "c1",
  kind: "audio",
  caller: "them",
  ring_seconds: 45,
  members: [seat({ user: "them" }), seat({ user: "me" })],
};

describe("ringSeconds", () => {
  it("reads the server's own window", () => {
    expect(ringSeconds({ call: "c", ring_seconds: 30 })).toBe(30);
  });

  it("falls back when a frame says nothing usable", () => {
    expect(ringSeconds(null)).toBe(DEFAULT_RING_SECONDS);
    expect(ringSeconds({ call: "c" })).toBe(DEFAULT_RING_SECONDS);
    expect(ringSeconds({ call: "c", ring_seconds: 0 })).toBe(DEFAULT_RING_SECONDS);
    expect(ringSeconds({ call: "c", ring_seconds: -5 })).toBe(DEFAULT_RING_SECONDS);
    expect(ringSeconds({ call: "c", ring_seconds: Number.NaN })).toBe(
      DEFAULT_RING_SECONDS,
    );
  });
});

describe("callKind", () => {
  it("is video only when the frame says video", () => {
    expect(callKind("video")).toBe("video");
    expect(callKind("audio")).toBe("audio");
    expect(callKind(undefined)).toBe("audio");
    expect(callKind("something-else")).toBe("audio");
  });
});

describe("sourceChanged", () => {
  it("says a camera that keeps its frame has not changed source", () => {
    expect(sourceChanged(9 / 16, 9 / 16)).toBe(false);
    // The same frame measured a little differently by the browser is still the
    // same camera: a few per cent is noise, not a new source.
    expect(sourceChanged(9 / 16, 0.55)).toBe(false);
  });

  it("says a picture that changes shape is somebody sharing a screen", () => {
    // A 4:3 camera and a 1512×982 desktop are the two shapes a call actually
    // meets, and the switch between them is the moment the owner reported.
    expect(sourceChanged(3 / 4, 982 / 1512)).toBe(true);
    // …and back again, when the screen is stopped.
    expect(sourceChanged(982 / 1512, 3 / 4)).toBe(true);
  });

  it("has nothing to compare until a first shape has been measured", () => {
    expect(sourceChanged(0, 9 / 16)).toBe(false);
    expect(sourceChanged(9 / 16, 0)).toBe(false);
    expect(sourceChanged(Number.NaN, 9 / 16)).toBe(false);
  });
});

describe("offersAfterCollision", () => {
  it("gives opposite answers to the two ends of one crossing", () => {
    expect(offersAfterCollision("b", "a")).toBe(true);
    expect(offersAfterCollision("a", "b")).toBe(false);
  });

  it("never has a third answer for two different ids", () => {
    const ids = ["0191", "0192", "a", "z", "0"];
    for (const mine of ids) {
      for (const theirs of ids) {
        if (mine === theirs) continue;
        expect(offersAfterCollision(mine, theirs)).toBe(
          !offersAfterCollision(theirs, mine),
        );
      }
    }
  });
});

describe("reading a frame", () => {
  it("takes the data object and ignores anything that is not one", () => {
    expect(frameData({ event: "x", data: { a: 1 } })).toEqual({ a: 1 });
    expect(frameData({ event: "x" })).toEqual({});
    expect(frameData({ event: "x", data: "nope" })).toEqual({});
  });

  it("names nobody for an empty or missing id", () => {
    expect(text("abc")).toBe("abc");
    expect(text("")).toBeNull();
    expect(text(null)).toBeNull();
    expect(text(undefined)).toBeNull();
  });

  it("refuses a party frame with no call in it", () => {
    expect(partyOf({ kind: "audio" })).toBeNull();
    expect(partyOf({ call: "" })).toBeNull();
    expect(partyOf({ call: "c1" })?.call).toBe("c1");
  });
});

describe("who is on the call", () => {
  it("finds one seat and everybody else", () => {
    expect(seatOf(party, "them")?.user).toBe("them");
    expect(seatOf(party, "nobody")).toBeNull();
    expect(seatOf(null, "them")).toBeNull();
    expect(otherSeats(party, "me").map((one) => one.user)).toEqual(["them"]);
    expect(otherSeats(null, "me")).toEqual([]);
  });

  it("calls somebody by name, then handle, then a neutral word", () => {
    expect(personName(seat({ user: "a", name: "Ada" }))).toBe("Ada");
    expect(personName(seat({ user: "a", name: "  ", username: "ada" }))).toBe("ada");
    expect(personName(seat({ user: "a", name: "", username: "" }))).toBe("Someone");
    expect(personName(null)).toBe("Someone");
  });

  it("titles a call by who is still on it", () => {
    expect(callTitle(party, "me", "audio")).toBe("Them");
    expect(callTitle(null, "me", "video")).toBe("Video call");
    expect(callTitle(null, "me", "audio")).toBe("Audio call");
    const three: CallParty = {
      ...party,
      members: [
        seat({ user: "a", name: "Ada" }),
        seat({ user: "b", name: "Bo" }),
        seat({ user: "me" }),
      ],
    };
    expect(callTitle(three, "me", "audio")).toBe("Ada + 1");
    const gone: CallParty = {
      ...party,
      members: [seat({ user: "them", state: "left" }), seat({ user: "me" })],
    };
    expect(callTitle(gone, "me", "audio")).toBe("Audio call");
  });

  it("knows who has gone", () => {
    expect(seatIsHere(seat({ user: "a" }))).toBe(true);
    expect(seatIsHere(seat({ user: "a", state: "left" }))).toBe(false);
    expect(seatIsHere(seat({ user: "a", state: "declined" }))).toBe(false);
  });
});

describe("goodbyeLine", () => {
  it("says a missed call when it stopped while our own phone rang", () => {
    expect(
      goodbyeLine({ phase: "ringing", by: null, selfId: "me", answered: false, party }),
    ).toBe(MISSED_CALL);
  });

  it("says a plain end when nobody in particular ended it", () => {
    expect(
      goodbyeLine({ phase: "live", by: null, selfId: "me", answered: true, party }),
    ).toBe(CALL_ENDED);
    expect(
      goodbyeLine({ phase: "live", by: "me", selfId: "me", answered: true, party }),
    ).toBe(CALL_ENDED);
  });

  it("says no answer when the ring we placed was never picked up", () => {
    expect(
      goodbyeLine({ phase: "dialling", by: null, selfId: "me", answered: false, party }),
    ).toBe(CALL_ENDED);
    expect(
      goodbyeLine({
        phase: "dialling",
        by: "them",
        selfId: "me",
        answered: false,
        party,
      }),
    ).toBe(NO_ANSWER);
  });

  it("names whoever walked out of a live call", () => {
    expect(
      goodbyeLine({ phase: "live", by: "them", selfId: "me", answered: true, party }),
    ).toBe("Them left");
    expect(
      goodbyeLine({
        phase: "live",
        by: "stranger",
        selfId: "me",
        answered: true,
        party,
      }),
    ).toBe(CALL_ENDED);
  });
});

describe("ringLine", () => {
  it("names the kind of call that is arriving", () => {
    expect(
      ringLine({ phase: "ringing", seat: null, kind: "audio", answered: false }),
    ).toBe("Incoming call");
    expect(
      ringLine({ phase: "ringing", seat: null, kind: "video", answered: false }),
    ).toBe("Incoming video call");
  });

  it("says Offline only when the server said a ring cannot reach them", () => {
    expect(
      ringLine({
        phase: "dialling",
        seat: seat({ user: "them", state: "ringing", reachable: false, online: false }),
        kind: "audio",
        answered: false,
      }),
    ).toBe("Offline");
    expect(
      ringLine({
        phase: "dialling",
        seat: seat({ user: "them", state: "ringing", reachable: true, online: false }),
        kind: "audio",
        answered: false,
      }),
    ).toBe("Ringing…");
    expect(
      ringLine({ phase: "dialling", seat: null, kind: "audio", answered: false }),
    ).toBe("Ringing…");
  });

  it("says Connecting once somebody has picked up", () => {
    expect(
      ringLine({
        phase: "dialling",
        seat: seat({ user: "them", state: "joined" }),
        kind: "audio",
        answered: false,
      }),
    ).toBe("Connecting…");
    expect(
      ringLine({
        phase: "dialling",
        seat: seat({ user: "them" }),
        kind: "audio",
        answered: true,
      }),
    ).toBe("Connecting…");
  });

  it("says nothing at all once the call is up or over", () => {
    expect(
      ringLine({ phase: "live", seat: null, kind: "audio", answered: true }),
    ).toBe("");
    expect(
      ringLine({ phase: "over", seat: null, kind: "audio", answered: true }),
    ).toBe("");
  });
});
