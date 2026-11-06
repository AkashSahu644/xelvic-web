import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { niceTop, type InsightChange, type InsightMetric, type InsightPoint } from "./model";

/**
 * The drawings on the Insights screen.
 *
 * Ported from `app/lib/screens/charts.dart`. There is no chart library here and
 * there is not going to be one, for the reason the app gives: the two charts are
 * a line with a fill under it and a bar, and a dependency that brings its own
 * type scale, its own colours and its own idea of what a grid should look like
 * would be fought on every one of those three. The phone draws these with a
 * `CustomPainter`; the web draws them as SVG, which is the same thing said in
 * the language the browser already has.
 *
 * Three rules are kept here rather than in the screen that uses them, because
 * they are properties of the drawing and a screen that had to remember them
 * would eventually forget one.
 *
 * **The y axis starts at zero, always.** A chart whose baseline is the smallest
 * value it happens to hold turns a rise from 40 to 44 into a cliff, and it is
 * the single most common way a dashboard lies without saying anything untrue.
 *
 * **Nothing is a gradient.** The app's rule: the fill under a line is one flat
 * colour at a low alpha, from the line down to the axis, and it does not fade
 * out as it goes. The fading version is prettier in a still and worse in a
 * chart — the eye reads the darker part as more.
 *
 * **A flat line draws no arrow.** `DeltaChip` has three states and not two; see
 * the note in the model about why `null` is a state of its own.
 *
 * Every colour is a CSS variable, so a theme that repaints the app repaints
 * these with it and nothing here names a colour of its own.
 */

/** The plot's geometry, from the app's own four constants. */
const PLOT_LEFT = 34;
const PLOT_RIGHT = 8;
const PLOT_TOP = 10;
const PLOT_BOTTOM = 20;

const DIM = "var(--dim)";
const LINE = "var(--line)";
const CARD = "var(--card)";
/** `X.fade(hex, a)` — the app's one way of saying "this colour, quieter". */
const faded = (colour: string, alpha: number) =>
  `color-mix(in_srgb,${colour} ${Math.round(alpha * 100)}%,transparent)`;

/**
 * How wide the box actually is.
 *
 * A line drawn into a stretched viewBox has its stroke thickness stretched with
 * it, which turns a hairline into a wedge on a wide screen. So the drawings are
 * measured and painted in real pixels, the same way the phone paints into the
 * size its parent gave it.
 */
function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  useEffect(() => {
    const node = box.current;
    if (!node) return;
    const measure = () => setWidth(node.clientWidth || 320);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return [box, width];
}

/** A line, and the area under it, with no axes and no labels. */
export function Sparkline({
  points,
  color,
  height = 34,
}: {
  points: InsightPoint[];
  color: string;
  height?: number;
}) {
  return (
    <Plot points={points} color={color} height={height} axes={false} selected={null} />
  );
}

/**
 * The trend line: axes, labels, and a point you can put a finger on.
 *
 * **Selection is a drag, not a hover** — on the phone. A pointer that is already
 * resting on a point is the same gesture done for free, so the web takes both:
 * moving the pointer along the plot names the day under it, and dragging does
 * the same thing with a finger held down. Lifting leaves the day where it was,
 * so the number stays readable after the pointer is gone and there is nothing to
 * dismiss.
 *
 * The readout sits *above* the plot rather than floating over it, so it can
 * never cover the part of the line it is describing.
 */
export function TrendChart({
  points,
  color,
  height = 160,
  hint,
  axisLabel,
  readoutLabel,
}: {
  points: InsightPoint[];
  color: string;
  height?: number;
  /** What the readout says before anybody touches it. */
  hint?: string;
  /** How a point's day is written under the plot. */
  axisLabel?: (day: string) => string;
  /** How a point's day is written in the readout above the plot. */
  readoutLabel?: (day: string) => string;
}) {
  const [at, setAt] = useState<number | null>(null);
  const picked = at !== null && at >= 0 && at < points.length ? points[at] : null;
  const label = (day: string) => (readoutLabel ? readoutLabel(day) : day);

  function nearest(dx: number, width: number) {
    // The pointer left the plot: the readout goes back to the line it says
    // before anybody touches the chart, which is the web's way of doing what
    // lifting a finger does on a phone — nothing to dismiss.
    if (dx < 0) {
      setAt(null);
      return;
    }
    if (points.length === 0) return;
    if (points.length === 1) {
      setAt(0);
      return;
    }
    const span = width - PLOT_LEFT - PLOT_RIGHT;
    if (span <= 0) {
      setAt(0);
      return;
    }
    const t = Math.min(1, Math.max(0, (dx - PLOT_LEFT) / span));
    setAt(Math.round(t * (points.length - 1)));
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center">
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[12px]",
            picked ? "font-bold text-ink" : "font-medium text-dim",
          )}
        >
          {picked ? label(picked.day) : (hint ?? "")}
        </span>
        {/* The readout holds the same slot whether or not a day is picked, so
            that dragging along does not reflow the row above the chart it is
            describing. */}
        <span
          className="ml-2 shrink-0 text-[12.5px] font-extrabold tabular-nums"
          style={{ color }}
        >
          {picked ? count(picked.value) : ""}
        </span>
      </div>
      <div className="mt-2">
        <TouchPlot
          points={points}
          color={color}
          height={height}
          selected={at}
          axisLabel={axisLabel}
          onPick={nearest}
        />
      </div>
    </div>
  );
}

