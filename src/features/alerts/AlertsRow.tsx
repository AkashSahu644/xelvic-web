import { Bell, BellOff, MoreVertical, Pin } from "lucide-react";
import { cn } from "@/lib/cn";
import { stamp } from "@/features/convo/model";
import { alertSummary } from "./model";
import type { AlertsPageData } from "@/types/api";

const ROSE = "var(--card)";
const ROSE_HOT = "linear-gradient(135deg, color-mix(in srgb, var(--accent) 8%, var(--card)), var(--card) 72%)";
const ROSE_EDGE = "var(--line)";
const ROSE_HOT_EDGE = "color-mix(in srgb, var(--accent) 22%, var(--line))";

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
      className="group relative flex min-h-[80px] cursor-pointer items-center gap-3 overflow-hidden rounded-[20px] border py-3 pl-3 pr-1.5 shadow-[0_1px_2px_rgba(17,17,26,0.04)] outline-none transition hover:-translate-y-px hover:shadow-[0_7px_20px_rgba(17,17,26,0.08)] focus-visible:ring-2 focus-visible:ring-accent/60"
      style={{
        background: hot ? ROSE_HOT : ROSE,
        borderColor: hot ? ROSE_HOT_EDGE : ROSE_EDGE,
      }}
    >
      {hot ? (
        <span className="absolute bottom-5 left-[5px] top-5 w-[3px] rounded-full bg-accent" aria-hidden />
      ) : null}
      <span
        className="flex size-[50px] shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: `color-mix(in srgb, var(--accent) ${hot ? 18 : 9}%, transparent)` }}
      >
        <Bell className={cn("size-[24px]", hot ? "text-accent" : "text-dim")} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={cn("min-w-0 flex-1 truncate text-[14.5px] tracking-[-0.15px]", hot ? "font-extrabold" : "font-bold")}>Notifications</span>
          {pinned ? (
            <span
              className="flex size-[18px] shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: hot ? "color-mix(in srgb, var(--accent) 16%, transparent)" : "color-mix(in srgb, var(--ink) 6%, transparent)" }}
              title="Pinned"
            >
              <Pin className={cn("size-2.5", hot ? "text-accent" : "text-dim")} />
            </span>
          ) : null}
          <span className={cn("shrink-0 text-right text-[10.5px] font-semibold tabular-nums", hot ? "text-accent" : "text-dim")}>
            {stamp(newest?.at)}
          </span>
        </div>
        <div className="mt-1 flex items-center gap-2">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[12.5px] leading-[1.35]",
              hot ? "font-semibold text-ink" : "font-normal text-dim",
            )}
          >
            {line}
          </p>
          {unread ? (
            <span className="flex h-[19px] min-w-[19px] shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[9.5px] font-extrabold text-on-accent tabular-nums shadow-[0_2px_6px_color-mix(in_srgb,var(--accent)_30%,transparent)]">
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
        </div>
        {muted ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            <span className="inline-flex h-[18px] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-1.5 text-[9.5px] font-bold text-dim">
              <BellOff className="size-2.5" aria-hidden /> Muted
            </span>
          </div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onManage();
        }}
        className="hidden size-8 shrink-0 items-center justify-center rounded-full text-dim opacity-0 hover:bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] hover:text-ink group-hover:opacity-100 focus:opacity-100 sm:flex"
        aria-label="Notification options"
        title="Notification options"
      >
        <MoreVertical className="size-4" />
      </button>
    </div>
  );
}
