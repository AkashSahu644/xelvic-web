import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AWARD_GLYPH_KEYS,
  CARD_BOX,
  CARD_BOX_WIDTH,
  CARD_HEIGHT,
  CARD_WIDEST_CROP,
  CARD_WIDTH,
  FACE_PATIENCE_MS,
  paintSparkCard,
  renderSparkCard,
  SPARK_CARD_STYLES,
  sparkCardAward,
  sparkCardDays,
  sparkCardPaper,
  within,
} from "@/features/sparks/card";
import { AWARDS, headAward } from "@/features/sparks/model";
import type { Spark, UserCard } from "@/types/api";

/**
 * Enough `Path2D` for the glyph painter to run outside a browser.
 *
 * Node has no canvas and no `Path2D`; the painter only ever hands the path to
 * `ctx.stroke`, so an object that remembers its own `d` is the whole of what is
 * needed to walk the code.
 */
class FakePath {
  constructor(public d: string) {}
}
(globalThis as { Path2D?: unknown }).Path2D = FakePath;

function spark(patch: Partial<Spark>): Spark {
  return { ...patch } as Spark;
}

describe("the card's page", () => {
  it("keeps the picture inside the band a phone actually shows", () => {
    // A moment is looked at with the sides cropped off, so a card drawn across
    // the whole 1080 came out full bleed on a phone — the fault the phone's own
    // comment records. Everything is inside what is left.
    expect(CARD_WIDTH).toBe(1080);
    expect(CARD_HEIGHT).toBe(1920);
    expect(CARD_BOX.width).toBe(CARD_WIDTH - CARD_WIDEST_CROP * 2);
    expect(CARD_BOX.left).toBeGreaterThanOrEqual(CARD_WIDEST_CROP);
    expect(CARD_BOX.left + CARD_BOX_WIDTH).toBeLessThanOrEqual(
      CARD_WIDTH - CARD_WIDEST_CROP,
    );
  });

  it("sits a little below the middle of the page and nothing else", () => {
    // The viewer's own bars are not the same height top and bottom, and this
    // nudge is what leaves the same amount of *clear* page on each side.
    expect(CARD_HEIGHT / 2 + 48 - CARD_BOX.height / 2).toBe(CARD_BOX.top);
    expect(CARD_BOX.top).toBe(248);
  });
});

describe("sparkCardPaper", () => {
  it("lets the award's tone most of the way out over white", () => {
    // Flat, and never a gradient: the app's rule, and the one thing this
    // picture shares with every screen it was made on.
    expect(sparkCardPaper(AWARDS[0])).toBe("rgb(249, 242, 231)");
  });

  it("stays a colour a canvas can read for every rung of the ladder", () => {
    for (const award of AWARDS) {
      expect(sparkCardPaper(award)).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
    }
  });
});

describe("sparkCardAward", () => {
  it("draws the same rung the sheet's own big glyph does", () => {
    // The one editorial decision the picture makes, and the phone keeps it by
    // asking the same question the sheet asks: a card that drew a flame for a
    // Blaze would be a picture of the wrong week.
    const runs: Spark[] = [
      spark({ alive: true, count: 12, stage: { key: "blaze" } }),
      spark({ broken: true, count: 0, stage: { key: "comet" } }),
      spark({ laps: 1, alive: true, count: 4, stage: { key: "nova" }, second: { key: "nova" } }),
      spark({ count: 0 }),
    ];
    for (const run of runs) {
      expect(sparkCardAward(run).key).toBe(headAward(run).key);
    }
  });

  it("wears the medal on a run that broke after a Century", () => {
    // The rung it is on and the highest rung it wore come apart here: what is
    // worn is a thing that was won.
    expect(
      sparkCardAward(spark({ laps: 1, broken: true, count: 0, stage: { key: "ember" } })).key,
    ).toBe("century");
  });

  it("falls back to the first rung for a run this build cannot read", () => {
    expect(sparkCardAward(spark({ stage: { key: "unknown" } })).key).toBe("ember");
    expect(sparkCardAward(spark({})).key).toBe("ember");
  });
});

