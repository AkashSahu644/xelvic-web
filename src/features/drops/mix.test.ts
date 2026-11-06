// The feed's Vibe mix: a share of the cards under "For you" are clips.
//
// The owner's ask on 2026-10-19, in their words: *"drops me kuch percent vibe
// mix kar diya jaye ... dono rahe or random rah ... naye user 40%, purane 20%"*.
// Two promises, and this file is about both:
//
//   * **A share, not a coin toss.** Every block of ten cards carries exactly
//     its share of clips, so one screenful cannot come up with none and the
//     next with four.
//   * **Random places, still places.** Where in the block they fall is drawn
//     from a salted hash of the block, so it is chance — and the same chance
//     every time it is asked for, which is what stops a heart landing or a page
//     arriving from rearranging the cards under the thumb.
//
// These are the app's own assertions (`app/test/drops_mix_test.dart`), carried
// over one for one. The weave is arithmetic over ids and nothing else, which is
// the point: it is the one part of the feed that can be *known* to agree with
// the phone rather than hoped to.

import { describe, expect, it } from "vitest";
import { mixedFeed, mixPerBlock, mixSlots, railClips, shelfKey, shelfOrder, walkOf } from "./mix";
import type { Drop } from "@/types/api";

/** One card as the server sends it. */
function row(id: string, kind = "text"): Drop {
  return { id, kind, ratio: 1 } as unknown as Drop;
}

function drops(count: number, prefix = "d"): Drop[] {
  return Array.from({ length: count }, (_, at) => row(`${prefix}${at}`));
}

function clips(count: number, prefix = "v"): Drop[] {
  return Array.from({ length: count }, (_, at) => row(`${prefix}${at}`, "vibe"));
}

function ids(rows: Drop[]): string[] {
  return rows.map((one) => String(one.id));
}

