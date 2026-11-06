import { Link } from "react-router-dom";
import { cn } from "@/utils/cn";
import { useOptionalPreferences } from "@/hooks/usePreferences";

/* ─────────────────────────────────────────────────────────────── the lockup ─── */

/**
 * The Xelvic lockup: the square app icon + the name side by side.
 *
 * Exact match for `web/src/components/ui/Logo.tsx`:
 * Uses the same branding PNGs (`/xelvic.png` and `/xelvic-white.png`)
 * and lowercase typography ("xelvic").
 */
const MARK = "/xelvic.png";
const MARK_WHITE = "/xelvic-white.png";

export function Wordmark({
  className,
  tone = "ink",
  to = "/",
  size = 32,
}: {
  className?: string;
  tone?: "ink" | "white";
  to?: string;
  size?: number;
}) {
  const src = tone === "white" ? MARK_WHITE : MARK;
  const textClass = tone === "white" ? "text-white" : "text-ink";

  const lockup = (
    <span className={cn("inline-flex select-none items-center gap-2.5", className)}>
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-[22%] object-contain"
        style={{ width: size, height: size }}
        draggable={false}
      />
      <span
        className={cn("font-extrabold lowercase leading-none tracking-tight", textClass)}
        style={{ fontSize: Math.round(size * 0.85) }}
      >
        xelvic
      </span>
    </span>
  );

  if (!to) return lockup;

  return (
    <Link to={to} className="inline-flex rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {lockup}
    </Link>
  );
}

export function BrandMark({ className, size = 36 }: { className?: string; size?: number }) {
  const preferences = useOptionalPreferences();
  const logo = preferences?.logo ?? "pink";
  const src = logo && logo !== "pink" ? `/logos/${logo}.webp` : "/favicon.png";
  return (
    <span
      className={cn("inline-flex items-center justify-center overflow-hidden rounded-[12px]", className)}
      style={{ width: size, height: size }}
    >
      <img src={src} alt="" className="h-full w-full rounded-[22%] object-cover" draggable={false} />
    </span>
  );
}