describe("sparkCardDays", () => {
  it("says a broken run is broken rather than on nought days", () => {
    expect(sparkCardDays(spark({ broken: true, count: 0 }))).toBe("Broken");
    expect(sparkCardDays(spark({ broken: true, count: 40 }))).toBe("Broken");
  });

  it("counts the days, and counts one of them in the singular", () => {
    expect(sparkCardDays(spark({ count: 0 }))).toBe("Not started");
    expect(sparkCardDays(spark({ count: 1 }))).toBe("1 day");
    expect(sparkCardDays(spark({ count: 12 }))).toBe("12 days");
  });
});

/**
 * A canvas that records instead of drawing.
 *
 * The card is a picture no test can look at, but it is still code, and code can
 * be run: this is the smallest thing that lets `paintSparkCard` be walked end to
 * end in a plain Node process — every method it calls, and every word it draws.
 * `roundRect` is deliberately left off so the corner fallback is the one
 * exercised.
 */
function recorder() {
  const drawn: string[] = [];
  const ctx = {
    font: "",
    letterSpacing: "0px",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    shadowColor: "",
    shadowBlur: 0,
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    setLineDash() {},
    beginPath() {},
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {},
    ellipse() {},
    closePath() {},
    bezierCurveTo() {},
    fill() {},
    stroke() {},
    fillRect() {},
    clip() {},
    drawImage() {},
    fillText(text: string) {
      drawn.push(text);
    },
    measureText(text: string) {
      const size = Number(/ (\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
      return { width: text.length * size * 0.6 };
    },
  };
  return { ctx, drawn };
}

/**
 * A canvas that records what each shape was painted *in*.
 *
 * `recorder` above answers "what did it say"; this one answers "in what" — the
 * ground the card is, the slabs the words stand on, and the ink the words are
 * written in. A card is a picture no test can see, so the colours it was drawn
 * from are the thing a test can hold on to.
 */
function paletteRecorder() {
  const ops: { op: string; paint: string; text?: string; rounded?: boolean }[] = [];
  // A slab is the one shape in this file that is a rounded rectangle and not
  // the card itself, so the corners it walks are how it is told apart: the
  // fallback `roundedRect` draws exactly four of them per path.
  let corners = 0;
  const ctx = {
    font: "",
    letterSpacing: "0px",
    textAlign: "left",
    textBaseline: "alphabetic",
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 1,
    lineCap: "butt",
    lineJoin: "miter",
    shadowColor: "",
    shadowBlur: 0,
    save() {},
    restore() {},
    translate() {},
    scale() {},
    rotate() {},
    setLineDash() {},
    beginPath() {
      corners = 0;
    },
    moveTo() {},
    lineTo() {},
    arc() {},
    arcTo() {
      corners += 1;
    },
    ellipse() {},
    closePath() {},
    bezierCurveTo() {},
    fill() {
      ops.push({ op: "fill", paint: String(this.fillStyle), rounded: corners === 4 });
      // A glyph is filled from a `Path2D` and walks no path of its own, so the
      // corners of the shape before it would otherwise still be standing.
      corners = 0;
    },
    stroke() {
      // A shadow is set around the card's own fill and at no other time, so a
      // stroke that arrives under one is the card's outline and not a shape's.
      ops.push({ op: "stroke", paint: String(this.strokeStyle) });
      corners = 0;
    },
    fillRect() {
      ops.push({ op: "fillRect", paint: String(this.fillStyle) });
    },
    clip() {},
    drawImage() {},
    fillText(text: string) {
      ops.push({ op: "text", paint: String(this.fillStyle), text });
    },
    measureText(text: string) {
      const size = Number(/ (\d+(?:\.\d+)?)px/.exec(this.font)?.[1] ?? 16);
      return { width: text.length * size * 0.6 };
    },
  };
  return { ctx, ops };
}

describe("the four looks drawn after the first card", () => {
  const GROUND: Record<string, string> = {
    classic: "#FFFFFF",
    midnight: "#241548",
    sunset: "#F4F1FC",
    aurora: "#F3F2FC",
    noir: "#F1EAFB",
  };

  function paint(style: string) {
    const { ctx, ops } = paletteRecorder();
    paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
      spark: spark({ alive: true, count: 12, pct: 0.4, stage: { key: "comet" } }),
      me: { name: "Ada Lovelace" },
      them: { name: "Sam" },
      mePhoto: null,
      themPhoto: null,
      style: style as (typeof SPARK_CARD_STYLES)[number],
    });
    return ops;
  }

  it("gives each look the ground the design sheet gave it", () => {
    // Read off the sheet the four were drawn from: one dark card and three pale
    // lavenders a shade apart. The first card's paper is white and stays white.
    for (const style of SPARK_CARD_STYLES) {
      const grounds = paint(style)
        .filter((op) => op.op === "fill")
        .map((op) => op.paint);
      expect(grounds).toContain(GROUND[style]);
    }
  });

  it("stands the count and the last line on a slab, and the first card on neither", () => {
    // A slab is the only rounded fill in this file that is not the card's own
    // ground, so it is read as a rounded fill in a let-down tone. The first
    // card has none of them; the four new looks each have two.
    const slabsOf = (style: string) =>
      paint(style).filter(
        (op) => op.op === "fill" && op.rounded && op.paint.startsWith("rgba("),
      ).length;
    expect(slabsOf("classic")).toBe(0);
    expect(slabsOf("midnight")).toBe(2);
    expect(slabsOf("sunset")).toBe(2);
    expect(slabsOf("aurora")).toBe(2);
    expect(slabsOf("noir")).toBe(2);
  });

  it("leaves the first card's own painting exactly as it was", () => {
    // The four looks were the whole of what was asked for, and the first card
    // was asked to come through untouched. This is that card's own list of
    // fills, in the order it draws them: its white paper, the white plates
    // behind the four calls drawn on the two lines, the flame's disc, the three
    // sparkles around it, and the two marks either side of the last line. A
    // slab anywhere in here would be a change to a card nobody asked to change.
    expect(
      paint("classic")
        .filter((op) => op.op === "fill")
        .map((op) => op.paint),
    ).toEqual([
      "#FFFFFF",
      "#FFFFFF",
      "#6C46D6",
      "#FFFFFF",
      "#6C46D6",
      "#FFFFFF",
      "#6C46D6",
      "#FFFFFF",
      "#6C46D6",
      "rgba(108, 70, 214, 0.3)",
      "rgba(108, 70, 214, 0.3)",
      "rgba(108, 70, 214, 0.1)",
      "rgba(108, 70, 214, 0.45)",
      "rgba(108, 70, 214, 0.45)",
      "rgba(108, 70, 214, 0.45)",
      "#6C46D6",
      "#6C46D6",
      "#6C46D6",
      "rgba(108, 70, 214, 0.9)",
      "rgba(108, 70, 214, 0.9)",
    ]);
  });

  it("writes the dark card's words in the light, and the others' in the app's ink", () => {
    // The one card whose ground is dark is the one card whose ink cannot be:
    // the award's name and the last line are both lifted to a pale tone there,
    // and both stay the app's own ink on the three pale ones.
    const inkOf = (style: string, startsWith: string) =>
      paint(style).find((op) => op.op === "text" && op.text?.startsWith(startsWith))
        ?.paint;

    expect(inkOf("classic", "COMET")).toBe("#1B1420");
    expect(inkOf("sunset", "COMET")).toBe("#1B1420");
    expect(inkOf("aurora", "COMET")).toBe("#1B1420");
    expect(inkOf("noir", "COMET")).toBe("#1B1420");
    expect(inkOf("midnight", "COMET")).not.toBe("#1B1420");

    expect(inkOf("classic", "A little message")).toBe("#8A8394");
    expect(inkOf("midnight", "A little message")).not.toBe("#8A8394");
  });

  it("keeps the two people and the award on the skeleton the sheet draws", () => {
    // All five put the glyph and the two faces at the same place: the looks
    // differ in paper and ornament, not in where the card's facts sit.
    for (const style of SPARK_CARD_STYLES) {
      const ops = paint(style);
      for (const line of ["Ada Lovelace", "Sam", "COMET", "12 days"]) {
        expect(ops.some((op) => op.op === "text" && op.text === line)).toBe(true);
      }
      expect(
        ops.some((op) => op.op === "text" && op.text?.startsWith("A little message")),
      ).toBe(true);
    }
  });
});

