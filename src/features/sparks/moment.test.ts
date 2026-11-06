import { describe, expect, it } from "vitest";
import { momentMention } from "@/features/sparks/moment";
import type { Spark, UserCard } from "@/types/api";

function person(id: string, username: string): UserCard {
  return { id, username, name: username.toUpperCase() } as UserCard;
}

function run(patch: Partial<Spark>): Spark {
  return { ...patch } as Spark;
}

const me = "u1";
const ada = person("u2", "ada");
const sam = person("u3", "sam");

describe("the person a spark moment names", () => {
  it("names the run's own other before anything in the list", () => {
    // The card being posted is this run's, so the run's own payload wins even
    // when the list carries two other live runs.
    expect(
      momentMention(
        run({ thread_id: "t1", other: ada }),
        { sparks: [run({ thread_id: "t2", other: sam }), run({ thread_id: "t3" })] },
        me,
      ),
    ).toEqual(ada);
  });

  it("falls back to the one live run's other person", () => {
    // The phone's second step: a page whose payload carries no `other` still
    // names the person the one going run is with.
    expect(
      momentMention(
        run({ thread_id: "t1" }),
        {
          sparks: [
            run({ thread_id: "t9", alive: false, other: person("u9", "cold") }),
            run({ thread_id: "t2", alive: true, other: sam }),
          ],
        },
        me,
      ),
    ).toEqual(sam);
  });

  it("says nobody when two runs are alive", () => {
    // Two live runs have no honest default; a guess would be somebody's name on
    // a moment that was not about them.
    expect(
      momentMention(
        run({}),
        {
          sparks: [
            run({ alive: true, other: ada }),
            run({ alive: true, other: sam }),
          ],
        },
        me,
      ),
    ).toBeNull();
  });

  it("does not count a run I have hidden", () => {
    expect(
      momentMention(
        run({}),
        { sparks: [run({ alive: true, off: true, other: ada })] },
        me,
      ),
    ).toBeNull();
  });

  it("never names me, and never names an empty card", () => {
    expect(
      momentMention(
        run({ other: person(me, "me") }),
        { sparks: [run({ alive: true, other: person(me, "me") })] },
        me,
      ),
    ).toBeNull();
    expect(
      momentMention(run({ other: { id: "", username: "" } as UserCard }), undefined, me),
    ).toBeNull();
    expect(momentMention(run({}), undefined, me)).toBeNull();
  });
});