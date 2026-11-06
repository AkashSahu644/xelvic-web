import { describe, expect, it } from "vitest";
import {
  AWARDS,
  awardDays,
  awardOf,
  closingLine,
  figure,
  hasCentury,
  headAward,
  litKeys,
  mineSecondsLeft,
  nextWords,
  offerEndsWords,
  offerOf,
  showsSpark,
  spanWords,
  sparkLeftWords,
  theirsSecondsLeft,
  wornOf,
} from "@/features/sparks/model";
import type { Spark } from "@/types/api";

const NOW = Date.parse("2026-11-03T12:00:00Z");

function spark(patch: Partial<Spark> = {}): Spark {
  return { thread_id: "t1", alive: true, count: 12, ...patch };
}

/** An ISO stamp a whole number of hours before NOW. */
function hoursAgo(hours: number): string {
  return new Date(NOW - hours * 3600 * 1000).toISOString();
}

describe("the ladder", () => {
  it("is the seven rungs the prototype has, in order and unbroken", () => {
    expect(AWARDS.map((award) => award.key)).toEqual([
      "ember",
      "flame",
      "blaze",
      "comet",
      "nova",
      "supernova",
      "century",
    ]);
    expect(AWARDS.map((award) => award.name)).toEqual([
      "Ember",
      "Flame",
      "Blaze",
      "Comet",
      "Nova",
      "Supernova",
      "Century",
    ]);
    // Each rung starts the day after the one below it ends, and Century — the
    // one that does not end — is the only open one.
    for (let i = 1; i < AWARDS.length; i += 1) {
      expect(AWARDS[i].from).toBe((AWARDS[i - 1].to ?? 0) + 1);
    }
    expect(AWARDS.filter((award) => award.to === null)).toHaveLength(1);
    expect(AWARDS[AWARDS.length - 1].to).toBeNull();
  });

  it("finds a rung by key, both ways the payload carries one", () => {
    expect(awardOf({ key: "nova" })?.name).toBe("Nova");
    expect(awardOf("nova")?.name).toBe("Nova");
    // An eighth award this build does not know is null rather than a throw:
    // the ladder is the server's, and a row has to draw.
    expect(awardOf({ key: "quasar" })).toBeNull();
    expect(awardOf(null)).toBeNull();
  });

  it("writes the days it covers", () => {
    expect(awardDays(AWARDS[0])).toBe("1–3 days");
    expect(awardDays(AWARDS[AWARDS.length - 1])).toBe("100+ days");
  });

  it("lights the ladder from the best ever, not from the run", () => {
    // The reason a dead spark can still show a Century.
    const spark119 = spark({
      alive: false,
      broken: true,
      count: 0,
      best: 118,
      laps: 1,
      stage: { key: "nova" },
      ladder: [
        { key: "ember", lit: true },
        { key: "nova", lit: true },
        { key: "century", lit: false },
      ],
    });
    expect(litKeys(spark119)).toEqual(["ember", "nova"]);
  });
});

describe("what a run wears", () => {
  it("gives a broken run the rung it broke on, drawn cold", () => {
    const broken = spark({ alive: false, broken: true, count: 0, stage: { key: "blaze" } });
    expect(wornOf(broken).map((award) => award.key)).toEqual(["blaze"]);
    expect(headAward(broken).key).toBe("blaze");
  });

  it("puts the Century first and the live rung beside it", () => {
    const twoLaps = spark({
      laps: 1,
      count: 112,
      stage: { key: "nova" },
      second: { key: "flame" },
    });
    expect(wornOf(twoLaps).map((award) => award.key)).toEqual(["century", "flame"]);
    // The ring and the big glyph read the live rung, and the Century only when
    // there is nothing else worn.
    expect(headAward(twoLaps).key).toBe("flame");
    expect(headAward(spark({ alive: false, laps: 1, count: 0, stage: { key: "nova" } })).key).toBe(
      "century",
    );
  });

  it("shows nothing for a run that ended before it got anywhere, or is hidden", () => {
    expect(showsSpark(spark({ alive: false }))).toBe(false);
    expect(showsSpark(spark({ alive: true }))).toBe(true);
    expect(showsSpark(spark({ alive: false, broken: true, count: 0 }))).toBe(true);
    expect(showsSpark(spark({ alive: false, laps: 1, count: 0 }))).toBe(true);
    // Hiding is the one thing the mark was asked to take away, and the run keeps
    // counting either way.
    expect(showsSpark(spark({ alive: true, off: true }))).toBe(false);
    expect(showsSpark(null)).toBe(false);
    expect(hasCentury(spark({ laps: 0 }))).toBe(false);
  });
});

