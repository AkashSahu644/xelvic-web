import { describe, expect, it } from "vitest";
import type { CallSeat } from "@/services/calls.service";
import {
  CALL_NOTICE_TAG,
  CALL_WORKER_URL,
  callActionFrom,
  callNoticeWords,
  callNoticesAllowed,
  callNoticesSupported,
  postsCallNotice,
} from "./notice";

function seat(over: Partial<CallSeat> = {}): CallSeat {
  return {
    user: "them",
    name: "Ana",
    username: "ana",
    avatar: null,
    ...over,
  };
}

describe("when a call belongs on the notification surface", () => {
  it("is only a call that is ringing", () => {
    expect(postsCallNotice("ringing")).toBe(true);
  });

  it("is not a call this tab placed, or one somebody is talking on", () => {
    // A row about something the person is already doing is a browser shouting
    // at its own user.
    expect(postsCallNotice("dialling")).toBe(false);
    expect(postsCallNotice("live")).toBe(false);
    expect(postsCallNotice("over")).toBe(false);
    expect(postsCallNotice("idle")).toBe(false);
  });
});

describe("what the row says", () => {
  it("names the caller and the kind of call", () => {
    expect(callNoticeWords({ seat: seat(), kind: "video" })).toEqual({
      title: "Ana",
      body: "Incoming video call",
    });
    expect(callNoticeWords({ seat: seat(), kind: "audio" })).toEqual({
      title: "Ana",
      body: "Incoming call",
    });
  });

  it("falls back to the app's own name when nobody is named yet", () => {
    expect(callNoticeWords({ seat: null, kind: "audio" })).toEqual({
      title: "Xelvic",
      body: "Incoming call",
    });
  });
});

describe("a press on the row", () => {
  it("reads the worker's own message", () => {
    expect(callActionFrom({ type: "xelvic-call", action: "accept" })).toBe("accept");
    expect(callActionFrom({ type: "xelvic-call", action: "decline" })).toBe(
      "decline",
    );
    expect(callActionFrom({ type: "xelvic-call", action: "open" })).toBe("open");
  });

  it("refuses anything that is not one of its own", () => {
    // A stray message must not be able to answer a call.
    expect(callActionFrom(null)).toBeNull();
    expect(callActionFrom("accept")).toBeNull();
    expect(callActionFrom({ type: "something-else", action: "accept" })).toBeNull();
    expect(callActionFrom({ action: "accept" })).toBeNull();
    expect(callActionFrom({ type: "xelvic-call", action: "hang-up" })).toBeNull();
    expect(callActionFrom({ type: "xelvic-call" })).toBeNull();
  });

  it("keeps the row under one tag, so it can be taken down", () => {
    expect(CALL_NOTICE_TAG).toBe("xelvic-call");
    expect(CALL_WORKER_URL).toBe("/call-sw.js");
  });
});

describe("permission", () => {
  it("is not supported where there is no notification surface", () => {
    // The tests run in node, which is exactly the case this has to survive.
    expect(callNoticesSupported()).toBe(false);
    expect(callNoticesAllowed()).toBe(false);
  });
});