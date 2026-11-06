import { describe, expect, it } from "vitest";
import { shelfRowFromOwn, shelfRowFromService, shelvesOf, siftShelf } from "./stickers.service";

/**
 * The sticker shelf's own rules.
 *
 * This is the logic the pickers in the editor and in a convo both narrow, and
 * the two shapes it reads are genuinely different — our sticker service answers
 * `{tags, pack: {...}}` and our own server answers `{name, keywords, pack}` —
 * so a mistake here is a sheet showing a different list of stickers than the
 * phone's, which is exactly what these tests exist to catch.
 */

describe("a row off the sticker service", () => {
  it("takes its name from the first tag", () => {
    const row = shelfRowFromService({
      id: 884,
      url: "https://cdn.example/boxing.webp",
      tags: ["boxing gloves", "sport"],
      pack: { id: 32, name: "Sports" },
    });
    expect(row).not.toBeNull();
    expect(row!.id).toBe("884");
    expect(row!.name).toBe("boxing gloves");
    expect(row!.pack).toBe("32");
    expect(row!.packName).toBe("Sports");
    // Everything it may be found by: the name, the shelf, and every tag.
    expect(siftShelf([row!], "sport")).toHaveLength(1);
    expect(siftShelf([row!], "boxing")).toHaveLength(1);
  });

  it("falls back to the shelf's name when a sticker carries no tag", () => {
    const row = shelfRowFromService({
      id: 1,
      url: "https://cdn.example/a.webp",
      tags: [],
      pack: { id: 7, name: "Faces" },
    });
    expect(row!.name).toBe("Faces");
  });

  it("is nothing at all without an address, which is what makes it undrawable", () => {
    expect(shelfRowFromService({ id: 5, tags: ["x"] })).toBeNull();
    expect(shelfRowFromService({ id: 5, url: "", tags: ["x"] })).toBeNull();
    expect(shelfRowFromService(null)).toBeNull();
    expect(shelfRowFromService("a sticker")).toBeNull();
  });
});

describe("a row off our own server", () => {
  it("reads a comma-separated keywords column as words to search by", () => {
    const row = shelfRowFromOwn({
      id: "12",
      name: "Thumbs up",
      keywords: "thumbs up,like,ok",
      url: "https://api.example/media/stickers/1.webp",
      pack: "reactions",
    });
    expect(row!.name).toBe("Thumbs up");
    expect(siftShelf([row!], "like")).toHaveLength(1);
    // The shelf it is filed under is searchable too, as the app's rule says.
    expect(siftShelf([row!], "reactions")).toHaveLength(1);
  });

  it("is dropped when its picture is missing rather than drawn as a broken tile", () => {
    expect(shelfRowFromOwn({ id: "1", name: "x", url: null })).toBeNull();
  });
});

describe("what a search means", () => {
  const shelf = [
    shelfRowFromService({
      id: 1,
      url: "https://cdn.example/cat.webp",
      tags: ["cat", "animal"],
      pack: { id: 2, name: "Animals" },
    })!,
    shelfRowFromService({
      id: 2,
      url: "https://cdn.example/cat-hat.webp",
      tags: ["cat", "party hat"],
      pack: { id: 3, name: "Party" },
    })!,
  ];

  it("narrows with a second word instead of widening", () => {
    expect(siftShelf(shelf, "cat")).toHaveLength(2);
    expect(siftShelf(shelf, "cat hat")).toHaveLength(1);
    // Order does not matter, and neither does case.
    expect(siftShelf(shelf, "HAT Cat")).toHaveLength(1);
  });

  it("matches part of a word, which is how somebody actually types", () => {
    expect(siftShelf(shelf, "ani")).toHaveLength(1);
  });

  it("shows the whole shelf for an empty box or a box of spaces", () => {
    expect(siftShelf(shelf, "")).toHaveLength(2);
    expect(siftShelf(shelf, "   ")).toHaveLength(2);
  });

  it("filters by shelf when one is asked for", () => {
    expect(siftShelf(shelf, "", "2")).toHaveLength(1);
    expect(siftShelf(shelf, "", "9")).toHaveLength(0);
  });
});

describe("the shelves a sticker list came off", () => {
  it("keeps the catalogue's order and counts what each shelf holds", () => {
    const rows = [
      shelfRowFromService({ id: 1, url: "u1", tags: ["a"], pack: { id: 9, name: "Late" } })!,
      shelfRowFromService({ id: 2, url: "u2", tags: ["b"], pack: { id: 4, name: "Early" } })!,
      shelfRowFromService({ id: 3, url: "u3", tags: ["c"], pack: { id: 9, name: "Late" } })!,
    ];
    expect(shelvesOf(rows)).toEqual([
      { id: "9", name: "Late", count: 2 },
      { id: "4", name: "Early", count: 1 },
    ]);
  });

  it("offers no shelf for stickers that came off none", () => {
    const rows = [shelfRowFromService({ id: 1, url: "u1", tags: ["a"] })!];
    expect(shelvesOf(rows)).toEqual([]);
  });
});
