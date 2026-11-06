import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BarChart3,
  Headphones,
  Link2,
  ListMusic,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/States";
import { audioService } from "@/services/audio.service";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { CoverArt, coverTone, playCount, seedOf, trackIsPodcast, trackLine, trackUnder } from "@/features/audio/parts";
import {
  AudioRowTile,
  BoardStripCard,
  LikeButton,
  NewPlaylistCard,
  PlaylistCard,
  PlaylistCover,
  SectionTitle,
  creatorUnder,
  playlistLine,
} from "@/features/audio/rows";
import { DropComposer } from "@/features/drops/DropComposer";
import { uploadAsset } from "@/utils/upload";
import { useAuth } from "@/hooks/useAuth";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import type { AudioBoard, AudioCategory, AudioCatalogue, AudioRow, Playlist } from "@/types/api";

/**
 * The Audio tab, rebuilt to `screens/audio.dart`'s own page.
 *
 * The order is the app's and it is load-bearing: the weekly board leads because
 * it is the one thing on this page that is different tomorrow, the reco deck
 * follows because a suggestion is the one thing here somebody did not already
 * know about, and only then the shelves this account keeps. The chip row above
 * the catalogue is **not** a filter any more — the app replaced it with the
 * reco layer's own shelf cards, each a door onto its own page, because a filter
 * is a thing the client decided and a shelf is a thing the server measured.
 *
 * Two of the app's doors are deliberately absent, and named in
 * `XELVIC_FINAL_GAP_REPORT.md` rather than drawn as buttons that do nothing:
 * the downloads door (a browser has no kept-tracks store here) and the
 * full-screen swipe deck behind "Audio drops" (its cards play instead).
 */

type Mode = "home" | "search";

