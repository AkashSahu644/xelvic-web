import { describe, expect, it } from "vitest";
import { ARRIVAL_MS, Arrivals } from "./arrivals";

describe("which messages are new", () => {
  it("knows a message it has just been told about", () => {
    const arrivals = new Arrivals();
    arrivals.mark({ id: "m1" }, 1000);
    expect(arrivals.of({ id: "m1" }, 1200)).toBe(1000);
  });

  it("does not know one it has never seen", () => {
    expect(new Arrivals().of({ id: "m1" }, 0)).toBeUndefined();
  });

  it("forgets one once it is no longer new", () => {
    const arrivals = new Arrivals();
    arrivals.mark({ id: "m1" }, 0);
    expect(arrivals.of({ id: "m1" }, ARRIVAL_MS)).toBe(0);
    expect(arrivals.of({ id: "m1" }, ARRIVAL_MS + 1)).toBeUndefined();
  });

  it("counts a message's two names as one arrival", () => {
    // The optimistic bubble carries the id the server will not keep; the same
    // message then arrives again under its own. One message, one moment.
    const arrivals = new Arrivals();
    arrivals.mark({ id: "s1", client_id: "c1" }, 500);
    expect(arrivals.of({ id: "s1" }, 600)).toBe(500);
    expect(arrivals.of({ id: "s1", client_id: "c1" }, 600)).toBe(500);
  });

  it("keeps the first moment when the same message arrives twice", () => {
    const arrivals = new Arrivals();
    arrivals.mark({ id: "s1", client_id: "c1" }, 500);
    arrivals.mark({ id: "s1", client_id: "c1" }, 900);
    expect(arrivals.of({ id: "s1" }, 1000)).toBe(500);
  });

  it("answers for a row that is only known by its client id", () => {
    const arrivals = new Arrivals();
    arrivals.mark({ id: "s1", client_id: "c1" }, 500);
    expect(arrivals.of({ id: "c1", client_id: "c1" }, 600)).toBe(500);
  });

  it("lets the old ones go rather than growing all evening", () => {
    const arrivals = new Arrivals();
    for (let index = 0; index < 500; index += 1) arrivals.mark({ id: `m${index}` }, index);
    // The newest are still known; the map is not holding five hundred names.
    expect(arrivals.of({ id: "m499" }, 600)).toBe(499);
    expect(arrivals.of({ id: "m0" }, 600)).toBeUndefined();
  });
});