describe("paintSparkCard", () => {
  it("paints a whole card without a photo anywhere", () => {
    const { ctx, drawn } = recorder();
    const run = spark({
      alive: true,
      count: 12,
      pct: 0.4,
      stage: { key: "blaze" },
    });
    const me = { id: "u1", username: "ada", name: "Ada Lovelace", initials: "AL" } as UserCard;
    const them = { id: "u2", username: "sam", name: "Sam", initials: "S" } as UserCard;

    expect(() =>
      paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
        spark: run,
        me,
        them,
        mePhoto: null,
        themPhoto: null,
      }),
    ).not.toThrow();

    // The four things the card is about, in the words it draws them in.
    expect(drawn).toContain("BLAZE");
    expect(drawn).toContain("12 days");
    expect(drawn).toContain("Ada Lovelace");
    expect(drawn).toContain("Sam");
    // No face came, so the plate carries initials rather than a hole.
    expect(drawn).toContain("AL");
    // The last line, cut to the room the two marks leave it — the phone's own
    // rule, and the reason this is read by its opening rather than in full: how
    // much of it fits is a fact about the font, not about this code.
    expect(drawn.some((line) => line.startsWith("A little message"))).toBe(true);
  });

  it("paints every treatment with the same facts", () => {
    // Four alternate looks, one card: whatever the composition, the run's
    // award, count and both people are still the picture.
    for (const style of SPARK_CARD_STYLES) {
      const { ctx, drawn } = recorder();
      expect(() =>
        paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
          spark: spark({ alive: true, count: 12, pct: 0.4, stage: { key: "blaze" } }),
          me: { name: "Ada Lovelace" },
          them: { name: "Sam" },
          mePhoto: null,
          themPhoto: null,
          style,
        }),
      ).not.toThrow();
      expect(drawn).toContain("BLAZE");
      expect(drawn).toContain("12 days");
      expect(drawn).toContain("Ada Lovelace");
      expect(drawn).toContain("Sam");
    }
  });

  it("says a broken run is broken, and a run that never counted is not", () => {
    const broken = recorder();
    paintSparkCard(broken.ctx as unknown as CanvasRenderingContext2D, {
      spark: spark({ broken: true, count: 0, stage: { key: "comet" } }),
      me: null,
      them: null,
      mePhoto: null,
      themPhoto: null,
    });
    expect(broken.drawn).toContain("Broken");
    expect(broken.drawn).toContain("COMET");

    const fresh = recorder();
    paintSparkCard(fresh.ctx as unknown as CanvasRenderingContext2D, {
      spark: spark({ count: 0 }),
      me: null,
      them: null,
      mePhoto: null,
      themPhoto: null,
    });
    expect(fresh.drawn).toContain("Not started");
  });

  it("draws a nameless side as a dash rather than as nothing", () => {
    const { ctx, drawn } = recorder();
    paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
      spark: spark({ count: 3 }),
      me: null,
      them: null,
      mePhoto: null,
      themPhoto: null,
    });
    expect(drawn).toContain("—");
  });

  it("draws the initials when a picture arrives but will not draw", () => {
    // A decoded picture is not a picture that draws: a browser can be handed an
    // image it then refuses to put on the canvas, and that refusal used to be
    // the whole card. The face falls back to the plate the list itself uses,
    // which is the same answer as a face that never came.
    const { ctx, drawn } = recorder();
    (ctx as { drawImage: () => void }).drawImage = () => {
      throw new Error("The image argument is in a broken state");
    };
    const picture = { width: 96, height: 96 } as unknown as HTMLImageElement;

    expect(() =>
      paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
        spark: spark({ count: 2 }),
        me: { name: "Ada Lovelace" },
        them: null,
        mePhoto: picture,
        themPhoto: null,
      }),
    ).not.toThrow();
    expect(drawn).toContain("AL");
  });

  it("reads a name that is not a string as initials rather than failing the card", () => {
    // The card is painted from a row that may have come out of a cache written
    // by an older build. A name this cannot set is a name drawn as nothing —
    // never a card that does not paint.
    const { ctx, drawn } = recorder();
    expect(() =>
      paintSparkCard(ctx as unknown as CanvasRenderingContext2D, {
        spark: spark({ count: 5 }),
        me: { name: 42 as unknown as string },
        them: null,
        mePhoto: null,
        themPhoto: null,
      }),
    ).not.toThrow();
    expect(drawn).toContain("4");
  });
});

