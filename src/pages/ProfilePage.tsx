import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Heart,
  Lock,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Play,
  Search,
  Settings,
  Share2,
  UserCheck,
  UserPlus,
  VolumeX,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { api, apiPathFrom } from "@/lib/api";
import { count } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { ChatGate, Drop, Page, Profile, Relation } from "@/types/api";

interface PeopleState {
  relation: Relation;
  gate: ChatGate | null;
  cta: string;
}

interface ProfileDropsPage extends Page<Drop> {
  gate?: string;
  can_post?: boolean;
}

function Stat({ value, label }: { value?: number | null; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[15px] font-extrabold tabular-nums">{typeof value === "number" ? count(value) : "—"}</p>
      <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-dim">{label}</p>
    </div>
  );
}

function Tile({ drop }: { drop: Drop }) {
  const media = drop.asset?.thumbnail_url || drop.asset?.content_url;
  return (
    <Link to={`/app/drops/${drop.id}`} className="group relative aspect-square overflow-hidden rounded-[12px] border border-line bg-card">
      {media ? (
        <AuthedImage src={media} alt={drop.body || "Drop"} className="h-full w-full" imgClassName="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
      ) : (
        <div className="flex h-full w-full flex-col justify-between bg-[color-mix(in_srgb,var(--accent)_7%,var(--card))] p-3">
          <p className="line-clamp-5 text-[11px] font-semibold leading-[1.45]">{drop.body || "A drop"}</p>
          {drop.poll ? <span className="text-[9px] font-bold uppercase tracking-wider text-accent">Poll</span> : null}
        </div>
      )}
      {drop.kind === "video" || drop.kind === "vibe" ? (
        <span className="absolute right-2 top-2 flex size-6 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"><Play className="size-3 fill-current" /></span>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/55 to-transparent px-2.5 pb-2 pt-6 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
        <span className="flex items-center gap-1"><Heart className="size-3 fill-current" />{count(drop.likes)}</span>
        <span className="flex items-center gap-1"><MessageCircle className="size-3" />{count(drop.comments)}</span>
      </span>
    </Link>
  );
}

export function ProfilePage() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PeopleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [blockOpen, setBlockOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [muted, setMuted] = useState<boolean | null>(null);

  const profileQuery = useQuery({
    queryKey: ["profile", username],
    queryFn: () => api.get<Profile>(`/auth/users/${encodeURIComponent(username)}/`),
    enabled: Boolean(username),
  });
  const profile = profileQuery.data;
  const isMe = Boolean(profile?.relation?.self || (user && profile?.id === user.id));
  const relation = state?.relation ?? profile?.relation;
  const gate = state?.gate ?? profile?.gate;

  const dropsQuery = useInfiniteQuery<ProfileDropsPage>({
    queryKey: ["profile-drops", username],
    queryFn: ({ pageParam }) => api.get<ProfileDropsPage>(String(pageParam)),
    initialPageParam: `/drops/users/${encodeURIComponent(username)}/`,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(profile),
  });
  const drops = dropsQuery.data?.pages.flatMap((page) => page.results) ?? [];
  const walled = dropsQuery.isError && (dropsQuery.error as { status?: number }).status === 403;

  function apply(next: PeopleState) {
    setState(next);
    queryClient.setQueryData<Profile>(["profile", username], (current) => current ? { ...current, relation: next.relation, gate: next.gate, cta: next.cta } : current);
  }

  async function act(path: string, method: "post" | "delete" = "post") {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const next = method === "delete"
        ? await api.delete<PeopleState>(`/social/users/${profile.id}/${path}/`)
        : await api.post<PeopleState>(`/social/users/${profile.id}/${path}/`);
      apply(next);
      await queryClient.invalidateQueries({ queryKey: ["profile", username] });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
    } catch (error) {
      toast({ title: "That did not work", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function message() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ thread?: { id: string } | null; gate?: ChatGate }>("/chat/threads/", { user: profile.id });
      if (result.thread?.id) {
        navigate(`/app/convo/${result.thread.id}`);
      } else if (result.gate) {
        toast({ title: result.gate.title || "The convo is closed", description: result.gate.text || "They have not opened this convo.", tone: "info" });
      }
    } catch (error) {
      toast({ title: "Could not open the convo", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function mutePosts() {
    if (!profile) return;
    const next = !(muted ?? false);
    try {
      await api.post(`/drops/mute/${profile.id}/`, { on: next });
      setMuted(next);
      setMenuOpen(false);
      toast({ title: next ? "Posts muted" : "Posts unmuted", tone: "success" });
    } catch (error) {
      toast({ title: "Could not change that", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  }

  async function report() {
    if (!profile) return;
    try {
      await api.post("/social/report/", { target_user: profile.id, reason: reportReason });
      setReportOpen(false);
      setMenuOpen(false);
      toast({ title: "Report sent", description: "Thank you. We will look at it.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not send the report", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  }

  async function share() {
    if (!profile) return;
    const url = `${window.location.origin}/app/u/${profile.username}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Profile link copied", tone: "success" });
    } catch {
      toast({ title: "Copy the link from the address bar", tone: "info" });
    }
  }

  if (profileQuery.isLoading) {
    return <div className="mx-auto max-w-[900px] px-4 py-4"><PageSkeleton rows={4} /></div>;
  }
  if (profileQuery.isError) {
    return <div className="mx-auto max-w-[600px] px-4 py-10"><div className="card"><ErrorState error={profileQuery.error} onRetry={() => void profileQuery.refetch()} /></div></div>;
  }
  if (!profile) {
    return <div className="mx-auto max-w-[600px] px-4 py-10"><div className="card"><EmptyState icon={<Search className="size-6" />} title="No such account" body="That username is not here." action={<Link to="/app/search" className="btn btn-primary">Search people</Link>} /></div></div>;
  }

  const isFollowing = Boolean(relation?.following);
  const isRequested = relation?.follow_state === "requested";
  const followLabel = isFollowing ? "Following" : isRequested ? "Requested" : relation?.follows_me ? "Follow back" : "Follow";

  return (
    <div className="mx-auto w-full max-w-[900px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <div className="relative h-36 overflow-hidden bg-[color-mix(in_srgb,var(--accent)_18%,var(--card))] sm:h-48 md:mt-4 md:rounded-[22px]">
        <AuthedImage src={profile.cover} alt={`${profile.name}'s cover`} className="h-full w-full" fallback={<div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,var(--accent-soft),transparent_60%),radial-gradient(circle_at_80%_80%,color-mix(in_srgb,var(--accent)_20%,transparent),transparent_55%)]" />} />
      </div>

      <div className="relative px-4 md:px-2">
        <div className="-mt-10 flex items-end justify-between gap-3 sm:-mt-12">
          <Avatar user={profile} size={86} className="rounded-full border-4 border-[var(--page)] shadow-sm" online={profile.online} />
          <div className="mb-1 flex flex-wrap justify-end gap-1.5">
            {isMe ? (
              <>
                <Link to="/app/settings" className="btn btn-secondary btn-sm"><Pencil className="size-3.5" /> Edit</Link>
                <button type="button" onClick={() => void share()} className="icon-btn" aria-label="Share profile"><Share2 className="size-4" /></button>
              </>
            ) : (
              <>
                {relation?.blocked_by_me ? (
                  <Button size="sm" variant="secondary" onClick={() => void act("block", "delete")} loading={busy}>Unblock</Button>
                ) : (
                  <>
                    <Button
                      size="sm"
                      variant={isFollowing ? "secondary" : "primary"}
                      loading={busy}
                      onClick={() => void act("follow", isFollowing || isRequested ? "delete" : "post")}
                      icon={isFollowing ? <UserCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    >
                      {followLabel}
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => void message()} loading={busy} disabled={Boolean(gate && !gate.can_type)} icon={<MessageCircle className="size-3.5" />}>
                      {gate?.cta || "Message"}
                    </Button>
                  </>
                )}
                <button type="button" onClick={() => setMenuOpen(true)} className="icon-btn" aria-label="More profile actions"><MoreHorizontal className="size-4" /></button>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-[20px] font-extrabold tracking-tight">{profile.name || profile.username}</h1>
            {profile.is_private ? <Lock className="size-3.5 text-dim" aria-label="Private account" /> : null}
          </div>
          <p className="text-[11px] text-dim">@{profile.username}</p>
          {profile.bio ? <p className="mt-2 max-w-[560px] whitespace-pre-wrap text-[12px] leading-5">{profile.bio}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-dim">
            {profile.dob ? <span className="flex items-center gap-1"><CalendarDays className="size-3" />{profile.dob}</span> : null}
            {profile.online ? <span className="flex items-center gap-1"><span className="size-1.5 rounded-full bg-[var(--good)]" />Online now</span> : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x divide-line rounded-[16px] border border-line bg-card py-3">
          <Stat value={profile.posts_count} label="Drops" />
          <Stat value={isMe ? user?.followers_count : profile.followers_count} label="Crew" />
          <Stat value={isMe ? user?.following_count : profile.following_count} label="Keeping" />
        </div>

        {gate && !gate.can_type && !isMe ? (
          <div className="mt-3 rounded-[14px] border border-line bg-card px-3.5 py-3">
            <p className="text-[11px] font-extrabold">{gate.title || "This convo is closed"}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-dim">{gate.text || "You cannot message this account right now."}</p>
            {gate.action === "unblock" ? <button type="button" onClick={() => void act("block", "delete")} className="mt-2 text-[10px] font-bold text-accent hover:underline">Unblock</button> : null}
            {gate.action === "withdraw" ? <button type="button" onClick={() => void act("withdraw")} className="mt-2 text-[10px] font-bold text-accent hover:underline">Withdraw request</button> : null}
          </div>
        ) : null}

        <div className="mt-5 flex items-center justify-between border-b border-line pb-2">
          <h2 className="text-[12px] font-extrabold">Drops</h2>
          {isMe ? <Link to="/app/saved" className="text-[10px] font-bold text-accent hover:underline">Saved</Link> : null}
        </div>

        {walled ? (
          <div className="py-14 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim"><Lock className="size-5" /></span>
            <p className="mt-3 text-[13px] font-extrabold">This account is private</p>
            <p className="mx-auto mt-1 max-w-[300px] text-[11px] leading-5 text-dim">Keep this account to see their drops. Until then, the grid stays closed.</p>
          </div>
        ) : dropsQuery.isLoading ? (
          <div className="mt-3 grid grid-cols-3 gap-1.5 sm:gap-2">{[0, 1, 2, 3, 4, 5].map((item) => <div key={item} className="skeleton aspect-square rounded-[12px]" />)}</div>
        ) : dropsQuery.isError ? (
          <div className="card mt-3"><ErrorState compact error={dropsQuery.error} onRetry={() => void dropsQuery.refetch()} /></div>
        ) : !drops.length ? (
          <div className="py-14 text-center">
            <p className="text-[13px] font-extrabold">No drops yet</p>
            <p className="mt-1 text-[11px] text-dim">{isMe ? "Put something up and it lands here." : "When they post, it shows up here."}</p>
            {isMe ? <Link to="/app/drops" className="btn btn-primary btn-sm mt-3">Make a drop</Link> : null}
          </div>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-1.5 sm:gap-2">
              {drops.map((drop) => <Tile key={drop.id} drop={drop} />)}
            </div>
            {dropsQuery.hasNextPage ? (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" size="sm" loading={dropsQuery.isFetchingNextPage} onClick={() => void dropsQuery.fetchNextPage()}>Load more</Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="More" size="sm">
        <div className="space-y-1 px-3 py-3">
          <button type="button" onClick={() => void mutePosts()} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
            <VolumeX className="size-4 text-dim" /> {muted ? "Unmute their posts" : "Mute their posts"}
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); setReportOpen(true); }} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-semibold hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
            <Search className="size-4 text-dim" /> Report this account
          </button>
          <button type="button" onClick={() => { setMenuOpen(false); setBlockOpen(true); }} className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[12px] font-semibold text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]">
            <Lock className="size-4" /> Block this account
          </button>
        </div>
      </Modal>

      <Modal open={reportOpen} onClose={() => setReportOpen(false)} title="Report this account" description="Tell us what is wrong. They will not be told.">
        <div className="px-5 py-4">
          <label className="text-[10px] font-bold uppercase tracking-wider text-dim">Reason</label>
          <select value={reportReason} onChange={(event) => setReportReason(event.target.value)} className="field mt-1.5">
            <option value="spam">Spam</option>
            <option value="abuse">Abuse</option>
            <option value="fake">Fake account</option>
            <option value="other">Something else</option>
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={() => void report()}>Send report</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={blockOpen}
        onClose={() => setBlockOpen(false)}
        onConfirm={() => {
          setBlockOpen(false);
          void act("block");
        }}
        title={`Block @${profile.username}?`}
        body="They will not be able to see your drops or message you. Any follow between you is removed."
        confirmLabel="Block"
        destructive
        loading={busy}
      />

      {isMe ? (
        <Link to="/app/settings" className="fixed bottom-[calc(86px+env(safe-area-inset-bottom,0px))] right-4 flex size-11 items-center justify-center rounded-full bg-accent text-[var(--accent-ink)] shadow-lg md:hidden" aria-label="Settings">
          <Settings className="size-5" />
        </Link>
      ) : null}
    </div>
  );
}
