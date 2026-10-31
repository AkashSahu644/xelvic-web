import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Bookmark,
  Ellipsis,
  EyeOff,
  Heart,
  MapPin,
  MessageCircle,
  Play,
  Share2,
  Trash2,
  Volume2,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage, AuthedVideo } from "@/components/Media";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, duration, relativeTime } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { usePlayer } from "@/providers/PlayerProvider";
import { useToast } from "@/providers/ToastProvider";
import { CommentsModal } from "@/features/drops/CommentsModal";
import type { Drop, Poll } from "@/types/api";

function ActionButton({
  active,
  label,
  children,
  onClick,
  disabled,
}: {
  active?: boolean;
  label: string;
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        "inline-flex min-h-8 items-center gap-1.5 rounded-full px-1.5 text-[11px] font-bold transition disabled:opacity-50",
        active ? "text-accent" : "text-dim hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

function PollBlock({ drop }: { drop: Drop }) {
  const [poll, setPoll] = useState<Poll | null>(drop.poll ?? null);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setPoll(drop.poll ?? null);
  }, [drop.poll]);

  if (!poll) return null;
  const total = poll.votes ?? poll.options.reduce((sum, option) => sum + (option.votes ?? 0), 0);
  const picked = new Set(poll.options.filter((option) => option.mine).map((option) => option.id));
  const showResults = Boolean(poll.results || poll.closed || picked.size);

  async function vote(optionId: string) {
    if (busy || poll?.closed) return;
    const next = new Set(picked);
    if (poll?.multiple) {
      if (next.has(optionId)) next.delete(optionId);
      else next.add(optionId);
    } else {
      if (next.has(optionId)) next.clear();
      else {
        next.clear();
        next.add(optionId);
      }
    }
    setBusy(true);
    try {
      const response = await api.post<{ poll: Poll }>(`/drops/${drop.id}/poll/vote/`, {
        options: Array.from(next),
      });
      setPoll(response.poll);
    } catch (error) {
      toast({ title: "Your answer did not go through", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-1.5">
      {poll.options.map((option) => {
        const votes = option.votes ?? 0;
        const share = total ? Math.round((votes / total) * 100) : 0;
        const mine = picked.has(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => void vote(option.id)}
            disabled={busy || poll.closed}
            className={cn(
              "relative block w-full overflow-hidden rounded-[10px] border px-3 py-2.5 text-left transition",
              mine ? "border-accent" : "border-line hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]",
              poll.closed && "cursor-default",
            )}
          >
            {showResults ? (
              <span
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-300",
                  mine ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]" : "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                )}
                style={{ width: `${share}%` }}
                aria-hidden
              />
            ) : null}
            <span className="relative flex items-center gap-2">
              <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", mine ? "border-accent bg-accent text-on-accent" : "border-line")}>
                {mine ? <span className="size-1.5 rounded-full bg-current" /> : null}
              </span>
              <span className="min-w-0 flex-1 text-[12.5px] font-semibold">{option.text}</span>
              {showResults ? <span className="num text-[11px] font-bold text-dim">{share}%</span> : null}
            </span>
          </button>
        );
      })}
      <p className="pt-0.5 text-[10px] text-dim">
        {count(total)} {total === 1 ? "answer" : "answers"}
        {poll.closed ? " · closed" : poll.multiple ? " · pick more than one" : ""}
      </p>
    </div>
  );
}