/** The plot, with the pointer handling the trend chart needs. */
function TouchPlot({
  points,
  color,
  height,
  selected,
  axisLabel,
  onPick,
}: {
  points: InsightPoint[];
  color: string;
  height: number;
  /** Which point the readout above is naming, so the cursor is drawn on it. */
  selected: number | null;
  axisLabel?: (day: string) => string;
  onPick: (dx: number, width: number) => void;
}) {
  const overlay = useRef<HTMLDivElement>(null);

  /**
   * Where the pointer is along the plot, in the plot's own coordinates.
   *
   * The overlay sits exactly over the drawing, so one subtraction is the whole
   * of the arithmetic — and the same pair of numbers the painter works from is
   * what the readout names, so the day above the chart is always the day under
   * the pointer.
   */
  function at(clientX: number) {
    const node = overlay.current;
    if (!node) return;
    const rect = node.getBoundingClientRect();
    onPick(clientX - rect.left, rect.width);
  }

  return (
    <div className="relative">
      <Plot
        points={points}
        color={color}
        height={height}
        axes
        selected={selected}
        axisLabel={axisLabel}
      />      {/* An overlay rather than handlers on the SVG: the plot is a picture of
          the numbers beside it and is not announced, and a picture that also has
          to be a control is two jobs on one element. */}
      <div
        ref={overlay}
        className="absolute inset-0 cursor-crosshair"
        onPointerDown={(event) => at(event.clientX)}
        onPointerMove={(event) => {
          // A resting pointer names a day; a finger only counts while it is
          // down, which is what a phone can actually do.
          if (event.pointerType === "mouse" || event.buttons) at(event.clientX);
        }}
        onPointerLeave={() => onPick(-1, 0)}
      />
    </div>
  );
}

