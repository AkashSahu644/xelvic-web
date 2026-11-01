import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  BadgeCheck,
  CameraOff,
  Check,
  ChevronDown,
  CirclePlus,
  Clock3,
  Copy,
  Download,
  EyeOff,
  FileText,
  Forward,
  Heart,
  Image as ImageIcon,
  Info,
  Lock,
  MapPin,
  MessageCircle,
  Mic,
  MoreHorizontal,
  Pause,
  Phone,
  Play,
  Plus,
  Reply,
  RotateCcw,
  Send,
  Smile,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Video,
  Volume2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Backdrop } from "@/components/Backdrop";
import { Button, Spinner } from "@/components/Button";
import { AuthedImage, AuthedVideo } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { EmptyState, ErrorState } from "@/components/States";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import { VoiceRecorder } from "@/features/convo/VoiceRecorder";
import { tintHex, vanishLabel, wallUrl, wallpaperOpacity } from "@/features/convo/skin";
import { CommentsModal } from "@/features/drops/CommentsModal";
import { dropBase, dropIsVibe } from "@/features/drops/model";
import { api, apiPathFrom, apiUrl } from "@/lib/api";
import { cn } from "@/lib/cn";
import { clock, count } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMediaUrl } from "@/lib/media";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useSocket, useSocketEvent } from "@/providers/SocketProvider";
import { useToast } from "@/providers/ToastProvider";
import type {
  Drop,
  Message,
  MessagePoll,
  Page,
  Playlist,
  ThreadCard,
  ThreadDetail,
  UserCard,
} from "@/types/api";

const REACTIONS = ["❤️", "😂", "🔥", "👍", "😮", "😢"];
const COMPOSER_EMOJIS = ["❤️", "😂", "🔥", "👍", "😮", "😢", "🙏", "🎉", "✨", "😍", "😭", "🤝"];

// The same camera the convo list uses, so a Spark is taken, edited and sent
// from the app's own editor rather than from a bare file input.
const CameraCapture = lazy(() =>
  import("@/features/camera/CameraCapture").then((module) => ({
    default: module.CameraCapture,
  })),
);

function draftKey(threadId: string) {
  return `xelvic:convo-draft:${threadId}`;
}

function readDraft(threadId: string) {
  try {
    return localStorage.getItem(draftKey(threadId)) ?? "";
  } catch {
    // Private mode or blocked storage: drafts are a convenience, not state.
    return "";
  }
}

function writeDraft(threadId: string, text: string) {
  try {
    if (text.trim()) localStorage.setItem(draftKey(threadId), text);
    else localStorage.removeItem(draftKey(threadId));
  } catch {
    // Ignore: the convo itself is unaffected.
  }
}

type MessageData = InfiniteData<Page<Message>, string | null>;

function updateMessageList(
  data: MessageData | undefined,
  update: (rows: Message[]) => Message[],
): MessageData | undefined {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, results: update(page.results) })) };
}

function useMessageCache(threadId: string) {
  const queryClient = useQueryClient();
  const key = ["messages", threadId] as const;

  /**
   * Insert or replace one message.
   *
   * A message from the socket can arrive before the HTTP response that
   * created it, and an optimistic row is already on screen by then. Both
   * carry the same `client_id`, so the local row is replaced rather than
   * followed by a second copy. Ids still win over client ids: the same
   * canonical message may arrive twice (HTTP + socket), and the second is a
   * merge, not a new bubble.
   */
  function insert(message: Message) {
    queryClient.setQueryData<MessageData>(key, (data) => {
      if (!data?.pages.length) return data;
      const matches = (row: Message) =>
        row.id === message.id ||
        Boolean(message.client_id && row.client_id === message.client_id);
      const exists = data.pages.some((page) => page.results.some(matches));
      if (exists) {
        return {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            results: page.results.map((row) =>
              matches(row)
                ? {
                    ...row,
                    ...message,
                    mine: message.mine ?? row.mine,
                    pending: false,
                    failed: false,
                  }
                : row,
            ),
          })),
        };
      }
      const pages = [...data.pages];
      pages[0] = { ...pages[0], results: [message, ...pages[0].results] };
      return { ...data, pages };
    });
  }

  function insertLocal(message: Message) {
    queryClient.setQueryData<MessageData>(key, (data) => {
      if (!data?.pages.length) {
        // The history is still loading. Seed a page so the optimistic row is
        // visible immediately; the in-flight fetch replaces it with the
        // server's copy, which already includes the message once it lands.
        return {
          pages: [{ results: [message], next: null, previous: null }],
          pageParams: [null],
        } as MessageData;
      }
      const exists = data.pages.some((page) =>
        page.results.some((row) => row.id === message.id),
      );
      if (exists) return data;
      const pages = [...data.pages];
      pages[0] = { ...pages[0], results: [message, ...pages[0].results] };
      return { ...data, pages };
    });
  }

  function markFailed(id: string) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) =>
        rows.map((row) =>
          row.id === id ? { ...row, pending: false, failed: true } : row,
        ),
      ),
    );
  }

  function patch(messageId: string, patch: Partial<Message>) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) => rows.map((row) => (row.id === messageId ? { ...row, ...patch } : row))),
    );
  }

  function remove(ids: string[]) {
    queryClient.setQueryData<MessageData>(key, (data) =>
      updateMessageList(data, (rows) => rows.filter((row) => !ids.includes(row.id))),
    );
  }

  return { insert, insertLocal, markFailed, patch, remove };
}

function ChatAudio({ src }: { src: string | null | undefined }) {
  const media = useMediaUrl(src);
  if (!src) return null;
  if (media.loading) return <div className="skeleton h-11 w-60 max-w-full rounded-[14px]" />;
  if (media.failed || !media.src) return <p className="text-[11px] text-dim">This sound could not be loaded.</p>;
  return <audio controls src={media.src} className="h-11 w-full max-w-[280px]" />;
}

function ChatDocument({ src, name }: { src: string | null | undefined; name?: string }) {
  const media = useMediaUrl(src);
  if (!src) return null;
  return (
    <a
      href={media.src ?? undefined}
      download={name || true}
      className={cn(
        "flex min-h-12 items-center gap-3 rounded-[14px] border border-line bg-paper px-3 py-2.5 text-[11.5px] font-semibold",
        !media.src && "pointer-events-none opacity-55",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
        <FileText className="size-4" />
      </span>
      <span className="min-w-0 flex-1 truncate">{name || "A document"}</span>
      <Download className="size-3.5 shrink-0 text-dim" />
    </a>
  );
}

function sharedDrop(message: Message) {
  const payload = message.payload ?? {};
  const rawDrop = payload.drop ?? payload.post;
  if (typeof rawDrop === "string" && rawDrop) return { id: rawDrop } as Drop;
  const drop = rawDrop as Drop | undefined;
  if (drop?.id) return drop;
  const rawVibe = payload.vibe;
  if (typeof rawVibe === "string" && rawVibe) return { id: rawVibe } as Drop;
  const vibe = rawVibe as Drop | undefined;
  if (vibe?.id) return vibe;
  const id = payload.drop_id ?? payload.post_id ?? payload.vibe_id;
  if (typeof id === "string" && id) return { id } as Drop;
  return null;
}

function isSharedMessage(message: Message) {
  return (
    Boolean(sharedDrop(message)) ||
    Boolean(message.payload?.playlist) ||
    Boolean(message.payload?.room) ||
    message.kind === "drop" ||
    message.kind === "vibe" ||
    message.kind === "live" ||
    message.kind === "sticker"
  );
}

/// A Spark is not a message kind. It is an ordinary photo or clip whose payload
/// carries `view_once`, which is what the server burns the bytes on — see
/// `services.open_view_once`. Reading `kind` here was the web's own invention
/// and meant a real Spark never matched while invented kinds did.
function isSparkMessage(message: Message) {
  return message.payload?.view_once === true;
}

function sparkState(message: Message, mine: boolean) {
  const payload = message.payload ?? {};
  // The server's own mark, and nothing this browser remembered: a look spent on
  // another device has to read the same here as it does there.
  const opened = payload.opened_at != null;
  const url = message.asset?.content_url;
  return {
    opened,
    shotAt: typeof payload.shot_at === "string" ? payload.shot_at : null,
    canOpen: !mine && !opened && Boolean(url),
  };
}

/// The line a photographed Spark leaves under its own card — the sender is told
/// the picture was taken, and the taker is reminded that they were noticed.
/// Browser screenshot detection does not exist, so this line is only ever drawn
/// from the payload the server marked; the app reports its own shutter there.
function sparkShotLine(message: Message, mine: boolean) {
  if (!isSparkMessage(message) || !message.payload?.shot_at) return null;
  return (
    <div className="mt-1.5 flex items-center justify-center gap-[6px] px-2">
      <CameraOff className="size-[13px] shrink-0 text-dim" aria-hidden />
      <span className="text-center text-[11.5px] font-semibold text-dim">
        {mine ? "They took a screenshot of your Spark." : "You took a screenshot of this Spark."}
      </span>
    </div>
  );
}

function SparkCard({
  message,
  mine,
  onOpen,
}: {
  message: Message;
  mine: boolean;
  onOpen: () => void;
}) {
  const state = sparkState(message, mine);

  if (state.canOpen) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="flex max-w-[78vw] items-center gap-[11px] rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_42%,transparent)] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] py-3 pl-3 pr-[18px] text-left transition active:scale-[0.99]"
      >
        <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent">
          <Sparkles className="size-[19px]" />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-bold text-ink">A Spark for you</span>
          <span className="mt-[3px] block text-[12.5px] text-dim">Tap to open · once only</span>
        </span>
      </button>
    );
  }

  // Three words on the receiving side, because a card with no picture behind it
  // can mean three things: still sent, already looked at, or never carried
  // bytes for this seat. The sender's side only ever has the first two.
  const label = mine
    ? state.opened
      ? "Spark · opened"
      : "Spark · sent"
    : state.opened
      ? "Spark · opened"
      : "Spark · gone";
  return (
    <span className="inline-flex items-center gap-2 rounded-[16px] border border-line bg-card px-[14px] py-[11px] text-[14px] text-dim">
      {state.opened ? <EyeOff className="size-[18px]" /> : <Sparkles className="size-[18px]" />}
      {label}
    </span>
  );
}

