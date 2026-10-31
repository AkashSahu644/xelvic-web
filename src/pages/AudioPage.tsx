import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Headphones,
  Link2,
  ListMusic,
  LoaderCircle,
  MoreVertical,
  Music2,
  Pause,
  Play,
  Plus,
  Podcast,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { duration } from "@/lib/format";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { usePlayer } from "@/providers/PlayerProvider";
import { useToast } from "@/providers/ToastProvider";
import type { AudioHome, Playlist, Track } from "@/types/api";

type Chip = "all" | "playlists" | "podcasts" | "artists";
type Mode = "home" | "search";

const COVER_TONES = ["#2A3EB1", "#00796B", "#AD1457", "#6A3FB5", "#9C5A00", "#116A80"];

function seedOf(value: number | string | undefined | null) {
  const number = typeof value === "number" ? value : Number.parseInt(String(value ?? "0"), 10);
  return Number.isFinite(number) ? Math.abs(number) : 0;
}

function coverTone(seed: number) {
  return COVER_TONES[seed % COVER_TONES.length];
}

function playCount(value: number | undefined) {
  const plays = Math.max(0, Math.trunc(value ?? 0));
  if (plays === 1) return "1 play";
  if (plays < 1000) return `${plays} plays`;
  if (plays < 1_000_000) {
    const thousands = plays / 1000;
    return `${thousands < 10 ? thousands.toFixed(1) : Math.round(thousands)}K plays`;
  }
  const millions = plays / 1_000_000;
  return `${millions < 10 ? millions.toFixed(1) : Math.round(millions)}M plays`;
}

function trackIsPodcast(track: Track) {
  return track.kind === "podcast";
}

function trackLine(track: Track) {
  return trackIsPodcast(track) ? track.series || track.artist : track.title;
}

function trackUnder(track: Track) {
  if (!trackIsPodcast(track)) return track.artist;
  return [track.title, track.artist].filter(Boolean).join(" · ");
}

function playlistWhose(playlist: Playlist) {
  if (playlist.mine) return "yours";
  if (playlist.shared) return playlist.owner ? `by ${playlist.owner}` : "shared with you";
  return "the catalogue";
}

function playlistLine(playlist: Playlist) {
  const tracks = playlist.count ?? 0;
  return `${tracks === 1 ? "1 track" : `${tracks} tracks`} · ${duration(playlist.seconds)}`;
}

function linkToken(value: string) {
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(/[/?#]/).filter(Boolean);
  const marker = parts.findIndex((part) => part === "s" || part === "shared");
  if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  if (parts.length === 1) return parts[0];
  return null;
}

function CoverArt({
  seed,
  podcast,
  size = 46,
  radius,
}: {
  seed: number;
  podcast?: boolean;
  size?: number;
  radius?: number;
}) {
  const Icon = podcast ? Podcast : Music2;
  return (
    <span
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.3,
        backgroundColor: coverTone(seed),
      }}
      aria-hidden
    >
      <Icon style={{ width: size * 0.42, height: size * 0.42 }} />
    </span>
  );
}

function NowBars({ playing, size = 14 }: { playing?: boolean; size?: number }) {
  return (
    <span className="flex items-end justify-between" style={{ width: size, height: size }} aria-hidden>
      {[0.55, 1, 0.7, 0.9].map((share, index) => (
        <span
          key={index}
          style={{
            width: size * 0.16,
            height: size * share,
            borderRadius: size * 0.08,
            backgroundColor: playing ? "var(--accent)" : "var(--dim)",
          }}
        />
      ))}
    </span>
  );
}

function PlaylistCover({ playlist, size = 132 }: { playlist: Playlist; size?: number }) {
  const src = playlist.cover?.thumbnail_url || playlist.cover?.content_url || playlist.cover_url;
  const radius = size * 0.2;
  const fallback = <CoverArt seed={seedOf(playlist.seed)} size={size} radius={radius} />;
  return (
    <span
      className="block overflow-hidden bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]"
      style={{ width: size, height: size, borderRadius: radius }}
    >
      {src ? (
        <AuthedImage src={src} alt="" className="size-full" fallback={fallback} />
      ) : (
        fallback
      )}
    </span>
  );
}