/** The line itself, drawn into a measured box. */
function Plot({
  points,
  color,
  height,
  axes,
  selected,
  axisLabel,
}: {
  points: InsightPoint[];
  color: string;
  height: number;
  axes: boolean;
  selected: number | null;
  axisLabel?: (day: string) => string;
}) {
  const [box, wide] = useWidth();
  const left = axes ? PLOT_LEFT : 0;
  const right = axes ? PLOT_RIGHT : 0;
  const top = axes ? PLOT_TOP : 2;
  const bottom = axes ? PLOT_BOTTOM : 2;
  const inner = wide - left - right;
  const tall = height - top - bottom;

  const peak = points.reduce((best, point) => Math.max(best, point.value), 0);
  const ceiling = axes ? niceTop(peak) : Math.max(1, peak);
  const yOf = (value: number) => top + tall - (value / ceiling) * tall;
  const across = (index: number) =>
    points.length <= 1 ? left + inner / 2 : left + (index / (points.length - 1)) * inner;

  const line = points.map((point, index) => `${across(index)},${yOf(point.value)}`).join(" ");
  const area =
    points.length > 0
      ? `${across(0)},${top + tall} ${line} ${across(points.length - 1)},${top + tall}`
      : "";

  const pick = selected !== null && selected >= 0 && selected < points.length ? selected : null;

  return (
    <div ref={box} className="w-full">
      <svg
        width={wide}
        height={height}
        viewBox={`0 0 ${wide} ${height}`}
        // A chart is a picture of the numbers next to it. Announcing it as
        // anything else would make a screen reader read the same fact twice.
        aria-hidden
        focusable={false}
        className="block"
      >
      {axes ? (
        <>
          {/* Three lines: the top of the scale, the middle, and the baseline.
              The baseline is drawn in the line colour rather than in the ink so
              that a chart whose every day is zero still shows an axis to be zero
              along. */}
          {[ceiling, Math.floor(ceiling / 2), 0].map((value) => (
            <g key={value}>
              <line
                x1={left}
                x2={left + inner}
                y1={yOf(value)}
                y2={yOf(value)}
                stroke={faded(LINE, 0.9)}
                strokeWidth={1}
              />
              <text
                x={left - 6}
                y={yOf(value)}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={9.5}
                fontWeight={600}
                fill={DIM}
              >
                {count(value)}
              </text>
            </g>
          ))}
        </>
      ) : null}

      {points.length === 0 ? (
        <line
          x1={left}
          x2={left + inner}
          y1={top + tall}
          y2={top + tall}
          stroke={faded(DIM, 0.35)}
          strokeWidth={1.5}
        />
      ) : (
        <>
          <polygon points={area} fill={faded(color, 0.12)} />
          <polyline
            points={line}
            fill="none"
            stroke={color}
            strokeWidth={axes ? 2.2 : 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}

      {axes && pick !== null ? (
        <>
          <line
            x1={across(pick)}
            x2={across(pick)}
            y1={top}
            y2={top + tall}
            stroke={faded(color, 0.4)}
            strokeWidth={1}
          />
          {/* A disc the colour of the page under the dot, so the dot reads as
              sitting *on* the line rather than as a kink in it. */}
          <circle cx={across(pick)} cy={yOf(points[pick].value)} r={5.5} fill={CARD} />
          <circle cx={across(pick)} cy={yOf(points[pick].value)} r={3.5} fill={color} />
        </>
      ) : null}

      {axes && points.length > 0 ? (
        <>
          {/* Only the two ends of the window are labelled. A tick per day would
              be thirty labels under a phone-wide chart; the shape between them
              is what the axis is for, and the readout names any day exactly. */}
          <text x={left} y={height - 14} fontSize={9.5} fontWeight={600} fill={DIM}>
            {(axisLabel ?? ((day: string) => day))(points[0].day)}
          </text>
          {points.length > 1 ? (
            <text
              x={left + inner}
              y={height - 14}
              textAnchor="end"
              fontSize={9.5}
              fontWeight={600}
              fill={DIM}
            >
              {(axisLabel ?? ((day: string) => day))(points[points.length - 1].day)}
            </text>
          ) : null}
        </>
      ) : null}
      </svg>
    </div>
  );
}

/** A titled block of the board — a title and its contents, and nothing else. */
export function Panel({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "rounded-[18px] border border-line bg-card px-3.5 pb-2 pt-3",
        className,
      )}
    >
      <h2 className="text-[14px] font-extrabold">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** A small pill, for the range chips and the two choosers on the growth chart. */
export function Chip({
  label,
  on,
  onTap,
  enabled = true,
}: {
  label: string;
  on: boolean;
  onTap?: (() => void) | null;
  /** Whether the choice is available at all — a greyed chip does nothing. */
  enabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={enabled && onTap ? onTap : undefined}
      disabled={!enabled}
      aria-pressed={on}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-[7px] text-[12.5px] font-bold transition",
        on
          ? "border-accent bg-accent text-[var(--on-accent)]"
          : enabled
            ? "border-line bg-card text-dim"
            : "border-line bg-card text-[color-mix(in_srgb,var(--dim)_45%,transparent)]",
      )}
    >
      {label}
    </button>
  );
}

