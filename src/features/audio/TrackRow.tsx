import { useEffect, useState } from "react";
import { Heart, ListMusic, Pause, Play, Trash2 } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { audioService } from "@/services/audio.service";
import { cn } from "@/utils/cn";
import { count, duration } from "@/utils/format";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import type { Track } from "@/types/api";

export function TrackRow({
  track,
  queue,
  index,
  onRemove,
  onPicked,
  compact,
}: {
  track: Track;
  queue?: Track[];
  index?: number;
  onRemove?: () => void;
  onPicked?: () => void;
  compact?: boolean;
}) {
  const player = usePlayer();
  const { toast } = useToast();
  const [liked, setLiked] = useState(Boolean(track.liked));
  const [busy, setBusy] = useState(false);
  const active = player.current?.id === track.id;
  const cover = track.cover_url || track.cover?.thumbnail_url || track.cover?.content_url;

  useEffect(() => setLiked(Boolean(track.liked)), [track.liked, track.id]);

  async function toggleLike() {
    if (busy) return;
    setBusy(true);
    try {
      const next = await audioService.like<{ liked: boolean }>(track.id);
      setLiked(next.liked);
    } catch (error) {
      toast({
        title: "That heart did not stick",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-[14px] px-2 py-2 transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
        active && "bg-[var(--accent-soft)]",
      )}
    >
      <button
        type="button"
        onClick={() => {
          onPicked?.();
          player.play(track, queue);
        }}
        className="relative size-12 shrink-0 overflow-hidden rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]"
        aria-label={active && player.playing ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        {cover ? (
          <AuthedImage src={cover} alt="" className="size-full" />
        ) : (
          <span className="flex size-full items-center justify-center text-accent">
            <ListMusic className="size-5" />
          </span>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100">
          {active && player.playing ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
        </span>
        {active && player.playing ? (
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-white/30">
            <span
              className="block h-full bg-white"
              style={{ width: `${player.duration ? (player.time / player.duration) * 100 : 0}%` }}
            />
          </span>
        ) : null}
      </button>
      <button
        type="button"
        onClick={() => {
          onPicked?.();
          player.play(track, queue);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-[13px] font-bold">{track.title}</span>
        <span className="block truncate text-[11px] text-dim">
          {track.artist}
          {track.series ? ` \u00b7 ${track.series}` : ""}
          {index !== undefined ? ` \u00b7 ${index + 1}` : ""}
        </span>
      </button>
      <span className="hidden text-[10px] tabular-nums text-dim sm:block">{duration(track.seconds)}</span>
      {!compact ? <span className="hidden text-[10px] tabular-nums text-dim md:block">{count(track.plays)} plays</span> : null}
      <button
        type="button"
        onClick={() => void toggleLike()}
        disabled={busy}
        className={cn("icon-btn", liked ? "text-accent" : "text-dim hover:text-ink")}
        aria-label={liked ? "Remove from felt" : "Felt this"}
      >
        <Heart className={cn("size-4", liked && "fill-current")} />
      </button>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="icon-btn text-dim hover:text-[var(--bad)]" aria-label="Remove from playlist">
          <Trash2 className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
