// The little face on a theme's tile, drawn rather than shipped.
//
// This is a direct port of `theme_marks.dart` on the Android side: the same
// 18 marks, laid out in a square of [-0.4, 0.4] and scaled to whatever the
// caller asks for, drawn in the theme's own accent and ink so a theme that
// changes its palette changes its character with it. The original draws on a
// Flutter canvas; here the same geometry becomes inline SVG.

/** The shapes a theme's character can be drawn as. */
export type ThemeMark =
  | "blob"
  | "horn"
  | "cloud"
  | "cup"
  | "bolt"
  | "flower"
  | "shell"
  | "flame"
  | "star"
  | "blossom"
  | "sun"
  | "ribbon"
  | "shard"
  | "feather"
  | "ring"
  | "swirl"
  | "eclipse"
  | "paw";

export interface MarkProps {
  mark: ThemeMark;
  /** The theme's primary accent color. */
  accent: string;
  /** The theme's ink / text color. */
  ink: string;
  /** The theme's card / surface background color. */
  ground?: string;
  /** The viewBox size, in logical units (default 44). */
  size?: number;
  className?: string;
}

function pt(u: number, x: number, y: number): string {
  return `${(0.5 + x) * u} ${(0.5 + y) * u}`;
}

function sw(u: number, fraction: number): number {
  return Math.max(0.4, fraction * u);
}

