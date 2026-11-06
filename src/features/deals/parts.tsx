import type { ReactNode } from "react";
import { CloudOff, RefreshCw } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { VerifiedTick } from "@/components/icons/Tick";
import { cn } from "@/utils/cn";
import type { DealStatus, DealUser } from "@/types/api";
import { isClosed, statusWord } from "./model";

/**
 * The pieces all three deal screens draw with.
 *
 * `app/lib/screens/deals/` keeps its chrome in the screens themselves, one copy
 * per file; on the web the same row appears on the list, the detail and the
 * directory, so it lives here once. What is *not* shared is anything that
 * decides something — those rules are in `model.ts` and `queries.ts`.
 */

/** The verified tick. `verifiedTick(true)` — the one blue, whatever the theme. */
export { VerifiedTick } from "@/components/icons/Tick";

/**
 * The one-word state.
 *
 * Two shapes, because the app has two: the list row mutes a closed deal and
 * washes an open one in the accent (`_StatusChip`), and the detail page gives
 * the bad colour to the two endings that went badly and the good colour to the
 * paid one (`_statusChip`). Both are ported rather than unified — the detail's
 * chip is the answer to "where does this stand", and the row's is "is this
 * still live".
 */
export function StatusChip({ status, hero }: { status: DealStatus; hero?: boolean }) {
  const word = statusWord(status);
  if (!hero) {
    const closed = isClosed(status);
    const tone = closed ? "var(--dim)" : "var(--accent)";
    return (
      <span
        className="shrink-0 rounded-full px-2.5 py-[5px] text-[12px] font-bold"
        style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} ${closed ? 10 : 14}%, transparent)` }}
      >
        {word}
      </span>
    );
  }
  const tone =
    status === "declined" || status === "cancelled"
      ? "var(--bad)"
      : status === "paid"
        ? "var(--good)"
        : "var(--accent)";
  return (
    <span
      className="shrink-0 rounded-full px-3 py-[7px] text-[12.5px] font-extrabold tracking-[0.2px]"
      style={{ color: tone, backgroundColor: `color-mix(in srgb, ${tone} 12%, transparent)` }}
    >
      {word}
    </span>
  );
}

/**
 * One side of a deal: the role in small letters, then the person — or the muted
 * stand-in the server's null deserves, which is not a blank line.
 */
export function PartyRow({ role, user }: { role: string; user: DealUser | null | undefined }) {
  return (
    <div className="flex items-center gap-3">
      <Avatar name={user?.name || user?.username || "?"} src={user?.avatar ?? null} size={40} />
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-dim">{role}</p>
        {user ? (
          <>
            <div className="flex items-center gap-1">
              <span className="truncate text-[15px] font-bold">
                {user.name || `@${user.username}`}
              </span>
              {user.verified ? <VerifiedTick size={14} /> : null}
            </div>
            {user.username ? (
              <p className="truncate text-[12.5px] text-dim" dir="ltr">
                @{user.username}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-dim">Not assigned</p>
        )}
      </div>
    </div>
  );
}

/** The card every deal panel is drawn on: a hairline and a 16px radius. */
export function DealCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("w-full rounded-2xl border border-line bg-card p-4", className)}>{children}</div>
  );
}

/**
 * A titled section on its own card — the heading, the line under it that says
 * what the section is for, and then the thing itself.
 */
export function DealSection({
  title,
  line,
  children,
}: {
  title: string;
  line: string;
  children: ReactNode;
}) {
  return (
    <DealCard>
      <h2 className="text-base font-extrabold">{title}</h2>
      <p className="mt-0.5 text-[12.5px] text-dim">{line}</p>
      <div className="mt-3">{children}</div>
    </DealCard>
  );
}

/**
 * A sentence held in a field and drawn later: the brief, the agreement. Empty
 * is drawn as the app draws it — "Nothing written here." in the quiet colour,
 * never a blank panel that reads like a loading state.
 */
export function Prose({ text, empty = "Nothing written here." }: { text: string; empty?: string }) {
  const value = text.trim();
  if (!value) return <p className="text-[14.5px] leading-[1.5] text-dim">{empty}</p>;
  return <p className="whitespace-pre-wrap text-[14.5px] leading-[1.5]">{value}</p>;
}

/** The list or a section could not be read. One line, and a way to ask again. */
export function DealRetry({
  title,
  line,
  onRetry,
  className,
}: {
  title: string;
  line?: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-8 py-12 text-center", className)}>
      <CloudOff className="size-11 text-[color-mix(in_srgb,var(--ink)_18%,transparent)]" aria-hidden />
      <h2 className="mt-3.5 text-[17px] font-bold">{title}</h2>
      {line ? <p className="mt-1.5 max-w-sm text-sm leading-[1.4] text-dim">{line}</p> : null}
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-accent px-4 py-2.5 text-sm font-bold text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
      >
        <RefreshCw className="size-4" aria-hidden />
        Try again
      </button>
    </div>
  );
}

/** A heading over a group of rows — "AS A COMPANY", "AS A CREATOR". */
export function GroupHeading({ children }: { children: ReactNode }) {
  return (
    <p className="px-5 pb-2 pt-5 text-[11px] font-extrabold uppercase tracking-[1.1px] text-dim">
      {children}
    </p>
  );
}