describe("the weave", () => {
  it("is exactly a share per block of ten, not a coin toss", () => {
    // Twenty per cent of forty cards is eight clips — two in each block of ten.
    // A coin toss could honestly answer nought or four in a block, and a reader
    // who scrolled one screen would then have been told the mix is twenty per
    // cent and shown something else.
    const mixed = mixedFeed({ drops: drops(40), vibes: clips(20), share: 0.2, salt: 11 });

    expect(mixed).toHaveLength(48);
    for (let block = 0; block < 4; block++) {
      const from = block * 12;
      const woven = mixed.slice(from, from + 12).filter((one) => one.kind === "vibe").length;
      expect(woven, `block ${block} carried ${woven} clips`).toBe(2);
    }
  });

  it("and forty per cent is four a block", () => {
    // The cold-start share. Same rule, twice the number.
    const mixed = mixedFeed({ drops: drops(20), vibes: clips(20), share: 0.4, salt: 3 });

    expect(mixed.filter((one) => one.kind === "vibe")).toHaveLength(8);
  });

  it("puts every card back, in the order it came", () => {
    // A weave that dropped or reordered a drop would be the ranker's work
    // undone on the phone.
    const feed = drops(25);
    const mixed = mixedFeed({ drops: feed, vibes: clips(10), share: 0.2, salt: 5 });

    expect(ids(mixed.filter((one) => one.kind !== "vibe"))).toEqual(ids(feed));
  });

  it("never weaves the same clip twice", () => {
    // A block that runs out of clips leaves the rest of its cards as drops
    // rather than dealing one clip at two places.
    const mixed = mixedFeed({ drops: drops(30), vibes: clips(4), share: 0.2, salt: 9 });

    const woven = ids(mixed.filter((one) => one.kind === "vibe"));
    expect(woven).toHaveLength(4);
    expect(new Set(woven).size).toBe(4);
  });

  it("runs out honestly rather than inventing filler", () => {
    const mixed = mixedFeed({ drops: drops(30), vibes: clips(1), share: 0.2, salt: 9 });

    expect(mixed).toHaveLength(31);
    expect(mixed.filter((one) => one.kind === "vibe")).toHaveLength(1);
  });

  it("a share of nought, or an empty shelf, is the feed itself", () => {
    const feed = drops(12);
    expect(ids(mixedFeed({ drops: feed, vibes: clips(5), share: 0, salt: 1 }))).toEqual(ids(feed));
    expect(ids(mixedFeed({ drops: feed, vibes: [], share: 0.2, salt: 1 }))).toEqual(ids(feed));
    expect(mixedFeed({ drops: [], vibes: clips(5), share: 0.2, salt: 1 })).toEqual([]);
  });

  it("the same salt answers the same arrangement", () => {
    // What lets a rebuild leave every card where the thumb left it: a like
    // landing is a rebuild, and a list that re-dealt itself on one would be a
    // card that moved as it was tapped.
    const feed = drops(23);
    const vibes = clips(9);

    expect(ids(mixedFeed({ drops: feed, vibes, share: 0.2, salt: 77 }))).toEqual(
      ids(mixedFeed({ drops: feed, vibes, share: 0.2, salt: 77 })),
    );
  });

  it("and a different salt answers a different one", () => {
    // The slots are chance rather than a fixed pattern down the page, so many
    // salts rather than two: two neighbouring salts agreeing would be a
    // coincidence and this is a test about a spread.
    const feed = drops(30);
    const vibes = clips(12);
    const arrangements = new Set(
      Array.from({ length: 40 }, (_, salt) =>
        ids(mixedFeed({ drops: feed, vibes, share: 0.2, salt })).join(","),
      ),
    );

    expect(arrangements.size).toBeGreaterThan(1);
  });

  it("a page arriving on the end moves nothing already on screen", () => {
    // A card at nine is in block nought whether there are ten of them or
    // thirty, so appending cannot re-deal what the thumb is already over.
    const shelf = clips(6);
    const short = mixedFeed({ drops: drops(10), vibes: shelf, share: 0.2, salt: 21 });
    const long = mixedFeed({ drops: drops(40), vibes: shelf, share: 0.2, salt: 21 });

    expect(ids(long.slice(0, short.length))).toEqual(ids(short));
  });

  it("a clip that is already a card of its own is not woven again", () => {
    // The server does not send a Vibe in the drops page today. If it ever does,
    // the arrangement must not carry the same row twice — two cards with one id
    // is a like that lands on the wrong one.
    const mixed = mixedFeed({
      drops: [...drops(9), row("v0", "vibe")],
      vibes: clips(5),
      share: 0.2,
      salt: 2,
    });

    const seen = ids(mixed);
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe("the strip above the feed", () => {
  it("drops the clips the feed is drawing beside it", () => {
    // The app's rule, for the reason the app gives it: a clip that is a card
    // and a tile at once is one clip met twice on one screen, at two addresses,
    // with two counters a like would have to move together. 2026-10-19, *"dono
    // rahe"* — both shapes stay, and a clip is in one of them at a time.
    const shelf = clips(8);
    const woven = mixedFeed({ drops: drops(10), vibes: shelf, share: 0.4, salt: 5 });
    // A woven card is *between* two drops, so the feed's first ten cards are a
    // few drops short of its first block of ten: how many clips are beside the
    // strip is counted off the drawn feed, not off the block.
    const beside = ids(woven.slice(0, 10)).filter((id) => id.startsWith("v"));
    const rail = ids(railClips({ shelf, woven }));

    expect(beside.length).toBeGreaterThan(0);
    expect(rail).toHaveLength(shelf.length - beside.length);
    for (const id of beside) expect(rail).not.toContain(id);
  });

  it("but a strip is not emptied by a feed somebody has scrolled", () => {
    // **The owner's report of 2026-11-06:** *"for you ke upar jo vibes ka
    // section tha wo bhi hat gya hai, please use rakhiye"*. The app asks its
    // question of the whole feed it holds, and a browser holds every page the
    // reader has scrolled to: eight clips against two pages of ten at the
    // cold-start share is eight clips woven — and the app's reading of that
    // draws no strip at all, which is a whole section gone from the page.
    const shelf = clips(8);
    const woven = mixedFeed({ drops: drops(20), vibes: shelf, share: 0.4, salt: 5 });
    const drawn = new Set(ids(woven).filter((id) => id.startsWith("v")));

    expect(drawn.size).toBe(8);
    expect(railClips({ shelf, woven }).length).toBeGreaterThan(0);
  });

  it("keeps a clip the feed only reaches screens further down", () => {
    // The exclusion is about one screen, so a clip drawn in the *second* block
    // is six screens below the strip rather than beside it.
    const shelf = clips(10);
    const woven = mixedFeed({ drops: drops(20), vibes: shelf, share: 0.2, salt: 5 });
    const late = ids(woven.slice(10)).filter((id) => id.startsWith("v"));
    const rail = new Set(ids(railClips({ shelf, woven })));

    expect(late.length).toBe(2);
    for (const id of late) expect(rail.has(id)).toBe(true);
  });

  it("and a shelf the feed has taken every clip of is still a strip", () => {
    // Four clips is the cold-start share's own block, so a shelf that small can
    // be woven whole and the exclusion can reach all of it. A tile that repeats
    // a card is the smaller of the two wrongs, and the only one a reader can
    // undo by scrolling; a heading over an empty row is a section that has
    // vanished, which is what was reported.
    const shelf = clips(4);
    const woven = mixedFeed({ drops: drops(10), vibes: shelf, share: 0.4, salt: 5 });

    expect(new Set(ids(woven)).size).toBe(14);
    expect(ids(railClips({ shelf, woven, head: 40 }))).toEqual(ids(shelf));
  });

  it("is the shelf's own head on a filled page, and the cards start past it", () => {
    // The feed has run out and the shelf's tail is the feed — so nothing is
    // dealt and nothing is excluded. The owner, 2026-10-24: *"upar 10 rail
    // chalegi uske baad neeche ke cards dikhao"*.
    const shelf = clips(14);
    const tail = shelf.slice(10);
    const rail = railClips({ shelf, woven: tail, filling: true });

    expect(ids(rail)).toEqual(ids(shelf.slice(0, 10)));
  });

  it("is nothing at all when the shelf is empty", () => {
    expect(railClips({ shelf: [], woven: drops(10) })).toEqual([]);
  });
});

describe("the walk's list", () => {
  it("opens on the clip that was pressed, whatever the shelf thinks", () => {
    // A plain video in the feed is not a Vibe and is not on the shelf. The app
    // opens it where a Vibe opens rather than on a screen of its own — the
    // report of 2026-10-19 — and the owner asked for the same here on
    // 2026-11-06: *"app me drops ke for you post me video post par click karne
    // par ek dusare page me wo video open hota hai waise isme nahi ho raha hai"*.
    const shelf = clips(4);
    const lead = row("v9", "video");
    const walk = walkOf(shelf, lead);

    expect(ids(walk)[0]).toBe("v9");
    expect(ids(walk)).toEqual(["v9", ...ids(shelf)]);
  });

  it("keeps the shelf's own order behind it", () => {
    // A swipe from the pressed clip goes on the way the strip would have gone,
    // and the walk does not run out: the hand after this one is asked for by the
    // page (`onNeedMore`), which is what makes the list the walk holds a *window*
    // rather than the whole shelf.
    const shelf = clips(5);
    const walk = walkOf(shelf, row("d1", "video"));

    expect(ids(walk)).toEqual(["d1", ...ids(shelf)]);
  });

  it("and never draws one clip twice", () => {
    // A lead the shelf is already holding is moved to the head rather than
    // repeated: the walk opens on what was pressed, and the same id twice is two
    // pages of one clip — a press that lands on the wrong counter.
    const shelf = clips(3);
    const walk = walkOf(shelf, shelf[1]);

    expect(ids(walk)[0]).toBe("v1");
    expect(new Set(ids(walk)).size).toBe(3);
    expect(ids(walk)).toEqual(["v1", "v0", "v2"]);
  });

  it("is the shelf itself when nothing was carried", () => {
    // A tile on the strip opens the walk on a clip the shelf holds, so there is
    // no lead — and no copy either, because the list is handed straight on.
    const shelf = clips(4);

    expect(walkOf(shelf, null)).toBe(shelf);
  });

  it("is a walk of one when the shelf has not arrived", () => {
    // The difference between a video that opens and a press that looks like it
    // did nothing: the rail and the feed are two requests, and a clip pressed
    // before the shelf lands still opens.
    const walk = walkOf([], row("d7", "video"));

    expect(ids(walk)).toEqual(["d7"]);
  });
});

describe("the arithmetic behind it", () => {
  it("keeps the hash to thirty-two bits whatever the id is", () => {
    // The port's one hazard: the phone holds the whole product before masking
    // it and a JavaScript number does not, so the multiply has to be `imul`.
    // A plain `*` answers a different hash for a long id, and the layout would
    // then be a different arrangement from the one the app draws.
    for (const id of ["d0", "a-much-longer-identifier-0004", "🜁", "V".repeat(200)]) {
      const key = shelfKey(id, 12345);
      expect(Number.isInteger(key)).toBe(true);
      expect(key).toBeGreaterThanOrEqual(0);
      expect(key).toBeLessThanOrEqual(0xffffffff);
    }
  });

  it("asks the shuffle for no more slots than a block has", () => {
    expect(mixSlots(7, 0, 2)).toHaveLength(2);
    expect(mixPerBlock(0.2)).toBe(2);
    expect(mixPerBlock(0.4)).toBe(4);
    // A share the block cannot hold, or one that is not a number, is not a
    // reason to deal four clips into ten cards and then a fifth.
    expect(mixPerBlock(3)).toBe(10);
    expect(mixPerBlock(Number.NaN)).toBe(0);
    expect(mixPerBlock(-1)).toBe(0);
  });

  it("orders the shelf by its own salted key, and settles a tie", () => {
    // Two ids are two different ids, so the comparator only ever decides a real
    // tie between two hashes — but a comparator that may call two different
    // things equal is a sort whose answer depends on the order it was handed.
    const one = shelfOrder(clips(8), 99);
    expect(ids(one)).toHaveLength(8);
    expect(new Set(ids(one)).size).toBe(8);
    expect(ids(shelfOrder(clips(8), 99))).toEqual(ids(one));
    // Asked twice, and asked of a list handed over in another order.
    expect(ids(shelfOrder([...clips(8)].reverse(), 99))).toEqual(ids(one));
  });
});