/** How one window compares with the one before it. */
export function DeltaChip({
  change,
  bare = false,
}: {
  change: InsightChange;
  /** Drawn without its own pill, for use inside a line of text. */
  bare?: boolean;
}) {
  if (change.up === null) {
    // Either nothing moved or there is nothing behind it. A dash for the first
    // — the metric is being measured and it did not go anywhere — and an empty
    // box for the second, so the row keeps its height.
    return bare ? <span className="text-[12px] text-dim">—</span> : null;
  }
  const up = change.up;
  const label =
    change.ratio === null
      ? // It moved, and the period it moved from was zero. There is no
        // percentage of nothing, so "first this period" is the honest way to
        // say it — and a fall from nothing is not a thing to say at all.
        up
        ? "first this period"
        : ""
      : `${up ? "+" : "−"}${Math.round(Math.abs(change.ratio) * 100)}%`;
  if (!label) return bare ? <span className="text-[12px] text-dim">—</span> : null;
  const tone = up ? "var(--good)" : "var(--bad)";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-bold",
        !bare && "rounded-full px-[7px] py-[3px]",
      )}
      style={{ color: tone, background: bare ? undefined : faded(tone, 0.1) }}
    >
      {/* The arrow is a shape rather than a character, so it cannot pick up a
          font's own idea of what an arrow looks like. */}
      <svg width={8} height={8} viewBox="0 0 8 8" aria-hidden className="shrink-0">
        <polygon points={up ? "4,0 8,8 0,8" : "4,8 8,0 0,0"} fill={tone} />
      </svg>
      {label}
    </span>
  );
}

/**
 * One number, its label, its delta, and the shape it made getting there.
 *
 * The four parts are in that order because that is the order the questions come
 * in: what is it, how much, is that better than before, and what did it look
 * like. The label is small and dim and the number is large, because a card is
 * found by its number and only then read for what it counts.
 */
export function MetricCard({ metric, color }: { metric: InsightMetric; color: string }) {
  return (
    <div className="rounded-[18px] border border-line bg-card px-3.5 pb-2.5 pt-3">
      <div className="flex items-center">
        <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-dim">
          {metric.title}
        </span>
        <span className="ml-2 shrink-0">
          <DeltaChip change={metric.change} />
        </span>
      </div>
      <p className="mt-1.5 text-[26px] font-extrabold leading-[1.05] tracking-[-0.6px] tabular-nums">
        {count(metric.total)}
      </p>
      <div className="mt-1.5">
        <Sparkline points={metric.points} color={color} height={30} />
      </div>
    </div>
  );
}

/**
 * One row of a ranking: what it was, how many, and how that compares.
 *
 * A bar and not a pie, and a bar and not a second line chart. Everything drawn
 * with this is a list of *things* — a moment, a drop, a face — and the question
 * about a list of things is which one is biggest, which is the one question a
 * bar answers by being looked at.
 */
export function BarRow({
  label,
  value,
  top,
  color,
  note,
}: {
  label: string;
  value: number;
  /** The largest value in this list, which is what the bar is drawn against. */
  top: number;
  color?: string;
  /** The second fact, on the right, under the first. */
  note?: string;
}) {
  const tone = color ?? "var(--accent)";
  const share = top <= 0 ? 0 : Math.min(1, Math.max(0, value / top));
  return (
    <div className="py-[9px]">
      <div className="flex items-center">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{label}</span>
        <span className="ml-2.5 shrink-0 text-[14px] font-extrabold tabular-nums">
          {count(value)}
        </span>
      </div>
      {/* The second fact goes *under* the first rather than beside it, which is
          the same shape every other row on this screen has: three things on one
          line — a title, a sentence and a number — is a line that has to be
          squeezed somewhere, and what gets squeezed is the sentence somebody
          needed to read. */}
      {note ? (
        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-dim">{note}</p>
      ) : null}
      {/* The track is the full row's width and the fill is a share of it, so the
          bars in a column are comparable by their lengths alone. */}
      <div className="mt-1.5 h-[5px] overflow-hidden rounded-[3px]" style={{ background: faded(LINE, 0.8) }}>
        <div
          className="h-full rounded-[3px]"
          style={{ width: `${(share === 0 ? 0.02 : share) * 100}%`, background: faded(tone, 0.85) }}
        />
      </div>
    </div>
  );
}