function PlaylistCard({ playlist }: { playlist: Playlist }) {
  const tracks = playlist.count ?? 0;
  return (
    <Link
      to={`/app/audio/${playlist.id}`}
      className="block w-[132px] shrink-0 transition hover:opacity-90"
    >
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

function NewPlaylistCard({ onClick }: { onClick: () => void }) {
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

function SectionTitle({
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
        <button type="button" onClick={onAction} className="shrink-0 rounded-full px-2 py-1 text-[12.5px] font-bold text-accent transition hover:bg-[var(--accent-soft)]">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function LibraryRow({
  track,
  queue,
  onMore,
}: {
  track: Track;
  queue: Track[];
  onMore?: () => void;
}) {
  const player = usePlayer();
  const on = player.current?.id === track.id;
  const playing = on && player.playing;

  return (
    <div className="flex h-[62px] items-center gap-3 px-3">
      <button
        type="button"
        onClick={() => player.play(track, queue)}
        className="relative size-[46px] shrink-0 overflow-hidden rounded-[14px]"
        aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
      >
        <CoverArt seed={seedOf(track.seed)} podcast={trackIsPodcast(track)} />
        {playing ? (
          <span className="absolute inset-0 flex items-center justify-center rounded-[14px] bg-black/40">
            <NowBars playing />
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
        <button type="button" onClick={onMore} className="icon-btn size-8 shrink-0 text-dim hover:text-ink" aria-label={`More about ${track.title}`}>
          <MoreVertical className="size-[18px]" />
        </button>
      ) : null}
    </div>
  );
}

export function AudioPage() {
  const [chip, setChip] = useState<Chip>("all");
  const [mode, setMode] = useState<Mode>("home");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [moreTrack, setMoreTrack] = useState<Track | null>(null);
  const [pickTrack, setPickTrack] = useState<Track | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const { user } = useAuth();
  const { toast } = useToast();

  const home = useQuery({
    queryKey: ["audio-home"],
    queryFn: () => api.get<AudioHome>("/audio/"),
    staleTime: 30_000,
  });
  const search = useQuery({
    queryKey: ["audio-search", query.trim()],
    queryFn: () => api.get<{ tracks: Track[]; query: string }>("/audio/tracks/", { query: { q: query.trim() } }),
    enabled: mode === "search" && query.trim().length > 0,
    staleTime: 20_000,
  });

  const hero = home.data?.hero ?? null;
  const recent = home.data?.recent ?? [];
  const playlists = home.data?.playlists ?? [];
  const podcasts = home.data?.podcasts ?? [];
  const artists = home.data?.artists ?? [];
  const mine = playlists.filter((playlist) => playlist.mine);
  const given = playlists.filter((playlist) => !playlist.mine && playlist.shared);
  const theirs = playlists.filter((playlist) => !playlist.mine && !playlist.shared);

  const showShelves = chip === "all" || chip === "playlists";
  const showTracks = chip === "all" || chip === "playlists";
  const showPodcasts = chip === "all" || chip === "podcasts";
  const showArtists = chip === "all" || chip === "artists";
  const recentTitle = home.data?.recent_source === "mine" ? "Recently played" : "Start here";
  const heroPlaying = Boolean(hero && player.current?.id === hero.id && player.playing);
  const heroLabel = home.data?.hero_source === "fresh" ? "START HERE" : heroPlaying ? "NOW PLAYING" : "LAST PLAYED";
  const empty = !hero && !recent.length && !playlists.length;

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["audio-home"] });
  }

  function playHero() {
    if (!hero) return;
    if (player.current?.id === hero.id) {
      player.toggle();
      return;
    }
    player.play(hero, recent.length ? recent : [hero]);
  }

  async function createPlaylist() {
    if (!name.trim()) {
      toast({ title: "Give the playlist a name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      let coverId: string | undefined;
      if (cover) coverId = (await uploadAsset(cover, { kind: "image" })).id;
      const made = await api.post<{ playlist: Playlist }>("/audio/playlists/", {
        name: name.trim(),
        cover: coverId ?? null,
      });
      await invalidate();
      setCreateOpen(false);
      setName("");
      setCover(null);
      toast({ title: "Playlist made", tone: "success" });
      navigate(`/app/audio/${made.playlist.id}`);
    } catch (error) {
      toast({
        title: "Could not make that playlist",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function addToPlaylist(playlist: Playlist) {
    if (!pickTrack || addingTo) return;
    setAddingTo(playlist.id);
    try {
      await api.post(`/audio/playlists/${playlist.id}/items/`, { track: pickTrack.id });
      await invalidate();
      toast({ title: "Added to the playlist", tone: "success" });
      setPickTrack(null);
    } catch (error) {
      toast({
        title: "Could not add that track",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setAddingTo(null);
    }
  }

  function openLink() {
    const token = linkToken(linkValue);
    if (!token) {
      toast({ title: "That is not a link.", tone: "error" });
      return;
    }
    setLinkOpen(false);
    setLinkValue("");
    navigate(`/s/${encodeURIComponent(token)}`);
  }

  function searchArtist(artist: string) {
    setMoreTrack(null);
    setQuery(artist);
    setMode("search");
  }

  const searchHeader = (
    <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => {
            setMode("home");
            setQuery("");
          }}
          className="icon-btn -ml-2"
          aria-label="Back to Audio"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-line bg-card px-3 focus-within:border-accent/50">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Songs, shows, artists"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button type="button" onClick={() => setQuery("")} className="text-dim hover:text-ink" aria-label="Clear search">
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (mode === "search") {
    return (
      <div className="min-h-dvh text-ink">
        {searchHeader}
        <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
          {!query.trim() ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="Look for anything"
              body="A song, a show, or somebody who makes them."
            />
          ) : search.isLoading ? (
            <div className="flex justify-center py-16">
              <LoaderCircle className="size-5 animate-spin text-dim" />
            </div>
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => void search.refetch()} />
          ) : !search.data?.tracks.length ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title={`Nothing for “${query.trim()}”`}
              body="Try one word of it."
            />
          ) : (
            <div className="pt-1">
              {search.data.tracks.map((track) => (
                <LibraryRow key={track.id} track={track} queue={search.data.tracks} />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh text-ink">
      <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[760px] items-center gap-3 px-4 pb-1.5 pt-2.5 md:px-6">
          <Link to={user ? `/app/u/${user.username}` : "/app"} aria-label="Your profile">
            <Avatar user={user} name={user?.name} size={40} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[22px] font-extrabold leading-6 tracking-[-0.4px]">Audio</h1>
            <p className="truncate text-[12px] text-dim">Playlists · Podcasts · Artists</p>
          </div>
          <button type="button" onClick={() => setLinkOpen(true)} className="icon-btn" aria-label="Open a playlist link">
            <Link2 className="size-[19px]" />
          </button>
          <button type="button" onClick={() => setMode("search")} className="icon-btn -mr-1" aria-label="Search the catalogue">
            <Search className="size-[19px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
        {home.isLoading ? (
          <PageSkeleton rows={3} />
        ) : home.isError ? (
          <ErrorState error={home.error} onRetry={() => void home.refetch()} />
        ) : !home.data || empty ? (
          <EmptyState
            icon={<Headphones className="size-6" />}
            title="Nothing on the shelves"
            body="The catalogue is empty. Look again in a moment."
            action={
              <Button variant="secondary" size="sm" onClick={() => void home.refetch()}>
                Look again
              </Button>
            }
          />
        ) : (
          <>
            {hero ? (
              <div className="px-4 pb-1 pt-1.5">
                <button
                  type="button"
                  onClick={playHero}
                  className="flex w-full items-center gap-3 rounded-[24px] border p-3 text-left transition active:scale-[.995]"
                  style={{
                    backgroundColor: `${coverTone(seedOf(hero.seed))}1A`,
                    borderColor: `${coverTone(seedOf(hero.seed))}47`,
                  }}
                >
                  <CoverArt
                    seed={seedOf(hero.seed)}
                    podcast={trackIsPodcast(hero)}
                    size={56}
                    radius={16}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block text-[9.5px] font-extrabold tracking-[1.4px]"
                      style={{ color: coverTone(seedOf(hero.seed)) }}
                    >
                      {heroLabel}
                    </span>
                    <span className="block truncate text-[15px] font-extrabold tracking-[-0.2px]">
                      {trackLine(hero)}
                    </span>
                    <span className="block truncate text-[11.5px] text-dim">{trackUnder(hero)}</span>
                  </span>
                  <span className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
                    {heroPlaying ? <Pause className="size-5 fill-current" /> : <Play className="ml-0.5 size-5 fill-current" />}
                  </span>
                </button>
              </div>
            ) : null}

            <div className="no-scrollbar flex h-[52px] items-center gap-2 overflow-x-auto px-4 py-2.5" role="tablist" aria-label="Audio shelves">
              {(
                [
                  ["all", "All"],
                  ["playlists", "Playlists"],
                  ["podcasts", "Podcasts"],
                  ["artists", "Artists"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={chip === key}
                  onClick={() => setChip(key)}
                  className={cn(
                    "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition",
                    chip === key
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-card text-ink hover:border-accent/35",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {showShelves && user ? (
              <>
                <SectionTitle>Your playlists</SectionTitle>
                <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                  <NewPlaylistCard onClick={() => setCreateOpen(true)} />
                  {mine.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                  ))}
                </div>
              </>
            ) : null}

            {showShelves && given.length ? (
              <>
                <SectionTitle>Shared with you</SectionTitle>
                <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                  {given.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                  ))}
                </div>
              </>
            ) : null}

            {showShelves && theirs.length ? (
              <>
                <SectionTitle>Playlists</SectionTitle>
                <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                  {theirs.map((playlist) => (
                    <PlaylistCard key={playlist.id} playlist={playlist} />
                  ))}
                </div>
              </>
            ) : null}

            {showTracks && recent.length ? (
              <>
                <SectionTitle
                  action="Play all"
                  onAction={() => {
                    const first = recent[0];
                    if (first) player.play(first, recent);
                  }}
                >
                  {recentTitle}
                </SectionTitle>
                <div>
                  {recent.map((track) => (
                    <LibraryRow key={track.id} track={track} queue={recent} onMore={() => setMoreTrack(track)} />
                  ))}
                </div>
              </>
            ) : null}

            {showPodcasts && podcasts.length ? (
              <>
                <SectionTitle>Podcasts</SectionTitle>
                <div>
                  {podcasts.map((track) => (
                    <LibraryRow key={track.id} track={track} queue={podcasts} onMore={() => setMoreTrack(track)} />
                  ))}
                </div>
              </>
            ) : null}

            {showArtists && artists.length ? (
              <>
                <SectionTitle>Artists</SectionTitle>
                <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                  {artists.map((artist, index) => (
                    <button
                      key={artist.slug || artist.name || index}
                      type="button"
                      onClick={() => searchArtist(artist.name)}
                      className="w-[78px] shrink-0 text-center"
                    >
                      <Avatar name={artist.name} size={64} className="mx-auto" />
                      <span className="mt-1.5 block truncate text-[12px] font-bold">{artist.name}</span>
                      <span className="block truncate text-[10.5px] text-dim">
                        {playCount(artist.listeners).replace(" plays", " monthly")}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </>
        )}
      </main>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="New playlist"
        description="A name and, if you like, a cover."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void createPlaylist()} loading={saving}>
              Make it
            </Button>
          </div>
        }
      >
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={400}
              placeholder="Late night"
              className="field w-full"
            />
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Cover</span>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line p-3 text-left transition hover:border-accent/40"
            >
              <span className="flex size-12 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-accent">
                <ListMusic className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold">{cover ? cover.name : "Choose a picture"}</span>
                <span className="block text-[10px] text-dim">Optional · up to 16 MB</span>
              </span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => setCover(event.target.files?.[0] ?? null)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={linkOpen}
        onClose={() => setLinkOpen(false)}
        title="A playlist link"
        description="Paste the whole link. A link somebody sent works without an account."
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setLinkOpen(false)}>
              Cancel
            </Button>
            <Button onClick={openLink}>Open</Button>
          </div>
        }
      >
        <div className="px-5 py-4">
          <input
            value={linkValue}
            onChange={(event) => setLinkValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") openLink();
            }}
            autoFocus
            maxLength={300}
            placeholder="https://…/s/…"
            className="field w-full"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(moreTrack)}
        onClose={() => setMoreTrack(null)}
        title={moreTrack ? trackLine(moreTrack) : undefined}
        description={moreTrack?.artist}
      >
        {moreTrack ? (
          <div className="p-2 pb-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <CoverArt seed={seedOf(moreTrack.seed)} podcast={trackIsPodcast(moreTrack)} size={44} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{trackLine(moreTrack)}</p>
                <p className="truncate text-[12px] text-dim">{trackUnder(moreTrack)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPickTrack(moreTrack);
                setMoreTrack(null);
              }}
              className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            >
              <ListMusic className="size-[18px] text-dim" />
              <span>
                <span className="block text-[13px] font-bold">Add to a playlist</span>
                <span className="block text-[11.5px] text-dim">Yours, or a new one named here.</span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => searchArtist(moreTrack.artist)}
              className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            >
              <UserRound className="size-[18px] text-dim" />
              <span className="text-[13px] font-bold">More from {moreTrack.artist}</span>
            </button>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pickTrack)}
        onClose={() => setPickTrack(null)}
        title="Add to a playlist"
        description={pickTrack ? `Where should “${pickTrack.title}” go?` : undefined}
      >
        <div className="p-2 pb-3">
          {mine.length ? (
            mine.map((playlist) => (
              <button
                key={playlist.id}
                type="button"
                disabled={addingTo !== null}
                onClick={() => void addToPlaylist(playlist)}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-60"
              >
                <PlaylistCover playlist={playlist} size={42} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-bold">{playlist.name}</span>
                  <span className="block truncate text-[11px] text-dim">{playlistLine(playlist)}</span>
                </span>
                {addingTo === playlist.id ? (
                  <LoaderCircle className="size-4 animate-spin text-dim" />
                ) : (
                  <Plus className="size-4 text-dim" />
                )}
              </button>
            ))
          ) : (
            <div className="px-3 py-6 text-center">
              <p className="text-[13px] font-bold">No playlists yet</p>
              <p className="mt-1 text-[11.5px] text-dim">Make one, then this track has somewhere to go.</p>
              <Button
                size="sm"
                className="mt-4"
                onClick={() => {
                  setPickTrack(null);
                  setCreateOpen(true);
                }}
              >
                Make a playlist
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