describe("the award glyphs", () => {
  it("has a mark for every rung the ladder draws", () => {
    // A rung with no mark falls back to the flame, and a ladder half in one
    // glyph would read as a bug in the picture rather than in the table.
    for (const award of AWARDS) {
      expect(AWARD_GLYPH_KEYS).toContain(award.key);
    }
    expect(AWARD_GLYPH_KEYS.length).toBe(AWARDS.length);
  });
});

describe("what a card is willing to wait for", () => {
  /**
   * The fault these guard: a face whose bytes never come held the paint for
   * ever. The composer opened, the spinner span, the Share button stayed dead,
   * and nothing on the page said why — a card that was never drawn at all. The
   * phone has always bounded this (`Faces.patience`); the first port of it did
   * not, and the browser run that found it is recorded in the testing report.
   */

  it("hands back the work when the work is quick", async () => {
    await expect(within(Promise.resolve("a face"), FACE_PATIENCE_MS)).resolves.toBe(
      "a face",
    );
  });

  it("gives up on a face that never arrives, rather than waiting for ever", async () => {
    const never = new Promise<string>(() => undefined);
    await expect(within(never, 20)).resolves.toBeNull();
  });

  it("waits the phone's own fifteen seconds for a face and not a moment more", async () => {
    // The number is the phone's (`Faces.patience`), and the wait is on this
    // reader only: the bytes are still coming for everything else on screen.
    expect(FACE_PATIENCE_MS).toBe(15_000);
  });

  it("lets a failure through rather than turning it into a wait", async () => {
    // A bound on waiting and nothing else. What turns a failure into initials
    // on the card is `faceImage` above, which catches everything it asks for —
    // this never has to.
    await expect(within(Promise.reject(new Error("no face")), 50)).rejects.toThrow(
      "no face",
    );
  });
});