export function DropCard({
  drop,
  onRemoved,
  onSavedChange,
  detailed,
}: {
  drop: Drop;
  onRemoved?: (id: string) => void;
  onSavedChange?: (id: string, saved: boolean) => void;
  detailed?: boolean;
}) {
  const [liked, setLiked] = useState(Boolean(drop.liked));
  const [likes, setLikes] = useState(drop.likes ?? 0);
  const [saved, setSaved] = useState(Boolean(drop.saved));
  const [saves, setSaves] = useState(drop.saves ?? 0);
  const [comments, setComments] = useState(drop.comments ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const player = usePlayer();

  useEffect(() => {
    setLiked(Boolean(drop.liked));
    setLikes(drop.likes ?? 0);
    setSaved(Boolean(drop.saved));
    setSaves(drop.saves ?? 0);
    setComments(drop.comments ?? 0);
  }, [drop.id, drop.liked, drop.likes, drop.saved, drop.saves, drop.comments]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [menuOpen]);

  async function toggleLike() {
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      const response = await api.post<{ likes: number; liked: boolean }>(`/drops/${drop.id}/like/`, { on: next });
      setLiked(response.liked);
      setLikes(response.likes);
    } catch (error) {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
      toast({ title: "That like did not stick", description: errorMessage(error), tone: "error" });
    }
  }

  async function toggleSave() {
    const next = !saved;
    setSaved(next);
    setSaves((value) => Math.max(0, value + (next ? 1 : -1)));
    try {
      const response = await api.post<{ saves: number; saved: boolean }>(`/drops/${drop.id}/save/`, { on: next });
      setSaved(response.saved);
      setSaves(response.saves);
      onSavedChange?.(drop.id, response.saved);
      toast({ title: response.saved ? "Kept in saved" : "Taken out of saved", tone: "success" });
    } catch (error) {
      setSaved(!next);
      setSaves((value) => Math.max(0, value + (next ? -1 : 1)));
      toast({ title: "That did not save", description: errorMessage(error), tone: "error" });
    }
  }

  async function share() {
    if (busy) return;
    setBusy("share");
    try {
      const response = await api.post<{ link: string }>(`/drops/${drop.id}/share/`, {});
      try {
        await navigator.clipboard.writeText(response.link);
        toast({ title: "Link copied", description: "It will open where the drop lives.", tone: "success" });
      } catch {
        toast({ title: "The link is ready", description: response.link, tone: "info" });
      }
    } catch (error) {
      toast({ title: "Could not share that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function remove(action: "hide" | "delete") {
    setBusy(action);
    setMenuOpen(false);
    try {
      if (action === "delete") await api.delete(`/drops/${drop.id}/`);
      else await api.post(`/drops/${drop.id}/hide/`, { on: true });
      onRemoved?.(drop.id);
      toast({ title: action === "delete" ? "Drop deleted" : "Drop hidden", tone: "success" });
    } catch (error) {
      toast({ title: "That did not work", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  function playSound() {
    if (!drop.asset?.content_url) return;
    player.play({
      id: drop.id,
      title: drop.body || "A drop",
      artist: drop.author.name || drop.author.username,
      stream_url: drop.asset.content_url,
      cover_url: drop.author.avatar,
      seconds: drop.asset.duration_ms ? Math.round(drop.asset.duration_ms / 1000) : undefined,
    });
  }

  const image = drop.asset && (drop.asset.kind === "image" || /image/.test(drop.asset.mime ?? ""));
  const video = drop.asset && (drop.asset.kind === "video" || /video/.test(drop.asset.mime ?? ""));
  const audio = drop.asset && (drop.asset.kind === "audio" || drop.asset.kind === "voice" || /audio/.test(drop.asset.mime ?? ""));
  const text = drop.body || "";

  return (
    <article
      className={cn(
        "card overflow-hidden transition duration-200",
        detailed ? "rounded-[20px]" : "hover:shadow-[0_12px_32px_rgb(19_19_26_/_0.06)]",
      )}
    >
      <header className="flex items-start gap-3 px-4 pt-4">
        <Link to={`/app/u/${drop.author.username}`} className="shrink-0">
          <Avatar user={drop.author} size={40} online={drop.author.online} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1.5">
            <Link to={`/app/u/${drop.author.username}`} className="truncate text-[13px] font-extrabold hover:underline">
              {drop.author.name || drop.author.username}
            </Link>
            {drop.collab && Array.isArray(drop.collab.people) && drop.collab.people.length ? (
              <span className="truncate text-[10.5px] text-dim">
                with {drop.collab.people.map((person) => person.name || person.username).join(", ")}
              </span>
            ) : null}
          </div>
          <p className="truncate text-[10.5px] text-dim">
            @{drop.author.username} · <Link to={`/app/drops/${drop.id}`} className="hover:underline">{relativeTime(drop.created_at)}</Link>
            {drop.place ? (
              <span className="inline-flex items-center gap-1"> · <MapPin className="size-2.5" aria-hidden />{drop.place}</span>
            ) : null}
          </p>
        </div>
        {drop.tag ? (
          <span className="mt-0.5 shrink-0 rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide text-accent">
            {drop.tag}
          </span>
        ) : null}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            className="icon-btn -mr-2 -mt-1.5 size-9"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="Drop options"
            aria-expanded={menuOpen}
          >
            <Ellipsis className="size-4" />
          </button>
          {menuOpen ? (
            <div className="absolute right-0 top-8 z-20 w-44 overflow-hidden rounded-[12px] border border-line bg-card p-1 shadow-xl">
              <button
                type="button"
                onClick={() => void remove("hide")}
                className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[11.5px] font-semibold text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink"
              >
                <EyeOff className="size-3.5" /> Hide from my feed
              </button>
              {drop.mine ? (
                <button
                  type="button"
                  onClick={() => void remove("delete")}
                  className="flex w-full items-center gap-2 rounded-[8px] px-2.5 py-2 text-left text-[11.5px] font-semibold text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
                >
                  <Trash2 className="size-3.5" /> Delete drop
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {text ? (
        <p className={cn("whitespace-pre-wrap break-words px-4 pt-3 text-[14px] leading-[1.65] text-ink/95", !detailed && "line-clamp-[8]")}>
          {text}
        </p>
      ) : null}

      {drop.asset && (image || video) ? (
        <div className="mt-3 px-4">
          <div
            className="overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
            style={drop.ratio && !video ? { aspectRatio: `1 / ${drop.ratio}` } : video ? { aspectRatio: `1 / ${drop.ratio || 1.25}` } : undefined}
          >
            {video ? (
              <AuthedVideo src={drop.asset.content_url} controls className="h-full w-full" />
            ) : (
              <AuthedImage
                src={drop.asset.content_url}
                alt={drop.body ? `Photo from ${drop.author.name}` : "Drop photo"}
                className="h-full w-full"
                loading="lazy"
              />
            )}
          </div>
        </div>
      ) : null}

      {drop.asset && audio ? (
        <div className="mt-3 px-4">
          <button
            type="button"
            onClick={playSound}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-paper px-3 py-3 text-left transition hover:border-accent/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              <Volume2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] font-bold">{drop.asset.original_name || "Sound on this drop"}</span>
              <span className="block text-[10px] text-dim">
                {drop.asset.duration_ms ? duration(drop.asset.duration_ms / 1000) : "Play in the audio bar"}
              </span>
            </span>
            <Play className="size-4 text-dim" aria-hidden />
          </button>
        </div>
      ) : null}

      {drop.poll ? (
        <div className="px-4">
          <PollBlock drop={drop} />
        </div>
      ) : null}

      {drop.peek ? (
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-start gap-2 rounded-[10px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
        >
          <Avatar user={drop.peek.author} size={22} />
          <span className="min-w-0 flex-1 text-[11px] leading-5 text-dim">
            <span className="font-extrabold text-ink">{drop.peek.author.name || drop.peek.author.username}</span>{" "}
            <span className="line-clamp-2">{drop.peek.body}</span>
          </span>
        </button>
      ) : null}

      <footer className="mt-2 flex items-center gap-1 px-4 pb-4">
        <ActionButton active={liked} label={liked ? "Remove like" : "Like this drop"} onClick={() => void toggleLike()}>
          <Heart className={cn("size-[17px]", liked && "fill-current")} />
          <span className="num">{count(likes)}</span>
        </ActionButton>
        <ActionButton label="Read and write responds" onClick={() => setCommentsOpen(true)}>
          <MessageCircle className="size-[17px]" />
          <span className="num">{count(comments)}</span>
        </ActionButton>
        <ActionButton label="Share this drop" onClick={() => void share()} disabled={busy === "share"}>
          <Share2 className="size-[17px]" />
          <span className="num">{count(drop.shares)}</span>
        </ActionButton>
        <span className="flex-1" />
        <ActionButton active={saved} label={saved ? "Remove from saved" : "Keep this drop"} onClick={() => void toggleSave()}>
          <Bookmark className={cn("size-[17px]", saved && "fill-current")} />
          <span className="num">{count(saves)}</span>
        </ActionButton>
      </footer>

      <CommentsModal
        drop={drop}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setComments((value) => value + 1)}
      />
    </article>
  );
}
