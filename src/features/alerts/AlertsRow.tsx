import { Bell, BellOff, Pin } from "lucide-react";
import { cn } from "@/utils/cn";
import { stamp } from "@/features/convo/model";
import { alertSummary } from "./model";
import type { AlertsPageData } from "@/types/api";

const HOT_FILL = "color-mix(in srgb, var(--accent) 15%, var(--page))";
const HOT_EDGE = "color-mix(in srgb, var(--accent) 15%, transparent)";

export function AlertsRow({
  data,
  onOpen,
  onManage,
}: {
  data?: AlertsPageData;
  onOpen: () => void;
  onManage: () => void;
}) {
  const unread = data?.unread ?? 0;
  const muted = data?.muted === true;
  const pinned = data?.pinned === true;
  const newest = data?.results?.[0];
  const hot = unread > 0 && !muted;
  const line = newest ? alertSummary(newest) : "Nothing yet";

  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
        if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
          event.preventDefault();
          onManage();
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        onManage();
      }}
      className={cn(
        "group relative flex min-h-[64px] cursor-pointer items-center gap-2 overflow-hidden px-1.5 pl-2 pr-2.5 outline-none transition-colors hover:bg-accent/5",
        "border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/50",
        hot && "border",
      )}
      style={hot ? { background: HOT_FILL, borderColor: HOT_EDGE } : undefined}
    >
      <span className="relative flex size-[46px] shrink-0 items-center justify-center">
        <span
          className={cn(
            "flex size-[44px] items-center justify-center rounded-full",
            hot
              ? "bg-[color-mix(in_srgb,var(--accent)_15%,transparent)] text-accent"
              : "bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] text-dim",
          )}
        >
          <Bell className="size-[23px]" strokeWidth={2.2} aria-hidden />
        </span>
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold tracking-[-0.15px]">
            Notifications
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13.5px] leading-[1.3]",
              hot ? "font-semibold text-ink" : "text-dim",
            )}
          >
            {line}
          </p>
        </div>
        {muted ? (
          <span className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex h-[21px] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-2 text-[10.5px] font-semibold text-dim">
              <BellOff className="size-3" aria-hidden /> Muted
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center">
        {pinned ? <PinMark hot={hot} /> : null}
        <span
          className={cn(
            "text-[12px] font-medium tabular-nums",
            hot ? "text-accent" : "text-dim",
          )}
        >
          {stamp(newest?.at)}
        </span>
      </div>
    </div>
  );
}

function PinMark({ hot }: { hot: boolean }) {
  return (
    <span
      className="mr-1.5 grid size-4 shrink-0 place-items-center rounded-full"
      style={{
        background: hot
          ? "color-mix(in srgb, var(--accent) 22%, transparent)"
          : "color-mix(in srgb, var(--ink) 6.5%, transparent)",
      }}
      title="Pinned"
    >
      <Pin
        className="size-[9px]"
        strokeWidth={2.6}
        style={{ color: hot ? "var(--accent)" : "var(--dim)" }}
        aria-hidden
      />
    </span>
  );
}
