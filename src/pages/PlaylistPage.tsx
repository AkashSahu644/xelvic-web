import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Copy,
  Link2,
  ListMusic,
  Pencil,
  Play,
  Plus,
  Search,
  Send,
  Trash2,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { TrackRow } from "@/features/audio/TrackRow";
import { api } from "@/lib/api";
import { count, duration } from "@/lib/format";
import { uploadAsset } from "@/lib/upload";
import { usePlayer } from "@/providers/PlayerProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Playlist, ThreadCard, Track } from "@/types/api";

interface PlaylistDetail {
  playlist: Playlist;
  tracks: Track[];
  shared_with?: PlaylistShare[];
}

interface PlaylistShare {
  id: string;
  where: string;
  to?: string;
  to_username?: string;
  token?: string;
  link?: string;
  at?: string;
}

export function PlaylistPage() {
  const { playlistId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const player = usePlayer();
  const { toast } = useToast();
  const [renameOpen, setRenameOpen] = useState(false);
  const [name, setName] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [trackQuery, setTrackQuery] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const detail = useQuery({
    queryKey: ["playlist", playlistId],
    queryFn: () => api.get<PlaylistDetail>(`/audio/playlists/${playlistId}/`),
    enabled: Boolean(playlistId),
  });
  const shares = useQuery({
    queryKey: ["playlist-shares", playlistId],
    queryFn: () => api.get<{ shared_with: PlaylistShare[] }>(`/audio/playlists/${playlistId}/share/`),
    enabled: shareOpen && Boolean(detail.data?.playlist.mine),
  });
  const threads = useQuery({
    queryKey: ["threads-share"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/"),
    enabled: shareOpen,
    staleTime: 20_000,
  });
  const search = useQuery({
    queryKey: ["audio-search", trackQuery.trim()],
    queryFn: () => api.get<{ tracks: Track[] }>("/audio/tracks/", { query: { q: trackQuery.trim() } }),
    enabled: addOpen && trackQuery.trim().length > 1,
  });

  const playlist = detail.data?.playlist;
  const tracks = detail.data?.tracks ?? [];

  async function invalidate() {
    await queryClient.invalidateQueries({ queryKey: ["playlist", playlistId] });
    await queryClient.invalidateQueries({ queryKey: ["audio-home"] });
  }

  async function saveDetails() {
    if (!playlist) return;
    if (!name.trim()) {
      toast({ title: "A playlist needs a name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      let coverId: string | null | undefined;
      if (coverFile) coverId = (await uploadAsset(coverFile, { kind: "image" })).id;
      await api.patch<{ playlist: Playlist }>(`/audio/playlists/${playlist.id}/`, {
        name: name.trim(),
        ...(coverId !== undefined ? { cover: coverId } : {}),
      });
      await invalidate();
      setRenameOpen(false);
      setCoverFile(null);
      toast({ title: "Playlist updated", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not update the playlist",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  async function removePlaylist() {
    if (!playlist) return;
    setSaving(true);
    try {
      await api.delete(`/audio/playlists/${playlist.id}/`);
      await queryClient.invalidateQueries({ queryKey: ["audio-home"] });
      toast({ title: "Playlist taken down", tone: "success" });
      navigate("/app/audio");
    } catch (error) {
      toast({
        title: "Could not take it down",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
      setDeleteOpen(false);
    }
  }

  async function addTrack(track: Track) {
    if (!playlist || adding) return;
    setAdding(track.id);
    try {
      await api.post(`/audio/playlists/${playlist.id}/items/`, { track: track.id });
      await invalidate();
      toast({ title: "Added to the playlist", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not add that track",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setAdding(null);
    }
  }

  async function removeTrack(track: Track) {
    if (!playlist || !track.item) return;
    try {
      await api.delete(`/audio/playlists/${playlist.id}/items/${track.item}/`);
      await invalidate();
    } catch (error) {
      toast({
        title: "Could not remove that track",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
  }

  async function move(index: number, direction: -1 | 1) {
    if (!playlist) return;
    const next = [...tracks];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    const items = next.map((track) => track.item).filter(Boolean);
    if (items.length !== tracks.length) return;
    try {
      await api.post(`/audio/playlists/${playlist.id}/order/`, { items });
      await invalidate();
    } catch (error) {
      toast({
        title: "Could not reorder the playlist",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
  }

  async function shareToThread(thread: ThreadCard) {
    if (!playlist || sharing) return;
    setSharing(true);
    try {
      await api.post(`/audio/playlists/${playlist.id}/share/`, { thread: thread.id });
      await queryClient.invalidateQueries({ queryKey: ["playlist-shares", playlistId] });
      toast({ title: "Sent", description: "The playlist landed in that convo.", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not send it",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSharing(false);
    }
  }

  async function makeLink() {
    if (!playlist || sharing) return;
    setSharing(true);
    try {
      const made = await api.post<{ token?: string; link?: string }>(`/audio/playlists/${playlist.id}/share/`, { link: true });
      await queryClient.invalidateQueries({ queryKey: ["playlist-shares", playlistId] });
      if (made.token) {
        const url = `${window.location.origin}/s/${made.token}`;
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "Anyone holding it can listen.", tone: "success" });
      } else {
        toast({ title: "Link ready", description: made.link || "Open the share sheet to copy it.", tone: "info" });
      }
    } catch (error) {
      toast({
        title: "Could not make a link",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSharing(false);
    }
  }

  async function revoke(share: PlaylistShare) {
    try {
      await api.delete(`/audio/playlists/${playlistId}/share/${share.id}/`);
      await queryClient.invalidateQueries({ queryKey: ["playlist-shares", playlistId] });
    } catch (error) {
      toast({
        title: "Could not take that back",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    }
  }

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader
        title={playlist?.name || "Playlist"}
        subtitle={playlist ? `${playlist.mine ? "Yours" : playlist.owner || "Xelvic"} · ${count(playlist.count)} tracks` : undefined}
        back
        actions={
          playlist?.mine ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setName(playlist.name);
                  setRenameOpen(true);
                }}
                className="icon-btn"
                aria-label="Edit playlist"
              >
                <Pencil className="size-4" />
              </button>
              <button type="button" onClick={() => setShareOpen(true)} className="icon-btn" aria-label="Share playlist">
                <Send className="size-4" />
              </button>
              <button type="button" onClick={() => setDeleteOpen(true)} className="icon-btn text-dim hover:text-[var(--bad)]" aria-label="Take playlist down">
                <Trash2 className="size-4" />
              </button>
            </>
          ) : null
        }
      />

      <div className="mx-auto w-full max-w-[900px] px-4 py-5 md:px-7">
        {detail.isLoading ? (
          <PageSkeleton rows={3} />
        ) : detail.isError ? (
          <div className="card"><ErrorState error={detail.error} onRetry={() => void detail.refetch()} /></div>
        ) : !playlist ? (
          <div className="card"><EmptyState icon={<ListMusic className="size-6" />} title="This playlist is not here" body="It may have been taken down, or the link may be wrong." action={<Button onClick={() => navigate("/app/audio")}>Back to Audio</Button>} /></div>
        ) : (
          <>
            <section className="relative overflow-hidden rounded-[24px] border border-line bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] p-5">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
                <div className="relative aspect-square w-36 shrink-0 overflow-hidden rounded-[18px] shadow-lg sm:w-44">
                  {playlist.cover ? (
                    <AuthedImage src={playlist.cover.content_url} alt="" className="size-full" loading="eager" />
                  ) : (
                    <span className="flex size-full items-center justify-center bg-[var(--accent-soft)] text-accent"><ListMusic className="size-10" /></span>
                  )}
                  {playlist.mine ? (
                    <button
                      type="button"
                      onClick={() => {
                        setName(playlist.name);
                        setRenameOpen(true);
                      }}
                      className="absolute bottom-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
                      aria-label="Change playlist cover"
                    >
                      <Camera className="size-4" />
                    </button>
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-accent">
                    {playlist.mine ? "Your playlist" : playlist.shared ? `Shared by ${playlist.owner || "someone"}` : "Xelvic playlist"}
                  </p>
                  <h2 className="mt-1 text-balance text-3xl font-extrabold tracking-[-0.04em]">{playlist.name}</h2>
                  <p className="mt-1 text-xs text-dim">{count(playlist.count)} tracks · {duration(playlist.seconds)}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <Button
                      disabled={!tracks.length}
                      onClick={() => {
                        if (tracks[0]) player.play(tracks[0], tracks);
                      }}
                      icon={<Play className="size-4 fill-current" />}
                    >
                      Play all
                    </Button>
                    {playlist.mine ? (
                      <Button variant="secondary" onClick={() => setAddOpen(true)} icon={<Plus className="size-4" />}>
                        Add tracks
                      </Button>
                    ) : null}
                    <Button variant="secondary" onClick={() => setShareOpen(true)} icon={<Users className="size-4" />}>
                      Share
                    </Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="mt-6">
              {tracks.length ? (
                <div className="card divide-y divide-line/70 p-1.5">
                  {tracks.map((track, index) => (
                    <div key={track.item || track.id} className="flex items-center gap-1">
                      <div className="min-w-0 flex-1">
                        <TrackRow
                          track={track}
                          queue={tracks}
                          index={index}
                          onRemove={playlist.mine && track.item ? () => void removeTrack(track) : undefined}
                        />
                      </div>
                      {playlist.mine && track.item ? (
                        <div className="flex shrink-0 flex-col">
                          <button type="button" onClick={() => void move(index, -1)} disabled={index === 0} className="rounded p-0.5 text-dim hover:text-ink disabled:opacity-25" aria-label="Move up">
                            <ArrowUp className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => void move(index, 1)} disabled={index === tracks.length - 1} className="rounded p-0.5 text-dim hover:text-ink disabled:opacity-25" aria-label="Move down">
                            <ArrowDown className="size-3.5" />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="card">
                  <EmptyState
                    icon={<ListMusic className="size-6" />}
                    title="Nothing on this shelf yet"
                    body={playlist.mine ? "Add the first track and this playlist starts here." : "The owner has not put anything on it yet."}
                    action={playlist.mine ? <Button size="sm" onClick={() => setAddOpen(true)}>Add a track</Button> : undefined}
                  />
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <Modal
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
        title="Playlist details"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRenameOpen(false)}>Cancel</Button>
            <Button onClick={() => void saveDetails()} loading={saving}>Save</Button>
          </div>
        }
      >
        <div className="space-y-4 px-5 py-4">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} className="field w-full" />
          </label>
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Cover</span>
            <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full items-center gap-3 rounded-[14px] border border-dashed border-line p-3 text-left">
              <span className="flex size-11 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-accent"><Camera className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] font-bold">{coverFile ? coverFile.name : "Replace the cover"}</span>
                <span className="block text-[10px] text-dim">A square picture reads best.</span>
              </span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
          </div>
        </div>
      </Modal>

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add tracks" description="Search the catalogue and add one at a time." size="lg">
        <div className="px-5 py-4">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-dim" />
            <input value={trackQuery} onChange={(event) => setTrackQuery(event.target.value)} autoFocus placeholder="Search the catalogue" className="field h-11 w-full pl-11" />
          </label>
          <div className="mt-3">
            {trackQuery.trim().length < 2 ? (
              <p className="py-8 text-center text-xs text-dim">Type at least two letters.</p>
            ) : search.isLoading ? (
              <p className="py-8 text-center text-xs text-dim">Searching...</p>
            ) : search.isError ? (
              <ErrorState compact error={search.error} onRetry={() => void search.refetch()} />
            ) : !search.data?.tracks.length ? (
              <p className="py-8 text-center text-xs text-dim">Nothing matched.</p>
            ) : (
              <div className="max-h-[50dvh] overflow-y-auto">
                {search.data.tracks.map((track) => {
                  const already = tracks.some((row) => row.id === track.id);
                  return (
                    <div key={track.id} className="flex items-center gap-3 border-b border-line/70 py-2 last:border-0">
                      <span className="flex size-10 items-center justify-center overflow-hidden rounded-[10px] bg-[var(--accent-soft)] text-accent">
                        {track.cover_url ? <AuthedImage src={track.cover_url} alt="" className="size-full" /> : <ListMusic className="size-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{track.title}</span>
                        <span className="block truncate text-[10px] text-dim">{track.artist} · {duration(track.seconds)}</span>
                      </span>
                      <Button size="sm" variant={already ? "ghost" : "secondary"} disabled={already || adding === track.id} onClick={() => void addTrack(track)} loading={adding === track.id}>
                        {already ? "On it" : "Add"}
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share playlist" description="Send it into a convo or copy a link." size="lg">
        <div className="px-5 py-4">
          <button type="button" onClick={() => void makeLink()} disabled={sharing} className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-[var(--accent-soft)] p-3 text-left transition hover:border-accent/40 disabled:opacity-60">
            <span className="flex size-10 items-center justify-center rounded-full bg-accent text-on-accent"><Link2 className="size-4" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-extrabold">Copy a link</span>
              <span className="block text-[10px] text-dim">Anyone with the link can listen, even without an account.</span>
            </span>
            <Copy className="size-4 text-accent" />
          </button>

          {playlist?.mine ? (
            <div className="mt-5">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Who has it</p>
              {shares.isLoading ? (
                <p className="py-3 text-xs text-dim">Loading...</p>
              ) : !shares.data?.shared_with.length ? (
                <p className="py-3 text-xs text-dim">Nobody yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {shares.data.shared_with.map((share) => (
                    <div key={share.id} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2">
                      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                        {share.token ? <Link2 className="size-3.5" /> : <Users className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-bold">{share.token ? "A link" : share.to || share.to_username || "Someone"}</span>
                        <span className="block text-[10px] text-dim">{share.token ? "Anyone holding it" : "In a convo"}</span>
                      </span>
                      <button type="button" onClick={() => void revoke(share)} className="text-[10px] font-bold text-dim hover:text-[var(--bad)]">Revoke</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          <div className="mt-5">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Send to a convo</p>
            {threads.isLoading ? (
              <p className="py-3 text-xs text-dim">Loading convos...</p>
            ) : threads.isError ? (
              <ErrorState compact error={threads.error} onRetry={() => void threads.refetch()} />
            ) : !threads.data?.threads.length ? (
              <p className="py-3 text-xs text-dim">No convos yet.</p>
            ) : (
              <div className="max-h-[38dvh] space-y-1 overflow-y-auto">
                {threads.data.threads.slice(0, 20).map((thread) => {
                  const person = thread.member ?? thread.members?.[0]?.user ?? thread.other;
                  const title = thread.title || person?.name || person?.username || "Convo";
                  return (
                    <button
                      key={thread.id}
                      type="button"
                      disabled={sharing}
                      onClick={() => void shareToThread(thread)}
                      className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-60"
                    >
                      <Avatar user={person} name={title} src={thread.avatar} size={34} />
                      <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{title}</span>
                      <Send className="size-3.5 text-dim" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={() => void removePlaylist()}
        title="Take this playlist down?"
        body="It leaves your shelf and every link and convo card stops working. This cannot be undone."
        confirmLabel="Take it down"
        destructive
        loading={saving}
      />

      {playlist && !playlist.mine ? (
        <div className="mx-auto mt-4 max-w-[900px] px-4 pb-8 text-center text-[11px] text-dim md:px-7">
          Shared with you by <Link to={`/app/u/${playlist.owner_username}`} className="font-bold text-accent hover:underline">{playlist.owner || "the owner"}</Link>.
        </div>
      ) : null}
    </div>
  );
}
