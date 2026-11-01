import { useRef, type KeyboardEvent, type PointerEvent } from "react";
import { Flame, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { cn } from "@/lib/cn";
import type { Spark, ThreadCard } from "@/types/api";
import { stamp, threadFace, threadLine, threadTitle } from "./model";

const HOT_FILL = "color-mix(in srgb, var(--accent) 22%, var(--page))";
const HOT_EDGE = "color-mix(in srgb, var(--accent) 72%, transparent)";
const ACTIVE_FILL = "color-mix(in srgb, var(--accent) 12%, var(--page))";
const ACTIVE_EDGE = "color-mix(in srgb, var(--accent) 42%, transparent)";

function useLongPress(onLongPress: () => void) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);

  const clear = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    origin.current = null;
  };

  return {
    fired,
    clear,
    handlers: {
      onPointerDown(event: PointerEvent<HTMLElement>) {
        if (event.pointerType === "mouse" && event.button !== 0) return;
        fired.current = false;
        origin.current = { x: event.clientX, y: event.clientY };
        clear();
        timer.current = window.setTimeout(() => {
          timer.current = null;
          fired.current = true;
          onLongPress();
        }, 520);
      },
      onPointerMove(event: PointerEvent<HTMLElement>) {
        const start = origin.current;
        if (!start) return;
        if (
          Math.abs(event.clientX - start.x) > 10 ||
          Math.abs(event.clientY - start.y) > 10
        ) {
          clear();
        }
      },
      onPointerUp: clear,
      onPointerCancel: clear,
      onPointerLeave: clear,
    },
  };
}

function SparkChip({
  spark,
  onOpen,
}: {
  spark: Spark;
  onOpen: () => void;
}) {
  const urgent = spark.alive && spark.at_risk;
  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onOpen();
      }}
      title={
        spark.stage
          ? `${spark.count ?? 0} days · ${spark.stage.name ?? "Spark"}`
          : `${spark.count ?? 0} days · Spark`
      }
      aria-label="Open spark"
      className="flex size-[22px] shrink-0 items-center justify-center transition hover:scale-105"
    >
      <Flame
        className="size-[18px]"
        strokeWidth={2.4}
        style={{
          color: urgent
            ? "#E5A11A"
            : spark.stage?.colour || "color-mix(in srgb, var(--accent) 72%, #8a168f)",
        }}
      />
    </button>
  );
}

export function ConvoRow({
  thread,
  active,
  spark,
  moment,
  onOpen,
  onActions,
  onOpenMoment,
  onOpenSpark,
}: {
  thread: ThreadCard;
  active?: boolean;
  spark?: Spark | null;
  moment?: { seen?: boolean; author?: string } | null;
  onOpen: () => void;
  onActions: () => void;
  onOpenMoment?: (username: string) => void;
  onOpenSpark?: () => void;
}) {
  const title = threadTitle(thread);
  const face = threadFace(thread);
  const unread = thread.unread_count ?? thread.unread ?? 0;
  const hot = unread > 0;
  const marked = hot || active;
  const line = threadLine(thread, unread);
  const opened = line === "Opened";
  const group = thread.kind === "group";
  const username = face?.username;
  const ring = Boolean(username && moment && onOpenMoment);
  const longPress = useLongPress(onActions);

  const style = hot
    ? { background: HOT_FILL, borderColor: HOT_EDGE }
    : active
      ? { background: ACTIVE_FILL, borderColor: ACTIVE_EDGE }
      : undefined;

  const onKey = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onOpen();
    }
    if (
      event.key === "ContextMenu" ||
      (event.shiftKey && event.key === "F10")
    ) {
      event.preventDefault();
      onActions();
    }
  };

  return (
    <div
      role="link"
      tabIndex={0}
      aria-current={active ? "page" : undefined}
      aria-label={`${title}${unread ? `, ${unread} unread` : ""}`}
      onClick={(event) => {
        if (longPress.fired.current) {
          longPress.fired.current = false;
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onOpen();
      }}
      onKeyDown={onKey}
      onContextMenu={(event) => {
        event.preventDefault();
        onActions();
      }}
      {...longPress.handlers}
      className={cn(
        "group relative flex min-h-[64px] cursor-pointer items-center gap-2 overflow-hidden py-2 pl-2 pr-2.5 outline-none transition-colors",
        "border-b border-[color-mix(in_srgb,var(--line)_70%,transparent)] focus-visible:ring-2 focus-visible:ring-accent/50",
        marked && "border",
      )}
      style={style}
    >
      {hot ? (
        <span
          className="absolute inset-y-0 left-0 w-[7px] bg-accent"
          aria-hidden
        />
      ) : null}
      <span className="relative shrink-0">
        {ring ? (
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (username) onOpenMoment?.(username);
            }}
            className={cn(
              "flex size-[52px] items-center justify-center rounded-full p-[2px] transition hover:scale-[1.02]",
              moment?.seen
                ? "bg-[color-mix(in_srgb,var(--ink)_16%,transparent)]"
                : "story-ring",
            )}
            aria-label={`Open ${title}'s moments`}
            title="Moments"
          >
            <Avatar user={face} name={title} src={thread.avatar} size={48} />
          </button>
        ) : (
          <Avatar user={face} name={title} src={thread.avatar} size={52} />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold tracking-[-0.15px]">
            {title}
          </span>
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <p
            className={cn(
              "min-w-0 flex-1 truncate text-[13.5px] leading-[1.3]",
              opened || hot
                ? "font-bold text-accent"
                : line === "Sent"
                  ? "font-medium text-dim"
                  : "font-normal text-dim",
            )}
          >
            {line}
          </p>
        </div>
        {group ? (
          <span className="mt-1 inline-flex h-[21px] items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-2 text-[10.5px] font-semibold text-dim">
            <Users className="size-3" aria-hidden /> Group
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end justify-between gap-2 self-stretch py-0.5">
        <span className="text-[12px] font-medium tabular-nums text-dim">
          {stamp(thread.last_message_at ?? thread.preview?.at)}
        </span>
        <div className="flex items-center gap-2">
          {unread ? (
            <span
              className="flex h-[20px] min-w-[20px] items-center justify-center rounded-full bg-accent px-1.5 text-[10.5px] font-bold tabular-nums text-on-accent"
              aria-label={`${unread} unread`}
            >
              {unread > 99 ? "99+" : unread}
            </span>
          ) : null}
          {spark && (spark.alive || spark.laps) && onOpenSpark ? (
            <SparkChip spark={spark} onOpen={onOpenSpark} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
