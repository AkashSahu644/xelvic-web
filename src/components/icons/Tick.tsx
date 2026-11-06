import { BadgeCheck } from "lucide-react";
import { cn } from "@/utils/cn";

/**
 * The verified mark, in one place.
 *
 * `verifiedTick` in `app/lib/screens/widgets.dart` — a mark drawn beside a name
 * anywhere a name is drawn, which is why the app keeps it in its shared widgets
 * file rather than in the folder of whichever screen needed it first. The web
 * grew its copy inside `features/deals/parts.tsx` because deals was the first
 * port to need one; the crew list needs exactly the same mark, and a second copy
 * is a second colour waiting to drift.
 *
 * The blue is the app's own literal, `0xFF1D9BF0` — deliberately not a theme
 * token. A verified mark is a fact about the account rather than about the
 * screen it is drawn on, so it keeps its colour when the theme changes, which is
 * what the phone does too.
 */
export function VerifiedTick({ size = 14, className }: { size?: number; className?: string }) {
  return (
    <BadgeCheck
      className={cn("shrink-0 text-[#1D9BF0]", className)}
      style={{ width: size, height: size }}
      aria-label="Verified"
    />
  );
}
