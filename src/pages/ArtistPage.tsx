import { useParams } from "react-router-dom";
import { ChevronRight, ImagePlus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { audioService } from "@/services/audio.service";
import { Avatar } from "@/components/ui/Avatar";

interface ArtistTrack {
  id: string;
  title: string;
  artist: string;
  artist_slug: string;
  kind: string;
  cover_url: string | null;
  stream_url: string | null;
  plays: number;
  liked: boolean;
  created_at: string;
}

interface PageResult<T> {
  results: T[];
  next: string | null;
  previous?: string | null;
}

interface ArtistPageData extends PageResult<ArtistTrack> {
  artist?: {
    id: string;
    name: string;
    username: string;
    avatar: string | null;
    slug: string;
    track_count: number;
  };
}

function TrackRow({ track }: { track: ArtistTrack }) {
  return (
    <div className="flex items-center gap-3 border-b border-line/70 px-3.5 py-3 last:border-0">
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_9%,transparent)] text-accent">
        <ImagePlus className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-bold truncate">{track.title}</p>
        <p className="mt-0.5 text-[10px] leading-4 text-dim">{track.artist}</p>
      </div>
      <ChevronRight className="size-3.5 text-dim" />
    </div>
  );
}

export function ArtistPage() {
  const { artistSlug } = useParams<{ artistSlug: string }>();

  const { data: artistData, isLoading, isError, error } = useQuery<ArtistPageData>({
    queryKey: ["artist", artistSlug],
    queryFn: () => audioService.tracks<ArtistPageData>({ artist: artistSlug }),
    enabled: !!artistSlug,
    throwOnError: true,
  });

  if (isLoading) return <p className="text-center py-12">Loading artist...</p>;
  if (isError) return <p className="text-center py-12 text-dim">Error loading artist: {error instanceof Error ? error.message : "Unknown error"}</p>;
  if (!artistData) return <p className="text-center py-12">Artist not found.</p>;

  const tracks = artistData.results;
  const artistInfo = artistData.artist ?? (tracks[0] ? { name: tracks[0].artist, username: tracks[0].artist_slug, avatar: null, track_count: tracks.length, id: "" } : { name: "Unknown Artist", username: artistSlug || "", avatar: null, track_count: 0, id: "" });
  const totalTracks = artistInfo.track_count || tracks.length;

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <header className="px-4 pb-2 pt-4 md:pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">
          {artistInfo.name}
        </h1>
        <p className="mt-0.5 text-[10px] text-dim">Artist page</p>
      </header>

      <main className="px-4 pt-3">
        <section className="rounded-[18px] border border-line bg-card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Avatar user={artistInfo} size={48} className="border-2 border-[var(--card)]" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-extrabold">{artistInfo.name}</p>
              <p className="text-[10px] text-dim">Tracks: {totalTracks}</p>
            </div>
          </div>

          {tracks.length === 0 ? (
            <p className="text-center text-[10px] text-dim py-8">No tracks found</p>
          ) : (
            <>
              {tracks.map((track) => (
                <TrackRow key={track.id} track={track} />
              ))}
            </>
          )}
        </section>

        {totalTracks > 0 && (
          <p className="mt-4 text-center text-[9px] text-dim">
            Total: {totalTracks} track{totalTracks !== 1 ? "s" : ""}
          </p>
        )}
      </main>
    </div>
  );
}