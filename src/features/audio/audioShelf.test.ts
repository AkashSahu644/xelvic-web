import { describe, expect, it } from "vitest";
import type { AudioBoard, Drop, SavedThing } from "@/types/api";
import { boardUploads, keptToTrack, rowToTrack } from "./audioShelf";

/**
 * The rules that decide what the editor's sound sheet draws.
 *
 * Every one of these exists because the sheet was drawing the wrong list: the
 * shipped catalogue instead of the uploads, and a saved shelf that came off the
 * heart endpoint instead of `/saved/`. None of it is layout — a mistake here is
 * a sheet that quietly shows something other than what the phone's picker does,
 * which is not something a screenshot of this client alone would catch.
 */

function drop(over: Partial<Drop> = {}): Drop {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    author: {
      id: "22222222-2222-4222-8222-222222222222",
      username: "asha",
      name: "Asha",
      avatar: null,
    },
    kind: "audio",
    body: "",
    asset: {
      id: "33333333-3333-4333-8333-333333333333",
      kind: "audio",
      content_url: "https://api.example/media/one.m4a",
      duration_ms: 21_500,
    },
    created_at: "2026-11-02T10:00:00Z",
    likes: 0,
    comments: 0,
    shares: 0,
    saves: 0,
    liked: false,
    saved: false,
    mine: false,
    title: "Monsoon",
    ...over,
  } as Drop;
}

describe("the weekly board's sounds", () => {
  it("keeps the uploads and drops the catalogue half", () => {
    const board: AudioBoard = {
      boards: [
        {
          key: "sounds",
          label: "Audios",
          week: "2026-10-27",
          rows: [
            { id: "a", source: "drop", title: "Mine", artist: "asha" },
            { id: "b", source: "catalogue", title: "Golden Hour", artist: "Xelvic" },
          ],
        },
      ],
    };
    expect(boardUploads(board).map((row) => row.id)).toEqual(["a"]);
  });

  it("drops the playlists chart, whose rows are shelves and not sounds", () => {
    const board: AudioBoard = {
      boards: [
        {
          key: "playlists",
          label: "Playlists",
          week: "2026-10-27",
          rows: [{ id: "shelf", source: "playlist", name: "Late night", count: 9 }],
        },
      ],
    };
    expect(boardUploads(board)).toEqual([]);
  });

  it("reads an older answer's named keys when there are no boards", () => {
    const board: AudioBoard = {
      sounds: [{ id: "a", source: "drop", title: "Mine", artist: "asha" }],
      podcasts: [{ id: "p", source: "drop", title: "Talk", artist: "asha" }],
    };
    expect(boardUploads(board).map((row) => row.id)).toEqual(["a", "p"]);
  });

  it("is nothing at all when the tab has not answered yet", () => {
    expect(boardUploads(undefined)).toEqual([]);
    expect(boardUploads({})).toEqual([]);
  });
});

describe("a board row read as a list row", () => {
  it("carries the source through, which is what the bookmark files under", () => {
    const row = rowToTrack({ id: "a", source: "drop", title: "Mine", artist: "asha" });
    expect(row.source).toBe("drop");
  });

  it("falls back to a shelf row's own name, which has no title", () => {
    expect(rowToTrack({ id: "a", name: "Late night" }).title).toBe("Late night");
  });
});

describe("a kept thing read as a sound", () => {
  const thing = (over: Partial<SavedThing>): SavedThing =>
    ({ kind: "drop", at: null, ...over }) as SavedThing;

  it("is the track's own row when a catalogue track was saved", () => {
    const track = rowToTrack({ id: "t", title: "Low Tide", artist: "Xelvic" });
    expect(keptToTrack(thing({ kind: "track", track }))).toBe(track);
  });

  it("turns a saved upload's card into the row a sound list draws", () => {
    const row = keptToTrack(thing({ drop: drop() }));
    expect(row).not.toBeNull();
    expect(row!.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(row!.title).toBe("Monsoon");
    expect(row!.artist).toBe("Asha");
    expect(row!.seconds).toBe(21);
    expect(row!.stream).toBe("https://api.example/media/one.m4a");
    // The key its own bookmark writes under, which is the whole point of the
    // conversion — an upload is a `drop` on the shelf and not a `track`.
    expect(row!.source).toBe("drop");
  });

  it("names a sound nobody titled by what the poster wrote under it", () => {
    const row = keptToTrack(
      thing({ drop: drop({ title: "", body: "for the walk home" }) }),
    );
    expect(row!.title).toBe("for the walk home");
  });

  it("is nothing for a saved picture, clip or note", () => {
    expect(keptToTrack(thing({ drop: drop({ kind: "image" }) }))).toBeNull();
    expect(keptToTrack(thing({ kind: "vibe", vibe: drop({ kind: "vibe" }) }))).toBeNull();
    expect(keptToTrack(thing({ drop: null as unknown as Drop }))).toBeNull();
  });
});
