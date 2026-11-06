import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Heart, LoaderCircle, MoreVertical, Pause, Play, Plus } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import { count, duration } from "@/utils/format";
import { audioService } from "@/services/audio.service";
import { dropsService } from "@/services/drops.service";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import type { AudioCreator, AudioRow, Playlist, Track } from "@/types/api";
import { CoverArt, coverTone, seedOf, trackIsPodcast, trackLine, trackUnder } from "./parts";

/**
 * The pieces every Audio surface draws, ported from the phone's
 * `screens/audio.dart` and `screens/audio_bits.dart`.
 *
 * The tab, a category shelf and the weekly board all draw the same row, the
 * same shelf card and the same heading, and a second copy of any of them would
 * be a second chance for one song to wear two faces. Everything here is the
 * server's own row read into the shapes the app already had: nothing is
 * invented, and a row the server has not measured draws no score rather than a
 * zero.
 */

/** The one heading every section on every Audio page is written with. */
export function SectionTitle({
  children,
  action,
  onAction,
}: {
  children: React.ReactNode;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 pb-2.5 pt-5">
      <h2 className="min-w-0 flex-1 truncate text-[15px] font-extrabold tracking-[-0.2px]">{children}</h2>
      {action ? (
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 rounded-full px-2 py-1 text-[12.5px] font-bold text-accent transition hover:bg-[var(--accent-soft)]"
        >
          {action}
        </button>
      ) : null}
    </div>
  );
}

/**
 * A shelf row as the player takes it.
 *
 * The shelf's rows are `AudioRow`, not `Track`: a sound somebody uploaded sits
 * on the same list as a catalogue song and the two differ only in which route
 * plays them. `stream` carries that address on both, which is why one mapping
 * serves both halves of the catalogue.
 */
export function rowTrack(row: AudioRow): Track {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? row.name ?? "",
    artist: row.artist ?? row.owner ?? "",
    artist_slug: row.artist_slug,
    series: row.series ?? null,
    episode: typeof row.episode === "number" ? row.episode : null,
    seconds: row.seconds ?? row.duration ?? 0,
    plays: row.plays,
    seed: row.seed,
    liked: row.liked,
    cover: row.cover ?? null,
    stream: row.stream ?? null,
  };
}

/** A queue of shelf rows, in the order the screen draws them. */
export function rowQueue(rows: AudioRow[]): Track[] {
  return rows.map(rowTrack);
}

/**
 * The heart on a row.
 *
 * The address is the row's own `source`, because the two halves of the
 * catalogue are felt at two different routes: a catalogue track at
 * `audio/tracks/{id}/like/`, an uploaded sound at the drop's own. The glyph
 * only moves once the server has answered with the state it landed on — the
 * app moves it optimistically, but a web that showed a heart the server refused
 * would be claiming something untrue.
 */
