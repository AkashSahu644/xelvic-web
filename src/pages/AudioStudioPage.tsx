import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CloudOff, ChartLine } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { audioService } from "@/services/audio.service";
import { errorMessage } from "@/utils/errors";
import { CoverArt, seedOf } from "@/features/audio/parts";

/**
 * The creator's own numbers — the app's `AudioStudioScreen`.
 *
 * One's own only: `GET /audio/studio/` answers an empty list for anybody else,
 * so there is nothing here to filter and nothing to hide. Every figure is the
 * server's own `Item`, and a number it has not measured is drawn as "Not
 * measured" rather than as a zero — `listeners`, `completion` and `score` are
 * nullable precisely so a screen cannot turn "nobody counted" into "nobody".
 *
 * A row opens its whole read. The empty state is the app's own two lines, not a
 * friendlier substitute for them.
 */
export function AudioStudioPage() {
  const studio = useQuery({
    queryKey: ["audio-studio"],
    queryFn: () => audioService.studio(),
    staleTime: 30_000,
  });
  const items = studio.data?.items ?? [];

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader title="Studio" back />

      {studio.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : studio.isError ? (
        <Blank
          icon={<CloudOff className="size-[46px]" />}
          title="No answer"
          line={errorMessage(studio.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void studio.refetch()}>
              Try again
            </button>
          }
        />
      ) : !items.length ? (
        <Blank
          icon={<ChartLine className="size-[46px]" />}
          title="Nothing of yours yet"
          line="Put a sound up, or have a track of yours released, and its numbers are read here."
        />
      ) : (
        <>
          <p className="px-4 pb-1 pt-3.5 text-[12.5px] leading-[1.4] text-dim">
            The numbers on the audio you made. Open one for the whole read.
          </p>
          <div className="pt-1">
            {items.map((item) => {
              const plays = item.plays ?? 0;
              return (
                <Link
                  key={item.subject || item.id}
                  to={`/app/audio/studio/${encodeURIComponent(item.id)}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                >
                  <CoverArt seed={seedOf(item.seed)} size={46} radius={14} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{item.title}</span>
                    <span className="block truncate text-[11.5px] text-dim">
                      {item.kind === "sound" ? "Sound" : "Track"}
                      {item.artist ? ` · ${item.artist}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block text-[12.5px] font-bold tabular-nums">
                      {plays} {plays === 1 ? "play" : "plays"}
                    </span>
                    <span className="block text-[11px] text-dim">
                      {item.listeners == null
                        ? "Listeners not recorded"
                        : `${item.listeners} ${item.listeners === 1 ? "listener" : "listeners"}`}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}