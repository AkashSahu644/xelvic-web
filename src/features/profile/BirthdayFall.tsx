import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "@/providers/ThemeProvider";

/**
 * Balloons let go over a profile on the one day they belong to.
 *
 * Ported from `BirthdayFall` in `app/lib/birthday.dart`, and the shape is that
 * widget's rather than a fresh idea: transparent balloons in the theme's own
 * colours, falling from above the top edge to below the bottom one, each with
 * its own place across the page, its own head start, its own sway and its own
 * tilt. The phone paints them with a `CustomPainter`; the web draws one small
 * SVG each and moves it, which is the same drawing said in the language the
 * browser already has.
 *
 * Four rules are kept from the app, because each of them was learned there.
 *
 * **It ends.** Six crossings of eleven seconds each — a little over a minute of
 * falling — and then the balloons are gone and the page is a page again. A
 * decoration that repeats for ever never lets a page go quiet, and a profile is
 * a long list somebody reads.
 *
 * **The balloons are rolled once.** Every one's facts are chosen when the layer
 * is built and only ever read afterwards; a fresh roll per frame is not a fall
 * but a shiver.
 *
 * **It takes nothing back.** The layer ignores the pointer, so the buttons under
 * it are still buttons and the list under it still scrolls.
 *
 * **It obeys the phone's setting.** A reader who asked for less motion gets no
 * balloons at all rather than a slow fall — the same answer `birthday.dart`
 * gives. The first frame draws nothing until the setting has been read, so a
 * reader who has motion switched off never sees one balloon appear and vanish.
 */

/** How long one balloon takes to cross the page. */
const CROSSING = 11_000;
/** How many crossings the fall runs before it comes to rest. */
const PASSES = 6;
/** How many balloons a full-intensity fall holds. */
const MOST = 13;
/** How many colours a fall may draw from: the theme's own run. */
const TONES = 3;
/** The seed every fall is rolled from, so two profiles draw the same fall. */
const SEED = 20260229;
/** The drawing's own units, per balloon body. */
const UNIT_W = 100;
const UNIT_H = 125;
/** The box the whole drawing stands in, in those units: body plus string. */
const BOX_W = 140;
const BOX_H = 330;

interface Balloon {
  /** Its centre-line across the page, as a fraction of the width. */
  baseX: number;
  /** How far into the fall it starts, 0..1. */
  offset: number;
  /** Its body's width, as a fraction of the page's width. */
  size: number;
  /** How far it drifts sideways at its widest, as a fraction of the width. */
  swayAmp: number;
  swayPhase: number;
  /** Cycles of sway over one crossing. */
  swayRate: number;
  /** How far it tips at its most, in radians. */
  spinAmp: number;
  spinPhase: number;
  /** Which of the theme's colours it is drawn in. */
  tone: number;
}

/**
 * The roll, from the fixed seed.
 *
 * A small deterministic generator rather than `Math.random`, for the app's own
 * reason: a fall that came out differently on every visit would not be a
 * drawing, and nothing about it could be looked at twice. The numbers are this
 * build's own rather than the phone's — Dart's `Random` is not reproducible in
 * JavaScript — so the two draw the same *kind* of fall and not the same one.
 */
