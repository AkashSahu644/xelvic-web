import { describe, expect, it } from "vitest";
import {
  inUnreadLane,
  lineTone,
  listLine,
  threadTitle,
  threadUnread,
  threadUnreadOther,
} from "@/features/convo/model";
import type { ThreadCard } from "@/types/api";

function thread(patch: Partial<ThreadCard>): ThreadCard {
  return { id: "t1", kind: "direct", ...patch } as ThreadCard;
}

describe("listLine", () => {
  it("never prints what was said, from either side", () => {
    // The rule the whole line exists for: a chat list is the screen people read
    // over your shoulder. This client printed `preview.text` with a `You:`
    // prefix on my own messages, which is the leak the phone's `listLine` was
    // written to close.
    expect(
      listLine(
        thread({
          preview: { kind: "text", text: "see you at six", mine: false, at: "2026-11-01T10:00:00Z" },
        }),
        2,
      ),
    ).toBe("2 new");
    expect(
      listLine(thread({ preview: { kind: "text", text: "on my way", mine: true } }), 0),
    ).toBe("Nothing new");
  });

  it("reads my own run as its receipt and theirs as a fact", () => {
    // `status` describes my outgoing bubble and not the incoming line the row is
    // about, which is why it is only read behind `preview.mine`.
    expect(
      listLine(thread({ status: "Delivered", preview: { kind: "text", text: "hi", mine: true } }), 0),
    ).toBe("Delivered");
    expect(
      listLine(thread({ status: "Opened", preview: { kind: "text", text: "hi", mine: true } }), 0),
    ).toBe("Opened");
    expect(
      listLine(thread({ status: "Opened", preview: { kind: "text", text: "hello", mine: false } }), 0),
    ).toBe("Nothing new");
  });

  it("counts without the noun the rest of the product does not use", () => {
    expect(listLine(thread({ unread_count: 1, preview: { kind: "text", mine: false } }), 1)).toBe(
      "1 new",
    );
    // The old wording, kept out: "1 new message" / "3 new messages".
    expect(listLine(thread({ unread_count: 3, preview: { kind: "image", mine: false } }), 3)).toBe(
      "3 new",
    );
  });

  it("keeps an empty row's invitation ahead of its count", () => {
    // The phone's order, ported as it stands: the invitation is the whole of
    // what a row with nothing on it can say, and a count on a row with no line
    // under it is a number about nothing. The old web wording put "3 new
    // messages" here instead.
    expect(listLine(thread({ unread_count: 3 }), 3)).toBe("Say something");
  });

  it("stays quiet on a held line rather than describing it", () => {
    // The line is not the preview's to describe, so a held one has nothing to
    // say: "Waiting for them" was this client's own wording and not the app's.
    expect(
      listLine(thread({ status: "Waiting", preview: { kind: "text", text: "hi", held: true } }), 0),
    ).toBe("Nothing new");
  });

  it("gives an empty convo an invitation and my own convo its own line", () => {
    expect(listLine(thread({}), 0)).toBe("Say something");
    expect(listLine(thread({ self: true }), 0)).toBe("Convo with yourself");
    expect(listLine(thread({ self: true, status: "Sent" }), 0)).toBe("Sent");
    // A convo with myself is not an invitation to a conversation — the
    // invitation is the whole of it, and it says so plainly.
    expect(listLine(thread({ self: true, unread_count: 4 }), 4)).toBe("Convo with yourself");
  });

  it("reads the count off either name the server sends it under", () => {
    expect(threadUnread(thread({ unread_count: 5, unread: 2 }))).toBe(5);
    expect(threadUnread(thread({ unread: 2 }))).toBe(2);
    expect(threadUnread(thread({}))).toBe(0);
  });
});

describe("the Unread lane", () => {
  it("reads the split, and reads a missing split as no split", () => {
    expect(threadUnreadOther(thread({ unread_other_count: 0 }))).toBe(0);
    expect(threadUnreadOther(thread({ unread_other_count: 4 }))).toBe(4);
    // Null, not nought — the two mean opposite things on this lane.
    expect(threadUnreadOther(thread({}))).toBeNull();
    expect(threadUnreadOther(thread({ unread_count: 3 }))).toBeNull();
  });

  it("includes every convo with a waiting line", () => {
    expect(inUnreadLane(thread({ unread_count: 2, unread_other_count: 0 }))).toBe(true);
    expect(inUnreadLane(thread({ unread_count: 3, unread_other_count: 1 }))).toBe(true);
    expect(inUnreadLane(thread({ unread_count: 1 }))).toBe(true);
    expect(inUnreadLane(thread({ unread_count: 0, unread_other_count: 0 }))).toBe(false);
    expect(inUnreadLane(thread({}))).toBe(false);
  });
});

describe("lineTone", () => {
  it("points at Opened whether or not anything is waiting", () => {
    expect(lineTone("Opened", 0).className).toBe("font-bold text-accent");
    expect(lineTone("Opened", 3).className).toBe("font-bold text-accent");
  });

  it("decides waiting and quiet from the words on screen", () => {
    // Not from the receipt behind them: a run of theirs with nothing since draws
    // "Nothing new" in the quiet tone, not an accent pointed at nothing.
    expect(lineTone("3 new", 3).className).toBe("font-semibold text-ink");
    expect(lineTone("Nothing new", 0).className).toBe("font-normal text-dim");
    expect(lineTone("Nothing new", 3).className).toBe("font-semibold text-ink");
  });
});

describe("threadTitle", () => {
  it("prefers an explicit group title, then the other person, then a member", () => {
    expect(threadTitle(thread({ title: "Crew" }))).toBe("Crew");
    expect(
      threadTitle(
        thread({ other: { id: "u1", username: "ada", name: "Ada" } as ThreadCard["other"] }),
      ),
    ).toBe("Ada");
    expect(
      threadTitle(
        thread({
          members: [{ user: { id: "u2", username: "sam", name: "", avatar: null, initials: "S" } }],
        }),
      ),
    ).toBe("sam");
    expect(threadTitle(thread({}))).toBe("Conversation");
  });
});
