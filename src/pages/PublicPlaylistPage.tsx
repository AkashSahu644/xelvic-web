import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ListMusic, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { BrandMark } from "@/components/icons/Brand";
import { Button } from "@/components/ui/Button";
import { AuthedImage } from "@/components/media/Media";
import { ErrorState } from "@/components/ui/States";
import { TrackRow } from "@/features/audio/TrackRow";
import { audioService } from "@/services/audio.service";
import { count, duration } from "@/utils/format";
import { usePlayer } from "@/hooks/usePlayer";

function PublicPlayerBar() {
  const player = usePlayer();
  if (!player.current) return null;
  const track = player.current;
  const total = player.duration || track.seconds || 0;
  return (
    <div
      className="fixed inset-x-3 bottom-3 z-50 rounded-[18px] p-2.5 shadow-2xl backdrop-blur-xl sm:left-auto sm:right-4 sm:w-[420px]"
      style={{ background: "rgb(var(--nav) / 0.94)", color: "var(--nav-ink)" }}
    >
      <div className="flex items-center gap-2.5">
        <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)]">
          {track.cover_url || track.cover?.thumbnail_url ? (
            <AuthedImage src={track.cover_url || track.cover?.thumbnail_url} alt="" className="size-full" />
          ) : (
            <ListMusic className="size-4 text-[var(--nav-quiet)]" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-bold">{track.title}</span>
          <span className="block truncate text-[10px] text-[var(--nav-quiet)]">{track.artist}</span>
        </span>
        <button type="button" onClick={player.previous} className="icon-btn text-[var(--nav-quiet)] hover:bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] hover:text-[var(--nav-ink)]" aria-label="Previous">
          <SkipBack className="size-4" />
        </button>
        <button type="button" onClick={player.toggle} className="flex size-9 items-center justify-center rounded-full bg-[var(--nav-ink)] text-[rgb(var(--nav))]" aria-label={player.playing ? "Pause" : "Play"}>
          {player.playing ? <Pause className="size-4 fill-current" /> : <Play className="ml-0.5 size-4 fill-current" />}
        </button>
        <button type="button" onClick={player.next} className="icon-btn text-[var(--nav-quiet)] hover:bg-[color-mix(in_srgb,var(--nav-ink)_10%,transparent)] hover:text-[var(--nav-ink)]" aria-label="Next">
          <SkipForward className="size-4" />
        </button>
      </div>
      <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--nav-ink)_15%,transparent)]">
        <span className="block h-full bg-[var(--nav-ink)]" style={{ width: `${total ? (player.time / total) * 100 : 0}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[9px] text-[var(--nav-quiet)] opacity-70">
        <span>{duration(player.time)}</span>
        <span>{duration(total)}</span>
      </div>
    </div>
  );
}

export function PublicPlaylistPage() {
  const { token = "" } = useParams();
  const player = usePlayer();
  const detail = useQuery({
    queryKey: ["public-playlist", token],
    queryFn: () => audioService.shared(token),
    enabled: Boolean(token),
    retry: false,
  });

  const playlist = detail.data?.playlist;
  const tracks = detail.data?.tracks ?? [];

  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="border-b border-line">
        <div className="mx-auto flex w-full max-w-[860px] items-center gap-3 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="Sign in to Xelvic">
            <BrandMark size={30} />
            <span className="text-[15px] font-extrabold tracking-[-0.04em]">Xelvic</span>
          </Link>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-[0.14em] text-dim">A shared playlist</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[860px] px-4 py-6 pb-28 sm:px-6">
        {detail.isLoading ? (
          <div className="space-y-4" aria-hidden>
            <div className="skeleton h-44 rounded-[22px]" />
            <div className="skeleton h-64 rounded-[18px]" />
          </div>
        ) : detail.isError ? (
          <div className="card">
            <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
            <div className="flex justify-center pb-8">
              <Link to="/signin" className="text-xs font-bold text-accent hover:underline">Sign in to Xelvic</Link>
            </div>
          </div>
        ) : !playlist ? (
          <div className="card">
            <ErrorState error={new Error("That link does not lead to a playlist.")} />
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-[24px] border border-line bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
              <div className="flex flex-col gap-5 p-5 sm:flex-row sm:items-end sm:p-7">
                <div className="aspect-square w-40 shrink-0 overflow-hidden rounded-[18px] shadow-lg sm:w-48">
                  {playlist.cover ? (
                    <AuthedImage src={playlist.cover.content_url} alt="" className="size-full" loading="eager" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-[var(--accent-soft)] text-accent"><ListMusic className="size-10" /></span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">
                    {playlist.owner ? `A playlist by ${playlist.owner}` : "A Xelvic playlist"}
                  </p>
                  <h1 className="mt-1 text-balance text-3xl font-extrabold tracking-[-0.04em] sm:text-4xl">{playlist.name}</h1>
                  <p className="mt-1 text-xs text-dim">{count(playlist.count)} tracks · {duration(playlist.seconds)}</p>
                  <div className="mt-4">
                    <Button
                      disabled={!tracks.length}
                      onClick={() => {
                        if (tracks[0]) player.play(tracks[0], tracks);
                      }}
                      icon={<Play className="size-4 fill-current" />}
                    >
                      Play all
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              {tracks.length ? (
                <div className="card divide-y divide-line/70 p-1.5">
                  {tracks.map((track, index) => (
                    <TrackRow key={track.id} track={track} queue={tracks} index={index} />
                  ))}
                </div>
              ) : (
                <div className="card py-16 text-center text-sm text-dim">This playlist has no tracks on it.</div>
              )}
            </section>

            <div className="mt-6 text-center text-[11px] leading-5 text-dim">
              Sent with Xelvic. <Link to="/signin" className="font-bold text-accent hover:underline">Sign in</Link> to keep it, or make your own.
            </div>
          </>
        )}
      </main>
      <PublicPlayerBar />
    </div>
  );
}