function linkToken(value: string) {
  const text = value.trim();
  if (!text) return null;
  const parts = text.split(/[/?#]/).filter(Boolean);
  const marker = parts.findIndex((part) => part === "s" || part === "shared");
  if (marker >= 0 && parts[marker + 1]) return parts[marker + 1];
  if (parts.length === 1) return parts[0];
  return null;
}

export function AudioPage() {
  const [mode, setMode] = useState<Mode>("home");
  const [typed, setTyped] = useState("");
  const [asked, setAsked] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [cover, setCover] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  const [moreRow, setMoreRow] = useState<AudioRow | null>(null);
  const [pickTrack, setPickTrack] = useState<AudioRow | null>(null);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [postOpen, setPostOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pause = useRef<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const { user } = useAuth();
  const { toast } = useToast();

  const home = useQuery({
    queryKey: ["audio-home"],
    queryFn: () => audioService.home(),
    staleTime: 30_000,
  });
  const catalogue = useQuery<AudioCatalogue>({
    queryKey: ["audio-categories"],
    queryFn: () => audioService.categories(),
    staleTime: 300_000,
    // A failed ask leaves the rail out rather than failing the tab.
    retry: false,
  });
  const drops = useQuery({
    queryKey: ["audio-feed", "section"],
    queryFn: () => audioService.feed({ limit: 8 }),
    staleTime: 60_000,
  });
  const search = useQuery({
    queryKey: ["audio-search", asked],
    queryFn: () => audioService.search(asked),
    enabled: mode === "search" && asked.length > 0,
    staleTime: 20_000,
  });

  // `audioSearchPause` — the phone's own 260ms. One bundle per pause instead of
  // one per letter, and the answer to a question that has been typed past is
  // never drawn because the key is the settled word.
  useEffect(() => {
    if (pause.current) window.clearTimeout(pause.current);
    if (!typed.trim()) {
      setAsked("");
      return;
    }
    pause.current = window.setTimeout(() => setAsked(typed.trim()), 260);
    return () => {
      if (pause.current) window.clearTimeout(pause.current);
    };
  }, [typed]);

  const hero = home.data?.hero ?? null;
  const playlists = home.data?.playlists ?? [];
  const recent = home.data?.recent ?? [];
  const podcasts = home.data?.podcasts ?? [];
  const artists = home.data?.artists ?? [];
  const board: AudioBoard | undefined = home.data?.trending;
  const recoRows = drops.data?.rows ?? [];
  const mine = playlists.filter((playlist) => playlist.mine);
  const given = playlists.filter((playlist) => !playlist.mine && playlist.shared);
  const theirs = playlists.filter((playlist) => !playlist.mine && !playlist.shared);
  const recentTitle = home.data?.recent_source === "mine" ? "Recently played" : "Start here";
  const heroPlaying = Boolean(hero && player.current?.id === hero.id && player.playing);
  const heroLabel = home.data?.hero_source === "fresh" ? "START HERE" : heroPlaying ? "NOW PLAYING" : "LAST PLAYED";
  const categories = (catalogue.data?.categories ?? []).filter((one) => one.key !== "viral");
  const leading = board?.boards?.find((chart) => chart.rows.length > 0);
  const empty =
    !hero && !recent.length && !playlists.length && !leading && !(board?.creators ?? []).length;

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
      const made = await audioService.createPlaylist({ name: name.trim(), cover: coverId ?? null });
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
      await audioService.addTrack(playlist.id, pickTrack.id);
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
    setMoreRow(null);
    setTyped(artist);
    setAsked(artist);
    setMode("search");
  }

  function openCategory(category: AudioCategory) {
    navigate(`/app/audio/c/${encodeURIComponent(category.key)}`, {
      state: {
        title: category.title,
        subtitle: category.subtitle ?? "",
        languages: catalogue.data?.languages ?? [],
        moods: catalogue.data?.moods ?? [],
        current: catalogue.data?.current ?? "",
      },
    });
  }

  const searchHeader = (
    <header className="sticky top-0 z-30 bg-[color-mix(in_srgb,var(--page)_92%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-[760px] items-center gap-2 px-4 py-3 md:px-6">
        <button
          type="button"
          onClick={() => {
            setMode("home");
            setTyped("");
            setAsked("");
          }}
          className="icon-btn -ml-2"
          aria-label="Back to Audio"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-[14px] border border-line bg-card px-3 focus-within:border-accent/50">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") setAsked(typed.trim());
            }}
            autoFocus
            placeholder="Songs, shows, artists"
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-dim"
            autoComplete="off"
            spellCheck={false}
          />
          {typed ? (
            <button
              type="button"
              onClick={() => {
                setTyped("");
                setAsked("");
              }}
              className="text-dim hover:text-ink"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>
      </div>
    </header>
  );

  if (mode === "search") {
    const found = search.data;
    const any = Boolean(found && (found.tracks?.length || found.playlists?.length || found.people?.length));
    return (
      <div className="min-h-dvh text-ink">
        {searchHeader}
        <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
          {!typed.trim() ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title="Look for anything"
              body="A song, a show, or somebody who makes them."
            />
          ) : search.isLoading || asked !== typed.trim() ? (
            <div className="flex justify-center py-16">
              <LoaderCircle className="size-5 animate-spin text-dim" />
            </div>
          ) : search.isError ? (
            <ErrorState error={search.error} onRetry={() => void search.refetch()} />
          ) : !any ? (
            <EmptyState
              icon={<Search className="size-6" />}
              title={`Nothing for “${asked}”`}
              body="Try one word of it."
            />
          ) : (
            <>
              {found?.playlists?.length ? (
                <>
                  <SectionTitle>Playlists</SectionTitle>
                  <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                    {found.playlists.map((playlist) => (
                      <PlaylistCard key={playlist.id} playlist={playlist} />
                    ))}
                  </div>
                </>
              ) : null}
              {found?.people?.length ? (
                <>
                  <SectionTitle>Makers</SectionTitle>
                  <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                    {found.people.map((person) => (
                      <Link key={person.id} to={`/app/u/${person.username}`} className="w-[84px] shrink-0 text-center">
                        <Avatar name={person.name} src={person.avatar ?? undefined} size={64} className="mx-auto" />
                        <span className="mt-1.5 block truncate text-[12px] font-bold">{person.name}</span>
                        <span className="block truncate text-[10.5px] text-dim">{creatorUnder(person)}</span>
                      </Link>
                    ))}
                  </div>
                </>
              ) : null}
              {found?.tracks?.length ? (
                <>
                  {found.playlists?.length || found.people?.length ? (
                    <SectionTitle>Audios</SectionTitle>
                  ) : null}
                  <div className="pt-1">
                    {found.tracks.map((track) => (
                      <AudioRowTile
                        key={track.id}
                        row={{ ...track, source: "catalogue" }}
                        rows={found.tracks.map((one) => ({ ...one, source: "catalogue" }))}
                      />
                    ))}
                  </div>
                </>
              ) : null}
            </>
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
            <p className="truncate text-[12px] text-dim">Playlists · Podcasts · Artists · Trending</p>
          </div>
          <Link to="/app/audio/studio" className="icon-btn" aria-label="Your studio">
            <BarChart3 className="size-[19px]" />
          </Link>
          <button type="button" onClick={() => setPostOpen(true)} className="icon-btn" aria-label="Post audio">
            <Plus className="size-[19px]" />
          </button>
          <button type="button" onClick={() => setLinkOpen(true)} className="icon-btn" aria-label="Open a playlist link">
            <Link2 className="size-[19px]" />
          </button>
          <button
            type="button"
            onClick={() => setMode("search")}
            className="icon-btn -mr-1"
            aria-label="Search the catalogue"
          >
            <Search className="size-[19px]" />
          </button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
        {home.isLoading ? (
          <PageSkeleton rows={3} />
        ) : home.isError ? (
          <ErrorState error={home.error} onRetry={() => void home.refetch()} />
        ) : (
          <>
            {hero ? (
              <div className="px-4 pb-1 pt-1.5">
                <div
                  className="flex w-full items-center gap-3 rounded-[24px] border p-3"
                  style={{
                    backgroundColor: `${coverTone(seedOf(hero.seed))}1A`,
                    borderColor: `${coverTone(seedOf(hero.seed))}47`,
                  }}
                >
                  <button type="button" onClick={playHero} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                    <CoverArt seed={seedOf(hero.seed)} podcast={trackIsPodcast(hero)} size={56} radius={16} />
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
                  </button>
                  <LikeButton id={hero.id} liked={hero.liked} size="lg" />
                  <button
                    type="button"
                    onClick={playHero}
                    className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent"
                    aria-label={heroPlaying ? "Pause" : `Play ${hero.title}`}
                  >
                    {heroPlaying ? (
                      <Pause className="size-5 fill-current" />
                    ) : (
                      <Play className="ml-0.5 size-5 fill-current" />
                    )}
                  </button>
                </div>
              </div>
            ) : null}

            {/* The reco layer's shelves. A chip is a door, not a filter: an
                empty shelf is drawn dim rather than dropped, because its page
                still opens and says honestly that it is empty. */}
            {categories.length ? (
              <div className="no-scrollbar flex h-[52px] items-center gap-2 overflow-x-auto px-4 py-2.5">
                {categories.map((category) => {
                  const emptyShelf = category.total <= 0;
                  return (
                    <button
                      key={category.key}
                      type="button"
                      onClick={() => openCategory(category)}
                      title={emptyShelf ? "Nothing here yet" : undefined}
                      className={cn(
                        "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition",
                        emptyShelf
                          ? "border-line/60 bg-card text-dim"
                          : "border-line bg-card text-ink hover:border-accent/35",
                      )}
                    >
                      {category.title}
                    </button>
                  );
                })}
              </div>
            ) : null}

            {empty ? (
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
                {leading ? (
                  <>
                    <SectionTitle action="See all" onAction={() => navigate("/app/audio/board")}>
                      Trending now
                    </SectionTitle>
                    <div className="no-scrollbar flex h-[176px] gap-3 overflow-x-auto px-4">
                      {leading.rows.map((row) => (
                        <BoardStripCard key={row.id} row={row} rows={leading.rows} />
                      ))}
                    </div>
                  </>
                ) : null}

                {recoRows.length ? (
                  <>
                    <SectionTitle>Audio drops</SectionTitle>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4">
                      {recoRows.map((row) => (
                        <BoardStripCard key={row.id} row={row} rows={recoRows} />
                      ))}
                    </div>
                  </>
                ) : null}

                {user ? (
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

                {given.length ? (
                  <>
                    <SectionTitle>Shared with you</SectionTitle>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                      {given.map((playlist) => (
                        <PlaylistCard key={playlist.id} playlist={playlist} />
                      ))}
                    </div>
                  </>
                ) : null}

                {theirs.length ? (
                  <>
                    <SectionTitle>Playlists</SectionTitle>
                    <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                      {theirs.map((playlist) => (
                        <PlaylistCard key={playlist.id} playlist={playlist} />
                      ))}
                    </div>
                  </>
                ) : null}

                {recent.length ? (
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
                        <AudioRowTile
                          key={track.id}
                          row={{ ...track, source: "catalogue" }}
                          rows={recent.map((one) => ({ ...one, source: "catalogue" }))}
                          onMore={(row) => setMoreRow(row)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {podcasts.length ? (
                  <>
                    <SectionTitle>Podcasts</SectionTitle>
                    <div>
                      {podcasts.map((track) => (
                        <AudioRowTile
                          key={track.id}
                          row={{ ...track, source: "catalogue" }}
                          rows={podcasts.map((one) => ({ ...one, source: "catalogue" }))}
                          onMore={(row) => setMoreRow(row)}
                        />
                      ))}
                    </div>
                  </>
                ) : null}

                {artists.length ? (
                  <>
                    <SectionTitle>Artists</SectionTitle>
                    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                      {artists.map((artist, index) =>
                        artist.slug ? (
                          <Link
                            key={artist.slug || artist.name || index}
                            to={`/app/audio/artist/${encodeURIComponent(artist.slug)}`}
                            className="w-[78px] shrink-0 text-center"
                          >
                            <Avatar name={artist.name} size={64} className="mx-auto" />
                            <span className="mt-1.5 block truncate text-[12px] font-bold">{artist.name}</span>
                            <span className="block truncate text-[10.5px] text-dim">
                              {playCount(artist.listeners).replace(" plays", " monthly")}
                            </span>
                          </Link>
                        ) : (
                          <button
                            key={artist.name || index}
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
                        ),
                      )}
                    </div>
                  </>
                ) : null}

                {board?.creators?.length ? (
                  <>
                    <SectionTitle>{artists.length ? "Makers" : "Artists"}</SectionTitle>
                    <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                      {board.creators.map((person) => (
                        <Link key={person.id} to={`/app/u/${person.username}`} className="w-[84px] shrink-0 text-center">
                          <Avatar name={person.name} src={person.avatar ?? undefined} size={64} className="mx-auto" />
                          <span className="mt-1.5 block truncate text-[12px] font-bold">{person.name}</span>
                          <span className="block truncate text-[10.5px] text-dim">
                            {count(person.plays)} {person.plays === 1 ? "play" : "plays"}
                          </span>
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </>
            )}
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
            placeholder="https://.../s/..."
            className="field w-full"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
      </Modal>

      <Modal
        open={Boolean(moreRow)}
        onClose={() => setMoreRow(null)}
        title={moreRow ? moreRow.title ?? moreRow.name : undefined}
        description={moreRow?.artist}
      >
        {moreRow ? (
          <div className="p-2 pb-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <CoverArt
                seed={seedOf(moreRow.seed)}
                podcast={moreRow.kind === "podcast"}
                size={44}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-bold">{moreRow.title ?? moreRow.name}</p>
                <p className="truncate text-[12px] text-dim">{moreRow.artist}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setPickTrack(moreRow);
                setMoreRow(null);
              }}
              className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            >
              <ListMusic className="size-[18px] text-dim" />
              <span>
                <span className="block text-[13px] font-bold">Add to a playlist</span>
                <span className="block text-[11.5px] text-dim">Yours, or a new one named here.</span>
              </span>
            </button>
            {moreRow.artist ? (
              <button
                type="button"
                onClick={() => searchArtist(moreRow.artist ?? "")}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
              >
                <UserRound className="size-[18px] text-dim" />
                <span className="text-[13px] font-bold">More from {moreRow.artist}</span>
              </button>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(pickTrack)}
        onClose={() => setPickTrack(null)}
        title="Add to a playlist"
        description={pickTrack ? `Where should “${pickTrack.title ?? pickTrack.name}” go?` : undefined}
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

      <DropComposer
        open={postOpen}
        mode="sound"
        onClose={() => setPostOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ["audio-home"] })}
      />
    </div>
  );
}