function ChatDropCard({
  message,
  onReply,
}: {
  message: Message;
  onReply: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const seed = sharedDrop(message);
  const payload = message.payload ?? {};
  const isVibe = Boolean(payload.vibe) || Boolean(payload.vibe_id) || seed?.kind === "vibe";
  const id = seed?.id;
  const query = useQuery<{ drop: Drop }>({
    queryKey: ["chat-drop", id, isVibe],
    queryFn: async () => {
      try {
        const row = await api.get<{ drop?: Drop; vibe?: Drop }>(`/drops/${id}/`);
        const drop = row.drop ?? row.vibe;
        if (!drop) throw new Error("That share is not available.");
        return { drop };
      } catch (error) {
        if (!isVibe) throw error;
        const row = await api.get<{ drop?: Drop; vibe?: Drop }>(`/drops/vibes/${id}/`);
        const drop = row.drop ?? row.vibe;
        if (!drop) throw error;
        return { drop };
      }
    },
    enabled: Boolean(id),
    initialData: seed ? { drop: seed } : undefined,
    staleTime: 20_000,
  });
  const drop = query.data?.drop ?? seed;
  const [liked, setLiked] = useState(Boolean(drop?.liked));
  const [likes, setLikes] = useState(drop?.likes ?? 0);
  const [comments, setComments] = useState(drop?.comments ?? 0);
  const [busy, setBusy] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    if (!drop) return;
    setLiked(Boolean(drop.liked));
    setLikes(drop.likes ?? 0);
    setComments(drop.comments ?? 0);
  }, [drop]);

  if (!drop?.id) return null;
  const dropId = drop.id;
  // A shared Vibe is a row in the other table, and every call about it is the
  // same call under another prefix — `Drops._path` in the app. The card used to
  // read and then like `/drops/{id}/` for both kinds, which is why a clip that
  // had been sent in a convo failed to feel.
  const base = dropBase(drop);
  const open = () =>
    navigate(dropIsVibe(drop) ? `/app/drops?vibe=${encodeURIComponent(drop.id)}` : `/app/drops/${drop.id}`);
  const asset = drop.asset;
  const clip = Object.values(drop.clip_urls ?? {})[0];
  const source = clip?.content_url ?? asset?.content_url ?? null;
  const poster = clip?.thumbnail_url ?? asset?.thumbnail_url ?? null;
  const isClip = drop.kind === "video" || drop.kind === "vibe" || isVibe;
  const shape = Math.min(1.32, Math.max(0.66, drop.ratio || 1.25));
  const collabCount = drop.collab?.count ?? drop.collab?.people?.length ?? 0;

  async function toggleLike() {
    if (busy) return;
    const next = !liked;
    setLiked(next);
    setLikes((value) => Math.max(0, value + (next ? 1 : -1)));
    setBusy(true);
    try {
      const response = await api.post<{ likes: number; liked: boolean }>(`/${base}/${dropId}/like/`, { on: next });
      setLiked(response.liked);
      setLikes(response.likes);
    } catch (error) {
      setLiked(!next);
      setLikes((value) => Math.max(0, value + (next ? -1 : 1)));
      toast({ title: "That like did not stick", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await api.post<{ link: string }>(`/${base}/${dropId}/share/`, {});
      try {
        await navigator.clipboard.writeText(response.link);
        toast({ title: "Link copied", tone: "success" });
      } catch {
        toast({ title: "The link is ready", description: response.link, tone: "info" });
      }
    } catch (error) {
      toast({ title: "Could not share that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const act = "flex h-8 items-center gap-1.5 rounded-full px-2 text-[11px] font-semibold text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink";

  return (
    <>
      <div className="w-[258px] max-w-[72vw] overflow-hidden rounded-[20px] border border-[color-mix(in_srgb,var(--ink)_7%,transparent)] bg-card shadow-[0_3px_12px_rgba(17,17,26,0.08)]">
        {source ? (
          <button
            type="button"
            onClick={open}
            className="group relative block w-full overflow-hidden bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
            style={{ aspectRatio: `1 / ${shape}` }}
            aria-label="Open this drop"
          >
            {isClip ? (
              poster ? (
                <AuthedImage src={poster} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
              ) : (
                <AuthedVideo src={source} className="h-full w-full object-cover" />
              )
            ) : (
              <AuthedImage src={source} alt={asset?.original_name || ""} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
            )}
            {isClip ? (
              <span className="absolute left-1/2 top-1/2 flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(0_0_0_/_0.38)] text-white backdrop-blur-sm transition group-hover:scale-105">
                <Play className="ml-0.5 size-5 fill-current" />
              </span>
            ) : null}
            {drop.tag ? (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgb(0_0_0_/_0.42)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
                {drop.tag}
              </span>
            ) : isVibe ? (
              <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgb(0_0_0_/_0.42)] px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-white backdrop-blur-sm">
                Vibe
              </span>
            ) : null}
            {drop.place ? (
              <span className="absolute bottom-2.5 left-2.5 max-w-[80%] truncate rounded-full bg-[rgb(0_0_0_/_0.42)] px-2 py-0.5 text-[9.5px] font-semibold text-white backdrop-blur-sm">
                {drop.place}
              </span>
            ) : null}
          </button>
        ) : (
          <button
            type="button"
            onClick={open}
            className="block w-full bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] px-4 pb-3 pt-4 text-left"
          >
            <p className="line-clamp-4 whitespace-pre-wrap break-words text-[13px] font-medium leading-[1.45] text-ink/90">
              {drop.body || "A note"}
            </p>
          </button>
        )}

        <div className="flex items-center gap-2 px-3.5 pb-2 pt-3">
          <Avatar user={drop.author} size={26} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-bold leading-4">{drop.author?.name || drop.author?.username}</span>
            <span className="block truncate text-[11px] leading-4 text-dim">@{drop.author?.username}</span>
          </span>
          {collabCount ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[8.5px] font-extrabold text-accent">
              +{collabCount}
            </span>
          ) : null}
        </div>

        {drop.body && source ? (
          <p className="line-clamp-3 px-3.5 pb-2 text-[12.5px] leading-[1.45] text-ink/90">{drop.body}</p>
        ) : null}

        <div className="flex items-center gap-1 px-2 pb-2.5 pt-0.5">
          <button type="button" onClick={() => void toggleLike()} disabled={busy} className={cn(act, liked && "text-accent")} aria-label={liked ? "Remove like" : "Like this drop"}>
            <Heart className={cn("size-[17px]", liked && "fill-current")} />
            <span>{count(likes)}</span>
          </button>
          <button type="button" onClick={() => setCommentsOpen(true)} className={act} aria-label="Comments">
            <MessageCircle className="size-[17px]" />
            <span>{count(comments)}</span>
          </button>
          <button type="button" onClick={() => void share()} disabled={busy} className={act} aria-label="Share this drop">
            <Upload className="size-[17px]" />
            <span>{count(drop.shares)}</span>
          </button>
          <button type="button" onClick={onReply} className={cn(act, "ml-auto")} aria-label="Reply to this drop">
            <Reply className="size-[17px]" />
          </button>
        </div>
      </div>
      <CommentsModal
        drop={drop}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setComments((value) => value + 1)}
      />
    </>
  );
}

/// One look, fetched into this tab and spent the moment it is on the screen.
///
/// The bytes are asked for first and `open-once/` is posted only once they are
/// in hand — the server purges the file in the same call, so spending before
/// the picture had arrived would burn a look nobody took. The frame is keyed by
/// the message, so its media state cannot outlive its own look.
function SparkLookFrame({
  look,
  threadId,
  onSpent,
  onStatus,
}: {
  look: Message;
  threadId: string;
  onSpent: (message: Message) => void;
  onStatus: (id: string, ready: boolean, failed: boolean) => void;
}) {
  const media = useMediaUrl(look.asset?.content_url);
  const spent = useRef(false);
  const video = look.asset?.kind === "video";

  useEffect(() => {
    onStatus(look.id, Boolean(media.src), media.failed);
  }, [look.id, media.src, media.failed, onStatus]);

  useEffect(() => {
    if (!media.src || spent.current) return;
    spent.current = true;
    // What actually spends the look. A failure here leaves the card as the
    // server has it rather than claiming a look the person did not take.
    void api
      .post<{ message: Message }>(`/chat/threads/${threadId}/messages/${look.id}/open-once/`, {})
      .then((response) => onSpent(response.message))
      .catch(() => undefined);
  }, [media.src, look.id, threadId, onSpent]);

  if (media.failed) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <Sparkles className="size-[34px] text-white/40" aria-hidden />
        <p className="text-[15px] text-white/70">This Spark is gone.</p>
        <p className="text-[12.5px] text-white/40">It was made to be seen once, and there is nothing left of it.</p>
      </div>
    );
  }
  if (!media.src) {
    return (
      <div className="flex flex-col items-center gap-[18px]" aria-label="Loading Spark">
        <Sparkles className="size-[30px] text-white/25" aria-hidden />
        <Spinner className="size-[22px] text-white/55" />
      </div>
    );
  }
  if (video) {
    return (
      <video
        src={media.src}
        className="max-h-full max-w-full object-contain"
        autoPlay
        playsInline
        muted
        loop
      />
    );
  }
  return <img src={media.src} alt={look.asset?.original_name || "A Spark"} className="max-h-full max-w-full object-contain" />;
}

function SparkSoundBand({
  sound,
}: {
  sound: { id: string; title: string; startMs: number; endMs: number };
}) {
  const media = useMediaUrl(apiUrl(`/chat/assets/${sound.id}/content/`));
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const start = Math.max(0, sound.startMs) / 1000;
  const end = Math.max(0, sound.endMs) / 1000;

  useEffect(() => () => audio.current?.pause(), []);

  function toggle() {
    const node = audio.current;
    if (!node || !media.src) return;
    if (!node.paused) {
      node.pause();
      return;
    }
    if (end > 0 && node.currentTime >= end) node.currentTime = start;
    void node
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }

  return (
    <div className="flex items-center">
      <audio
        ref={audio}
        src={media.src ?? undefined}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          if (end > 0 && event.currentTarget.currentTime >= end) {
            event.currentTarget.pause();
            event.currentTarget.currentTime = start;
          }
        }}
        preload="metadata"
        className="hidden"
      />
      <button
        type="button"
        onClick={toggle}
        disabled={!media.src}
        className="flex items-center gap-[5px] px-1 py-0.5 text-left disabled:opacity-60"
        aria-label={playing ? "Pause the sound" : "Play the sound"}
      >
        <span className="flex size-[30px] shrink-0 items-center justify-center">
          {media.loading ? (
            <Spinner className="size-[13px] text-white" />
          ) : playing ? (
            <Pause className="size-[22px] fill-current text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]" />
          ) : (
            <Play className="size-[22px] fill-current text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]" />
          )}
        </span>
        <span className="max-w-[200px] truncate text-[11px] font-semibold tracking-[0.1px] text-white drop-shadow-[0_0_3px_rgba(0,0,0,0.54)]">
          {sound.title || "Sound attached"}
        </span>
      </button>
    </div>
  );
}

/// A sound rides along in the payload as an asset id, not a URL — the same
/// shape the app reads (`SparkLook.of`), because the wire carries the second
/// upload's id and the asset door serves it.
function sparkSound(message: Message) {
  const payload = message.payload ?? {};
  const raw = payload.sound;
  const id = typeof raw === "string" ? raw : typeof raw === "number" ? String(raw) : "";
  if (!id) return null;
  const ms = (value: unknown) =>
    typeof value === "number" ? value : typeof value === "string" ? Number(value) || 0 : 0;
  return {
    id,
    title: typeof payload.sound_title === "string" ? payload.sound_title.trim() : "",
    startMs: ms(payload.sound_start_ms),
    endMs: ms(payload.sound_end_ms),
  };
}

