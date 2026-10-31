import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  CirclePlay,
  Eye,
  Flame,
  Heart,
  History,
  ImagePlus,
  Lightbulb,
  LoaderCircle,
  Lock,
  PenLine,
  Plus,
  Send,
  Sparkles,
  Sunrise,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage, AuthedVideo } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, timeAgoShort } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { useMediaUrl } from "@/lib/media";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import { CameraCapture } from "@/features/camera/CameraCapture";
import type { EditorDoc } from "@/features/camera/editorTypes";
import type {
  Moment,
  MomentItem,
  MomentPrompt,
  MomentTray,
  TrayMoment,
} from "@/types/api";

const DAY_MS = 6000;
const NO_FILES: File[] = [];

function SoundTrack({ src, muted }: { src: string | null | undefined; muted: boolean }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const media = useMediaUrl(src);
  useEffect(() => {
    const element = audio.current;
    if (!element || !media.src) return;
    element.play().catch(() => undefined);
    return () => element.pause();
  }, [media.src]);
  return (
    <audio
      ref={audio}
      src={media.src ?? undefined}
      loop
      muted={muted}
      className="hidden"
      aria-hidden
    />
  );
}

function MomentFrameArt({ item, onEnded }: { item: MomentItem; onEnded: () => void }) {
  if (item.kind === "image" && item.asset?.content_url) {
    return (
      <AuthedImage
        src={item.asset.content_url}
        alt={item.body || "A moment"}
        className="h-full w-full object-contain"
        loading="eager"
      />
    );
  }
  if (item.kind === "video" && item.asset?.content_url) {
    return (
      <AuthedVideo
        src={item.asset.content_url}
        className="h-full w-full object-contain"
        autoPlay
        playsInline
        muted={item.muted}
        onEnded={onEnded}
      />
    );
  }
  if (item.kind === "vibe" && item.vibe && typeof item.vibe === "object") {
    const vibe = item.vibe as { asset?: { content_url?: string }; body?: string };
    if (vibe.asset?.content_url) {
      return <AuthedVideo src={vibe.asset.content_url} className="h-full w-full object-contain" autoPlay muted onEnded={onEnded} />;
    }
  }
  return (
    <div className="flex h-full w-full items-center justify-center px-8">
      <p className="max-w-2xl whitespace-pre-wrap text-center text-[clamp(1.5rem,5vw,3.4rem)] font-extrabold leading-[1.18] tracking-[-0.04em] text-white drop-shadow-lg">
        {item.body || "A moment with no words."}
      </p>
    </div>
  );
}

interface Frame {
  moment: Moment;
  item: MomentItem;
}

function framesOf(moments: Moment[]): Frame[] {
  return moments.flatMap((moment) => moment.items.map((item) => ({ moment, item })));
}