describe("a card the browser will not paint the first time", () => {
  /*
   * The page behind the card opens once and paints once. A paint that failed
   * left it saying it could not draw the card, with a dead Share button and a
   * picture that was never made — so it is tried a second time, on a fresh
   * canvas and with neither picture, before the page is told at all. These
   * stand in for a browser with no canvas: one that records and answers
   * `toBlob` on demand.
   */

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** A document whose canvas answers `toBlob` with what `encode` returns. */
  function browser(encode: (attempt: number) => Blob | null) {
    const { ctx } = recorder();
    let attempts = 0;
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (done: (value: Blob | null) => void) => {
        attempts += 1;
        done(encode(attempts));
      },
    };
    vi.stubGlobal("document", { createElement: () => canvas });
    return () => attempts;
  }

  it("is painted a second time, without its pictures, instead of giving up", async () => {
    const attempts = browser((attempt) =>
      attempt === 1 ? null : new Blob(["png"], { type: "image/png" }),
    );

    const file = await renderSparkCard({
      spark: spark({ count: 4, alive: true }),
      me: { name: "Ada" },
      them: null,
    });

    expect(attempts()).toBe(2);
    expect(file.type).toBe("image/png");
  });

  it("says so only after the second paint has failed too", async () => {
    const attempts = browser(() => null);

    await expect(
      renderSparkCard({
        spark: spark({ count: 4, alive: true }),
        me: { name: "Ada" },
        them: null,
      }),
    ).rejects.toThrow("would not encode");
    expect(attempts()).toBe(2);
  });
});