function SparkViewer({
  looks,
  threadId,
  onClose,
  onSpent,
  onReply,
}: {
  looks: Message[];
  threadId: string;
  onClose: () => void;
  onSpent: (message: Message) => void;
  onReply: (look: Message, body: string) => Promise<boolean>;
}) {
  const [at, setAt] = useState(0);
  const [status, setStatus] = useState<{ id: string; ready: boolean; failed: boolean }>({
    id: "",
    ready: false,
    failed: false,
  });
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const replyRef = useRef<HTMLTextAreaElement>(null);
  const look = looks[at];
  const more = at + 1 < looks.length;
  const ready = status.id === look?.id && status.ready;
  const failed = status.id === look?.id && status.failed;
  const sound = look ? sparkSound(look) : null;

  const reportStatus = useMemo(
    () => (id: string, isReady: boolean, isFailed: boolean) => setStatus({ id, ready: isReady, failed: isFailed }),
    [],
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);

  if (!look) return null;

  // A tap moves the run forward and nothing moves back: the look behind is
  // spent, so there is nothing to go back to. The last tap closes the page.
  // While the picture is still coming, or a reply is being written, the tap is
  // refused rather than spending a Spark nobody has seen or re-aiming a draft.
  function advance() {
    if (!ready && !failed) return;
    if (reply.trim()) {
      replyRef.current?.blur();
      return;
    }
    if (more) {
      setAt((index) => index + 1);
      setSent(false);
      return;
    }
    onClose();
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const landed = await onReply(look, body);
      if (landed) {
        setReply("");
        setSent(true);
        window.setTimeout(() => setSent(false), 2000);
      }
    } finally {
      setSending(false);
    }
  }

  const who = look.sender?.name || look.sender?.username || "";

  return createPortal(
    <div className="fixed inset-0 z-[100] flex h-[100dvh] flex-col overflow-hidden bg-black text-white" role="dialog" aria-modal="true" aria-label="A Spark">
      <div className="relative min-h-0 flex-1" onClick={advance}>
        <div className="absolute inset-0 flex items-center justify-center px-3">
          <SparkLookFrame key={look.id} look={look} threadId={threadId} onSpent={onSpent} onStatus={reportStatus} />
        </div>
        <div className="pointer-events-none absolute left-[14px] top-[max(10px,env(safe-area-inset-top))] flex items-center gap-[7px]">
          <Sparkles className="size-[15px] text-white/70" aria-hidden />
          <span className="text-[13px] font-semibold tracking-[0.4px] text-white/70">Spark</span>
          {looks.length > 1 ? (
            <span className="ml-1 text-[12.5px] font-semibold text-white/40">
              {at + 1} of {looks.length}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="absolute right-2 top-[max(4px,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full text-white transition hover:bg-white/10"
          aria-label="Close Spark"
        >
          <X className="size-[22px]" />
        </button>
      </div>

      <div className="shrink-0">
        {sound ? (
          <div className="px-4 pb-2">
            <SparkSoundBand key={look.id} sound={sound} />
          </div>
        ) : null}
        <div className="flex items-center justify-center gap-[7px] px-5 pb-4">
          <Sparkles className="size-[14px] text-white/40" aria-hidden />
          <span className="text-[12.5px] text-white/40">
            {more ? "Once only · Tap for the next" : "Once only · Tap to close"}
          </span>
        </div>
        <form onSubmit={(event) => void sendReply(event)} className="flex items-end gap-[6px] border-t border-line bg-page px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2">
          <textarea
            ref={replyRef}
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendReply(event);
              }
            }}
            rows={1}
            maxLength={8000}
            disabled={sending}
            placeholder={who ? `Reply to ${who}…` : "Reply to this Spark…"}
            className="max-h-[108px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-card px-4 py-[11px] text-[15px] leading-5 text-ink outline-none transition placeholder:text-dim focus:border-[1.5px] focus:border-accent disabled:opacity-70"
          />
          <button
            type="submit"
            disabled={!reply.trim() || sending}
            className="flex size-[44px] shrink-0 items-center justify-center rounded-full bg-accent text-white transition active:scale-95 disabled:bg-[color-mix(in_srgb,var(--accent)_35%,transparent)]"
            aria-label="Send reply"
          >
            {sending ? <Spinner className="size-[18px] text-white/70" /> : sent ? <Check className="size-5" /> : <ArrowUp className="size-5" strokeWidth={2.6} />}
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function SharedCard({ message, onReply }: { message: Message; onReply: () => void }) {
  const payload = message.payload ?? {};
  const drop = sharedDrop(message);
  const playlist = payload.playlist as Playlist | undefined;
  const room = payload.room as { id?: string; title?: string; listeners?: number } | undefined;
  const vibe = payload.vibe as Drop | undefined;
  if (drop?.id) {
    return <ChatDropCard message={message} onReply={onReply} />;
  }
  if (vibe?.id) {
    return <ChatDropCard message={message} onReply={onReply} />;
  }
  if (playlist?.id) {
    return (
      <Link to={`/app/audio/${playlist.id}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-paper p-3 transition hover:border-accent/40">
        <span className="flex size-11 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
          <Volume2 className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold">{playlist.name || playlist.title || "A playlist"}</span>
          <span className="block text-[10px] text-dim">{playlist.count ?? playlist.track_count ?? 0} tracks{playlist.owner ? ` · ${playlist.owner}` : ""}</span>
        </span>
      </Link>
    );
  }
  if (room?.id) {
    return (
      <Link to={`/app/live/${room.id}`} className="flex items-center gap-3 rounded-[14px] border border-line bg-paper p-3 transition hover:border-accent/40">
        <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
          <Sparkles className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-extrabold">{room.title || "A live room"}</span>
          <span className="block text-[10px] text-dim">{room.listeners ?? 0} listening</span>
        </span>
      </Link>
    );
  }
  if (payload.sticker || message.kind === "sticker") {
    return (
      <div className="flex min-h-24 min-w-24 items-center justify-center rounded-[20px] bg-[var(--accent-soft)] px-5 py-4 text-4xl">
        {String(payload.sticker ?? "✨")}
      </div>
    );
  }
  return null;
}

function PollMessage({ message, onVote }: { message: Message; onVote: (choice: number) => Promise<void> }) {
  const poll = message.poll;
  if (!poll?.options?.length) return null;
  const total = poll.total ?? 0;
  return (
    <div className="min-w-[250px] space-y-2">
      <p className="text-[12.5px] font-extrabold leading-5">{poll.question || "Ask the crowd"}</p>
      {poll.options.map((option) => {
        const mine = poll.mine === option.index;
        const share = total ? Math.round((option.count / total) * 100) : 0;
        return (
          <button
            key={option.index}
            type="button"
            onClick={() => void onVote(option.index)}
            className={cn(
              "relative block w-full overflow-hidden rounded-[12px] border px-3 py-2.5 text-left transition hover:border-accent/45",
              mine ? "border-accent bg-[var(--accent-soft)]" : "border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)]",
            )}
          >
            <span className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--accent)_13%,transparent)] transition-[width]" style={{ width: `${share}%` }} aria-hidden />
            <span className="relative flex items-center gap-2 text-[11.5px] font-semibold">
              <span className={cn("flex size-4 items-center justify-center rounded-full border", mine ? "border-accent bg-accent text-on-accent" : "border-line bg-card")}>
                {mine ? <Check className="size-2.5" /> : null}
              </span>
              <span className="flex-1">{option.text}</span>
              <span className={cn("text-[10px] tabular-nums", mine ? "font-bold text-accent" : "text-dim")}>{share}%</span>
            </span>
          </button>
        );
      })}
      <p className="text-[9.5px] font-semibold text-dim">{count(total)} {total === 1 ? "vote" : "votes"}</p>
    </div>
  );
}

function chatDay(value: string) {
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return "";
  const now = new Date();
  const day = new Date(at.getFullYear(), at.getMonth(), at.getDate());
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const gap = Math.round((today.getTime() - day.getTime()) / 86_400_000);
  if (gap === 0) return "Today";
  if (gap === 1) return "Yesterday";
  if (gap > 1 && gap < 7) return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(at);
  return `${at.getDate()} ${new Intl.DateTimeFormat(undefined, { month: "short" }).format(at)}`;
}

function bubbleType(text: string) {
  const rows = Array.from(text.trim());
  if (!rows.length || rows.length > 12) return 15;
  if (!rows.every((glyph) => /\p{Extended_Pictographic}/u.test(glyph))) return 15;
  if (rows.length === 1) return 42;
  if (rows.length === 2) return 36;
  if (rows.length === 3) return 30;
  return 24;
}

/**
 * The word beside my newest bubble.
 *
 * The server's `thread.status` is authoritative for the newest outgoing
 * message, and the per-seat watermarks are what the backend itself compares
 * (`services.outgoing_status` and `_status_word`). Nothing here guesses: with
 * no evidence the word is "Sent", never "Delivered".
 */
interface ReceiptMark {
  read?: number | null;
  delivered?: number | null;
}

/**
 * Everything needed to (re)send one message. Kept in a ref so a failed row
 * can be retried without re-typing it, and so the same `client_id` is reused
 * on retry — the backend dedupes on `(sender, client_id)`, so a retry after a
 * lost response cannot produce a duplicate bubble.
 */
interface OutgoingSend {
  clientId: string;
  localId: string;
  kind: string;
  body: string;
  replyToId?: string;
  payload?: Record<string, unknown>;
  channel?: string | null;
  file?: { file: File; kind: string; preview?: string };
  /** The uploaded asset, kept so a retry re-sends rather than re-uploads. */
  assetId?: string;
}

function receiptWord(
  message: Message,
  thread: ThreadDetail,
  meId: string | undefined,
  marks: Record<string, ReceiptMark>,
) {
  if (message.failed) return "Not sent";
  if (message.pending) return "Sending";
  if (message.held) return "Waiting for them";
  const seats = (thread.members ?? []).filter(
    (seat) => seat.user?.id && seat.user.id !== meId && !seat.left_at,
  );
  if (!seats.length) {
    // A direct convo may not carry a roster; the card's own status is still
    // the server's answer about exactly this bubble.
    return thread.status || "Sent";
  }
  const ordinal = message.ordinal ?? 0;
  if (!ordinal) return "Sent";
  const floor = (which: "read" | "delivered") =>
    Math.min(
      ...seats.map((seat) => {
        const mark = marks[seat.user.id];
        if (which === "read") {
          return mark?.read ?? seat.last_read_ordinal ?? 0;
        }
        return mark?.delivered ?? seat.last_delivered_ordinal ?? 0;
      }),
    );
  if (floor("read") >= ordinal) return "Opened";
  if (floor("delivered") >= ordinal) return "Delivered";
  return "Sent";
}

function locationOf(message: Message) {
  const payload = message.payload ?? {};
  const raw = (payload.location ?? payload.place ?? {}) as Record<string, unknown>;
  const lat = Number(raw.lat ?? raw.latitude ?? payload.lat ?? payload.latitude);
  const lng = Number(raw.lng ?? raw.longitude ?? raw.longitude ?? payload.lng);
  const label = String(
    raw.name ?? raw.label ?? payload.place_name ?? message.body ?? "Shared location",
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { label, href: null };
  return { label, href: `https://www.google.com/maps?q=${lat},${lng}` };
}

function MessageGesture({
  disabled,
  onLongPress,
  onDoubleTap,
  onSwipe,
  children,
}: {
  disabled?: boolean;
  onLongPress: () => void;
  onDoubleTap: () => void;
  onSwipe: () => void;
  children: React.ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const timer = useRef<number | null>(null);
  const long = useRef(false);
  const travel = useRef(0);

  function clear() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
  }

  function down(event: React.PointerEvent) {
    if (disabled || event.button !== 0) return;
    long.current = false;
    travel.current = 0;
    start.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
    timer.current = window.setTimeout(() => {
      long.current = true;
      onLongPress();
    }, 480);
  }

  function move(event: React.PointerEvent) {
    const origin = start.current;
    if (!origin) return;
    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;
    if (Math.abs(dy) > 10 || Math.abs(dx) < 3) {
      if (Math.abs(dy) > 10) clear();
      return;
    }
    if (Math.abs(dx) > 10) clear();
    travel.current = dx > 0 ? Math.min(64, dx * 0.65) : 0;
    setOffset(travel.current);
  }

  function up() {
    clear();
    const travelled = travel.current;
    travel.current = 0;
    start.current = null;
    setDragging(false);
    setOffset(0);
    if (!long.current && travelled >= 42) onSwipe();
  }

  return (
    <div
      style={{
        transform: offset ? `translateX(${offset}px)` : undefined,
        transition: dragging ? "none" : "transform 160ms ease",
        touchAction: "pan-y",
      }}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(event) => {
        if (disabled) return;
        event.preventDefault();
        onLongPress();
      }}
      onDoubleClick={(event) => {
        if (disabled) return;
        event.preventDefault();
        onDoubleTap();
      }}
    >
      {children}
    </div>
  );
}

const SENDER_TONES = ["#d6336c", "#0f9f8f", "#b7791f", "#3b82f6", "#7c3aed", "#e8590c", "#0f766e"];

function senderTone(value: string) {
  let score = 0;
  for (const glyph of value) score = (score * 31 + glyph.charCodeAt(0)) % 104_729;
  return SENDER_TONES[score % SENDER_TONES.length];
}

function MessageBubble({
  message,
  meId,
  showSender,
  receipt,
  onReply,
  onReact,
  onOptions,
  onVote,
  onOpenSpark,
  onRetry,
  progress,
}: {
  message: Message;
  meId?: string;
  showSender: boolean;
  receipt: string;
  onReply: () => void;
  onReact: (emoji: string) => Promise<void>;
  onOptions: () => void;
  onVote: (choice: number) => Promise<void>;
  onOpenSpark: () => void;
  onRetry?: () => void;
  progress?: number;
}) {
  const mine = meId ? message.sender?.id === meId : Boolean(message.mine);
  const deleted = message.deleted_for_all;
  const spark = isSparkMessage(message);
  const hasCard = isSharedMessage(message);
  const location = message.kind === "location" ? locationOf(message) : null;
  const caption = message.body?.trim();
  const picture = !deleted && !message.reply_to && !caption && (message.asset?.kind === "image" || message.asset?.kind === "video");
  const bare = picture || (!deleted && !message.reply_to && !caption && hasCard);

  if (message.kind === "system") {
    return (
      <div className="flex justify-center py-2">
        <p className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-3.5 py-1 text-center text-[11px] font-semibold text-dim shadow-xs">
          {message.body}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("flex pb-[2px]", mine ? "justify-end" : "justify-start")}>
      <div className={cn("relative max-w-[76%]", mine ? "items-end text-right" : "items-start text-left")}>
        <MessageGesture
          // A row that only exists locally has no server id yet; acting on it
          // would call endpoints with a fake id, so gestures wait for the real
          // message to land.
          disabled={Boolean(deleted || message.pending || message.failed)}
          onLongPress={onOptions}
          onDoubleTap={() => void onReact(REACTIONS[0])}
          onSwipe={onReply}
        >
          {spark ? (
            <div className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
              <SparkCard message={message} mine={mine} onOpen={onOpenSpark} />
              {sparkShotLine(message, mine)}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: bare ? "transparent" : mine ? "var(--convo-bubble-wash)" : "var(--convo-in-wash)",
                backgroundImage: !bare && mine ? "var(--convo-bubble-run)" : undefined,
                borderColor: bare ? "transparent" : mine ? "var(--convo-bubble-edge)" : "var(--convo-in-edge)",
                color: mine ? "var(--convo-out-ink)" : "var(--convo-in-ink)",
                borderRadius: bare ? 0 : mine ? "18px 18px 6px 18px" : "18px 18px 18px 6px",
              }}
              className={cn(
                "relative overflow-hidden text-[15px] leading-[1.35] border transition-colors text-left",
                bare ? "bg-transparent border-transparent p-0" : "px-3.5 pb-2 pt-2.5",
                deleted && "italic opacity-60",
                message.pending && "opacity-70",
                message.failed &&
                  "border-[color-mix(in_srgb,var(--bad)_55%,var(--line))]",
              )}
            >
              {showSender && !bare ? (
                <p className="mb-0.5 text-[11.5px] font-bold leading-4" style={{ color: senderTone(message.sender.username || message.sender.name || "") }}>
                  {message.sender.name || message.sender.username}
                </p>
              ) : null}
              {bare && message.created_at ? (
                <p className="mb-1 text-[10px] leading-none text-dim">{clock(message.created_at)}</p>
              ) : null}
              {!bare && message.edited_at && !deleted ? (
                <span className="mb-1 block text-[10px] leading-none text-dim">Edited</span>
              ) : null}
              {message.reply_to ? (
                <div
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--ink) 5%, transparent)",
                    borderColor: "var(--accent)",
                  }}
                  className="mb-1.5 rounded-[8px] border-l-[3px] px-2.5 py-1.5 text-[11px] leading-4"
                >
                  <span className="block font-bold text-accent">{message.reply_to.sender?.name || "Reply"}</span>
                  <span className="line-clamp-1 opacity-80" style={{ color: mine ? "var(--convo-out-dim)" : "var(--convo-in-dim)" }}>
                    {message.reply_to.deleted_for_all ? "This was removed" : message.reply_to.body}
                  </span>
                </div>
              ) : null}

              {deleted ? (
                <p className="italic">This was removed</p>
              ) : (
                <>
                  {message.asset?.kind === "image" && message.asset.content_url ? (
                    <AuthedImage src={message.asset.content_url} alt={message.asset.original_name || "Photo"} className={cn("max-h-[340px] w-full rounded-[14px] object-cover", caption && "mb-1.5", !bare && "min-w-[180px]")} />
                  ) : null}
                  {message.asset?.kind === "video" && message.asset.content_url ? (
                    <AuthedVideo src={message.asset.content_url} controls className={cn("max-h-[340px] w-full rounded-[14px] bg-[rgb(0_0_0_/_0.08)]", caption && "mb-1.5", !bare && "min-w-[210px]")} />
                  ) : null}
                  {(message.asset?.kind === "audio" || message.asset?.kind === "voice") && message.asset.content_url ? (
                    <div className="mb-1.5 min-w-[190px]">
                      <ChatAudio src={message.asset.content_url} />
                    </div>
                  ) : null}
                  {message.asset?.kind === "doc" && message.asset.content_url ? (
                    <div className="mb-1.5">
                      <ChatDocument src={message.asset.content_url} name={message.asset.original_name} />
                    </div>
                  ) : null}
                  {message.kind === "poll" ? <PollMessage message={message} onVote={onVote} /> : null}
                  {location ? (
                    location.href ? (
                      <a
                        href={location.href}
                        target="_blank"
                        rel="noreferrer"
                        className="mb-1.5 flex min-w-[190px] items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-2.5 transition hover:border-accent/40"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                          <MapPin className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-[9px] font-extrabold uppercase tracking-[0.1em] text-dim">Location</span>
                          <span className="block truncate text-[12px] font-semibold">{location.label}</span>
                        </span>
                      </a>
                    ) : (
                      <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
                        <MapPin className="size-3.5 text-accent" /> {location.label}
                      </p>
                    )
                  ) : null}
                  {(message.kind === "collab" || message.kind === "vanish_ask") ? (
                    <div className="mb-1.5 min-w-[210px] rounded-[12px] border border-[color-mix(in_srgb,var(--accent)_28%,var(--line))] bg-[var(--accent-soft)] px-3 py-2.5">
                      <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-accent">
                        {message.kind === "collab" ? "Collab invite" : "Disappearing request"}
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-[12px] font-semibold leading-5 text-ink">
                        {caption || (message.kind === "collab" ? "A collab invite" : "A disappearing-message request")}
                      </p>
                      {typeof message.payload?.answer === "string" ? (
                        <p className="mt-1 text-[10px] font-bold text-dim">
                          Answered: {String(message.payload.answer)}
                        </p>
                      ) : (
                        <p className="mt-1 text-[10px] font-semibold text-dim">Waiting for an answer</p>
                      )}
                    </div>
                  ) : null}
                  {hasCard ? <SharedCard message={message} onReply={onReply} /> : null}
                  {caption && !hasCard && message.kind !== "collab" && message.kind !== "vanish_ask" ? <p style={{ fontSize: bubbleType(caption) }} className={cn("whitespace-pre-wrap break-words", bubbleType(caption) > 15 && "leading-[1.05]")}>{caption}</p> : null}
                  {caption && hasCard ? <p className="mt-1.5 whitespace-pre-wrap break-words text-[11px] opacity-80">{caption}</p> : null}
                  {!caption && !message.asset && !hasCard && message.kind !== "poll" && !location && message.kind !== "collab" && message.kind !== "vanish_ask" ? <p className="opacity-60">Empty message</p> : null}
                </>
              )}
            </div>
          )}

          {mine && !deleted && (message.failed || message.pending || message.held || receipt) ? (
            <div className="mt-[6px] flex items-center justify-end gap-[5px] pr-1.5 text-[11px]">
              {message.failed ? (
                <button
                  type="button"
                  onClick={onRetry}
                  disabled={!onRetry}
                  className="inline-flex items-center gap-[5px] text-[var(--bad)] transition enabled:hover:underline disabled:opacity-70"
                  title={onRetry ? "Tap to send again" : "Not sent"}
                >
                  <AlertCircle className="size-[11px]" />
                  <span>Not sent</span>
                  {onRetry ? <RotateCcw className="size-[11px]" /> : null}
                </button>
              ) : (
                <>
                  {message.pending || message.held ? <Clock3 className="size-[11px] text-dim" /> : null}
                  <span className="text-dim">
                    {message.pending && typeof progress === "number"
                      ? `Uploading ${progress}%`
                      : receipt}
                  </span>
                </>
              )}
            </div>
          ) : null}

          {message.reactions?.length ? (
            <div className={cn("mt-1 flex flex-wrap gap-1", mine ? "justify-end" : "justify-start")}>
              {message.reactions.map((reaction) => (
                <button
                  key={reaction.emoji}
                  type="button"
                  onClick={() => void onReact(reaction.emoji)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-medium transition",
                    message.my_reaction === reaction.emoji
                      ? "border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[var(--accent-soft)] text-accent"
                      : "border-line bg-card text-dim hover:text-ink",
                  )}
                  aria-label={`React ${reaction.emoji}`}
                >
                  <span>{reaction.emoji}</span>
                  <span className="font-bold tabular-nums">{reaction.count}</span>
                </button>
              ))}
            </div>
          ) : null}
        </MessageGesture>
      </div>
    </div>
  );
}

