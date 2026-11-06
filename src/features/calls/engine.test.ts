import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CallSeat } from "@/services/calls.service";
import { CallEngine, callsSupported } from "./engine";
import { GOODBYE_MS } from "./model";

function seat(over: Partial<CallSeat> & { user: string }): CallSeat {
  return {
    state: "joined",
    name: over.user === "me" ? "Me" : "Them",
    username: over.user,
    avatar: null,
    ...over,
  };
}

const RING = {
  call: "c1",
  kind: "audio",
  caller: "them",
  ring_seconds: 45,
  members: [
    seat({ user: "them" }),
    seat({ user: "me" }),
    seat({ user: "callee", state: "ringing" }),
  ],
};

function harness(options: { socketUp?: boolean } = {}) {
  let up = options.socketUp ?? true;
  const sent: Record<string, unknown>[] = [];
  const engine = new CallEngine({
    selfId: "me",
    // A socket that is not up hears nothing at all: the frame is not merely
    // ignored, it never leaves — which is the thing `onSocketLive` is for.
    send: (action) => {
      if (!up) return false;
      sent.push(action);
      return true;
    },
    report: () => undefined,
  });
  return {
    engine,
    sent,
    socketDown: () => {
      up = false;
    },
    socketUp: () => {
      up = true;
    },
  };
}