function roll(intensity: number): Balloon[] {
  const strength = Math.min(1, Math.max(0, intensity));
  if (strength <= 0) return [];
  // At least two, so a low number is a thinner fall rather than a lonely balloon.
  const count = Math.min(MOST, Math.max(2, Math.round(strength * MOST)));

  let seed = SEED >>> 0;
  const next = () => {
    // mulberry32: small, fast, and the same sequence every time.
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const between = (a: number, b: number) => a + next() * (b - a);

  return Array.from({ length: count }, () => ({
    // Across the page but never touching its edges, so a balloon sways through
    // its whole arc without half of it being off the screen.
    baseX: between(0.08, 0.92),
    offset: next(),
    size: between(0.055, 0.1),
    swayAmp: between(0.015, 0.05),
    swayPhase: next() * 2 * Math.PI,
    // Under two, so the drift across is slower than the drift down and reads as
    // a balloon rather than as a pendulum.
    swayRate: between(0.7, 1.6),
    spinAmp: between(0.1, 0.26),
    spinPhase: next() * 2 * Math.PI,
    tone: Math.floor(next() * TONES),
  }));
}

export function BirthdayFall({ intensity = 1 }: { intensity?: number }) {
  const { accentAt } = useTheme();
  const balloons = useMemo(() => roll(intensity), [intensity]);
  const refs = useRef<(HTMLSpanElement | null)[]>([]);
  const [still, setStill] = useState(true);
  const [pageWidth, setPageWidth] = useState(() =>
    typeof window === "undefined" ? 0 : window.innerWidth,
  );

  // Read once, and again if the setting changes while the page is open: a
  // reader who turns animations off mid-page should not have to reload it.
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const read = () => setStill(media.matches);
    read();
    media.addEventListener("change", read);
    return () => media.removeEventListener("change", read);
  }, []);

  // The drawing's own size follows the page, so a balloon stays the fraction of
  // the width it was rolled as. Only the frame loop's reading of the page is
  // live; this one is the scale of the picture and a frame of lag costs nothing.
  useEffect(() => {
    const read = () => setPageWidth(window.innerWidth);
    window.addEventListener("resize", read);
    return () => window.removeEventListener("resize", read);
  }, []);

  useEffect(() => {
    if (still || intensity <= 0 || balloons.length === 0) return;
    let frame = 0;
    const began = performance.now();
    const total = CROSSING * PASSES;

    const step = (now: number) => {
      const elapsed = now - began;
      // The fall is over. Nothing further is written, so every balloon stays
      // where the last frame left it — below the page, where it cannot be seen.
      if (elapsed >= total) return;
      const progress = elapsed / CROSSING;
      const width = window.innerWidth;
      const height = window.innerHeight;

      balloons.forEach((balloon, index) => {
        const node = refs.current[index];
        if (!node) return;
        // The modulo is the loop: the same fraction of the crossing is handed
        // to every balloon, and its own head start decides where in the column
        // it is.
        const t = (progress + balloon.offset) % 1;
        const body = balloon.size * width;
        const sway =
          Math.sin(2 * Math.PI * (balloon.swayRate * t + balloon.swayPhase)) *
          balloon.swayAmp *
          width;
        // The body's centre travels from well above the top edge to well below
        // the bottom, so both the balloon and the string at its foot are
        // entirely off the page at each end of the arc. Whatever happens where
        // the count wraps is therefore hidden by the screen edge rather than by
        // a fade — which is also why the app needs none.
        const margin = body * 3;
        const centreY = -margin + t * (height + 2 * margin);
        const angle = Math.sin(2 * Math.PI * (t + balloon.spinPhase)) * balloon.spinAmp;
        // The drawing is laid out in units of a hundredth of the body, so the
        // box around it is a fixed multiple of the body — and moving that box by
        // half its width and its own known inset puts the body's centre on the
        // point just worked out.
        const cx = balloon.baseX * width + sway;
        node.style.transform = `translate(${cx - body * (BOX_W / 2 / UNIT_W)}px, ${
          centreY - body * ((BOX_W / 2) / UNIT_W)
        }px) rotate(${angle}rad)`;
      });

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [still, intensity, balloons]);

  // Nothing at all is a real answer: a fall nobody asked for costs no layer.
  if (still || intensity <= 0 || balloons.length === 0) return null;
  const veil = 0.4 + 0.6 * Math.min(1, Math.max(0, intensity));

  return (
    <div
      className="pointer-events-none fixed inset-0 z-30 overflow-hidden"
      aria-hidden
      data-birthday-fall
    >
      {balloons.map((balloon, index) => {
        const box = balloon.size * pageWidth * (BOX_W / UNIT_W);
        const tone = accentAt(balloon.tone);
        return (
          <span
            key={index}
            ref={(node) => {
              refs.current[index] = node;
            }}
            className="absolute left-0 top-0 will-change-transform"
            // The box is the drawing's own viewBox at the body's scale, so the
            // body's centre falls on the box's own centre — which is why the
            // default transform origin is the pivot the tilt needs, and why the
            // default `preserveAspectRatio` never letterboxes the drawing.
            style={{ width: box, height: box * (BOX_H / BOX_W) }}
          >
            {/* The origin of the viewBox is the body's centre, so every number
                below is a fraction of the body: 50 wide and 62.5 tall is the
                oval, and the string runs on down to 192. */}
            <svg viewBox={`-70 -70 ${BOX_W} ${BOX_H}`} className="h-full w-full">
              {/* Body, knot and string, all in the one tone. "Transparent" is a
                  low fill under a stronger hairline, which is what lets the page
                  show through — a body filled with anything would stop being
                  see-through, and a gradient would make it opaque. */}
              <ellipse
                rx={UNIT_W / 2}
                ry={UNIT_H / 2}
                fill={tone}
                fillOpacity={Math.min(1, 0.13 * veil)}
                stroke={tone}
                strokeOpacity={Math.min(1, 0.55 * veil)}
                strokeWidth={3.5}
              />
              {/* The one highlight, on the upper left: an arc following the
                  body's own curve, which is the whole of what says "glass"
                  without a second colour, and cannot read as a stripe laid over
                  it the way a straight line would. */}
              <path
                d="M -37.8 -5.3 A 20 32.5 0 0 1 -26.2 -50.9"
                fill="none"
                stroke={tone}
                strokeOpacity={Math.min(1, 0.3 * veil)}
                strokeWidth={5}
                strokeLinecap="round"
              />
              {/* The knot: a small triangle where the neck is pinched shut. */}
              <path
                d="M -7 62.5 L 7 62.5 L 0 73.5 Z"
                fill={tone}
                fillOpacity={Math.min(1, 0.5 * veil)}
              />
              {/* A curve and not a line: a straight string reads as a stick
                  pinned to the balloon, and the bend is the one detail that
                  makes it look like it is hanging from something. */}
              <path
                d="M 0 73.5 Q 28 136 -12 192.25"
                fill="none"
                stroke={tone}
                strokeOpacity={Math.min(1, 0.42 * veil)}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            </svg>
          </span>
        );
      })}
    </div>
  );
}
