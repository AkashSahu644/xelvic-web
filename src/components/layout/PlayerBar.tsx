import { useState } from "react";
import { ListMusic, Pause, Play, SkipBack, SkipForward, Volume2, X } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import { duration } from "@/utils/format";
import { usePlayer } from "@/hooks/usePlayer";

export function PlayerBar({ offset, compact = false }: { offset: "desktop" | "mobile"; compact?: boolean }) {
  const player = usePlayer();
  const [expanded, setExpanded] = useState(false);
  if (!player.current || player.barHidden) return null;
  const track = player.current;
  const total = player.duration || track.seconds || 0;
  const progress = total ? Math.min(100, (player.time / total) * 100) : 0;

  return (
    <div
      className={cn(
        "fixed z-40 px-3",
        offset === "desktop"
          ? cn(
              "bottom-4 right-4",
              compact ? "left-[88px]" : "left-[100px] lg:left-[252px]",
            )
          : "bottom-[calc(78px+env(safe-area-inset-bottom,0px))] inset-x-2 md:hidden",
      )}
    >
      <div
        className="overflow-hidden rounded-[18px] shadow-[0_18px_48px_rgb(8_8_12_/_0.35)] backdrop-blur-xl"
        style={{ background: "rgb(var(--nav) / 0.92)", color: "var(--nav-ink)" }}
      >
        <div className="flex items-center gap-3 p-2.5">
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="flex min-w-0 flex-1 items-center gap-3 text-left"
            aria-label={expanded ? "Collapse player" : "Expand player"}
          >
            {track.cover_url || track.cover?.thumbnail_url || track.cover?.content_url ? (
              <AuthedImage src={track.cover_url || track.cover?.thumbnail_url || track.cover?.content_url} alt="" className="size-11 rounded-xl" />
            ) : (
              <span className="flex size-11 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)]">
                <ListMusic className="size-5 text-[color-mix(in_srgb,var(--nav-ink)_70%,transparent)]" aria-hidden />
              </span>
            )}
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{track.title}</span>
              <span className="block truncate text-[11px] text-[var(--nav-quiet)]">{track.artist}</span>
            </span>
          </button>
          <div className="hidden items-center gap-1 sm:flex">
            <button type="button" className="icon-btn text-[var(--nav-quiet)] hover:bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] hover:text-[var(--nav-ink)]" onClick={player.previous} aria-label="Previous track">
              <SkipBack className="size-4" />
            </button>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-full bg-[var(--nav-ink)] text-[rgb(var(--nav))] transition hover:scale-[1.03] active:scale-95"
              onClick={player.toggle}
              aria-label={player.playing ? "Pause" : "Play"}
            >
              {player.loading ? (
                <span className="size-4 animate-spin rounded-full border-2 border-[color-mix(in_srgb,rgb(var(--nav))_25%,transparent)] border-t-[rgb(var(--nav))]" />
              ) : player.playing ? (
                <Pause className="size-4 fill-current" />
              ) : (
                <Play className="ml-0.5 size-4 fill-current" />
              )}
            </button>
            <button type="button" className="icon-btn text-[var(--nav-quiet)] hover:bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] hover:text-[var(--nav-ink)]" onClick={player.next} aria-label="Next track">
              <SkipForward className="size-4" />
            </button>
          </div>
          <div className="hidden w-36 items-center gap-2 lg:flex">
            <Volume2 className="size-4 text-[var(--nav-quiet)]" aria-hidden />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={player.volume}
              onChange={(event) => player.setVolume(Number(event.target.value))}
              aria-label="Volume"
              className="h-1 w-full cursor-pointer appearance-none rounded-full accent-[var(--nav-ink)]"
              style={{
                background: `linear-gradient(to right, var(--nav-ink) ${player.volume * 100}%, color-mix(in srgb, var(--nav-ink) 20%, transparent) ${player.volume * 100}%)`,
              }}
            />
          </div>
          <button type="button" className="icon-btn text-[var(--nav-quiet)] hover:bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] hover:text-[var(--nav-ink)]" onClick={player.close} aria-label="Stop player">
            <X className="size-4" />
          </button>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(total, 0.1)}
          step={0.1}
          value={Math.min(player.time, total)}
          onChange={(event) => player.seek(Number(event.target.value))}
          disabled={!total}
          aria-label="Seek"
          aria-valuetext={`${duration(player.time)} of ${duration(total)}`}
          className="block h-1 w-full cursor-pointer appearance-none accent-[var(--nav-ink)] disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(to right, var(--nav-ink) ${progress}%, color-mix(in srgb, var(--nav-ink) 15%, transparent) ${progress}%)`,
          }}
        />
        {expanded ? (
          <div className="border-t border-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] px-4 py-3">
            <div className="flex items-center justify-between text-[11px] text-[var(--nav-quiet)]">
              <span>{duration(player.time)}</span>
              <span>{duration(total)}</span>
            </div>
            {player.failed ? <p className="mt-1 text-xs text-[var(--bad)]">This track could not be loaded.</p> : null}
          </div>
        ) : null}
        <div className="flex items-center justify-between px-3 pb-2 text-[10px] text-[var(--nav-quiet)] opacity-70 sm:hidden">
          <span>{duration(player.time)}</span>
          <span>{duration(total)}</span>
        </div>
      </div>
    </div>
  );
}