const mkThin = (u: number, color: string) => ({
  stroke: color,
  strokeWidth: sw(u, 0.045),
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const mkWide = (u: number, color: string) => ({
  stroke: color,
  strokeWidth: sw(u, 0.12),
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

const mkFill = (color: string) => ({ fill: color });

/** One character mark as a self-contained inline SVG. */
export function ThemeMarkArt({
  mark,
  accent,
  ink,
  ground = "transparent",
  size = 44,
  className,
}: MarkProps) {
  const u = size;
  const p = (x: number, y: number) => pt(u, x, y);
  const thin = mkThin(u, ink);
  const wide = mkWide(u, accent);
  const fillAccent = mkFill(accent);
  const fillInk = mkFill(ink);

  let body: React.ReactNode = null;

  switch (mark) {
    case "blob":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.3 * u} {...fillAccent} />
          <circle cx={p(-0.18, 0.16)} r={0.11 * u} {...fillAccent} />
          <circle cx={p(0.2, 0.17)} r={0.11 * u} {...fillAccent} />
          <circle cx={p(-0.06, -0.12)} r={0.03 * u} {...fillInk} />
          <circle cx={p(0.06, -0.12)} r={0.03 * u} {...fillInk} />
        </>
      );
      break;

    case "horn":
      body = (
        <>
          {/* Left horn */}
          <path d={`M${p(-0.12, -0.26)} C${p(-0.34, -0.38)} ${p(-0.38, 0.12)} ${p(-0.14, 0.32)}`} {...thin} />
          {/* Right horn */}
          <path d={`M${p(0.12, -0.26)} C${p(0.34, -0.38)} ${p(0.38, 0.12)} ${p(0.14, 0.32)}`} {...thin} />
          {/* Horn tips */}
          <circle cx={p(-0.14, 0.32)} r={0.04 * u} {...fillAccent} />
          <circle cx={p(0.14, 0.32)} r={0.04 * u} {...fillAccent} />
          {/* Eyes */}
          <circle cx={p(-0.16, -0.04)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.16, -0.04)} r={0.025 * u} {...fillInk} />
          {/* Smile */}
          <path d={`M${p(-0.12, 0.12)} Q${p(0, 0.26)} ${p(0.12, 0.12)}`} {...thin} />
        </>
      );
      break;

    case "cloud":
      body = (
        <>
          <circle cx={p(-0.14, 0.08)} r={0.13 * u} {...fillAccent} />
          <circle cx={p(0, -0.04)} r={0.16 * u} {...fillAccent} />
          <circle cx={p(0.14, 0.08)} r={0.13 * u} {...fillAccent} />
          <circle cx={p(-0.04, 0.14)} r={0.06 * u} {...fillInk} />
          <circle cx={p(0.04, 0.14)} r={0.06 * u} {...fillInk} />
          <circle cx={p(-0.02, 0.12)} r={0.025 * u} {...fillAccent} />
          <circle cx={p(0.02, 0.12)} r={0.025 * u} {...fillAccent} />
        </>
      );
      break;

    case "cup":
      body = (
        <>
          {/* Bowl */}
          <path d={`M${p(-0.28, -0.08)} Q${p(0, 0.3)} ${p(0.28, -0.08)}`} {...wide} />
          {/* Left handle */}
          <path d={`M${p(-0.28, -0.04)} C${p(-0.42, -0.02)} ${p(-0.42, 0.12)} ${p(-0.3, 0.14)}`} {...thin} />
          {/* Right handle */}
          <path d={`M${p(0.28, -0.04)} C${p(0.42, -0.02)} ${p(0.42, 0.12)} ${p(0.3, 0.14)}`} {...thin} />
          {/* Face */}
          <circle cx={p(-0.1, 0.02)} r={0.03 * u} {...fillInk} />
          <circle cx={p(0.1, 0.02)} r={0.03 * u} {...fillInk} />
          <path d={`M${p(-0.06, 0.1)} Q${p(0, 0.14)} ${p(0.06, 0.1)}`} {...thin} />
        </>
      );
      break;

    case "bolt":
      body = (
        <>
          <polygon
            points={`${p(-0.04, -0.3)},${p(0.18, -0.04)},${p(0.06, -0.04)},${p(-0.08, 0.3)},${p(-0.18, 0.04)},${p(0.02, 0.04)}`}
            {...fillAccent}
          />
          <circle cx={p(-0.04, -0.08)} r={0.03 * u} {...fillInk} />
          <circle cx={p(0.1, -0.08)} r={0.03 * u} {...fillInk} />
        </>
      );
      break;

    case "flower":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.16 * u} {...fillAccent} />
          <circle cx={p(0, -0.24)} r={0.1 * u} {...fillAccent} />
          <circle cx={p(0.22, -0.08)} r={0.1 * u} {...fillAccent} />
          <circle cx={p(0.14, 0.16)} r={0.1 * u} {...fillAccent} />
          <circle cx={p(-0.14, 0.16)} r={0.1 * u} {...fillAccent} />
          <circle cx={p(-0.22, -0.08)} r={0.1 * u} {...fillAccent} />
          {/* Center */}
          <circle cx={p(0, 0)} r={0.07 * u} {...fillInk} />
        </>
      );
      break;

    case "shell":
      body = (
        <>
          <path
            d={`M${p(-0.06, -0.28)} C${p(-0.26, -0.28)} ${p(-0.36, 0.08)} ${p(-0.06, 0.24)}`}
            {...thin}
          />
          <path
            d={`M${p(0.06, -0.28)} C${p(0.26, -0.28)} ${p(0.36, 0.08)} ${p(0.06, 0.24)}`}
            {...thin}
          />
          <path
            d={`M${p(0, 0.24)} Q${p(-0.24, 0)} ${p(0, -0.22)} Q${p(0.24, 0)} ${p(0, 0.24)}`}
            {...thin}
          />
          <circle cx={p(0, 0.22)} r={0.025 * u} {...fillAccent} />
        </>
      );
      break;

    case "flame":
      body = (
        <>
          <path
            d={`M${p(0, 0.3)} C${p(-0.22, 0.14)} ${p(-0.22, -0.14)} ${p(0, -0.24)} C${p(0.22, -0.14)} ${p(0.22, 0.14)} ${p(0, 0.3)} Z`}
            {...fillAccent}
          />
          <ellipse cx={p(0, 0.08)} rx={0.06 * u} ry={0.1 * u} {...fillInk} />
          <circle cx={p(0, 0.06)} r={0.025 * u} {...fillAccent} />
        </>
      );
      break;

    case "star":
      body = (
        <>
          <polygon
            points={`${p(0, -0.28)},${p(0.07, -0.09)},${p(0.28, -0.09)},${p(0.11, 0.04)},${p(0.18, 0.24)},${p(0, 0.12)},${p(-0.18, 0.24)},${p(-0.11, 0.04)},${p(-0.28, -0.09)},${p(-0.07, -0.09)}`}
            {...fillAccent}
          />
          <circle cx={p(-0.04, -0.04)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.04, -0.04)} r={0.025 * u} {...fillInk} />
        </>
      );
      break;

    case "blossom":
      body = (
        <>
          <circle cx={p(-0.14, -0.14)} r={0.12 * u} {...fillAccent} />
          <circle cx={p(0.14, -0.14)} r={0.12 * u} {...fillAccent} />
          <circle cx={p(-0.14, 0.14)} r={0.12 * u} {...fillAccent} />
          <circle cx={p(0.14, 0.14)} r={0.12 * u} {...fillAccent} />
          <circle cx={p(0, 0)} r={0.1 * u} {...fillInk} />
        </>
      );
      break;

    case "sun":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.14 * u} {...fillAccent} />
          {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = Math.cos(rad) * 0.2;
            const y1 = Math.sin(rad) * 0.2;
            const x2 = Math.cos(rad) * 0.32;
            const y2 = Math.sin(rad) * 0.32;
            return (
              <line
                key={deg}
                x1={p(x1, y1).split(" ")[0]}
                y1={p(x1, y1).split(" ")[1]}
                x2={p(x2, y2).split(" ")[0]}
                y2={p(x2, y2).split(" ")[1]}
                {...thin}
              />
            );
          })}
          <circle cx={p(0, 0)} r={0.07 * u} {...fillInk} />
        </>
      );
      break;

    case "ribbon":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.12 * u} {...fillAccent} />
          <path d={`M${p(-0.12, 0)} C${p(-0.18, 0.28)} ${p(0, 0.34)} ${p(0.12, 0.28)}`} {...thin} />
          <path d={`M${p(-0.12, 0)} C${p(-0.18, -0.1)} ${p(-0.08, -0.18)} ${p(0, -0.12)}`} {...thin} />
          <path d={`M${p(0.12, 0)} C${p(0.18, -0.1)} ${p(0.08, -0.18)} ${p(0, -0.12)}`} {...thin} />
          <circle cx={p(-0.04, -0.04)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.04, -0.04)} r={0.025 * u} {...fillInk} />
        </>
      );
      break;

    case "shard":
      body = (
        <>
          <polygon
            points={`${p(0, -0.3)},${p(0.16, 0.08)},${p(0.06, 0.3)},${p(-0.06, 0.3)},${p(-0.16, 0.08)}`}
            {...fillAccent}
          />
          <circle cx={p(-0.06, 0.08)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.06, 0.08)} r={0.025 * u} {...fillInk} />
          <path d={`M${p(-0.04, 0.16)} Q${p(0, 0.2)} ${p(0.04, 0.16)}`} {...thin} />
        </>
      );
      break;

    case "feather":
      body = (
        <>
          <path
            d={`M${p(0, -0.3)} Q${p(0.14, 0)} ${p(0.04, 0.3)} Q${p(-0.04, 0.1)} ${p(0, -0.3)} Z`}
            {...fillAccent}
          />
          <line x1={p(0, -0.28)} y1={p(0, -0.28).split(" ")[1]} x2={p(0.02, 0.26).split(" ")[0]} y2={p(0.02, 0.26).split(" ")[1]} {...thin} />
          <circle cx={p(-0.02, -0.1)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.06, -0.02)} r={0.025 * u} {...fillInk} />
        </>
      );
      break;

    case "ring":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.22 * u} {...fillAccent} fillOpacity={0} {...thin} />
          <circle cx={p(0, 0)} r={0.16 * u} {...fillAccent} fillOpacity={0} {...thin} />
          <circle cx={p(-0.06, -0.02)} r={0.025 * u} {...fillInk} />
          <circle cx={p(0.06, -0.02)} r={0.025 * u} {...fillInk} />
          <path d={`M${p(-0.1, 0.08)} Q${p(0, 0.14)} ${p(0.1, 0.08)}`} {...thin} />
        </>
      );
      break;

    case "swirl":
      body = (
        <>
          <path
            d={`M${p(0.08, 0)} C${p(0.2, 0)} ${p(0.2, -0.18)} ${p(0, -0.18)} C${p(-0.2, -0.18)} ${p(-0.2, 0.1)} ${p(0.1, 0.1)} C${p(0.2, 0.1)} ${p(0.2, 0)} ${p(0.1, -0.08)}`}
            {...wide}
          />
          <circle cx={p(0, -0.1)} r={0.025 * u} {...fillAccent} />
          <circle cx={p(0.1, -0.1)} r={0.025 * u} {...fillAccent} />
        </>
      );
      break;

    case "eclipse":
      body = (
        <>
          <circle cx={p(0, 0)} r={0.22 * u} {...fillAccent} />
          <circle cx={p(0.08, 0)} r={0.18 * u} {...fillInk} />
          <circle cx={p(-0.04, -0.06)} r={0.025 * u} {...fillAccent} />
          <circle cx={p(0.04, -0.06)} r={0.025 * u} {...fillAccent} />
        </>
      );
      break;

    case "paw":
      body = (
        <>
          {/* Main pad */}
          <ellipse cx={p(0, 0.06)} rx={0.16 * u} ry={0.12 * u} {...fillAccent} />
          {/* Toe pads */}
          <circle cx={p(-0.1, -0.14)} r={0.065 * u} {...fillAccent} />
          <circle cx={p(0, -0.18)} r={0.065 * u} {...fillAccent} />
          <circle cx={p(0.1, -0.14)} r={0.065 * u} {...fillAccent} />
          {/* Heart center */}
          <path
            d={`M${p(0, 0.04)} C${p(-0.04, 0)} ${p(-0.06, 0.06)} ${p(0, 0.1)} C${p(0.06, 0.06)} ${p(0.04, 0)} ${p(0, 0.04)} Z`}
            {...fillInk}
          />
        </>
      );
      break;
  }

  return (
    <svg
      viewBox={`0 0 ${u} ${u}`}
      width={u}
      height={u}
      className={className}
      aria-hidden="true"
      focusable="false"
      style={{ display: "block", flexShrink: 0 }}
    >
      <rect x={0} y={0} width={u} height={u} fill={ground} />
      {body}
    </svg>
  );
}
