import { describe, expect, it } from "vitest";
import { threadLine, threadTitle } from "@/features/convo/model";
import type { ThreadCard } from "@/types/api";

function thread(patch: Partial<ThreadCard>): ThreadCard {
  return { id: "t1", kind: "direct", ...patch } as ThreadCard;
}

describe("threadLine", () => {
  it("shows an incoming preview even when my own last message was opened", () => {
    // `status` describes my outgoing bubble, not the incoming line the row
    // is about. Using it here used to replace the preview with "Opened".
    const row = thread({
      status: "Opened",
      preview: { kind: "text", text: "see you at six", mine: false, at: "2026-11-01T10:00:00Z" },
    });
    expect(threadLine(row, 2)).toBe("see you at six");
  });

  it("prefixes my own preview and falls back to the server status", () => {
    expect(
      threadLine(thread({ preview: { kind: "text", text: "on my way", mine: true } }), 0),
    ).toBe("You: on my way");
    expect(
      threadLine(thread({ status: "Delivered", preview: { kind: "poll", mine: true } }), 0),
    ).toBe("You: Poll");
    expect(
      threadLine(thread({ status: "Delivered", preview: { kind: "unknown-kind", mine: true } }), 0),
    ).toBe("Delivered");
  });

  it("keeps the held line honest", () => {
    expect(
      threadLine(thread({ status: "Waiting", preview: { kind: "text", text: "hi", held: true } }), 0),
    ).toBe("Waiting for them");
  });

  it("counts unread only when there is no preview to describe", () => {
    expect(threadLine(thread({ unread_count: 3 }), 3)).toBe("3 new messages");
    expect(threadLine(thread({ unread_count: 1 }), 1)).toBe("1 new message");
    expect(threadLine(thread({}), 0)).toBe("Say something");
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