describe("the two clocks", () => {
  it("counts each side off its own last message", () => {
    // 30 hours of silence: mine is 18 hours from breaking, theirs is 2.
    const run = spark({
      mine_last: hoursAgo(30),
      theirs_last: hoursAgo(46),
      mine_left: 1,
      theirs_left: 1,
    });
    // The dates win over the server's own reading — they do not go stale while
    // a sheet is open.
    expect(mineSecondsLeft(run, NOW)).toBe(18 * 3600);
    expect(theirsSecondsLeft(run, NOW)).toBe(2 * 3600);
    // And the reading is the fallback for a payload with no dates on it.
    expect(mineSecondsLeft(spark({ mine_last: null, mine_left: 400 }), NOW)).toBe(400);
    expect(mineSecondsLeft(spark({ mine_last: null }), NOW)).toBeNull();
    // A clock past its window is nought and never negative.
    expect(mineSecondsLeft(spark({ mine_last: hoursAgo(50) }), NOW)).toBe(0);
  });

  it("says a side's clock only when the run is going", () => {
    const run = spark({ mine_last: hoursAgo(30), theirs_last: hoursAgo(40) });
    expect(sparkLeftWords(run, true, NOW)).toBe("18 hours left");
    expect(sparkLeftWords(run, false, NOW)).toBe("8 hours left");
    expect(sparkLeftWords(spark({ ...run, off: true }), true, NOW)).toBe("");
    expect(sparkLeftWords(spark({ ...run, broken: true }), true, NOW)).toBe("");
    expect(sparkLeftWords(spark({ ...run, alive: false }), true, NOW)).toBe("");
  });

  it("names the side that is running out", () => {
    const both = spark({
      mine_last: hoursAgo(45),
      theirs_last: hoursAgo(45),
      seconds_left: 3 * 3600,
    });
    expect(closingLine(both, NOW)).toBe(
      "Both clocks are nearly out — this spark breaks in 3 hours.",
    );
    const mine = spark({ mine_last: hoursAgo(45), theirs_last: hoursAgo(2), seconds_left: 3600 });
    expect(closingLine(mine, NOW)).toBe(
      "Your clock is nearly out — send a line in the next 1 hour or this spark breaks.",
    );
    const theirs = spark({
      mine_last: hoursAgo(2),
      theirs_last: hoursAgo(46),
      seconds_left: 2 * 3600,
    });
    expect(closingLine(theirs, NOW)).toBe(
      "Their clock is nearly out — this spark breaks in 2 hours unless they send.",
    );
  });

  it("reads a span in the largest unit it has", () => {
    expect(spanWords(3 * 3600)).toBe("3 hours");
    expect(spanWords(3600)).toBe("1 hour");
    expect(spanWords(40 * 60)).toBe("40 minutes");
    // Under a minute still reads as one, never as nought.
    expect(spanWords(5)).toBe("1 minute");
  });
});

describe("the offer on a broken run", () => {
  it("takes both keys or neither", () => {
    expect(offerOf(spark({ offer: { price: 40, count: 47 } }))).toEqual({ price: 40, count: 47 });
    // Half an offer is not an offer: a price against a count that was invented
    // is worse than no price at all.
    expect(offerOf(spark({ offer: { price: 40 } }))).toBeNull();
    expect(offerOf(spark({ offer: null }))).toBeNull();
    expect(offerOf(spark({}))).toBeNull();
  });

  it("reads the deadline off hold_until, in days and then in minutes", () => {
    const offer = { price: 40, count: 47 };
    const long = spark({ offer, hold_until: new Date(NOW + 28 * 3600 * 1000).toISOString() });
    expect(offerEndsWords(long, NOW)).toBe("Offer ends in 1 day 4 hours");
    const soon = spark({ offer, hold_until: new Date(NOW + 90 * 1000).toISOString() });
    expect(offerEndsWords(soon, NOW)).toBe("Offer ends in 1 minute");
    // Nothing to say: no offer, no deadline, or a deadline that has gone by.
    expect(offerEndsWords(spark({ hold_until: long.hold_until }), NOW)).toBe("");
    expect(offerEndsWords(spark({ offer }), NOW)).toBe("");
    expect(offerEndsWords(spark({ offer, hold_until: hoursAgo(1) }), NOW)).toBe("");
  });
});

describe("what the sheet says", () => {
  it("tells the four things the number can be", () => {
    expect(figure(spark({ count: 1200 }))).toEqual({ big: "1.2k", small: "days" });
    expect(figure(spark({ count: 1 }))).toEqual({ big: "1", small: "day" });
    expect(figure(spark({ alive: false, broken: true, count: 0, stage: { key: "nova" } }))).toEqual({
      big: "Broken",
      small: "",
    });
    expect(figure(spark({ alive: false, count: 0 }))).toEqual({ big: "Not started", small: "" });
    expect(figure(spark({ alive: false, count: 0, laps: 1 }))).toEqual({
      big: "Count starts again",
      small: "",
    });
    expect(figure(spark({ off: true }))).toEqual({ big: "Hidden", small: "" });
  });

  it("promises nothing about a run that is not going", () => {
    const running = spark({ count: 25, next_at: 31, next_stage: { key: "nova" } });
    expect(nextWords(running)).toBe("Nova in 6 days — day 31");
    expect(nextWords(spark({ ...running, count: 31 }))).toBe("Nova any day now");
    // A broken run's count is a nought, so "Nova in 31 days" off it would be a
    // promise about a run that no longer exists.
    expect(nextWords(spark({ ...running, broken: true, alive: false, count: 0 }))).toBe("");
    expect(nextWords(spark({ ...running, off: true }))).toBe("");
    expect(nextWords(spark({ count: 1, next_at: 4 }))).toBe("");
  });
});