function PollComposer({
  open,
  onClose,
  onSend,
}: {
  open: boolean;
  onClose: () => void;
  onSend: (question: string, options: string[]) => Promise<void>;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) {
      setQuestion("");
      setOptions(["", ""]);
      setBusy(false);
    }
  }, [open]);

  async function send(event: FormEvent) {
    event.preventDefault();
    const filled = options.map((value) => value.trim()).filter(Boolean);
    if (!question.trim()) {
      toast({ title: "Ask something first", tone: "info" });
      return;
    }
    if (filled.length < 2) {
      toast({ title: "Give the crowd at least two answers", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      await onSend(question.trim(), filled.slice(0, 6));
      onClose();
    } catch (error) {
      toast({ title: "The poll did not send", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Ask the crowd"
      description="One question, and the answers they can pick from."
      footer={<Button type="submit" form="poll-composer" loading={busy} icon={<Send className="size-4" />}>Ask</Button>}
    >
      <form id="poll-composer" onSubmit={(event) => void send(event)} className="space-y-3 p-4">
        <label className="block">
          <span className="mb-1.5 block text-[9.5px] font-extrabold uppercase tracking-[0.12em] text-dim">Question</span>
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What do you want to know?"
            maxLength={140}
            autoFocus
            className="min-h-12 w-full rounded-[15px] border border-line bg-paper px-3.5 text-sm font-semibold outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
          />
        </label>
        <div className="space-y-2">
          {options.map((value, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[10px] font-extrabold text-accent">{index + 1}</span>
              <input
                value={value}
                onChange={(event) => setOptions((current) => current.map((row, rowIndex) => (rowIndex === index ? event.target.value : row)))}
                placeholder={index === 0 ? "First answer" : index === 1 ? "Second answer" : "Another answer"}
                maxLength={80}
                className="min-h-11 flex-1 rounded-[13px] border border-line bg-paper px-3.5 text-[12.5px] outline-none transition focus:border-accent focus:bg-card"
              />
              {options.length > 2 ? (
                <button type="button" onClick={() => setOptions((current) => current.filter((_, row) => row !== index))} className="icon-btn !size-8 text-dim hover:text-[var(--bad)]" aria-label="Remove option">
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          ))}
        </div>
        {options.length < 6 ? (
          <button
            type="button"
            onClick={() => setOptions((current) => [...current, ""])}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 text-[10.5px] font-extrabold text-accent transition hover:brightness-95"
          >
            <Plus className="size-3.5" /> Add an answer
          </button>
        ) : null}
      </form>
    </Modal>
  );
}

function ThreadInfoModal({
  open,
  onClose,
  thread,
  onOptions,
}: {
  open: boolean;
  onClose: () => void;
  thread: ThreadDetail;
  onOptions: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Convo details" size="md">
        <div className="p-4">
          <div
            className="relative overflow-hidden rounded-[20px] border border-line p-4"
            style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card) 66%)" }}
          >
            <span
              className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-35 blur-2xl"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
              aria-hidden
            />
            <div className="relative flex items-center gap-3.5">
              <Avatar user={thread.other ?? thread.members?.[0]?.user} name={thread.title} src={thread.avatar} size={54} online={thread.other?.online} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-extrabold tracking-[-0.2px]">
                  {thread.title || thread.other?.name || thread.other?.username}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-dim">
                  {thread.other?.online ? <span className="size-1.5 rounded-full bg-[var(--good)]" /> : null}
                  {thread.kind === "group"
                    ? `${thread.member_count ?? thread.members?.length ?? 0} members`
                    : thread.other
                      ? `@${thread.other.username}${thread.other.online ? " · online" : ""}`
                      : "Direct convo"}
                </p>
                {thread.vanish_mode && thread.vanish_mode !== "off" ? (
                  <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9px] font-extrabold text-accent">
                    <Clock3 className="size-3" /> {vanishLabel(thread.vanish_mode, thread.vanish_days)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {thread.kind === "group" && thread.members?.length ? (
            <section className="mt-4">
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="flex items-center gap-1.5 text-[11px] font-extrabold">
                  <Users className="size-3.5 text-accent" /> People
                </h3>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-dim">
                  {thread.member_count ?? thread.members.length} in the group
                </span>
              </div>
              <div className="max-h-44 space-y-1 overflow-y-auto rounded-[16px] border border-line p-1.5">
                {thread.members.map((member) => (
                  <Link key={member.user.id} to={`/app/u/${member.user.username}`} className="flex items-center gap-2.5 rounded-[11px] px-2 py-1.5 transition hover:bg-[color-mix(in_srgb,var(--accent)_5%,transparent)]">
                    <Avatar user={member.user} size={32} online={member.user.online} />
                    <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">{member.user.name || member.user.username}</span>
                    <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-dim">{member.role}</span>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={onOptions} icon={<MoreHorizontal className="size-3.5" />}>
              Convo options
            </Button>
          </div>
          <p className="mt-3 rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-3 py-2 text-[9.5px] leading-4 text-dim">
            Mute, pin, the vault, wallpaper, the theme, disappearing messages, and clearing live in options.
          </p>
        </div>
      </Modal>
  );
}

function MessageOptions({
  message,
  open,
  group,
  onClose,
  onChanged,
  onReact,
  onReply,
}: {
  message: Message | null;
  open: boolean;
  group?: boolean;
  onClose: () => void;
  onChanged: () => void;
  onReact: (emoji: string) => Promise<void>;
  onReply: () => void;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setEditing(false);
    setBody(message?.body ?? "");
  }, [message]);

  if (!message) return null;
  const current = message;

  async function edit(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || busy) return;
    setBusy(true);
    try {
      await api.patch(`/chat/threads/${current.thread}/messages/${current.id}/`, { body: body.trim() });
      onChanged();
      onClose();
      toast({ title: "Message edited", tone: "success" });
    } catch (error) {
      toast({ title: "Could not edit that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove(all: boolean) {
    setBusy(true);
    try {
      await api.delete(`/chat/threads/${current.thread}/messages/${current.id}/${all ? "?scope=all" : ""}`);
      onChanged();
      onClose();
      toast({ title: all ? "Removed for everyone" : "Removed from your copy", tone: "success" });
    } catch (error) {
      toast({ title: "That message did not go", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={onClose} title="Message options" size="sm">
      <div className="p-3">
        {editing ? (
          <form onSubmit={(event) => void edit(event)} className="space-y-2.5">
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              autoFocus
              rows={4}
              className="w-full resize-none rounded-[15px] border border-line bg-paper p-3.5 text-sm outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" size="sm" type="button" onClick={() => setEditing(false)}>Cancel</Button>
              <Button size="sm" type="submit" loading={busy}>Save</Button>
            </div>
          </form>
        ) : (
          <div className="space-y-1.5">
            {!message.deleted_for_all ? (
              <div className="mb-1 flex items-center justify-between gap-0.5 rounded-full border border-line bg-card p-1">
                {REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      void onReact(emoji).then(onClose);
                    }}
                    className="flex size-9 items-center justify-center rounded-full text-[19px] transition hover:scale-110 hover:bg-[var(--accent-soft)]"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mb-2 rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[9px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  {message.mine ? "You" : message.sender.name || message.sender.username}
                </p>
                <span className="shrink-0 text-[9px] tabular-nums text-dim">{clock(message.created_at)}</span>
              </div>
              <p className="mt-1 line-clamp-3 text-[12px] leading-5 text-ink">
                {message.body || message.asset?.original_name || `${message.kind} message`}
              </p>
            </div>
            {!message.deleted_for_all ? (
              <button
                type="button"
                onClick={() => {
                  onReply();
                  onClose();
                }}
                className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Reply className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Reply</span>
                  <span className="block text-[10px] text-dim">Answer this message.</span>
                </span>
              </button>
            ) : null}
            {message.body ? (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(message.body).then(
                    () => toast({ title: "Text copied", tone: "success" }),
                    () => toast({ title: "Could not copy", tone: "error" }),
                  );
                }}
                className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Copy className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Copy text</span>
                  <span className="block text-[10px] text-dim">Keep a copy of this message.</span>
                </span>
              </button>
            ) : null}
            {!message.deleted_for_all && !message.pending && !message.failed ? (
              <button
                type="button"
                onClick={() => setForwardOpen(true)}
                className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Forward className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Forward</span>
                  <span className="block text-[10px] text-dim">Send a copy to another convo.</span>
                </span>
              </button>
            ) : null}
            {group && !message.deleted_for_all && !message.pending && !message.failed ? (
              <button
                type="button"
                onClick={() => setInfoOpen(true)}
                className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Info className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Message info</span>
                  <span className="block text-[10px] text-dim">Who received and opened it.</span>
                </span>
              </button>
            ) : null}
            {message.mine && !message.deleted_for_all && message.kind === "text" ? (
              <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><FileText className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Edit message</span>
                  <span className="block text-[10px] text-dim">Fix the words, keep the place.</span>
                </span>
              </button>
            ) : null}
            <button type="button" onClick={() => void remove(false)} disabled={busy} className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-50">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim"><Trash2 className="size-4" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[12px] font-extrabold text-dim">Remove for me</span>
                <span className="block text-[10px] text-dim">Only your copy loses it.</span>
              </span>
            </button>
            {message.mine ? (
              <button type="button" onClick={() => void remove(true)} disabled={busy} className="flex w-full items-center gap-3 rounded-[13px] px-2.5 py-2.5 text-left text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] disabled:opacity-50">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]"><Trash2 className="size-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-extrabold">Remove for everyone</span>
                  <span className="block text-[10px] opacity-75">It disappears from the convo.</span>
                </span>
              </button>
            ) : null}
          </div>
        )}
      </div>
    </Modal>
      <ForwardSheet message={message} open={forwardOpen} onClose={() => setForwardOpen(false)} />
      <MessageInfoSheet message={message} open={infoOpen} onClose={() => setInfoOpen(false)} />
    </>
  );
}

function ForwardSheet({
  message,
  open,
  onClose,
}: {
  message: Message | null;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/"),
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (open) setPicked([]);
  }, [open, message?.id]);

  if (!message) return null;

  const rows = threads.data?.threads ?? [];

  function toggle(id: string) {
    setPicked((current) => (current.includes(id) ? current.filter((row) => row !== id) : [...current, id]));
  }

  async function forward() {
    if (!picked.length || busy) return;
    setBusy(true);
    try {
      const response = await api.post<{ messages: Message[] }>(
        `/chat/threads/${message!.thread}/messages/${message!.id}/forward/`,
        { threads: picked },
      );
      // The server answers with the canonical copies it created.
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      toast({
        title: response.messages?.length === 1 ? "Forwarded" : `Forwarded to ${response.messages?.length ?? picked.length} convos`,
        tone: "success",
      });
      onClose();
    } catch (error) {
      toast({ title: "That forward did not land", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Forward" description="Pick where a copy of this message goes." size="md">
      <div className="p-4">
        <div className="mb-3 rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] px-3 py-2.5">
          <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-dim">
            {message.sender?.name || message.sender?.username || "Message"}
          </p>
          <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-ink">
            {message.body || message.asset?.original_name || `${message.kind} message`}
          </p>
        </div>

        {threads.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="skeleton h-14 rounded-[14px]" />
            ))}
          </div>
        ) : threads.isError ? (
          <ErrorState error={threads.error} onRetry={() => void threads.refetch()} compact />
        ) : !rows.length ? (
          <EmptyState icon={<Forward className="size-6" />} title="No other convos" body="Start a conversation first, then forward this message into it." />
        ) : (
          <div className="max-h-[46dvh] space-y-1 overflow-y-auto rounded-[16px] border border-line p-1.5">
            {rows.map((row) => {
              const face = row.other ?? row.members?.[0]?.user;
              const active = picked.includes(row.id);
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => toggle(row.id)}
                  aria-pressed={active}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-[12px] px-2 py-2 text-left transition",
                    active ? "bg-[var(--accent-soft)]" : "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
                  )}
                >
                  <Avatar user={face} name={row.title} src={row.avatar} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">
                    {row.title || face?.name || face?.username || "Conversation"}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border transition",
                      active ? "border-accent bg-accent text-on-accent" : "border-line text-transparent",
                    )}
                    aria-hidden
                  >
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-4 flex items-center justify-end gap-2">
          <Button variant="secondary" size="sm" type="button" onClick={onClose}>Cancel</Button>
          <Button size="sm" type="button" loading={busy} disabled={!picked.length} onClick={() => void forward()}>
            {picked.length ? `Forward to ${picked.length}` : "Forward"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function MessageInfoSheet({
  message,
  open,
  onClose,
}: {
  message: Message | null;
  open: boolean;
  onClose: () => void;
}) {
  const info = useQuery({
    queryKey: ["message-info", message?.thread, message?.id],
    queryFn: () =>
      api.get<{ seen: { user: UserCard; at: string | null }[]; delivered: { user: UserCard; at: string | null }[]; not_delivered: { user: UserCard; at: string | null }[] }>(
        `/chat/threads/${message!.thread}/messages/${message!.id}/info/`,
      ),
    enabled: open && Boolean(message && !message.pending && !message.failed),
  });

  if (!message) return null;

  const buckets = [
    { key: "seen", label: "Opened", rows: info.data?.seen ?? [] },
    { key: "delivered", label: "Delivered", rows: info.data?.delivered ?? [] },
    { key: "not_delivered", label: "Not delivered yet", rows: info.data?.not_delivered ?? [] },
  ];

  return (
    <Modal open={open} onClose={onClose} title="Message info" description="Who has seen this message, straight from the server." size="sm">
      <div className="p-4">
        {info.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton h-12 rounded-[12px]" />
            ))}
          </div>
        ) : info.isError ? (
          <ErrorState error={info.error} onRetry={() => void info.refetch()} compact />
        ) : (
          <div className="space-y-4">
            {buckets.map((bucket) => (
              <section key={bucket.key}>
                <h3 className="mb-1.5 flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-[0.12em] text-dim">
                  <span>{bucket.label}</span>
                  <span className="tabular-nums">{bucket.rows.length}</span>
                </h3>
                {bucket.rows.length ? (
                  <div className="space-y-1 rounded-[14px] border border-line p-1.5">
                    {bucket.rows.map((item) => (
                      <div key={item.user.id} className="flex items-center gap-2.5 rounded-[10px] px-2 py-1.5">
                        <Avatar user={item.user} size={28} online={item.user.online} />
                        <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">
                          {item.user.name || item.user.username}
                        </span>
                        <span className="shrink-0 text-[10px] tabular-nums text-dim">
                          {item.at ? clock(item.at) : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] px-3 py-2 text-[10.5px] text-dim">
                    {bucket.key === "seen" ? "No one has opened it yet." : bucket.key === "delivered" ? "No one in this group has received it yet." : "Everyone has it."}
                  </p>
                )}
              </section>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function MediaSheet({ threadId, open, onClose }: { threadId: string; open: boolean; onClose: () => void }) {
  const media = useQuery({
    queryKey: ["thread-media", threadId],
    queryFn: () => api.get<{ messages: Message[] }>(`/chat/threads/${threadId}/media/`, { query: { kinds: "image,video,voice,audio,doc" } }),
    enabled: open,
  });
  return (
    <Modal open={open} onClose={onClose} title="Media and files" description="Everything shared in this convo, in one place." size="lg">
      <div className="p-4">
        {media.isLoading ? (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
            {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
              <div key={row} className="skeleton aspect-square rounded-[14px]" />
            ))}
          </div>
        ) : media.isError ? (
          <ErrorState error={media.error} onRetry={() => void media.refetch()} compact />
        ) : !media.data?.messages?.length ? (
          <EmptyState icon={<ImageIcon className="size-6" />} title="Nothing shared yet" body="Pictures, clips, voice notes and files will collect here." />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between px-1">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-dim">Shared here</p>
              <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[9.5px] font-bold text-dim">
                {media.data.messages.length}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {media.data.messages.map((message) => (
                <div key={message.id} className="group relative aspect-square overflow-hidden rounded-[14px] border border-line bg-paper">
                  {message.asset?.kind === "image" && message.asset.content_url ? (
                    <AuthedImage src={message.asset.thumbnail_url || message.asset.content_url} alt="" className="h-full w-full transition duration-300 group-hover:scale-[1.03]" />
                  ) : message.asset?.kind === "video" && message.asset.content_url ? (
                    <AuthedVideo src={message.asset.content_url} className="h-full w-full" controls />
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-1.5 p-2 text-center">
                      <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                        <FileText className="size-4" />
                      </span>
                      <span className="line-clamp-2 text-[8.5px] font-semibold text-dim">{message.asset?.original_name || message.body || message.asset?.kind}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

export function ChatPage() {
  const { threadId = "" } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { status: socketStatus, send: sendSocket } = useSocket();
  const queryClient = useQueryClient();
  const cache = useMessageCache(threadId);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [attachment, setAttachment] = useState<{ file: File; kind: string; preview?: string } | null>(null);
  const [sending, setSending] = useState(0);
  const [uploadPercent, setUploadPercent] = useState<Record<string, number>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [selected, setSelected] = useState<Message | null>(null);
  const [sparkView, setSparkView] = useState<Message[] | null>(null);
  const [typers, setTypers] = useState<Record<string, string>>({});
  const [receipts, setReceipts] = useState<Record<string, ReceiptMark>>({});
  const [voiceRecorderOpen, setVoiceRecorderOpen] = useState(false);
  const [channel, setChannel] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(false);
  const lastThread = useRef("");
  const attachmentPreview = useRef<string | null>(null);
  const typingTimer = useRef<number | null>(null);
  const olderAnchor = useRef<{ height: number; top: number } | null>(null);
  const olderPending = useRef(false);
  const { styled, chatBackdrop } = useTheme();

  const threadQuery = useQuery({
    queryKey: ["thread", threadId],
    queryFn: () => api.get<{ thread: ThreadDetail; catalog?: unknown }>(`/chat/threads/${threadId}/`),
    enabled: Boolean(threadId),
    staleTime: 15_000,
  });
  const messages = useInfiniteQuery({
    queryKey: ["messages", threadId],
    queryFn: ({ pageParam }) =>
      api.get<Page<Message>>(pageParam ?? `/chat/threads/${threadId}/messages/`),
    initialPageParam: `/chat/threads/${threadId}/messages/` as string | null,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(threadId),
  });

  const thread = threadQuery.data?.thread;
  const accent = tintHex(thread?.tint);
  const wallpaper = wallUrl(thread?.wallpaper);
  const opacity = wallpaperOpacity();
  /**
   * What the inside of a chat stands on when nobody has chosen a wallpaper for
   * it: the theme's own picture of this page.
   *
   * It is the *last* answer and not the first, which is the app's ordering and
   * the whole reason a convo's own choice survives a theme change — a wallpaper
   * somebody picked, a photograph they took and a theme's drawing all compete
   * for one ground, and the app settles it in that order (`screens/chat.dart`,
   * the `wallpaper == null` branch).
   */
  const themeWall = wallpaper ? null : chatBackdrop;
  /**
   * Whether the theme stands on a picture anywhere at all.
   *
   * This and not "does this page have one", because it is what the app's
   * `X.pageGround` asks: a theme with any art at all is read with a *clear*
   * ground, so its bars are transparent over whatever is behind them and the
   * picture reaches the top and bottom edges of the phone. A theme of colours
   * keeps its own opaque ink there.
   */
  const painting =
    Object.keys(styled.art).length > 0 ||
    Boolean(styled.chatWall || styled.profileWall || styled.coverArt);
  /** The chat's bars: the page's own ink, or glass over the picture the page stands on. */
  const bar = painting
    ? "bg-[color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur-xl"
    : "bg-page";

  useEffect(() => {
    if (!thread || searchParams.get("info") !== "1") return;
    setInfoOpen(true);
    const copy = new URLSearchParams(searchParams);
    copy.delete("info");
    setSearchParams(copy, { replace: true });
  }, [thread, searchParams, setSearchParams]);
  const allMessages = useMemo(() => {
    const seen = new Set<string>();
    return (messages.data?.pages ?? [])
      .flatMap((page) => page.results)
      .filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      })
      .sort((a, b) => {
        // Server pages arrive newest-first; render ascending. Optimistic rows
        // have no ordinal yet, so they must sit at the end, not the top.
        const ao = a.ordinal ?? Number.MAX_SAFE_INTEGER;
        const bo = b.ordinal ?? Number.MAX_SAFE_INTEGER;
        if (ao !== bo) return ao - bo;
        return Date.parse(a.created_at) - Date.parse(b.created_at);
      });
  }, [messages.data]);
  const visibleMessages = channel ? allMessages.filter((message) => message.channel === channel) : allMessages;
  const latestOrdinal = allMessages.reduce((max, message) => Math.max(max, message.ordinal ?? 0), 0);
  const hasOlder = messages.hasNextPage;
  const fetchOlder = messages.fetchNextPage;

  useEffect(() => {
    setText(readDraft(threadId));
    setReplyTo(null);
    setAttachment(null);
    setSelected(null);
    setSparkView(null);
    setAttachOpen(false);
    setEmojiOpen(false);
    setChannel(null);
    setReceipts({});
    setTypers({});
    setSheetOpen(false);
    setInfoOpen(false);
    firstScroll.current = false;
    lastThread.current = threadId;
  }, [threadId]);

  useEffect(() => {
    if (socketStatus !== "live" || !threadId) return;
    sendSocket({ action: "subscribe", thread: threadId, fresh: true });
    return () => {
      sendSocket({ action: "unsubscribe", thread: threadId });
      sendSocket({ action: "away", thread: threadId });
    };
  }, [threadId, socketStatus, sendSocket]);

  useEffect(() => {
    if (!allMessages.length) return;
    const element = scrollRef.current;
    if (!element) return;
    const initial = !firstScroll.current;
    const near = element.scrollHeight - element.scrollTop - element.clientHeight < 280;
    if (initial || near) {
      window.requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: initial ? "auto" : "smooth", block: "end" });
      });
      firstScroll.current = true;
    }
  }, [allMessages.length, threadId]);

  useEffect(() => {
    if (!latestOrdinal) return;
    const timer = window.setTimeout(() => {
      void api.post(`/chat/threads/${threadId}/read/`, { ordinal: latestOrdinal }).catch(() => undefined);
      if (socketStatus === "live") sendSocket({ action: "read", thread: threadId, ordinal: latestOrdinal });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [latestOrdinal, threadId, socketStatus, sendSocket]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const onScroll = () => {
      setShowJump(element.scrollHeight - element.scrollTop - element.clientHeight > 600);
      if (element.scrollTop > 240 || !hasOlder || olderPending.current) return;
      olderAnchor.current = { height: element.scrollHeight, top: element.scrollTop };
      olderPending.current = true;
      void fetchOlder().finally(() => {
        olderPending.current = false;
      });
    };
    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, [hasOlder, fetchOlder]);

  useEffect(() => {
    const anchor = olderAnchor.current;
    const element = scrollRef.current;
    if (!anchor || !element) return;
    window.requestAnimationFrame(() => {
      const row = scrollRef.current;
      if (!row) return;
      row.scrollTop = row.scrollHeight - anchor.height + anchor.top;
      olderAnchor.current = null;
    });
  }, [allMessages.length]);

  useEffect(() => {
    if (!text.trim() || socketStatus !== "live") return;
    sendSocket({ action: "typing", thread: threadId, typing: true });
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      sendSocket({ action: "typing", thread: threadId, typing: false });
    }, 2400);
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
  }, [text, threadId, socketStatus, sendSocket]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
      if (attachmentPreview.current) URL.revokeObjectURL(attachmentPreview.current);
    };
  }, []);

  useSocketEvent(
    ["message.new", "message.edit", "message.gone", "message.react", "message.poll", "thread.typing", "thread.read", "thread.update", "thread.members", "thread.channels"],
    (frame) => {
      const data = (frame.data ?? {}) as Record<string, unknown>;
      const incomingThread = String(data.thread_id ?? data.id ?? "");
      if (incomingThread && incomingThread !== threadId) return;
      if (frame.event === "message.new") {
        const message = data.message as Message | undefined;
        if (message) {
          cache.insert(message);
          if (!message.mine && document.visibilityState === "visible") {
            void api.post(`/chat/threads/${threadId}/read/`, { ordinal: message.ordinal }).catch(() => undefined);
          }
        }
      } else if (frame.event === "message.edit") {
        const message = data.message as Message | undefined;
        if (message) cache.insert(message);
      } else if (frame.event === "message.gone") {
        const ids = (data.message_ids as string[] | undefined) ?? [];
        cache.remove(ids);
      } else if (frame.event === "message.react") {
        cache.patch(String(data.message_id), {
          reactions: data.reactions as Message["reactions"],
          my_reaction: data.user_id === user?.id ? (data.emoji as string | null) : undefined,
        });
      } else if (frame.event === "message.poll") {
        cache.patch(String(data.message_id), { poll: data.poll as MessagePoll });
      } else if (frame.event === "thread.typing") {
        const userId = String(data.user_id ?? "");
        if (!userId || userId === user?.id) return;
        const name = thread?.members?.find((member) => member.user.id === userId)?.user.name || "Someone";
        if (data.typing) {
          setTypers((current) => ({ ...current, [userId]: name }));
          window.setTimeout(() => {
            setTypers((current) => {
              const next = { ...current };
              delete next[userId];
              return next;
            });
          }, Number(data.ttl ?? 5) * 1000);
        } else {
          setTypers((current) => {
            const next = { ...current };
            delete next[userId];
            return next;
          });
        }
      } else if (frame.event === "thread.read") {
        // Honest receipts: the server tells us this seat's delivered/read
        // watermark. Store it both in local state (immediate) and in the
        // thread cache (so a remount still renders the same word).
        const userId = String(data.user_id ?? "");
        if (!userId || userId === user?.id) return;
        const delivered = typeof data.delivered === "number" ? data.delivered : undefined;
        const read = typeof data.read === "number" ? data.read : undefined;
        setReceipts((current) => ({
          ...current,
          [userId]: {
            delivered: delivered ?? current[userId]?.delivered,
            read: read ?? current[userId]?.read,
          },
        }));
        queryClient.setQueryData<{ thread: ThreadDetail; catalog?: unknown }>(
          ["thread", threadId],
          (current) => {
            if (!current?.thread) return current;
            const members = (current.thread.members ?? []).map((seat) =>
              seat.user?.id === userId
                ? {
                    ...seat,
                    last_delivered_ordinal: delivered ?? seat.last_delivered_ordinal,
                    last_read_ordinal: read ?? seat.last_read_ordinal,
                  }
                : seat,
            );
            return { ...current, thread: { ...current.thread, members } };
          },
        );
      } else if (frame.event === "thread.update" || frame.event === "thread.members" || frame.event === "thread.channels") {
        void queryClient.invalidateQueries({ queryKey: ["thread", threadId] });
      }
    },
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (selected) setSelected(null);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selected]);

  function clearAttachment() {
    if (attachmentPreview.current) URL.revokeObjectURL(attachmentPreview.current);
    attachmentPreview.current = null;
    setAttachment(null);
  }

  function chooseFile(file: File) {
    clearAttachment();
    const preview = file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : undefined;
    attachmentPreview.current = preview ?? null;
    const kind = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : file.type.startsWith("audio/")
          ? "audio"
          : "doc";
    setAttachment({ file, kind, preview });
  }

  function handleVoiceRecorded(file: File) {
    chooseFile(file);
    setVoiceRecorderOpen(false);
  }

  function handleVoiceCancel() {
    setVoiceRecorderOpen(false);
  }

  const outbox = useRef<Map<string, OutgoingSend>>(new Map());

  async function deliver(intent: OutgoingSend) {
    const { clientId, localId, kind, body, replyToId, payload, file } = intent;
    setSending((count) => count + 1);
    try {
      let assetId = intent.assetId;
      if (file && !assetId) {
        setUploadPercent((current) => ({ ...current, [clientId]: 0 }));
        const asset = await uploadAsset(file.file, {
          kind: file.kind === "voice" ? "voice" : file.kind === "image" ? "image" : file.kind === "video" ? "video" : file.kind === "audio" ? "audio" : "doc",
          voice: file.kind === "voice",
          onProgress: (percent) =>
            setUploadPercent((current) => ({ ...current, [clientId]: percent })),
        });
        assetId = asset.id;
        intent.assetId = asset.id;
        // Show the real uploaded asset while the message row lands.
        cache.patch(localId, { asset });
      }
      const response = await api.post<{ message: Message }>(`/chat/threads/${threadId}/messages/send/`, {
        kind,
        body,
        reply_to: replyToId,
        asset: assetId,
        payload,
        channel: intent.channel ?? undefined,
        client_id: clientId,
      });
      outbox.current.delete(clientId);
      cache.insert(response.message);
      if (file?.preview) URL.revokeObjectURL(file.preview);
      return true;
    } catch (error) {
      cache.markFailed(localId);
      toast({ title: "Your message did not send", description: errorMessage(error), tone: "error" });
      return false;
    } finally {
      setSending((count) => Math.max(0, count - 1));
      setUploadPercent((current) => {
        if (!(clientId in current)) return current;
        const next = { ...current };
        delete next[clientId];
        return next;
      });
    }
  }

  function retrySend(clientId: string) {
    const intent = outbox.current.get(clientId);
    if (!intent) return;
    cache.patch(intent.localId, { pending: true, failed: false });
    void deliver(intent);
  }

  async function sendMessage(options: { kind?: string; body?: string; payload?: Record<string, unknown>; file?: { file: File; kind: string; preview?: string } | null } = {}) {
    const body = (options.body ?? text).trim();
    const file = options.file === undefined ? attachment : options.file;
    const kind = options.kind ?? file?.kind ?? "text";
    if (!body && !file) return;

    const clientId = crypto.randomUUID();
    const localId = `local-${clientId}`;
    const intent: OutgoingSend = {
      clientId,
      localId,
      kind,
      body,
      replyToId: replyTo?.id ?? undefined,
      payload: options.payload,
      channel: channel ?? null,
      file: file ? { file: file.file, kind: file.kind, preview: file.preview } : undefined,
    };
    outbox.current.set(clientId, intent);

    const preview = file?.preview;
    const showsPreview = Boolean(preview && (file?.kind === "image" || file?.kind === "video"));
    const now = new Date().toISOString();
    const local: Message = {
      id: localId,
      thread: threadId,
      channel: channel ?? null,
      kind,
      body,
      sender: (user ?? thread?.other ?? { id: "me", name: "You", username: "you" }) as Message["sender"],
      mine: true,
      reply_to: replyTo
        ? {
            id: replyTo.id,
            kind: replyTo.kind,
            body: replyTo.body,
            sender: {
              id: replyTo.sender?.id ?? "",
              name: replyTo.sender?.name ?? replyTo.sender?.username ?? "",
            },
            deleted_for_all: replyTo.deleted_for_all,
          }
        : null,
      asset: showsPreview && preview
        ? {
            id: localId,
            kind,
            content_url: preview,
            thumbnail_url: preview,
            original_name: file?.file.name,
            mime: file?.file.type,
            size: file?.file.size,
          }
        : undefined,
      payload: options.payload ?? null,
      pending: true,
      created_at: now,
      updated_at: now,
      client_id: clientId,
    };
    cache.insertLocal(local);

    // The composer clears immediately; the bubble itself carries the state.
    setText("");
    writeDraft(threadId, "");
    setEmojiOpen(false);
    setReplyTo(null);
    if (file && attachmentPreview.current === preview && preview) {
      // The optimistic bubble now owns this object URL; revoke it when the
      // real upload replaces the row, not here.
      attachmentPreview.current = null;
      setAttachment(null);
    } else {
      clearAttachment();
    }
    window.requestAnimationFrame(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }));

    await deliver(intent);
  }

  async function replyToSpark(look: Message, body: string) {
    try {
      const response = await api.post<{ message: Message }>(`/chat/threads/${threadId}/messages/send/`, {
        kind: "text",
        body,
        reply_to: look.id,
        client_id: crypto.randomUUID(),
      });
      cache.insert(response.message);
      return true;
    } catch (error) {
      toast({ title: "Your reply did not send", description: errorMessage(error), tone: "error" });
      return false;
    }
  }

  async function sendPoll(question: string, options: string[]) {
    await sendMessage({
      kind: "poll",
      body: question,
      payload: { question, options },
      file: null,
    });
  }

  async function react(message: Message, emoji: string) {
    if (message.pending || message.failed) return;
    try {
      const response = await api.post<{ emoji: string | null; reactions: Message["reactions"] }>(
        `/chat/threads/${threadId}/messages/${message.id}/react/`,
        { emoji },
      );
      cache.patch(message.id, { reactions: response.reactions, my_reaction: response.emoji });
    } catch (error) {
      toast({ title: "That reaction did not land", description: errorMessage(error), tone: "error" });
    }
  }

  async function vote(message: Message, choice: number) {
    if (message.pending || message.failed) return;
    try {
      const response = await api.post<{ poll: MessagePoll }>(
        `/chat/threads/${threadId}/messages/${message.id}/vote/`,
        { choice },
      );
      cache.patch(message.id, { poll: response.poll });
    } catch (error) {
      toast({ title: "Your vote did not land", description: errorMessage(error), tone: "error" });
    }
  }

  function openSpark(message: Message) {
    // Every Spark in this thread from the one tapped onward, oldest first. Mine
    // is not mine to look at, an opened one has nothing behind it any more, and
    // one whose bytes are gone has nothing to fetch. Anything above the tap is
    // left alone: opening a later Spark never spends an earlier one.
    const run = allMessages
      .filter(
        (row) =>
          isSparkMessage(row) &&
          !(user?.id ? row.sender?.id === user.id : row.mine) &&
          row.payload?.opened_at == null &&
          Boolean(row.asset?.content_url),
      )
      .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    const start = run.findIndex((row) => row.id === message.id);
    setSparkView(start >= 0 ? run.slice(start) : [message]);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (voiceRecorderOpen) {
      setVoiceRecorderOpen(false);
      return;
    }
    void sendMessage();
  }

  function scrollToBottom() {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    setShowJump(false);
  }

  function refreshThread() {
    void threadQuery.refetch();
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    void queryClient.invalidateQueries({ queryKey: ["vault"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
  }

  const title = thread ? thread.title || thread.other?.name || thread.other?.username || "Convo" : "Convo";
  const face = thread?.other ?? thread?.members?.[0]?.user;
  const typingNames = Object.values(typers);

  if (threadQuery.isLoading) {
    return (
      <div className="flex h-[calc(100dvh-57px)] items-center justify-center md:h-dvh">
        <Spinner className="size-7" />
      </div>
    );
  }
  if (threadQuery.isError || !thread) {
    return (
      <div className="mx-auto max-w-lg p-5">
        <div className="card">
          <ErrorState error={threadQuery.error ?? new Error("This convo is not available.")} onRetry={() => void threadQuery.refetch()} />
          <div className="flex justify-center pb-5"><Button variant="secondary" onClick={() => navigate("/app/convo")}>Back to Convo</Button></div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative isolate flex h-[calc(100dvh-57px)] flex-col overflow-hidden bg-page md:h-dvh"
      style={
        {
          ...(accent ? { "--accent": accent } : {}),
          ...(wallpaper
            ? { backgroundImage: `url("${wallpaper}")`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
        } as React.CSSProperties
      }
    >
      {/* The theme's own picture of this page, under everything and over the
          page's flat ground — the same slot, and the same negative stack level,
          as the wash the picked wallpaper is read through below. `isolate` on
          the page above is what keeps it under the thread rather than over it. */}
      <Backdrop backdrop={themeWall} position="absolute" />
      {wallpaper ? (
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundColor: "rgb(0 0 0)",
            opacity: 1 - opacity,
          }}
          aria-hidden="true"
        />
      ) : null}
      <header
        className={cn(
          "z-30 flex shrink-0 items-center gap-2 border-b border-line px-3 py-2 md:px-5",
          bar,
        )}
      >
        <button type="button" onClick={() => navigate("/app/convo")} className="icon-btn -ml-1 md:hidden" aria-label="Back to convos">
          <ArrowLeft className="size-5" />
        </button>
        <Link
          to={face ? `/app/u/${face.username}` : "#"}
          className="flex min-w-0 flex-1 items-center gap-2.5 py-0.5 pr-2 transition hover:opacity-90"
        >
          <span className="relative shrink-0">
            <Avatar user={face} name={title} src={thread.avatar} size={36} />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-[4px]">
              <span className="truncate text-[16px] font-bold tracking-[-0.2px]">{title}</span>
              {thread.kind !== "group" && face?.verified ? (
                <BadgeCheck className="size-[15px] shrink-0 fill-[#1D9BF0] text-white" strokeWidth={2.5} aria-label="Verified" />
              ) : null}
              {thread.vaulted ? <Lock className="size-3 text-dim" aria-label="Vaulted" /> : null}
            </span>
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-0.5">
          {thread.kind !== "group" ? (
            <>
              <button type="button" className="icon-btn" onClick={() => toast({ title: "Calls are not on the web yet", tone: "info" })} aria-label="Audio call" title="Audio call">
                <Phone className="size-[19px]" />
              </button>
              <button type="button" className="icon-btn" onClick={() => toast({ title: "Calls are not on the web yet", tone: "info" })} aria-label="Video call" title="Video call">
                <Video className="size-[20px]" />
              </button>
            </>
          ) : null}
          <button type="button" className="icon-btn" onClick={() => setSheetOpen(true)} aria-label="Convo options" title="Convo options">
            <MoreHorizontal className="size-[20px]" />
          </button>
        </div>
      </header>

      {thread.channels?.length ? (
        <div className="no-scrollbar flex shrink-0 items-center gap-1.5 overflow-x-auto border-b border-line bg-[color-mix(in_srgb,var(--card)_70%,transparent)] px-3 py-2 backdrop-blur">
          <button
            type="button"
            onClick={() => setChannel(null)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold transition",
              channel === null
                ? "bg-accent text-on-accent shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                : "bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)] text-dim hover:text-ink",
            )}
          >
            All rooms
          </button>
          {thread.channels.map((room) => (
            <button
              key={room.id}
              type="button"
              onClick={() => setChannel(room.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold transition",
                channel === room.id
                  ? "bg-accent text-on-accent shadow-[0_3px_9px_color-mix(in_srgb,var(--accent)_22%,transparent)]"
                  : "bg-[color-mix(in_srgb,var(--ink)_4.5%,transparent)] text-dim hover:text-ink",
              )}
            >
              # {room.name}
            </button>
          ))}
        </div>
      ) : null}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto scroll-area px-3 py-4 md:px-6">
        <div className="mx-auto max-w-[820px]">
          {messages.isLoading ? (
            <div className="space-y-5 py-8" aria-hidden>
              {[0, 1, 2, 3, 4].map((row) => (
                <div key={row} className={cn("flex", row % 2 ? "justify-end" : "justify-start")}>
                  <div
                    className={cn("skeleton rounded-[18px]", row % 2 ? "h-11 w-44 rounded-br-[6px]" : "h-14 w-64 rounded-bl-[6px]")}
                  />
                </div>
              ))}
            </div>
          ) : messages.isError ? (
            <ErrorState error={messages.error} onRetry={() => void messages.refetch()} compact />
          ) : !visibleMessages.length ? (
            <div className="flex min-h-[42dvh] items-center justify-center">
              <div className="flex w-full max-w-[360px] flex-col items-center rounded-[24px] border border-line bg-card px-7 py-9 text-center shadow-[0_10px_30px_rgba(17,17,26,0.05)]">
                <span className="flex size-14 items-center justify-center rounded-[20px] bg-[var(--accent-soft)] text-accent">
                  <MessageCircle className="size-6" />
                </span>
                <h3 className="mt-4 text-[15px] font-extrabold tracking-tight">No messages in this room</h3>
                <p className="mt-1.5 text-[11.5px] leading-5 text-dim">
                  {thread.other ? `Say the first thing to ${thread.other.name || thread.other.username}.` : "The conversation starts here."}
                </p>
              </div>
            </div>
          ) : (
            <>
              {thread.vanish_mode && thread.vanish_mode !== "off" ? (
                <div className="flex justify-center pb-3.5 pt-1.5">
                  <div className="flex items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_40%,transparent)] bg-card py-1.5 pl-[11px] pr-3 text-[10.5px] font-semibold text-accent">
                    <Clock3 className="size-3" />
                    Disappearing convo · {vanishLabel(thread.vanish_mode, thread.vanish_days)}
                  </div>
                </div>
              ) : null}
              {messages.isFetchingNextPage ? (
                <div className="flex justify-center py-2">
                  <Spinner className="size-4" />
                </div>
              ) : null}
              {visibleMessages.map((message, index) => {
                const previous = visibleMessages[index - 1];
                const showDay = !previous || new Date(previous.created_at).toDateString() !== new Date(message.created_at).toDateString();
                const mineRow = user?.id ? message.sender?.id === user.id : Boolean(message.mine);
                const aboveMine = previous ? (user?.id ? previous.sender?.id === user.id : Boolean(previous.mine)) : mineRow;
                const distance = !previous || showDay ? 4 : aboveMine !== mineRow || Math.abs(new Date(message.created_at).getTime() - new Date(previous.created_at).getTime()) > 300_000 ? 10 : 2;
                // A group names the speaker at the head of a run, never on each
                // line of it — the same three breaks the spacing is drawn around.
                const showSender =
                  !mineRow &&
                  thread.kind === "group" &&
                  (!previous ||
                    showDay ||
                    previous.sender?.id !== message.sender?.id ||
                    Math.abs(new Date(message.created_at).getTime() - new Date(previous.created_at).getTime()) > 300_000);
                return (
                  <div key={message.id} style={{ marginTop: showDay ? 0 : distance }}>
                    {showDay ? (
                      <div className="flex justify-center pb-3 pt-2.5">
                        <span className="rounded-full border border-line bg-card px-[11px] py-[5px] text-[11px] font-semibold tracking-[0.2px] text-dim">
                          {chatDay(message.created_at)}
                        </span>
                      </div>
                    ) : null}
                    <MessageBubble
                      message={message}
                      meId={user?.id}
                      showSender={showSender}
                      receipt={mineRow ? receiptWord(message, thread, user?.id, receipts) : ""}
                      onReply={() => {
                        setReplyTo(message);
                        window.setTimeout(() => document.getElementById("chat-input")?.focus(), 20);
                      }}
                      onReact={(emoji) => react(message, emoji)}
                      onOptions={() => setSelected(message)}
                      onVote={(choice) => vote(message, choice)}
                      onOpenSpark={() => openSpark(message)}
                      onRetry={message.failed && message.client_id ? () => retrySend(message.client_id!) : undefined}
                      progress={message.client_id ? uploadPercent[message.client_id] : undefined}
                    />
                  </div>
                );
              })}
              <div ref={bottomRef} className="h-2" />
            </>
          )}
        </div>
      </div>

      {showJump ? (
        <button
          type="button"
          onClick={scrollToBottom}
          className="absolute bottom-28 right-4 z-20 flex size-10 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--accent)_18%,var(--line))] bg-card text-accent shadow-[0_6px_20px_rgba(17,17,26,0.12)] transition hover:-translate-y-0.5"
          aria-label="Jump to latest"
        >
          <ChevronDown className="size-4" />
        </button>
      ) : null}

      <div
        className={cn(
          "relative shrink-0 border-t border-line px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 md:px-3",
          bar,
        )}
      >
        <div className="mx-auto max-w-[820px]">
          {typingNames.length ? (
            <p className="flex items-center gap-1.5 px-3 pb-1.5 text-[10px] font-semibold text-accent">
              <span className="flex gap-0.5">
                {[0, 1, 2].map((dot) => (
                  <span key={dot} className="size-1 animate-pulse rounded-full bg-accent" style={{ animationDelay: `${dot * 140}ms` }} />
                ))}
              </span>
              {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing…
            </p>
          ) : null}
          {replyTo ? (
            <div className="mb-2 flex items-center gap-2.5 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_14%,var(--line))] bg-[var(--accent-soft)] px-3 py-2">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-accent">
                <Reply className="size-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[9.5px] font-extrabold text-accent">Replying to {replyTo.sender.name || replyTo.sender.username}</p>
                <p className="truncate text-[10.5px] text-dim">{replyTo.body || replyTo.asset?.original_name || replyTo.kind}</p>
              </div>
              <button type="button" onClick={() => setReplyTo(null)} className="icon-btn !size-7 text-dim hover:text-ink" aria-label="Cancel reply"><X className="size-3.5" /></button>
            </div>
          ) : null}
          {attachment ? (
            <div className="mb-2 flex items-center gap-2.5 rounded-[14px] border border-line bg-card p-2 shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
              {attachment.preview && attachment.kind === "image" ? (
                <img src={attachment.preview} alt="" className="size-12 rounded-[10px] object-cover" />
              ) : attachment.preview && attachment.kind === "video" ? (
                <video src={attachment.preview} className="size-12 rounded-[10px] object-cover" muted />
              ) : (
                <span className="flex size-11 items-center justify-center rounded-[10px] bg-[var(--accent-soft)] text-accent">
                  {attachment.kind === "voice" || attachment.kind === "audio" ? <Volume2 className="size-4" /> : <FileText className="size-4" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-bold">{attachment.file.name}</p>
                <p className="text-[9.5px] text-dim">
                  {Math.max(1, Math.round(attachment.file.size / 1024))} KB · ready to send
                </p>
              </div>
              <button type="button" onClick={clearAttachment} className="icon-btn !size-8" aria-label="Remove attachment"><X className="size-4" /></button>
            </div>
          ) : null}
          {voiceRecorderOpen ? (
            <VoiceRecorder onVoiceRecorded={handleVoiceRecorded} onCancel={handleVoiceCancel} />
          ) : null}
          {emojiOpen ? (
            <div className="absolute bottom-[62px] left-3 z-30 grid w-[232px] grid-cols-6 gap-1 rounded-[16px] border border-line bg-card p-2 shadow-[0_12px_34px_rgba(17,17,26,0.16)]">
              {COMPOSER_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="flex size-8 items-center justify-center rounded-[9px] text-[19px] transition hover:bg-[var(--accent-soft)]"
                  onClick={() => {
                    const next = `${text}${emoji}`;
                    setText(next);
                    writeDraft(threadId, next);
                    setEmojiOpen(false);
                    window.setTimeout(() => document.getElementById("chat-input")?.focus(), 20);
                  }}
                  aria-label={`Add ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="flex items-end gap-2">
            <input
              ref={fileInput}
              type="file"
              accept="image/*,video/*,audio/*,application/pdf,.doc,.docx,.txt"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) chooseFile(file);
                event.target.value = "";
              }}
            />
            {!voiceRecorderOpen ? (
              <div className="relative shrink-0">
                <button
                  type="button"
                  className="flex size-[40px] items-center justify-center rounded-full text-accent transition hover:bg-[var(--accent-soft)]"
                  onClick={() => setAttachOpen((value) => !value)}
                  aria-label="Add attachment"
                  aria-expanded={attachOpen}
                >
                  <CirclePlus className="size-[27px]" strokeWidth={1.8} />
                </button>
                {attachOpen ? (
                <div className="absolute bottom-[52px] left-0 z-30 w-48 rounded-[16px] border border-line bg-card p-1.5 shadow-[0_12px_34px_rgba(17,17,26,0.16)]">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-[var(--accent-soft)]"
                    onClick={() => {
                      setAttachOpen(false);
                      fileInput.current?.click();
                    }}
                  >
                    <FileText className="size-4 text-accent" /> Photo or file
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-[var(--accent-soft)]"
                    onClick={() => {
                      setAttachOpen(false);
                      setCameraOpen(true);
                    }}
                  >
                    <Sparkles className="size-4 text-accent" /> Spark
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-[var(--accent-soft)]"
                    onClick={() => {
                      setAttachOpen(false);
                      setPollOpen(true);
                    }}
                  >
                    <Users className="size-4 text-accent" /> Ask the crowd
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2.5 rounded-[11px] px-2.5 py-2 text-left text-[12px] font-semibold transition hover:bg-[var(--accent-soft)]"
                    onClick={() => {
                      setAttachOpen(false);
                      setEmojiOpen(true);
                    }}
                  >
                    <Smile className="size-4 text-accent" /> Emoji
                  </button>
                </div>
                ) : null}
              </div>
            ) : null}
            <textarea
              id="chat-input"
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                writeDraft(threadId, event.target.value);
                const element = event.currentTarget;
                element.style.height = "auto";
                element.style.height = `${Math.min(120, element.scrollHeight)}px`;
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void sendMessage();
                }
              }}
              rows={1}
              maxLength={8000}
              placeholder="Say something"
              className="max-h-[120px] min-h-[44px] flex-1 resize-none rounded-[22px] border border-line bg-card px-4 py-[11px] text-[15px] leading-5 text-ink outline-none transition placeholder:text-dim focus:border-[1.5px] focus:border-accent"
            />
            <button
              type={voiceRecorderOpen || (!text.trim() && !attachment) ? "button" : "submit"}
              onClick={
                voiceRecorderOpen
                  ? () => setVoiceRecorderOpen(false)
                  : !text.trim() && !attachment
                    ? () => setVoiceRecorderOpen(true)
                    : undefined
              }
              disabled={sending > 0 && !text.trim() && !attachment}
              className="flex size-[46px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:brightness-105 active:scale-95 disabled:opacity-40"
              aria-label={voiceRecorderOpen ? "Cancel voice note" : (!text.trim() && !attachment ? "Record a voice note" : "Send message")}
            >
              {sending ? <Spinner className="size-4 text-on-accent" /> : voiceRecorderOpen ? <Pause className="size-[22px] fill-current" /> : (!text.trim() && !attachment) ? <Mic className="size-6" /> : (thread?.vanish_mode && thread.vanish_mode !== "off" ? <Clock3 className="size-[21px] fill-current" /> : <ArrowUp className="size-5" strokeWidth={2.6} />)}
            </button>
          </form>
        </div>
      </div>

      <ConvoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        thread={thread}
        kind="convo"
        onChanged={refreshThread}
        onGone={() => {
          void queryClient.invalidateQueries({ queryKey: ["threads"] });
          void queryClient.invalidateQueries({ queryKey: ["vault"] });
          void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
          navigate("/app/convo");
        }}
        onGroupSettings={() => {
          setSheetOpen(false);
          setInfoOpen(true);
        }}
        onMedia={() => {
          setSheetOpen(false);
          setMediaOpen(true);
        }}
      />
      <ThreadInfoModal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        thread={thread}
        onOptions={() => {
          setInfoOpen(false);
          setSheetOpen(true);
        }}
      />
      <MediaSheet threadId={threadId} open={mediaOpen} onClose={() => setMediaOpen(false)} />
      <SparkViewer
        looks={sparkView ?? []}
        threadId={threadId}
        onClose={() => setSparkView(null)}
        onSpent={(updated) => cache.insert(updated)}
        onReply={replyToSpark}
      />
      <Suspense fallback={null}>
        {cameraOpen ? (
          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            fromChat={true}
            onPosted={() => {
              void queryClient.invalidateQueries({ queryKey: ["messages", threadId] });
              void queryClient.invalidateQueries({ queryKey: ["threads"] });
            }}
          />
        ) : null}
      </Suspense>
      <PollComposer open={pollOpen} onClose={() => setPollOpen(false)} onSend={sendPoll} />
      <MessageOptions
        message={selected}
        open={Boolean(selected)}
        group={thread.kind === "group"}
        onClose={() => setSelected(null)}
        onChanged={() => void messages.refetch()}
        onReact={(emoji) => (selected ? react(selected, emoji) : Promise.resolve())}
        onReply={() => {
          if (!selected) return;
          setReplyTo(selected);
          window.setTimeout(() => document.getElementById("chat-input")?.focus(), 20);
        }}
      />
    </div>
  );
}