describe("CallEngine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("takes an incoming ring, and draws who is calling", () => {
    const { engine } = harness();
    engine.apply({
      event: "call.incoming",
      data: { ...RING, from: { user: "them", name: "Them", username: "them" } },
    });
    const call = engine.getSnapshot();
    expect(call.phase).toBe("ringing");
    expect(call.callId).toBe("c1");
    expect(call.kind).toBe("audio");
    expect(call.party?.members?.map((one) => one.user)).toEqual([
      "them",
      "me",
      "callee",
    ]);
  });

  it("turns down a second ring while this tab is already on a call", () => {
    const { engine, sent } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({
      event: "call.incoming",
      data: { ...RING, call: "c2", kind: "video" },
    });
    expect(engine.getSnapshot().callId).toBe("c1");
    expect(engine.getSnapshot().kind).toBe("audio");
    expect(sent).toEqual([{ action: "call.decline", call: "c2" }]);
  });

  it("refuses a party frame that is about somebody else's call", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({
      event: "call.joined",
      data: { ...RING, call: "c2", joined: "stranger" },
    });
    expect(engine.getSnapshot().callId).toBe("c1");
    expect(engine.getSnapshot().phase).toBe("ringing");
  });

  it("is a video call once somebody turns a camera on", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({
      event: "call.accepted",
      data: { ...RING, answered: "me" },
    });
    expect(engine.getSnapshot().phase).toBe("live");
    expect(engine.getSnapshot().since).not.toBeNull();
    engine.apply({
      event: "call.video",
      data: { ...RING, kind: "video", video: "them" },
    });
    expect(engine.getSnapshot().kind).toBe("video");
    expect(engine.getSnapshot().phase).toBe("live");
  });

  it("marks somebody who leaves instead of closing the call", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c2", by: "them" } });
    expect(engine.getSnapshot().phase).toBe("ringing");
    engine.apply({ event: "call.left", data: { call: "c1", user: "callee" } });
    expect(engine.getSnapshot().phase).toBe("ringing");
    expect(
      engine.getSnapshot().party?.members?.find((one) => one.user === "callee")
        ?.state,
    ).toBe("left");
  });

  it("says a ring was missed, and puts the screen away a moment later", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    expect(engine.getSnapshot().phase).toBe("over");
    expect(engine.getSnapshot().note).toBe("Missed call");
    vi.advanceTimersByTime(GOODBYE_MS);
    expect(engine.getSnapshot().phase).toBe("idle");
    expect(engine.getSnapshot().callId).toBeNull();
  });

  it("keeps the first reason for a call ending", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: "them" } });
    expect(engine.getSnapshot().note).toBe("Missed call");
  });

  it("does not put a call it has said goodbye to back on the screen", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    engine.apply({ event: "call.joined", data: { ...RING, joined: "callee" } });
    expect(engine.getSnapshot().phase).toBe("over");
  });

  it("still draws a ring that arrives while the last one says goodbye", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    expect(engine.getSnapshot().phase).toBe("over");
    engine.apply({
      event: "call.incoming",
      data: {
        ...RING,
        call: "c2",
        kind: "video",
        members: [seat({ user: "them" }), seat({ user: "me" })],
      },
    });
    expect(engine.getSnapshot().phase).toBe("ringing");
    expect(engine.getSnapshot().callId).toBe("c2");
    expect(engine.getSnapshot().kind).toBe("video");
    expect(engine.getSnapshot().note).toBe("");
  });

  it("places a call, waits for the server's word, and hears it", async () => {
    const { engine, sent } = harness();
    const placed = engine.ring("them", "video");
    expect(engine.getSnapshot().phase).toBe("dialling");
    expect(sent).toEqual([
      { action: "call.ring", user: "them", kind: "video", ref: "call-web-1" },
    ]);
    engine.apply({ event: "call.ok", data: { call: "c1", ref: "call-web-1" } });
    await placed;
    // The name of the call comes from whichever frame arrives first: the
    // answer to the ring, or the ring's own news.
    expect(engine.getSnapshot().callId).toBe("c1");
  });

  it("reports a refused ring rather than pretending it was placed", async () => {
    const { engine } = harness();
    const placed = engine.ring("them", "audio");
    engine.apply({
      event: "error",
      data: {
        code: "gate_no_chat",
        message: "You cannot call them yet.",
        ref: "call-web-1",
      },
    });
    await expect(placed).rejects.toThrow("You cannot call them yet.");
    expect(engine.getSnapshot().phase).toBe("idle");
  });

  it("says a request again when the socket comes up, and only once", async () => {
    const { engine, sent, socketUp } = harness({ socketUp: false });
    void engine.ring("them", "audio");
    expect(sent).toEqual([]);
    socketUp();
    engine.onSocketLive();
    expect(sent).toEqual([
      { action: "call.ring", user: "them", kind: "audio", ref: "call-web-1" },
    ]);
    engine.onSocketLive();
    expect(sent).toHaveLength(1);
  });

  it("asks whether anybody is ringing it whenever the socket comes up", () => {
    const { engine, sent } = harness();
    engine.onSocketLive();
    expect(sent).toEqual([{ action: "call.pending" }]);
  });

  it("says nothing to nobody once it is already on a call", () => {
    const { engine, sent } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.onSocketLive();
    expect(sent).toEqual([]);
  });

  it("gives up on a ring nobody answers, on the server's own clock", () => {
    const { engine, sent } = harness();
    engine.apply({
      event: "call.incoming",
      data: { ...RING, ring_seconds: 3 },
    });
    vi.advanceTimersByTime(2_900);
    expect(engine.getSnapshot().phase).toBe("ringing");
    vi.advanceTimersByTime(200);
    expect(engine.getSnapshot().phase).toBe("idle");
    expect(
      sent.some((one) => one.action === "call.decline" && one.call === "c1"),
    ).toBe(true);
  });

  it("gives up on a ring this tab placed, and says why", () => {
    const { engine, sent } = harness();
    void engine.ring("them", "audio").catch(() => undefined);
    engine.apply({ event: "call.ringing", data: { ...RING } });
    expect(engine.getSnapshot().phase).toBe("dialling");
    vi.advanceTimersByTime(45_000);
    expect(engine.getSnapshot().phase).toBe("over");
    expect(engine.getSnapshot().note).toBe("No answer");
    expect(sent.some((one) => one.action === "call.leave")).toBe(true);
  });

  it("carries a call it cannot open a microphone for", async () => {
    const { engine } = harness();
    expect(callsSupported()).toBe(false);
    void engine.ring("them", "audio");
    // No browser under the test, so the devices cannot be had — which is said
    // on screen rather than thrown, and the call is the half that still works.
    expect(engine.getSnapshot().mediaError).toBe(
      "This browser cannot reach a microphone or a camera.",
    );
    expect(engine.getSnapshot().phase).toBe("dialling");
  });

  it("hangs up: media first, then the goodbye", () => {
    const { engine, sent } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.accepted", data: { ...RING, answered: "me" } });
    void engine.hangUp();
    expect(engine.getSnapshot().phase).toBe("over");
    expect(engine.getSnapshot().note).toBe("Call ended");
    expect(sent.some((one) => one.action === "call.leave")).toBe(true);
  });

  it("holds a goodbye it could not say, and says it when it can", () => {
    const { engine, sent, socketDown, socketUp } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.accepted", data: { ...RING, answered: "me" } });
    socketDown();
    void engine.hangUp();
    expect(sent.filter((one) => one.action === "call.leave")).toEqual([]);
    socketUp();
    engine.onSocketLive();
    expect(sent.filter((one) => one.action === "call.leave")).toHaveLength(1);
  });

  it("turns the microphone off, and says so", () => {
    const { engine } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.accepted", data: { ...RING, answered: "me" } });
    expect(engine.getSnapshot().muted).toBe(false);
    engine.toggleMute();
    expect(engine.getSnapshot().muted).toBe(true);
    engine.toggleMute();
    expect(engine.getSnapshot().muted).toBe(false);
  });

  it("tells the server before it reaches for a camera", () => {
    const { engine, sent } = harness();
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.accepted", data: { ...RING, answered: "me" } });
    engine.toggleCamera();
    expect(engine.getSnapshot().kind).toBe("audio");
    expect(sent.some((one) => one.action === "call.video")).toBe(true);
  });

  it("tells a subscriber every time anything a screen draws changes", () => {
    const { engine } = harness();
    const seen: string[] = [];
    const stop = engine.subscribe(() => seen.push(engine.getSnapshot().phase));
    engine.apply({ event: "call.incoming", data: { ...RING } });
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    stop();
    engine.apply({ event: "call.ended", data: { call: "c1", by: null } });
    expect(seen).toEqual(["ringing", "over"]);
  });

  describe("a call this screen has been told to leave alone", () => {
    const ROOM = "r1";

    it("is remembered, and only when there is an id to remember", () => {
      const { engine } = harness();
      expect(engine.ignores(ROOM)).toBe(false);
      engine.ignoreCall(null);
      engine.ignoreCall(undefined);
      engine.ignoreCall("");
      expect(engine.ignores(ROOM)).toBe(false);
      engine.ignoreCall(ROOM);
      expect(engine.ignores(ROOM)).toBe(true);
    });

    it("does not let a room's frames take over the 1:1 screen", () => {
      // A room's stage is a `calls.Call` on the server, so its frames carry the
      // same names. Without this, a `call.joined` out of a room this tab is
      // standing in would put the room on the call screen and answer it.
      const { engine } = harness();
      engine.ignoreCall(ROOM);
      engine.apply({
        event: "call.incoming",
        data: { ...RING, call: ROOM },
      });
      engine.apply({
        event: "call.joined",
        data: { ...RING, call: ROOM, joined: "them" },
      });
      engine.apply({ event: "call.video", data: { call: ROOM, kind: "video" } });
      const call = engine.getSnapshot();
      expect(call.phase).toBe("idle");
      expect(call.callId).toBeNull();
      expect(call.kind).toBe("audio");
    });

    it("still takes a real call afterwards", () => {
      const { engine } = harness();
      engine.ignoreCall(ROOM);
      engine.apply({ event: "call.incoming", data: { ...RING, call: ROOM } });
      engine.apply({ event: "call.incoming", data: { ...RING } });
      expect(engine.getSnapshot().phase).toBe("ringing");
      expect(engine.getSnapshot().callId).toBe("c1");
    });

    it("does not swallow the answers to this tab's own requests", () => {
      // Acks and errors are matched by ref rather than by call, and a room this
      // tab is in must not be able to stop a ring this tab placed being
      // settled — an unanswered request is a button that never stops spinning.
      const { engine } = harness();
      engine.ignoreCall(ROOM);
      engine.apply({
        event: "error",
        data: { code: "busy", message: "They are busy", ref: "7" },
      });
      // Nothing was waiting on ref 7, so the point is only that it arrived
      // without disturbing the machine.
      expect(engine.getSnapshot().phase).toBe("idle");
    });
  });

  describe("turning the arriving picture over", () => {
    /** Ring, answer, and be on the call — the state a screen has a Mirror on. */
    function onCall() {
      const made = harness();
      made.engine.apply({ event: "call.incoming", data: { ...RING } });
      made.engine.apply({ event: "call.accepted", data: { ...RING, answered: "me" } });
      return made;
    }

    it("draws what arrives as it was sent until somebody says otherwise", () => {
      // The phone's rule for every picture that is not its own, and the reason
      // an incoming camera is not quietly turned over: what a person is being
      // shown is what the other end is sending.
      const { engine } = onCall();
      expect(engine.getSnapshot().remoteMirrored).toBe(false);
    });

    it("turns over what arrives, and leaves this tab's own picture alone", () => {
      // The owner's report of 2026-11-06: the button was flipping the one
      // picture that was already right. `mirrored` is this tab's own tile and
      // follows the lens; this press must not reach it.
      const { engine } = onCall();
      const own = engine.getSnapshot().mirrored;
      const seen: boolean[] = [];
      const stop = engine.subscribe(() =>
        seen.push(engine.getSnapshot().remoteMirrored),
      );
      engine.toggleRemoteMirror();
      const after = engine.getSnapshot();
      stop();
      expect(after.remoteMirrored).toBe(true);
      expect(after.mirrored).toBe(own);
      // Published, so the tiles redraw on the press rather than at the next
      // frame that happens to arrive.
      expect(seen).toEqual([true]);
      engine.toggleRemoteMirror();
      expect(engine.getSnapshot().remoteMirrored).toBe(false);
    });

    it("is a switch over somebody else's picture, not a setting", () => {
      // It belongs to the call it was pressed in: the next call draws what
      // arrives as it was sent, exactly as the phone does.
      const { engine } = onCall();
      engine.toggleRemoteMirror();
      expect(engine.getSnapshot().remoteMirrored).toBe(true);
      void engine.hangUp();
      vi.advanceTimersByTime(GOODBYE_MS);
      expect(engine.getSnapshot().phase).toBe("idle");
      engine.apply({ event: "call.incoming", data: { ...RING } });
      expect(engine.getSnapshot().remoteMirrored).toBe(false);
    });
  });
});