export function LikeButton({
  id,
  liked: initial,
  drop,
  size = "sm",
}: {
  id: string;
  liked?: boolean;
  /** An uploaded sound is felt at the drop's own route, not the track's. */
  drop?: boolean;
  size?: "sm" | "lg";
}) {
  const [liked, setLiked] = useState(Boolean(initial));
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  async function press() {
    if (busy) return;
    setBusy(true);
    const want = !liked;
    try {
      const answer = drop
        ? await dropsService.like("drops", id, want)
        : await audioService.like<{ liked?: boolean; data?: { liked?: boolean } }>(id);
      const landed = answer.liked ?? answer.data?.liked ?? want;
      setLiked(landed);
      void queryClient.invalidateQueries({ queryKey: ["audio-home"] });
    } catch (error) {
      toast({
        title: "That could not be saved",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  const box = size === "lg" ? "size-[38px]" : "size-[30px]";
  const glyph = size === "lg" ? "size-[19px]" : "size-[16px]";
  return (
    <button
      type="button"
      onClick={() => void press()}
      disabled={busy}
      aria-label={liked ? "Let it go" : "Feel this"}
      aria-pressed={liked}
      className={cn("flex shrink-0 items-center justify-center rounded-full transition disabled:opacity-60", box)}
    >
      {busy ? (
        <LoaderCircle className={cn("animate-spin text-dim", glyph)} />
      ) : (
        <Heart className={cn(glyph, liked ? "fill-current text-accent" : "text-dim")} />
      )}
    </button>
  );
}

function RowCover({ row, size = 46, radius }: { row: AudioRow; size?: number; radius?: number }) {
  const src = row.cover?.thumbnail_url || row.cover?.content_url;
  const podcast = row.kind === "podcast";
  const fallback = <CoverArt seed={seedOf(row.seed)} podcast={podcast} size={size} radius={radius} />;
  if (!src) return fallback;
  return (
    <span
      className="block shrink-0 overflow-hidden"
      style={{ width: size, height: size, borderRadius: radius ?? size * 0.3 }}
    >
      <AuthedImage src={src} alt="" className="size-full" fallback={fallback} />
    </span>
  );
}

/**
 * One shelf row, drawn the way `AudioRowTile` draws it on the phone: sleeve,
 * what it is, who it is, how long, and a play that toggles.
 */
export function AudioRowTile({
  row,
  rows,
  onMore,
}: {
  row: AudioRow;
  rows: AudioRow[];
  onMore?: (row: AudioRow) => void;
}) {
  const player = usePlayer();
  const track = rowTrack(row);
  const on = player.current?.id === track.id;
  const playing = on && player.playing;
  const queue = rowQueue(rows);

  return (
    <div className="flex h-[62px] items-center gap-3 px-3">
      <button
        type="button"
        onClick={() => player.play(track, queue)}
        className="relative shrink-0"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        <RowCover row={row} radius={14} />
        {playing ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/40">
            <Pause className="size-4 fill-current text-white" aria-hidden />
          </span>
        ) : null}
      </button>
      <button type="button" onClick={() => player.play(track, queue)} className="min-w-0 flex-1 text-left">
        <span className={cn("block truncate text-[13.5px] font-bold", on ? "text-accent" : "text-ink")}>
          {trackLine(track)}
        </span>
        <span className="block truncate text-[11.5px] text-dim">{trackUnder(track)}</span>
      </button>
      <span className="shrink-0 text-[11.5px] tabular-nums text-dim">{duration(track.seconds)}</span>
      {/* Every row wears its heart, an uploaded sound included: a drop is felt
          at its own door, which is why the button is told which half of the
          catalogue this row came from. */}
      <LikeButton id={row.id} liked={row.liked} drop={row.source === "drop"} />
      <button
        type="button"
        onClick={() => player.play(track, queue)}
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-full transition",
          on ? "bg-accent text-on-accent" : "border border-line bg-card text-ink hover:border-accent/40",
        )}
        aria-label={playing ? "Pause" : `Play ${track.title}`}
      >
        {playing ? <Pause className="size-[15px] fill-current" /> : <Play className="ml-0.5 size-[15px] fill-current" />}
      </button>
      {onMore ? (
        <button
          type="button"
          onClick={() => onMore(row)}
          className="icon-btn size-8 shrink-0 text-dim hover:text-ink"
          aria-label={`More about ${track.title}`}
        >
          <MoreVertical className="size-[18px]" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * One card of the "Trending now" strip: a sleeve, what it is, and who.
 *
 * A press anywhere plays it with the whole strip as the queue — the app's own
 * bargain, because the thing being chosen is which of these to hear first.
 */
export function BoardStripCard({ row, rows }: { row: AudioRow; rows: AudioRow[] }) {
  const player = usePlayer();
  const track = rowTrack(row);
  const on = player.current?.id === track.id;
  return (
    <button
      type="button"
      onClick={() => player.play(track, rowQueue(rows))}
      className="w-[116px] shrink-0 rounded-[18px] text-left"
    >
      <span className="relative block">
        <RowCover row={row} size={116} radius={18} />
        {on ? (
          <span className="absolute bottom-1.5 right-1.5 flex size-[30px] items-center justify-center rounded-full bg-black/45 text-white">
            {player.playing ? (
              <Pause className="size-3.5 fill-current" aria-hidden />
            ) : (
              <Play className="ml-0.5 size-3.5 fill-current" aria-hidden />
            )}
          </span>
        ) : null}
      </span>
      <span className={cn("mt-2 block truncate text-[12.5px] font-bold", on ? "text-accent" : "text-ink")}>
        {track.title}
      </span>
      <span className="block truncate text-[11px] text-dim">{track.artist}</span>
    </button>
  );
}

/** A track's sleeve and what it is, for the "more" sheet every list opens. */
export function TrackHead({ row, title, under }: { row: AudioRow; title: string; under?: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <RowCover row={row} size={44} radius={13} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-bold">{title}</p>
        {under ? <p className="truncate text-[12px] text-dim">{under}</p> : null}
      </div>
    </div>
  );
}

/* ---- playlists ------------------------------------------------------- */

export function PlaylistCover({ playlist, size = 132 }: { playlist: Playlist; size?: number }) {
  const src = playlist.cover?.thumbnail_url || playlist.cover?.content_url || playlist.cover_url;
  const radius = size * 0.2;
  const fallback = <CoverArt seed={seedOf(playlist.seed)} size={size} radius={radius} />;
  return (
    <span
      className="block overflow-hidden bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {src ? <AuthedImage src={src} alt="" className="size-full" fallback={fallback} /> : fallback}
    </span>
  );
}

export function playlistLine(playlist: Playlist) {
  const tracks = playlist.count ?? 0;
  return `${tracks === 1 ? "1 track" : `${count(tracks)} tracks`} · ${duration(playlist.seconds)}`;
}

export function playlistWhose(playlist: Playlist) {
  if (playlist.mine) return "yours";
  if (playlist.shared) return playlist.owner ? `by ${playlist.owner}` : "shared with you";
  return "the catalogue";
}

export function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const tracks = playlist.count ?? 0;
  return (
    <Link to={`/app/audio/${playlist.id}`} className="block w-[132px] shrink-0 transition hover:opacity-90">
      <span className="relative block h-[132px] w-[132px]">
        <PlaylistCover playlist={playlist} />
        {tracks > 0 ? (
          <span className="absolute bottom-2 right-2 flex size-[34px] items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
            <Play className="ml-0.5 size-[18px] fill-current" aria-hidden />
          </span>
        ) : null}
      </span>
      <span className="mt-2 block truncate text-[13px] font-bold">{playlist.name}</span>
      <span className="block truncate text-[11px] text-dim">
        {playlistLine(playlist)} · {playlistWhose(playlist)}
      </span>
    </Link>
  );
}

export function NewPlaylistCard({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="w-[132px] shrink-0 text-left">
      <span className="flex h-[132px] w-[132px] items-center justify-center rounded-[26px] border border-[color-mix(in_srgb,var(--ink)_16%,transparent)] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]">
        <Plus className="size-10" aria-hidden />
      </span>
      <span className="mt-2 block truncate text-[13px] font-bold">New playlist</span>
      <span className="block truncate text-[11px] text-dim">Name it and pick a picture</span>
    </button>
  );
}

/* ---- words ------------------------------------------------------------ */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "8 – 14 Sep" from a week's Monday, or "" when that is not a date.
 *
 * The board is weekly and a chart with no date on it reads as "of all time",
 * which is exactly what it is not. A week that cannot be read draws nothing
 * rather than a date this side made up — the app's `weekSpan`.
 */
export function weekSpan(monday?: string | null) {
  if (!monday) return "";
  const start = new Date(`${monday}T00:00:00`);
  if (Number.isNaN(start.getTime())) return "";
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return `${start.getDate()} – ${end.getDate()} ${MONTHS[end.getMonth()]}`;
}

/** A mood key as a word: `feel-good` reads "Feel good". */
export function moodName(key: string) {
  const words = key.replace(/[-_]/g, " ").trim();
  if (!words) return key;
  return words[0].toUpperCase() + words.slice(1);
}

/** The number under a maker's name, in the app's own words. */
export function creatorUnder(person: AudioCreator) {
  const plays = person.plays ?? 0;
  const sounds = person.sounds ?? 0;
  return `${count(plays)} ${plays === 1 ? "play" : "plays"} · ${count(sounds)} ${sounds === 1 ? "sound" : "sounds"}`;
}

/** The tone a row's sleeve was drawn in — used where a tint has to match it. */
export { coverTone, seedOf, trackIsPodcast };