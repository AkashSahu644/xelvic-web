// The little face on a theme's tile, drawn rather than shipped.
//
// This is a direct port of `theme_marks.dart` on the Android side: all 33 of
// `XMark`'s names — the 19 *things* a theme is about, the 12 the character
// themes are drawn as, the teddy above the shelf and Alone's moon — laid out in
// a square of [-0.4, 0.4] and scaled to whatever the caller asks for, drawn in
// the theme's own accent and ink so a theme that changes its palette changes its
// character with it. The original draws on a Flutter canvas; here the same
// geometry becomes inline SVG.

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
  | "paw"
  | "wing"
  | "fox"
  | "tiara"
  | "headset"
  | "visor"
  | "knot"
  | "hood"
  | "toon"
  | "bubble"
  | "snout"
  | "aerial"
  | "patch"
  | "helmet"
  | "bear"
  | "moon";

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

const mkStroke = (u: number, color: string, fraction: number) => ({
  stroke: color,
  strokeWidth: Math.max(0.4, fraction * u),
  fill: "none" as const,
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
  // The character marks of `theme_marks.dart` are drawn with five paints, and
  // they are named here as they are named there: `stroke` is the ink at 0.07u,
  // `detail` is the ink as a fill, and a face's features are cut in the *ground*
  // — the card under the mark — because a feature has to read on the accent
  // beneath it and the app already holds every accent to 4.5:1 against its card.
  const stroke = mkStroke(u, ink, 0.07);
  const inkStroke = (fraction: number) => mkStroke(u, ink, fraction);
  const groundStroke = (fraction: number) => mkStroke(u, ground, fraction);
  const holeLine = mkStroke(u, ground, 0.07);
  const fillGround = mkFill(ground);
  const X = (x: number) => (0.5 + x) * u;
  const Y = (y: number) => (0.5 + y) * u;
  /** A circle's centre, for `<circle cx cy>`. */
  const c = (x: number, y: number) => ({ cx: X(x), cy: Y(y) });
  /** An ellipse in mark units, for `<ellipse>`. */
  const e = (x: number, y: number, rx: number, ry: number) => ({
    cx: X(x),
    cy: Y(y),
    rx: rx * u,
    ry: ry * u,
  });
  /** A rectangle between two corners, for `<rect>`. */
  const box = (x0: number, y0: number, x1: number, y1: number) => ({
    x: X(Math.min(x0, x1)),
    y: Y(Math.min(y0, y1)),
    width: Math.abs(x1 - x0) * u,
    height: Math.abs(y1 - y0) * u,
  });
  /** The same, rounded, for the marks that draw an `RRect`. */
  const rbox = (x0: number, y0: number, x1: number, y1: number, r: number) => ({
    ...box(x0, y0, x1, y1),
    rx: r * u,
    ry: r * u,
  });
  /**
   * An arc of a circle as a path, in mark units and canvas angles: zero points
   * right and angles grow clockwise, which is the way `Canvas.drawArc` reads
   * them, so every arc in the Dart source transfers without re-deriving it.
   */
  const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
    const x0 = X(cx) + r * u * Math.cos(a0);
    const y0 = Y(cy) + r * u * Math.sin(a0);
    const x1 = X(cx) + r * u * Math.cos(a1);
    const y1 = Y(cy) + r * u * Math.sin(a1);
    const large = Math.abs(a1 - a0) > Math.PI ? 1 : 0;
    const sweep = a1 > a0 ? 1 : 0;
    return `M${x0} ${y0} A${r * u} ${r * u} 0 ${large} ${sweep} ${x1} ${y1}`;
  };

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

    // The fifteen below are the app's character themes: the shapes the painted
    // designs wear on their tiles, ported one for one out of `theme_marks.dart`.
    // Yumi: a butterfly, two wings a side, the body and feelers in the ink so
    // they read on the accent, and a spot on each upper wing for the same reason.
    case "wing":
      body = (
        <>
          {[-1, 1].map((side) => (
            <g key={side}>
              <ellipse {...e(0.18 * side, -0.13, 0.16, 0.19)} {...fillAccent} />
              <ellipse {...e(0.15 * side, 0.2, 0.125, 0.135)} {...fillAccent} />
              <circle {...c(0.2 * side, -0.15)} r={0.05 * u} {...fillInk} />
              <path d={`M${p(0, -0.22)} L${p(0.13 * side, -0.35)}`} {...stroke} />
              <circle {...c(0.13 * side, -0.35)} r={0.035 * u} {...fillInk} />
            </g>
          ))}
          {/* The body, a thin spindle down the middle. */}
          <rect {...rbox(-0.035, -0.21, 0.035, 0.25, 0.035)} {...fillInk} />
        </>
      );
      break;

    // Yuzu: a fox — ears first, the muzzle a nose and nothing else, and the inner
    // ear filled rather than left hollow, because at tile size a hollow triangle
    // is a notch cut out of the head rather than a second ear.
    case "fox":
      body = (
        <>
          {[-1, 1].map((side) => (
            <path
              key={`outer${side}`}
              d={`M${p(0.34 * side, -0.1)} L${p(0.3 * side, -0.48)} L${p(0.05 * side, -0.18)} Z`}
              {...fillAccent}
            />
          ))}
          <circle {...c(0, 0.06)} r={0.29 * u} {...fillAccent} />
          {[-1, 1].map((side) => (
            <path
              key={`inner${side}`}
              d={`M${p(0.28 * side, -0.14)} L${p(0.26 * side, -0.37)} L${p(0.14 * side, -0.19)} Z`}
              {...fillGround}
            />
          ))}
          <circle {...c(-0.11, -0.01)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.11, -0.01)} r={0.055 * u} {...fillGround} />
          <path d={`M${p(0, 0.1)} L${p(0.07, 0.2)} L${p(-0.07, 0.2)} Z`} {...fillGround} />
          <path d={arc(0, 0.19, 0.11, 0.45, Math.PI - 0.45)} {...holeLine} />
        </>
      );
      break;

    // Hana: two buns and a crown, and the crown is one shape rather than a band
    // with points on it — the arc and the three triangles are the same ink and
    // touching, so they read as a tiara instead of a hat with things stuck on it.
    case "tiara":
      body = (
        <>
          {[-1, 1].map((side) => (
            <circle key={side} {...c(0.27 * side, 0.03)} r={0.17 * u} {...fillAccent} />
          ))}
          <circle {...c(0, 0.06)} r={0.27 * u} {...fillAccent} />
          <path d={arc(0, 0.06, 0.22, Math.PI, Math.PI * 2)} {...inkStroke(0.08)} />
          {[-0.14, 0, 0.14].map((x) => (
            <path
              key={x}
              d={`M${p(x - 0.055, -0.12)} L${p(x, -0.32)} L${p(x + 0.055, -0.12)} Z`}
              {...fillInk}
            />
          ))}
          <circle {...c(-0.1, 0.13)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, 0.13)} r={0.055 * u} {...fillGround} />
          <circle {...c(0, 0.26)} r={0.035 * u} {...fillGround} />
        </>
      );
      break;

    // Rina: an idol's headset — the band over the hair, the cups on her ears and
    // the mic brought round to her mouth, which is what makes her a performer
    // rather than a girl with headphones. The band and cups sit over the page as
    // much as over her, so they are the ink; her mouth is on her face, so it is
    // the ground.
    case "headset":
      body = (
        <>
          <circle {...c(0, 0.08)} r={0.26 * u} {...fillAccent} />
          <path d={arc(0, 0.08, 0.3, Math.PI, Math.PI * 2)} {...stroke} />
          {[-1, 1].map((side) => (
            <g key={side}>
              <circle {...c(0.3 * side, 0.08)} r={0.1 * u} {...fillInk} />
              <circle {...c(0.3 * side, 0.08)} r={0.04 * u} {...fillAccent} />
            </g>
          ))}
          <path d={`M${p(0.3, 0.16)} Q${p(0.3, 0.34)} ${p(0.15, 0.32)}`} {...stroke} />
          <circle {...c(0.13, 0.32)} r={0.05 * u} {...fillInk} />
          <circle {...c(-0.1, 0.05)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, 0.05)} r={0.055 * u} {...fillGround} />
          <circle {...c(0, 0.19)} r={0.035 * u} {...fillGround} />
        </>
      );
      break;

    // Rivet: a visor rather than a face. The two eyes are the accent showing
    // *through* the ink band, which is the whole idea of a visor, and the fin and
    // the grill are what keep the head from being a circle with a stripe on it.
    case "visor":
      body = (
        <>
          <circle {...c(0, 0.05)} r={0.29 * u} {...fillAccent} />
          <path d={`M${p(-0.12, -0.24)} L${p(0.06, -0.46)} L${p(0.16, -0.22)} Z`} {...fillInk} />
          <rect {...rbox(-0.3, -0.12, 0.3, 0.06, 0.07)} {...fillInk} />
          {[-1, 1].map((side) => (
            <rect
              key={side}
              {...rbox(0.14 * side - 0.07, -0.05, 0.14 * side + 0.07, 0, 0.02)}
              {...fillAccent}
            />
          ))}
          {[-0.1, 0, 0.1].map((x) => (
            <path key={x} d={`M${p(x, 0.14)} L${p(x, 0.24)}`} {...holeLine} />
          ))}
        </>
      );
      break;

    // Ken: the hair is a flat cap of ink and the knot sits on top of it, which is
    // the whole of a topknot at this size. The scar is the one thing about him
    // that is not symmetrical, and it is drawn thin on purpose — a scar as thick
    // as a limb is a bandage.
    case "knot":
      body = (
        <>
          <circle {...c(0, 0.06)} r={0.27 * u} {...fillAccent} />
          <path d={`${arc(0, -0.02, 0.28, Math.PI, Math.PI * 2)} Z`} {...fillInk} />
          <circle {...c(0, -0.34)} r={0.09 * u} {...fillInk} />
          <circle {...c(-0.1, 0.13)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, 0.13)} r={0.055 * u} {...fillGround} />
          <path d={`M${p(0.17, 0.02)} L${p(0.25, 0.15)}`} {...groundStroke(0.035)} />
        </>
      );
      break;

    // Kage: the hood *is* the silhouette, made by drawing a disc of ink and
    // cutting the face back out of it, and the mask covers a mouth nobody has
    // ever seen. The tie trailing off to the right says the hood is cloth.
    case "hood":
      body = (
        <>
          <path d={`M${p(0.26, -0.04)} L${p(0.46, 0.12)} L${p(0.3, 0.2)} Z`} {...fillInk} />
          <circle {...c(0, 0.04)} r={0.32 * u} {...fillInk} />
          <circle {...c(0, 0.08)} r={0.24 * u} {...fillAccent} />
          <rect {...rbox(-0.2, 0.12, 0.2, 0.28, 0.06)} {...fillInk} />
          <circle {...c(-0.1, -0.02)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, -0.02)} r={0.055 * u} {...fillGround} />
        </>
      );
      break;

    // Bounce: a 1930s cartoon's flat cap, which is a disc of ink laid over the
    // head and cut back out of it with the head's own colour. His eyes are the
    // one place the marks use a pupil: a tall oval with the accent showing in it
    // is what makes him look alive rather than stunned.
    case "toon":
      body = (
        <>
          <circle {...c(0, -0.02)} r={0.3 * u} {...fillInk} />
          <circle {...c(0, 0.12)} r={0.3 * u} {...fillAccent} />
          <rect {...rbox(0.08, -0.14, 0.48, -0.04, 0.05)} {...fillInk} />
          {[-1, 1].map((side) => (
            <g key={side}>
              <ellipse {...e(0.12 * side, 0.1, 0.055, 0.1)} {...fillGround} />
              <circle {...c(0.12 * side, 0.04)} r={0.033 * u} {...fillAccent} />
            </g>
          ))}
          <path d={arc(0, 0.26, 0.14, 0.35, Math.PI - 0.35)} {...holeLine} />
        </>
      );
      break;

    // Poppy: the bubble is an outline rather than a disc, and that is the whole
    // of her — a filled circle is a ball, an outlined one is something about to
    // pop, with the ground showing through it either way.
    case "bubble":
      body = (
        <>
          <circle {...c(0, -0.08)} r={0.26 * u} {...fillAccent} />
          <path d={arc(0, -0.08, 0.26, Math.PI, Math.PI * 2)} {...stroke} />
          <circle {...c(-0.1, -0.12)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, -0.12)} r={0.055 * u} {...fillGround} />
          <circle {...c(0, 0.03)} r={0.045 * u} {...fillGround} />
          <circle {...c(0, 0.3)} r={0.19 * u} {...stroke} />
          <path d={arc(0, 0.3, 0.12, 3.6, 4.7)} {...stroke} />
        </>
      );
      break;

    // Rex: small, so the spikes are most of his silhouette and his snout is a
    // bump of the head's own colour — a snout in a second colour is a beak.
    case "snout":
      body = (
        <>
          {[-0.18, 0, 0.18].map((x) => (
            <path
              key={x}
              d={`M${p(x - 0.11, -0.1)} L${p(x, -0.4)} L${p(x + 0.11, -0.1)} Z`}
              {...fillInk}
            />
          ))}
          <circle {...c(0, 0.08)} r={0.28 * u} {...fillAccent} />
          <ellipse {...e(0, 0.22, 0.17, 0.1)} {...fillAccent} />
          <circle {...c(-0.07, 0.2)} r={0.03 * u} {...fillGround} />
          <circle {...c(0.07, 0.2)} r={0.03 * u} {...fillGround} />
          <circle {...c(-0.11, 0)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.11, 0)} r={0.055 * u} {...fillGround} />
        </>
      );
      break;

    // Cog: a tin head, and the eyes are slots rather than pupils because a toy's
    // eyes are what its maker cut out of it. The aerial is the one part that is
    // not the tin, and its bead is the accent so the rod reads as wire with
    // something on the end of it.
    case "aerial":
      body = (
        <>
          <path d={`M${p(0, -0.2)} L${p(0, -0.4)}`} {...stroke} />
          <circle {...c(0, -0.44)} r={0.07 * u} {...fillAccent} />
          <rect {...rbox(-0.26, -0.2, 0.26, 0.3, 0.1)} {...fillAccent} />
          {[-1, 1].map((side) => (
            <rect
              key={side}
              {...rbox(0.13 * side - 0.07, -0.06, 0.13 * side + 0.07, 0.04, 0.03)}
              {...fillGround}
            />
          ))}
          {[-0.08, 0, 0.08].map((x) => (
            <path key={x} d={`M${p(x, 0.14)} L${p(x, 0.24)}`} {...holeLine} />
          ))}
        </>
      );
      break;

    // Marina: a bandana and an eyepatch, which is two thirds of a pirate. The
    // patch hangs clear of the bandana rather than touching it — the two are the
    // same colour and a patch joined to a bandana is one dark face — and she is
    // the only mark here with one eye open.
    case "patch":
      body = (
        <>
          <circle {...c(0, 0.06)} r={0.27 * u} {...fillAccent} />
          <path d={`M${p(-0.24, 0)} L${p(0.26, -0.08)}`} {...stroke} />
          <path d={`${arc(0, -0.04, 0.3, Math.PI, Math.PI * 2)} Z`} {...fillInk} />
          <circle {...c(0.28, -0.1)} r={0.09 * u} {...fillInk} />
          <path d={`M${p(0.34, -0.06)} L${p(0.48, 0.02)} L${p(0.34, 0.08)} Z`} {...fillInk} />
          <circle {...c(-0.13, 0.12)} r={0.095 * u} {...fillGround} />
          <circle {...c(0.13, 0.12)} r={0.055 * u} {...fillGround} />
          <path d={arc(0.02, 0.2, 0.12, 0.35, Math.PI - 0.35)} {...holeLine} />
        </>
      );
      break;

    // Comet: a helmet drawn as a rim rather than as a shell, because the face has
    // to show through it — a helmet that covers a face is a mark with no
    // character in it. The two antennae are the silhouette it gets instead, and
    // the mouth is a small oval, the one shape that reads as "surprised".
    case "helmet":
      body = (
        <>
          {[-1, 1].map((side) => (
            <g key={side}>
              <path d={`M${p(0.2 * side, -0.2)} L${p(0.33 * side, -0.37)}`} {...stroke} />
              <circle {...c(0.34 * side, -0.39)} r={0.05 * u} {...fillInk} />
            </g>
          ))}
          <circle {...c(0, 0.06)} r={0.26 * u} {...fillAccent} />
          <circle {...c(0, 0.06)} r={0.31 * u} {...inkStroke(0.1)} />
          <circle {...c(-0.1, 0.04)} r={0.055 * u} {...fillGround} />
          <circle {...c(0.1, 0.04)} r={0.055 * u} {...fillGround} />
          <ellipse {...e(0, 0.17, 0.045, 0.03)} {...fillGround} />
        </>
      );
      break;

    // Bubu: a teddy's head, which at this size is ears, eyes and a muzzle. The
    // ears are drawn *before* the head so the head overlaps their inner edge,
    // which is what makes two circles and a circle read as one bear; the muzzle
    // is the one place a *feature* is the ground rather than a cut in it, so the
    // mouth above it is the ink — the one pairing the app holds to 4.5:1 on every
    // theme: ink on the card.
    case "bear":
      body = (
        <>
          {[-1, 1].map((side) => (
            <g key={side}>
              <circle {...c(0.25 * side, -0.21)} r={0.15 * u} {...fillAccent} />
              <circle {...c(0.25 * side, -0.21)} r={0.07 * u} {...fillGround} />
            </g>
          ))}
          <circle {...c(0, 0.06)} r={0.28 * u} {...fillAccent} />
          <ellipse {...e(0, 0.18, 0.15, 0.115)} {...fillGround} />
          <ellipse {...e(0, 0.12, 0.055, 0.04)} {...fillInk} />
          <path d={arc(0, 0.14, 0.09, 0.35, Math.PI - 0.35)} {...inkStroke(0.05)} />
          <circle {...c(-0.12, -0.02)} r={0.05 * u} {...fillInk} />
          <circle {...c(0.12, -0.02)} r={0.05 * u} {...fillInk} />
        </>
      );
      break;

    // Ren: a crescent moon with a spark beside it — Alone's night sky. A crescent
    // is a disc with a disc of the ground bitten out of it, opened to the right so
    // the spark sits in its crook, and the spark is drawn last so it reads on the
    // card the bite exposes rather than on the crescent.
    case "moon":
      body = (
        <>
          <circle {...c(0, 0)} r={0.3 * u} {...fillAccent} />
          <circle {...c(0.18, -0.06)} r={0.28 * u} {...fillGround} />
          <path
            d={`M${p(0.26, -0.2)} L${p(0.3, -0.1)} L${p(0.4, -0.06)} L${p(0.3, -0.02)} L${p(0.26, 0.08)} L${p(0.22, -0.02)} L${p(0.12, -0.06)} L${p(0.22, -0.1)} Z`}
            {...fillAccent}
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