function MomentViewer({
  moments,
  startId,
  onClose,
  onChanged,
}: {
  moments: Moment[];
  startId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const frames = useMemo(() => framesOf(moments), [moments]);
  const initial = Math.max(
    0,
    frames.findIndex((frame) => frame.moment.id === startId || frame.item.id === startId),
  );
  const [index, setIndex] = useState(initial);
  const [reactions, setReactions] = useState<Record<string, Moment["reactions"]>>(() =>
    Object.fromEntries(moments.map((moment) => [moment.id, moment.reactions])),
  );
  const [replyOpen, setReplyOpen] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [soundMuted, setSoundMuted] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const frame = frames[index];
  const author = frame?.moment.author;

  const go = (next: number) => {
    if (next < 0) return;
    if (next >= frames.length) {
      onClose();
      return;
    }
    setIndex(next);
    setReplyOpen(false);
    setReply("");
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (replyOpen) return;
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, replyOpen, frames.length]);

  useEffect(() => {
    if (!frame) return;
    void api.post(`/moments/items/${frame.item.id}/seen/`, {}).catch(() => undefined);
    if (frames.filter((row) => row.moment.id === frame.moment.id).at(-1)?.item.id === frame.item.id) {
      void api.post(`/moments/${frame.moment.id}/seen/`, {}).catch(() => undefined);
    }
    if (frame.item.kind !== "video" && frame.item.kind !== "vibe") {
      const timer = window.setTimeout(() => go(index + 1), DAY_MS);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);

  if (!frame) {
    return null;
  }

  const reaction = reactions[frame.moment.id] ?? frame.moment.reactions;
  const liked = Boolean(reaction?.mine);
  const mine = frame.moment.mine || author?.id === user?.id;
  const sound = frame.item.sound?.content_url;

  async function react() {
    if (busy) return;
    setBusy(true);
    try {
      const response = await api.post<{ reactions: Moment["reactions"] }>(
        `/moments/${frame.moment.id}/react/`,
        { emoji: liked ? "" : "❤️" },
      );
      setReactions((current) => ({ ...current, [frame.moment.id]: response.reactions }));
    } catch (error) {
      toast({ title: "That reaction did not land", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await api.post(`/moments/${frame.moment.id}/reply/`, { body });
      setReply("");
      setReplyOpen(false);
      toast({ title: "Sent to the convo", tone: "success" });
    } catch (error) {
      toast({ title: "Your reply did not send", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function removeMoment() {
    if (!mine || busy) return;
    setBusy(true);
    try {
      await api.delete(`/moments/${frame.moment.id}/`);
      onChanged();
      toast({ title: "Moment taken down", tone: "success" });
      onClose();
    } catch (error) {
      toast({ title: "Could not take that down", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] bg-[#07070b] text-white" role="dialog" aria-modal="true" aria-label="Moment viewer">
      <div className="absolute inset-0 overflow-hidden">
        {frame.item.kind === "image" && frame.item.asset?.content_url ? (
          <div className="absolute inset-0 scale-105 opacity-40 blur-3xl">
            <AuthedImage src={frame.item.asset.content_url} alt="" className="h-full w-full" />
          </div>
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/70" />
        <div className="relative flex h-full w-full items-center justify-center">
          <div className="h-full max-h-[calc(100dvh-132px)] w-full max-w-[560px] md:my-8 md:h-[calc(100dvh-64px)] md:rounded-[24px] md:border md:border-white/10 md:shadow-2xl">
            <MomentFrameArt item={frame.item} onEnded={() => go(index + 1)} />
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 mx-auto flex max-w-[760px] items-center gap-3 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <Link
          to={author ? `/app/u/${author.username}` : "#"}
          className="pointer-events-auto flex min-w-0 items-center gap-2.5"
          onClick={onClose}
        >
          <Avatar user={author} size={38} />
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-extrabold">
              {frame.moment.credit?.name || author?.name || author?.username}
            </span>
            <span className="block truncate text-[10.5px] text-white/65">
              {timeAgoShort(frame.moment.created_at)}
              {frame.moment.credit ? ` · via ${frame.moment.credit.name}` : ""}
            </span>
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {mine ? (
            <button type="button" className="icon-btn text-white/65 hover:bg-white/10 hover:text-white" onClick={() => void removeMoment()} disabled={busy} aria-label="Take down this moment">
              <Trash2 className="size-4" />
            </button>
          ) : null}
          <button type="button" className="icon-btn text-white/70 hover:bg-white/10 hover:text-white" onClick={onClose} aria-label="Close viewer">
            <X className="size-5" />
          </button>
        </div>
      </div>

      <div className="absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[560px] gap-1 px-3 pt-[max(.4rem,env(safe-area-inset-top))]">
        {frames.map((row, rowIndex) => (
          <span key={`${row.moment.id}-${row.item.id}`} className="h-[2.5px] flex-1 overflow-hidden rounded-full bg-white/25">
            <span
              className={cn(
                "block h-full bg-white transition-[width]",
                rowIndex < index ? "w-full" : rowIndex === index ? "w-full animate-[moment-progress_6s_linear_forwards]" : "w-0",
              )}
              style={rowIndex === index && (frame.item.kind === "video" || frame.item.kind === "vibe") ? { animation: "none", width: "38%" } : undefined}
            />
          </span>
        ))}
      </div>

      <button type="button" className="absolute inset-y-0 left-0 z-[5] w-1/3" onClick={() => go(index - 1)} aria-label="Previous moment" />
      <button type="button" className="absolute inset-y-0 right-0 z-[5] w-1/3" onClick={() => go(index + 1)} aria-label="Next moment" />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 mx-auto max-w-[640px] px-4 pb-[max(1.2rem,env(safe-area-inset-bottom))]">
        {frame.item.body && frame.item.kind !== "note" ? (
          <p className="mb-3 whitespace-pre-wrap text-[13px] leading-5 text-white/90 drop-shadow">{frame.item.body}</p>
        ) : null}
        {frame.moment.prompt ? <p className="mb-2 text-[11px] font-bold text-white/65">{frame.moment.prompt}</p> : null}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void react()}
            disabled={busy}
            className={cn(
              "flex min-h-10 items-center gap-1.5 rounded-full px-3 text-[12px] font-bold backdrop-blur-md transition",
              liked ? "bg-accent text-on-accent" : "bg-white/12 text-white hover:bg-white/20",
            )}
            aria-label={liked ? "Remove heart" : "Heart this moment"}
          >
            <Heart className={cn("size-[18px]", liked && "fill-current")} />
            <span>{count(reaction?.count ?? 0)}</span>
          </button>
          {!mine ? (
            <button
              type="button"
              onClick={() => setReplyOpen((value) => !value)}
              className="flex min-h-10 items-center gap-1.5 rounded-full bg-white/12 px-3 text-[12px] font-bold backdrop-blur-md transition hover:bg-white/20"
            >
              <Send className="size-4" /> Reply
            </button>
          ) : null}
          {typeof frame.moment.viewers === "number" ? (
            <span className="ml-1 inline-flex items-center gap-1 text-[11px] text-white/65">
              <Eye className="size-3.5" /> {count(frame.moment.viewers)}
            </span>
          ) : null}
          <span className="flex-1" />
          <button
            type="button"
            onClick={() => setSoundMuted((value) => !value)}
            className="rounded-full bg-white/12 px-3 py-2 text-[10.5px] font-bold text-white/75 backdrop-blur-md hover:bg-white/20"
            aria-label={soundMuted ? "Unmute moment sound" : "Mute moment sound"}
          >
            {soundMuted ? "Sound off" : "Sound on"}
          </button>
          <button type="button" onClick={() => go(index + 1)} className="rounded-full bg-white/12 p-2.5 text-white/80 hover:bg-white/20" aria-label="Next moment">
            <ArrowRight className="size-4" />
          </button>
        </div>
        {replyOpen ? (
          <form onSubmit={(event) => void sendReply(event)} className="pointer-events-auto mt-2 flex items-center gap-2">
            <input
              autoFocus
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Send a reply to their convo"
              maxLength={2200}
              className="min-h-11 flex-1 rounded-full border border-white/15 bg-black/40 px-4 text-sm text-white outline-none placeholder:text-white/40 focus:border-white/35"
            />
            <button type="submit" className="flex size-11 items-center justify-center rounded-full bg-[var(--nav-ink)] text-[rgb(var(--nav))]" aria-label="Send reply">
              {busy ? <LoaderCircle className="size-4 animate-spin" /> : <Send className="size-4" />}
            </button>
          </form>
        ) : null}
        {mine && frames.filter((row) => row.moment.id === frame.moment.id).length > 1 ? (
          <button type="button" onClick={() => go(index + 1)} className="mt-2 inline-flex items-center gap-1 text-[10px] text-white/55">
            Next picture <ArrowRight className="size-3" />
          </button>
        ) : null}
      </div>
      <button type="button" onClick={() => go(index - 1)} className="absolute left-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white/70 backdrop-blur-md hover:bg-black/45 md:flex" aria-label="Previous">
        <ArrowLeft className="size-4" />
      </button>
      <button type="button" onClick={() => go(index + 1)} className="absolute right-2 top-1/2 z-10 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/25 text-white/70 backdrop-blur-md hover:bg-black/45 md:flex" aria-label="Next">
        <ArrowRight className="size-4" />
      </button>
      {sound ? <SoundTrack src={sound} muted={soundMuted} /> : null}
    </div>,
    document.body,
  );
}

function stillOf(moment: Moment): string | null {
  const first = moment.items?.[0];
  return first?.asset?.thumbnail_url || first?.asset?.content_url || null;
}

function captionOf(moment: Moment): string {
  return moment.items.map((item) => item.body?.trim()).find(Boolean) ?? "";
}

function MineRailCard({
  cover,
  count,
  onOpen,
  onAdd,
}: {
  cover: string | null;
  count: number;
  onOpen: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="w-[86px] shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={count ? `Your moments, ${count} up` : "Add to your moments"}
        >
          <span className="relative block h-[129px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
            {cover ? <AuthedImage src={cover} alt="Your moment" className="h-full w-full" /> : null}
          </span>
          <span className="mt-1.5 block truncate text-[11.5px] text-ink">
            {count ? `${count} up` : "Your moments"}
          </span>
        </button>
        <button
          type="button"
          onClick={onAdd}
          className="absolute right-1 top-[105px] flex size-[22px] items-center justify-center rounded-full border-2 border-card bg-accent text-on-accent"
          aria-label="Add to your moments"
        >
          <Plus className="size-3" />
        </button>
      </div>
    </div>
  );
}

function RailCard({
  row,
  opening,
  onOpen,
}: {
  row: TrayMoment;
  opening: boolean;
  onOpen: () => void;
}) {
  const name = row.author?.name || row.author?.username || "Moment";
  const first = name.split(" ")[0];
  const cover = row.cover?.thumbnail_url || row.cover?.content_url || null;

  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={opening}
      className="w-[86px] shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${first}, ${row.count ?? 1} moments${row.seen ? ", already watched" : ""}`}
    >
      <span
        className={cn(
          "relative block h-[129px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]",
          row.seen && "opacity-45",
        )}
      >
        {cover ? <AuthedImage src={cover} alt={`${first}'s moment`} className="h-full w-full" /> : null}
        <span className="absolute left-1.5 top-1.5 rounded-full bg-card p-[1.5px]">
          <Avatar user={row.author} name={name} size={26} />
        </span>
        {opening ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        ) : null}
      </span>
      <span className={cn("mt-1.5 block truncate text-[11.5px]", row.seen ? "text-dim" : "text-ink")}>{first}</span>
    </button>
  );
}

function MomentRail({
  mine,
  others,
  opening,
  onMine,
  onAdd,
  onOpen,
}: {
  mine: Moment[];
  others: TrayMoment[];
  opening: string | null;
  onMine: () => void;
  onAdd: () => void;
  onOpen: (row: TrayMoment) => void;
}) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-3.5 pb-2 pt-1 md:px-0">
      <MineRailCard cover={mine[0] ? stillOf(mine[0]) : null} count={mine.length} onOpen={onMine} onAdd={onAdd} />
      {others.map((row) => (
        <RailCard key={row.id} row={row} opening={opening === row.id} onOpen={() => onOpen(row)} />
      ))}
    </div>
  );
}

type EditorTool = "filter" | "crop" | "text" | "sticker" | "tag" | "lasso" | "turn" | null;

function MomentComposer({
  open,
  onClose,
  onPosted,
  answering,
  prompt,
  initialFiles = NO_FILES,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  answering?: boolean;
  prompt?: string;
  initialFiles?: File[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editorTool, setEditorTool] = useState<EditorTool>(null);
  const [keepInside, setKeepInside] = useState(true);
  const [editedFiles, setEditedFiles] = useState<Map<number, string>>(new Map());
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setFiles(initialFiles);
      setBody("");
      setBusy(false);
      setEditing(false);
      setEditorTool(null);
      setEditedFiles(new Map());
      return;
    }
    setFiles([]);
    setBody("");
    setBusy(false);
    setEditing(false);
    setEditorTool(null);
    setEditedFiles(new Map());
  }, [open, initialFiles]);

  async function post(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    if (!files.length && !body.trim()) {
      toast({ title: "Put something in the frame", description: "Words, a picture, or a clip.", tone: "info" });
      return;
    }
    if (files.length > 6) {
      toast({ title: "That is more frames than one moment carries", description: "Choose up to six.", tone: "error" });
      return;
    }
    // If there are files and we haven't edited yet, open editor first
    if (files.length && !editing && !editedFiles.size) {
      setEditing(true);
      setEditorTool("filter");
      return;
    }
    setBusy(true);
    try {
      const uploaded = [];
      for (const [index, file] of files.entries()) {
        const fileToUpload = editedFiles.has(index)
          ? await fetch(editedFiles.get(index)!).then(r => r.blob()).then(b => new File([b], file.name, { type: file.type }))
          : file;
        const asset = await uploadAsset(fileToUpload);
        uploaded.push({
          kind: asset.kind,
          asset: asset.id,
          body: index === 0 ? body.trim() : "",
        });
      }
      const items = uploaded.length
        ? uploaded
        : [{ kind: "text", body: body.trim() }];
      await api.post("/moments/", { items, ...(answering ? { prompt: true } : {}) });
      toast({ title: "Your moment is up", tone: "success" });
      onPosted();
      onClose();
    } catch (error) {
      toast({ title: "That moment did not post", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  function closeEditor() {
    setEditing(false);
    setEditorTool(null);
  }

  function applyEdit(dataUrl: string, index: number) {
    setEditedFiles((prev) => {
      const next = new Map(prev);
      next.set(index, dataUrl);
      return next;
    });
  }

  function removeEdit(index: number) {
    setEditedFiles((prev) => {
      const next = new Map(prev);
      next.delete(index);
      return next;
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={answering ? "Answer the day" : "New moment"}
      description={answering ? prompt : "It stays for the day, then it goes."}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] text-dim">{files.length ? `${files.length} of 6 frames` : "Camera, library, or a note"}</span>
          <Button loading={busy} icon={<Plus className="size-4" />} type="submit" form="moment-composer" disabled={editing}>
            Put up
          </Button>
        </div>
      }
    >
      <form id="moment-composer" onSubmit={(event) => void post(event)} className="space-y-4 p-5 relative">
        {prompt && !answering ? (
          <div className="rounded-[13px] border border-[color-mix(in_srgb,var(--accent)_32%,var(--line))] bg-[var(--accent-soft)] px-3.5 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-wide text-accent">The day asks</p>
            <p className="mt-1 text-[13px] font-semibold leading-5">{prompt}</p>
          </div>
        ) : null}
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={2200}
          rows={4}
          autoFocus
          placeholder={files.length ? "Say something under it..." : "Write it in the frame..."}
          className="w-full resize-none rounded-[14px] border border-line bg-paper p-3.5 text-sm leading-6 outline-none transition placeholder:text-dim focus:border-accent"
        />
        {files.length ? (
          <div className="flex flex-wrap gap-2">
            {files.map((file, index) => (
              <span key={`${file.name}-${index}`} className="relative overflow-hidden rounded-[10px] border border-line">
                {editedFiles.has(index) ? (
                  <img src={editedFiles.get(index)} alt="" className="size-16 object-cover" />
                ) : file.type.startsWith("image/") ? (
                  <img src={URL.createObjectURL(file)} alt="" className="size-16 object-cover" />
                ) : (
                  <span className="flex size-16 items-center justify-center bg-paper text-dim"><CirclePlay className="size-5" /></span>
                )}
                {editing && editorTool === "crop" && index === 0 ? (
                  <button
                    type="button"
                    onClick={() => removeEdit(index)}
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/65 text-white"
                    aria-label="Remove crop"
                  >
                    <X className="size-3" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFiles((current) => current.filter((_, row) => row !== index))}
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/65 text-white"
                    aria-label="Remove this file"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </span>
            ))}
            {editing && (
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditorTool("filter")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "filter" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Filter
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("crop")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "crop" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Crop
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("text")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "text" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Text
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("sticker")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "sticker" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Stickers
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("tag")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "tag" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Tag
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("lasso")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "lasso" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Lasso
                </button>
                <button
                  type="button"
                  onClick={() => setEditorTool("turn")}
                  className={cn(
                    "flex-1 px-3 py-1.5 rounded text-[10px] font-bold text-white/70 bg-white/10 hover:bg-white/20 transition",
                    editorTool === "turn" ? "bg-accent text-on-accent" : "",
                  )}
                >
                  Turn
                </button>
              </div>
            )}
            {editorTool === "crop" && files.length ? (
              <div className="mt-2 p-2 rounded bg-dim text-[10px] text-dim">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="crop-mode"
                    checked={keepInside}
                    onChange={() => setKeepInside(true)}
                    className="rounded w-4 h-4 bg-white border border-dim"
                  />
                  Keep inside
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="crop-mode"
                    checked={!keepInside}
                    onChange={() => setKeepInside(false)}
                    className="rounded w-4 h-4 bg-white border border-dim"
                  />
                  Keep outside
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
        {editing ? (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center p-4 z-20">
            {editorTool === "filter" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Filter</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={true}
                      onChange={() => {}}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>None</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={false}
                      onChange={() => {}}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>Vintage</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={false}
                      onChange={() => {}}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>Mono</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="filter"
                      checked={false}
                      onChange={() => {}}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>Vibrant</span>
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim">
                  <button
                    type="button"
                    onClick={() => {
                      applyEdit(URL.createObjectURL(files[0]), 0);
                      closeEditor();
                    }}
                    className="w-full rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="w-full mt-2 px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "crop" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Crop</h3>
                <p className="text-[12px] text-dim mb-4">
                  Adjust the crop area. {"Keep inside is selected: "}{keepInside ? " content stays within " : " content extends beyond "}<span className="font-medium">frame</span>
                </p>
                <div className="space-y-3">
                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] text-dim">Width</span>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={100}
                      onChange={() => {}}
                      className="w-full rounded bg-dim p-1"
                    />
                  </label>
                  <label className="flex flex-col gap-2">
                    <span className="text-[10px] text-dim">Height</span>
                    <input
                      type="range"
                      min="50"
                      max="100"
                      value={100}
                      onChange={() => {}}
                      className="w-full rounded bg-dim p-1"
                    />
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "text" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Text</h3>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Caption</span>
                    <input
                      type="text"
                      placeholder="Add a caption..."
                      className="flex-1 rounded bg-dim px-3 py-2 text-sm outline-none"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Color</span>
                    <div className="h-4 w-8 rounded bg-dim flex items-center justify-center">
                      <span className="text-[10px]" id="text-color-preview">#000</span>
                    </div>
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Font</span>
                    <select
                      className="rounded bg-dim px-3 py-2 text-sm outline-none"
                    >
                      <option>Default</option>
                      <option>Serif</option>
                      <option>Monospace</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "sticker" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Stickers</h3>
                <p className="text-[12px] text-dim mb-4">Add stickers to your moment</p>
                <div className="grid grid-cols-3 gap-2 h-48">
                  <button
                    type="button"
                    key="1"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 1</span>
                  </button>
                  <button
                    type="button"
                    key="2"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 2</span>
                  </button>
                  <button
                    type="button"
                    key="3"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 3</span>
                  </button>
                  <button
                    type="button"
                    key="4"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 4</span>
                  </button>
                  <button
                    type="button"
                    key="5"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 5</span>
                  </button>
                  <button
                    type="button"
                    key="6"
                    className="rounded bg-dim p-2 flex flex-col items-center justify-center hover:bg-white/10 transition"
                  >
                    <span className="text-[10px]">Sticker 6</span>
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "tag" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Tag</h3>
                <p className="text-[12px] text-dim mb-4">Add a location or tag</p>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Tag</span>
                    <input
                      type="text"
                      placeholder="#location or #event"
                      className="flex-1 rounded bg-dim px-3 py-2 text-sm outline-none"
                    />
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "lasso" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Lasso</h3>
                <p className="text-[12px] text-dim mb-4">
                  {keepInside ? "Keep inside" : "Keep outside"} selection
                </p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="lasso-mode"
                      checked={keepInside}
                      onChange={() => setKeepInside(true)}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>Keep inside</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="lasso-mode"
                      checked={!keepInside}
                      onChange={() => setKeepInside(false)}
                      className="rounded w-4 h-4 bg-white border border-dim"
                    />
                    <span>Keep outside</span>
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : editorTool === "turn" && files.length ? (
              <div className="rounded-lg bg-card p-6 max-w-lg w-full">
                <h3 className="text-[14px] font-semibold mb-4">Turn</h3>
                <p className="text-[12px] text-dim mb-4">Rotate and adjust orientation</p>
                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Angle</span>
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      value={0}
                      onChange={() => {}}
                      className="w-24 rounded bg-dim p-1"
                    />
                  </label>
                  <label className="flex items-center gap-2">
                    <span className="text-[10px] text-dim">Flip</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="flex-1 rounded bg-dim p-2 hover:bg-white/10 transition"
                      >
                        <svg
                          className="size-4"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        className="flex-1 rounded bg-dim p-2 hover:bg-white/10 transition"
                      >
                        <svg
                          className="size-4"
                          viewBox="0 0 24 24"
                        >
                          <path d="M12 5v14M5 12h14" />
                        </svg>
                      </button>
                    </div>
                  </label>
                </div>
                <div className="mt-4 pt-4 border-t border-dim flex justify-between">
                  <button
                    type="button"
                    onClick={() => applyEdit(URL.createObjectURL(files[0]), 0)}
                    className="rounded bg-accent px-3 py-2 text-[12px] font-bold text-on-accent"
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    onClick={() => closeEditor()}
                    className="px-3 py-2 rounded bg-white/10 text-white text-[12px] font-bold hover:bg-white/20"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <input
          ref={input}
          type="file"
          accept="image/*,video/*"
          multiple
          className="sr-only"
          onChange={(event) => {
            const next = Array.from(event.target.files ?? []);
            setFiles((current) => [...current, ...next].slice(0, 6));
            event.target.value = "";
          }}
        />
        <div className="flex items-center gap-2">
          <button type="button" className="btn btn-secondary min-h-10 flex-1" onClick={() => input.current?.click()} disabled={files.length >= 6}>
            <ImagePlus className="size-4" /> {files.length ? "Add another" : "Choose from library"}
          </button>
          <button type="button" className="btn btn-secondary min-h-10" onClick={() => setFiles([])} disabled={!files.length}>
            Clear
          </button>
        </div>
        <p className="text-[10px] leading-4 text-dim">
          Pictures and clips are checked before uploading. A moment is shown to the people allowed by your account.
        </p>
      </form>
    </Modal>
  );
}

function todayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function labelForDay(day?: string): string {
  if (!day) return "EARLIER";
  const parsed = new Date(`${day}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return day;
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const gap = Math.round((midnight.getTime() - parsed.getTime()) / 86_400_000);
  if (gap === 1) return "YESTERDAY";
  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  return `${parsed.getDate()} ${months[parsed.getMonth()]}`;
}

function tallyAnswers(count: number, mine: boolean): string {
  if (!mine || count === 0) return `${count} answered`;
  const others = count - 1;
  if (others === 0) return "You answered";
  return `You and ${others} other${others === 1 ? "" : "s"} answered`;
}

function AnswerStrip({ answers, onOpen }: { answers: Moment[]; onOpen: (moment: Moment) => void }) {
  return (
    <div className="mt-3">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {answers.map((answer) => {
          const cover = stillOf(answer);
          const caption = captionOf(answer);
          const name = answer.author.name || answer.author.username;
          return (
            <button
              key={answer.id}
              type="button"
              onClick={() => onOpen(answer)}
              className="relative h-[54px] w-[46px] shrink-0 overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              aria-label={`${name}'s answer`}
            >
              {cover ? (
                <AuthedImage src={cover} alt="" className="h-full w-full" />
              ) : (
                <span className="flex h-full w-full items-center justify-center p-1.5 text-center text-[10px] leading-3 text-dim">
                  {caption || "—"}
                </span>
              )}
              <span className="absolute bottom-0 left-0 rounded-full bg-card p-px">
                <Avatar user={answer.author} size={20} />
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-dim">{tallyAnswers(answers.length, answers.some((answer) => answer.mine))}</p>
    </div>
  );
}

function LockedPanel({ count }: { count: number }) {
  const who = count === 1 ? "1 person has answered" : `${count} people have answered`;
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-[12px] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] px-2.5 py-2">
      <Lock className="size-4 shrink-0 text-accent" />
      <div>
        <p className="text-[13px] font-semibold">{who}</p>
        <p className="text-[12px] text-dim">Answer, and you will see what they said.</p>
      </div>
    </div>
  );
}

function FirstToAnswer() {
  return (
    <div className="mt-3 flex items-center gap-1.5 text-[12.5px] text-dim">
      <Lightbulb className="size-[15px]" /> Be the first to answer
    </div>
  );
}

function TodayCard({
  prompt,
  loading,
  error,
  onAnswer,
  onOpen,
  onBefore,
  onToday,
  onRetry,
}: {
  prompt?: MomentPrompt;
  loading: boolean;
  error: boolean;
  onAnswer: () => void;
  onOpen: (moment: Moment) => void;
  onBefore: (day?: string) => void;
  onToday: () => void;
  onRetry: () => void;
}) {
  const day = prompt?.text?.trim() ? prompt : null;
  const today = !day?.day || day.day === todayKey();
  const answers = day?.answers ?? [];
  const locked = day?.locked ?? ((day?.count ?? 0) > 0 && !day?.answered);
  const before = day?.before;
  const beforeCount = before?.count ?? before?.answers?.length ?? 0;

  return (
    <div className="mt-2 rounded-[18px] border border-[color-mix(in_srgb,var(--accent)_25%,var(--line))] bg-card px-4 pb-3 pt-3.5">
      <div className="flex items-center gap-1.5">
        <Sunrise className="size-[15px] text-accent" />
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent">
          {day == null || today ? "Today's question" : "Earlier"}
        </p>
        {today && typeof day?.streak === "number" && day.streak > 0 ? (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-[3px] text-[12px] font-bold text-accent">
            <Flame className="size-3.5" /> {day.streak}
          </span>
        ) : null}
      </div>

      <p className={cn("mt-2 text-[16.5px] font-semibold leading-[1.3]", day ? "text-ink" : "text-dim")}>
        {day?.text ?? (loading ? "Finding today's question…" : "Today's question could not be reached.")}
      </p>

      {day ? (
        <>
          {answers.length ? (
            <AnswerStrip answers={answers} onOpen={onOpen} />
          ) : locked ? (
            <LockedPanel count={day.count ?? 0} />
          ) : (
            <FirstToAnswer />
          )}

          {today ? (
            <Button size="sm" className="mt-3" onClick={onAnswer}>
              {day.answered ? "Answer again" : "Answer"}
            </Button>
          ) : null}

          {before ? (
            <button
              type="button"
              onClick={() => onBefore(before.day)}
              disabled={!before.day}
              className="mt-2.5 flex w-full items-center gap-2 border-t border-line py-2 text-left transition enabled:hover:text-ink disabled:cursor-default"
            >
              <History className="size-4 shrink-0 text-dim" />
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-dim">{labelForDay(before.day)}</span>
                <span className="mt-0.5 block truncate text-[13px] text-ink">{before.text}</span>
              </span>
              <span className="shrink-0 text-[11.5px] text-dim">
                {beforeCount ? `${beforeCount} answer${beforeCount === 1 ? "" : "s"}` : "nobody"}
              </span>
              <ChevronRight className="size-[18px] shrink-0 text-dim" />
            </button>
          ) : null}

          {!today ? (
            <button
              type="button"
              onClick={onToday}
              className="mt-1 inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-[13px] font-semibold text-accent hover:underline"
            >
              <ArrowLeft className="size-4" /> Today's question
            </button>
          ) : null}
        </>
      ) : error ? (
        <button type="button" onClick={onRetry} className="mt-2 text-[12px] font-bold text-accent hover:underline">
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function MomentsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [viewer, setViewer] = useState<{ moments: Moment[]; startId?: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [compose, setCompose] = useState(false);
  const [answering, setAnswering] = useState(false);
  const [seedFiles, setSeedFiles] = useState<File[]>(NO_FILES);
  const [day, setDay] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [params, setParams] = useSearchParams();
  const mediaInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (params.get("compose") !== "1") return;
    setAnswering(false);
    setSeedFiles(NO_FILES);
    setDay(null);
    setCompose(true);
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("compose");
      return next;
    }, { replace: true });
  }, [params, setParams]);

  const tray = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => api.get<MomentTray>("/moments/tray/"),
  });
  const mine = useQuery({
    queryKey: ["moments-mine"],
    queryFn: () => api.get<{ moments: Moment[]; total?: number; total_views?: number }>("/moments/mine/"),
    select: (data) => data.moments ?? [],
  });
  const prompt = useQuery({
    queryKey: ["moments-prompt", day],
    queryFn: () => api.get<MomentPrompt>(day ? `/moments/prompt/?day=${encodeURIComponent(day)}` : "/moments/prompt/"),
    retry: false,
    staleTime: 60_000,
  });

  const mineMoments = useMemo(() => mine.data ?? [], [mine.data]);
  const others = useMemo(
    () => [...(tray.data?.unseen ?? []), ...(tray.data?.seen ?? [])],
    [tray.data],
  );
  const hasMoments = mineMoments.length > 0 || others.length > 0;

  function openCompose(files: File[] = NO_FILES) {
    if (files.length > 0) {
      setSeedFiles(files);
      setAnswering(false);
      setCompose(true);
    } else {
      // Open camera/gallery picker through CameraCapture which includes full editor
      setCameraOpen(true);
    }
  }

  function openAnswer() {
    setDay(null);
    setSeedFiles(NO_FILES);
    setAnswering(true);
    setCompose(true);
  }

  function closeCompose() {
    setCompose(false);
    setAnswering(false);
    setSeedFiles(NO_FILES);
  }

  function openMediaPicker() {
    // Open camera capture with full editor for moments flow
    setCameraOpen(true);
  }

  function handleMediaReady(file: File, _kind: "image" | "video", _doc: EditorDoc | null) {
    // Add the edited file to seedFiles and open composer
    setSeedFiles((current) => [...current, file].slice(0, 6));
    setAnswering(false);
    setCompose(true);
    setCameraOpen(false);
  }

  function openMine() {
    if (mineMoments.length) {
      setViewer({ moments: mineMoments });
      return;
    }
    openMediaPicker();
  }

  async function openTray(row: TrayMoment) {
    const username = row.author?.username || user?.username;
    if (!username) return;
    if (row.mine && mineMoments.length) {
      setViewer({ moments: mineMoments, startId: row.id });
      return;
    }
    setOpening(row.id);
    try {
      const response = await api.get<{ moments: Moment[] }>(`/moments/users/${username}/`);
      if (!response.moments?.length) {
        toast({ title: "That moment has already gone", tone: "info" });
        void tray.refetch();
        return;
      }
      setViewer({ moments: response.moments, startId: row.id });
    } catch (error) {
      toast({ title: "Could not open that moment", description: errorMessage(error), tone: "error" });
    } finally {
      setOpening(null);
    }
  }

  const momentOpened = useRef("");
  useEffect(() => {
    const id = params.get("moment");
    if (!id || momentOpened.current === id) return;
    momentOpened.current = id;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("moment");
      return next;
    }, { replace: true });
    setOpening(id);
    void api
      .get<{ moment: Moment }>(`/moments/${encodeURIComponent(id)}/`)
      .then(async (response) => {
        if (!response.moment) return;
        const author = response.moment.author?.username;
        if (author) {
          try {
            const day = await api.get<{ moments: Moment[] }>(
              `/moments/users/${encodeURIComponent(author)}/`,
            );
            if (day.moments?.length) {
              setViewer({ moments: day.moments, startId: id });
              return;
            }
          } catch {
            // The one moment is still a real answer when the day is not.
          }
        }
        setViewer({ moments: [response.moment], startId: id });
      })
      .catch((error) => {
        toast({ title: "That moment is not there any more", description: errorMessage(error), tone: "error" });
      })
      .finally(() => setOpening(null));
  }, [params, setParams, toast]);

  const deepOpened = useRef("");
  useEffect(() => {
    const username = params.get("user");
    if (!username || deepOpened.current === username) return;
    deepOpened.current = username;
    setParams((current) => {
      const next = new URLSearchParams(current);
      next.delete("user");
      return next;
    }, { replace: true });
    const row = others.find((item) => item.author?.username === username);
    if (row?.mine && mineMoments.length) {
      setViewer({ moments: mineMoments, startId: row.id });
      return;
    }
    setOpening(username);
    void api
      .get<{ moments: Moment[] }>(`/moments/users/${encodeURIComponent(username)}/`)
      .then((response) => {
        if (response.moments?.length) setViewer({ moments: response.moments, startId: row?.id });
        else toast({ title: "Nothing is up right now", tone: "info" });
      })
      .catch((error) => {
        toast({ title: "Could not open those moments", description: errorMessage(error), tone: "error" });
      })
      .finally(() => setOpening(null));
  }, [params, setParams, others, mineMoments, toast]);

  function openAnswerMoment(moment: Moment) {
    setViewer({ moments: [moment], startId: moment.id });
  }

  function refreshMoments() {
    void queryClient.invalidateQueries({ queryKey: ["moments-tray"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-prompt"] });
  }

  function afterPosted() {
    setDay(null);
    refreshMoments();
  }

  return (
    <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <input
        ref={mediaInput}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(event) => {
          const next = Array.from(event.target.files ?? []);
          event.target.value = "";
          if (next.length) openCompose(next);
        }}
      />

      <PageHeader
        title="Moments"
        actions={
          <>
            <button type="button" className="icon-btn" onClick={() => openCompose()} title="Write a note" aria-label="Write a note">
              <PenLine className="size-[18px]" />
            </button>
            <button type="button" className="icon-btn" onClick={openMediaPicker} title="Add to your moments" aria-label="Add to your moments">
              <ImagePlus className="size-[18px]" />
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[760px] px-3 pt-1.5 sm:px-4 md:px-7">
        {tray.isLoading && !mineMoments.length && !others.length ? (
          <div className="no-scrollbar flex gap-3 overflow-hidden px-3.5 py-1 md:px-0" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="w-[86px] shrink-0">
                <div className="skeleton h-[129px] rounded-[14px]" />
                <div className="skeleton mt-1.5 h-2.5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <MomentRail
            mine={mineMoments}
            others={others}
            opening={opening}
            onMine={openMine}
            onAdd={openMediaPicker}
            onOpen={(row) => void openTray(row)}
          />
        )}

        <TodayCard
          prompt={prompt.data}
          loading={prompt.isLoading}
          error={prompt.isError}
          onAnswer={openAnswer}
          onOpen={openAnswerMoment}
          onBefore={(next) => {
            if (next) setDay(next);
          }}
          onToday={() => setDay(null)}
          onRetry={() => void prompt.refetch()}
        />

        {!hasMoments && !prompt.data && !prompt.isLoading ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title={prompt.isError ? "No answer from the server" : "Nothing up right now"}
            body={
              prompt.isError
                ? "Your moments could not be reached. Try again in a moment."
                : "What your people put up today turns up here, and is gone tomorrow. Put something up with the card at the top."
            }
            action={
              prompt.isError ? (
                <Button size="sm" variant="secondary" onClick={() => void prompt.refetch()}>
                  Try again
                </Button>
              ) : undefined
            }
            className="py-12"
          />
        ) : null}
      </div>

      <MomentComposer
        open={compose}
        onClose={closeCompose}
        onPosted={afterPosted}
        answering={answering}
        prompt={answering ? prompt.data?.text || prompt.data?.prompt : undefined}
        initialFiles={seedFiles}
      />

      {viewer ? (
        <MomentViewer
          moments={viewer.moments}
          startId={viewer.startId}
          onClose={() => setViewer(null)}
          onChanged={refreshMoments}
        />
      ) : null}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onMediaReady={handleMediaReady}
      />
    </div>
  );
}
